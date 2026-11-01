import type { Frame, Page, PhotoMeta } from '../types';
import {
  defaultOrientationOf,
  findPreset,
  pageSizeFromPreset,
} from '../data/papers';
import { clamp, coverCrop, type Rect } from './geometry';

export function uid(prefix = 'id'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

export function defaultPage(
  presetId = 'a4',
  orientation?: 'portrait' | 'landscape',
): Page {
  const preset = findPreset(presetId) ?? findPreset('a4')!;
  const dir = orientation ?? defaultOrientationOf(preset);
  const { widthMm, heightMm } = pageSizeFromPreset(preset, dir);
  return {
    id: uid('page'),
    presetId: preset.id,
    widthMm,
    heightMm,
    orientation: dir,
    marginMm: preset.group === 'paper' ? 6 : 0,
    gapMm: 2,
    background: '#ffffff',
    cutLines: false,
    items: [],
  };
}

export function createFrame(photoId: string, rect: Rect, patch: Partial<Frame> = {}): Frame {
  return {
    id: uid('frame'),
    photoId,
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    rotation: 0,
    mask: 'rect',
    radiusMm: 2,
    fill: 'cover',
    zoom: 1,
    focusX: 0.5,
    focusY: 0.5,
    matteMm: 0,
    matteBottomMm: 0,
    matteColor: '#ffffff',
    borderMm: 0,
    borderColor: '#ffffff',
    shadow: false,
    opacity: 1,
    locked: false,
    ...patch,
  };
}

/** 页面内容区（扣除页边距） */
export function contentRect(page: Page, marginOverride?: number): Rect {
  const m = marginOverride ?? page.marginMm;
  return {
    x: m,
    y: m,
    w: Math.max(10, page.widthMm - m * 2),
    h: Math.max(10, page.heightMm - m * 2),
  };
}

export function pageAspect(page: Page): number {
  return page.widthMm / page.heightMm;
}

export function photoAspect(photo: PhotoMeta): number {
  return photo.width / photo.height;
}

function averageAspect(photos: PhotoMeta[]): number {
  if (!photos.length) return 1.4;
  const sorted = photos.map(photoAspect).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 1.4;
}

function cyclePhotos(photos: PhotoMeta[], count: number): PhotoMeta[] {
  if (!photos.length) return [];
  const result: PhotoMeta[] = [];
  for (let i = 0; i < count; i += 1) result.push(photos[i % photos.length]);
  return result;
}

/** 自动等格排版：根据纸张比例与照片比例选择最佳行列 */
export function layoutGrid(page: Page, photos: PhotoMeta[]): Frame[] {
  if (!photos.length) return [];
  const area = contentRect(page);
  const gap = clamp(page.gapMm, 0, Math.min(area.w, area.h) / 2);
  const n = photos.length;
  const avg = averageAspect(photos);

  let best: { cols: number; rows: number; score: number } | null = null;
  for (let cols = 1; cols <= n; cols += 1) {
    const rows = Math.ceil(n / cols);
    const cellW = (area.w - gap * (cols - 1)) / cols;
    const cellH = (area.h - gap * (rows - 1)) / rows;
    if (cellW < 12 || cellH < 12) continue;
    const coverage = (n * cellW * cellH) / (area.w * area.h);
    const cellAspect = cellW / cellH;
    const aspectPenalty = Math.abs(Math.log(cellAspect / avg));
    const emptyPenalty = (cols * rows - n) * 0.3;
    const score = coverage * 10 - aspectPenalty * 1.1 - emptyPenalty;
    if (!best || score > best.score) best = { cols, rows, score };
  }
  if (!best) best = { cols: Math.ceil(Math.sqrt(n)), rows: Math.ceil(n / Math.ceil(Math.sqrt(n))), score: 0 };

  const { cols, rows } = best;
  const cellW = (area.w - gap * (cols - 1)) / cols;
  const cellH = (area.h - gap * (rows - 1)) / rows;

  return photos.map((photo, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const rowCount = Math.min(cols, n - row * cols);
    const rowOffset = ((cols - rowCount) * (cellW + gap)) / 2;
    const rect = {
      x: area.x + rowOffset + col * (cellW + gap),
      y: area.y + row * (cellH + gap),
      w: cellW,
      h: cellH,
    };
    return createFrame(photo.id, rect);
  });
}

interface ShelfRow {
  items: Array<{ photo: PhotoMeta; w: number; h: number }>;
  width: number;
  height: number;
}

interface ShelfResult {
  rows: ShelfRow[];
  totalHeight: number;
}

/** 固定高度、自动换行的货架式排布 */
function shelfPack(
  photos: PhotoMeta[],
  areaW: number,
  areaH: number,
  gap: number,
  targetH: number,
): ShelfResult {
  const rows: ShelfRow[] = [];
  let row: ShelfRow = { items: [], width: 0, height: 0 };
  for (const photo of photos) {
    const aspect = photoAspect(photo);
    let h = targetH;
    let w = targetH * aspect;
    if (w > areaW) {
      w = areaW;
      h = areaW / aspect;
    }
    const needed = row.items.length ? row.width + gap + w : w;
    if (row.items.length && needed > areaW + 0.001) {
      rows.push(row);
      row = { items: [], width: 0, height: 0 };
    }
    row.items.push({ photo, w, h });
    row.width = row.items.length === 1 ? w : row.width + gap + w;
    row.height = Math.max(row.height, h);
  }
  if (row.items.length) rows.push(row);
  const totalHeight =
    rows.reduce((sum, r) => sum + r.height, 0) + gap * Math.max(0, rows.length - 1);
  return { rows, totalHeight };
}

/**
 * 等比例联系表排版：所有照片保持原始比例，不裁切，按行居中。
 * 通过二分查找最大化照片高度。
 */
export function layoutContactSheet(page: Page, photos: PhotoMeta[]): Frame[] {
  if (!photos.length) return [];
  const area = contentRect(page);
  const gap = clamp(page.gapMm, 0, 20);
  if (area.w < 20 || area.h < 20) return [];
  let lo = 5;
  let hi = area.h;
  let best: ShelfResult | null = null;
  for (let i = 0; i < 32; i += 1) {
    const mid = (lo + hi) / 2;
    const result = shelfPack(photos, area.w, area.h, gap, mid);
    if (result.totalHeight <= area.h) {
      best = result;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  if (!best) return [];
  const top = area.y + (area.h - best.totalHeight) / 2;
  const frames: Frame[] = [];
  let y = top;
  for (const row of best.rows) {
    let x = area.x + (area.w - row.width) / 2;
    for (const item of row.items) {
      frames.push(
        createFrame(item.photo.id, {
          x,
          y: y + (row.height - item.h) / 2,
          w: item.w,
          h: item.h,
        }),
      );
      x += item.w + gap;
    }
    y += row.height + gap;
  }
  return frames;
}

export interface MosaicCell {
  c: number;
  r: number;
  cs: number;
  rs: number;
}

export interface MosaicDef {
  cols: number;
  rows: number;
  cells: MosaicCell[];
}

export function layoutMosaic(page: Page, photos: PhotoMeta[], def: MosaicDef): Frame[] {
  if (!photos.length) return [];
  const area = contentRect(page);
  const gap = clamp(page.gapMm, 0, 10);
  const cellW = (area.w - gap * (def.cols - 1)) / def.cols;
  const cellH = (area.h - gap * (def.rows - 1)) / def.rows;
  return def.cells.map((cell, index) => {
    const rect = {
      x: area.x + cell.c * (cellW + gap),
      y: area.y + cell.r * (cellH + gap),
      w: cellW * cell.cs + gap * (cell.cs - 1),
      h: cellH * cell.rs + gap * (cell.rs - 1),
    };
    return createFrame(photos[index % photos.length].id, rect);
  });
}

/** 拍立得白框：四周留白、底部大留白 */
export function layoutPolaroid(page: Page, photo: PhotoMeta, single = true): Frame[] {
  const area = contentRect(page);
  const base = Math.min(area.w, area.h);
  const matte = base * 0.055;
  const bottom = matte * 3.4;
  const rect = {
    x: area.x + area.w * 0.07,
    y: area.y + area.h * 0.05,
    w: area.w * 0.86,
    h: area.h * 0.9,
  };
  const safeBottom = Math.min(bottom, rect.h / 2.4);
  return [
    createFrame(photo.id, rect, {
      matteMm: matte,
      matteBottomMm: safeBottom,
      matteColor: '#ffffff',
      shadow: true,
      fill: 'cover',
    }),
  ];
}

/** 四连拍照片条 */
export function layoutStrip(page: Page, photos: PhotoMeta[]): Frame[] {
  if (!photos.length) return [];
  const area = contentRect(page);
  const gap = clamp(page.gapMm, 0, 8);
  const slots = 4;
  const h = (area.h - gap * (slots - 1)) / slots;
  const list = cyclePhotos(photos, slots);
  return list.map((photo, i) =>
    createFrame(photo.id, {
      x: area.x,
      y: area.y + i * (h + gap),
      w: area.w,
      h,
    }),
  );
}

/** 证件照排版：同一张照片按固定尺寸重复，带裁切线 */
export function layoutIdSheet(
  page: Page,
  photo: PhotoMeta,
  cellW: number,
  cellH: number,
): Frame[] {
  const area = contentRect(page);
  const gap = clamp(page.gapMm || 2, 1, 6);
  const cols = Math.floor((area.w + gap) / (cellW + gap));
  const rows = Math.floor((area.h + gap) / (cellH + gap));
  if (cols < 1 || rows < 1) return [];
  const count = Math.min(cols * rows, 40);
  const totalW = cols * cellW + gap * (cols - 1);
  const totalH = rows * cellH + gap * (rows - 1);
  const startX = area.x + (area.w - totalW) / 2;
  const startY = area.y + (area.h - totalH) / 2;
  const frames: Frame[] = [];
  for (let i = 0; i < count; i += 1) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    frames.push(
      createFrame(photo.id, {
        x: startX + c * (cellW + gap),
        y: startY + r * (cellH + gap),
        w: cellW,
        h: cellH,
      }),
    );
  }
  return frames;
}

/** 满版单图 */
export function layoutFull(page: Page, photo: PhotoMeta): Frame[] {
  const area = contentRect(page);
  return [createFrame(photo.id, area)];
}

/** 裁切拼接：一张照片切成网格，可拆下重组 */
export function layoutSplit(
  page: Page,
  photo: PhotoMeta,
  cols: number,
  rows: number,
): Frame[] {
  const area = contentRect(page);
  const gap = clamp(page.gapMm, 0, 8);
  const cellW = (area.w - gap * (cols - 1)) / cols;
  const cellH = (area.h - gap * (rows - 1)) / rows;
  const baseCrop = coverCrop(
    photo.width,
    photo.height,
    area.w,
    area.h,
    1,
    0.5,
    0.5,
  );
  const frames: Frame[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      frames.push(
        createFrame(
          photo.id,
          {
            x: area.x + c * (cellW + gap),
            y: area.y + r * (cellH + gap),
            w: cellW,
            h: cellH,
          },
          {
            crop: {
              x: (baseCrop.sx + (baseCrop.sw * c) / cols) / photo.width,
              y: (baseCrop.sy + (baseCrop.sh * r) / rows) / photo.height,
              w: (baseCrop.sw / cols) / photo.width,
              h: (baseCrop.sh / rows) / photo.height,
            },
          },
        ),
      );
    }
  }
  return frames;
}

/** 错位切片：一张照片切成竖条并上下错位，形成艺术拼贴 */
export function layoutSliced(page: Page, photo: PhotoMeta, slices = 5): Frame[] {
  const area = contentRect(page);
  const gap = clamp(page.gapMm / 2, 0, 3);
  const stripW = (area.w - gap * (slices - 1)) / slices;
  const baseCrop = coverCrop(
    photo.width,
    photo.height,
    area.w,
    area.h,
    1,
    0.5,
    0.5,
  );
  const srcAspect = photo.width / photo.height;
  const frames: Frame[] = [];
  const heightPattern = [0.78, 0.94, 0.72, 0.9, 0.8, 0.88, 0.74, 0.92, 0.8];
  for (let i = 0; i < slices; i += 1) {
    const factor = heightPattern[i % heightPattern.length];
    const h = area.h * factor;
    const y = area.y + (i % 2 === 0 ? area.h * 0.03 : area.h - h - area.h * 0.03);
    const cropW = baseCrop.sw / slices / photo.width;
    const desiredAspect = stripW / h;
    const cropH = clamp(
      (cropW * srcAspect) / desiredAspect,
      Math.min(cropW, 0.02),
      baseCrop.sh / photo.height,
    );
    const baseY = baseCrop.sy / photo.height;
    const baseH = baseCrop.sh / photo.height;
    const stagger = clamp(0.5 + (i % 3 - 1) * 0.18, 0, 1);
    const cropY = baseY + clamp((baseH - cropH) * stagger, 0, baseH - cropH);
    frames.push(
      createFrame(
        photo.id,
        {
          x: area.x + i * (stripW + gap),
          y,
          w: stripW,
          h,
        },
        {
          crop: {
            x: (baseCrop.sx / photo.width) + (baseCrop.sw / photo.width) * (i / slices),
            y: cropY,
            w: cropW,
            h: cropH,
          },
        },
      ),
    );
  }
  return frames;
}

/** 心形剪影 */
export function layoutHeart(page: Page, photo: PhotoMeta): Frame[] {
  const area = contentRect(page);
  const size = Math.min(area.w, area.h) * 0.86;
  return [
    createFrame(
      photo.id,
      {
        x: area.x + (area.w - size) / 2,
        y: area.y + (area.h - size) / 2,
        w: size,
        h: size * 0.92,
      },
      { mask: 'heart', shadow: true },
    ),
  ];
}

/** 圆形三连 */
export function layoutCircles(page: Page, photos: PhotoMeta[]): Frame[] {
  if (!photos.length) return [];
  const area = contentRect(page);
  const gap = clamp(page.gapMm, 0, 12);
  const d = Math.min(area.w / 3 - gap, area.h * 0.9);
  const list = cyclePhotos(photos, 3);
  const totalW = d * 3 + gap * 2;
  const startX = area.x + (area.w - totalW) / 2;
  return list.map((photo, i) =>
    createFrame(
      photo.id,
      {
        x: startX + i * (d + gap),
        y: area.y + (area.h - d) / 2,
        w: d,
        h: d,
      },
      { mask: 'circle' },
    ),
  );
}

/** 分页海报：一张照片切成多张纸，导出后拼接 */
export function buildPosterTiles(
  page: Page,
  photo: PhotoMeta,
  cols: number,
  rows: number,
): Page[] {
  const baseCrop = coverCrop(
    photo.width,
    photo.height,
    page.widthMm * cols,
    page.heightMm * rows,
    1,
    0.5,
    0.5,
  );
  const total = cols * rows;
  const pages: Page[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const index = r * cols + c;
      const tile = createFrame(
        photo.id,
        { x: 0, y: 0, w: page.widthMm, h: page.heightMm },
        {
          crop: {
            x: (baseCrop.sx + (baseCrop.sw / cols) * c) / photo.width,
            y: (baseCrop.sy + (baseCrop.sh / rows) * r) / photo.height,
            w: baseCrop.sw / cols / photo.width,
            h: baseCrop.sh / rows / photo.height,
          },
        },
      );
      pages.push({
        ...page,
        id: uid('page'),
        marginMm: 0,
        gapMm: 0,
        cutLines: false,
        items: [tile],
        note: `分页海报 ${index + 1}/${total}（${c + 1}列 ${r + 1}行）`,
      });
    }
  }
  return pages;
}

export const MOSAIC_DEFS: Record<string, MosaicDef> = {
  'mosaic-four': {
    cols: 2,
    rows: 2,
    cells: [
      { c: 0, r: 0, cs: 1, rs: 1 },
      { c: 1, r: 0, cs: 1, rs: 1 },
      { c: 0, r: 1, cs: 1, rs: 1 },
      { c: 1, r: 1, cs: 1, rs: 1 },
    ],
  },
  'mosaic-nine': {
    cols: 3,
    rows: 3,
    cells: Array.from({ length: 9 }, (_, i) => ({
      c: i % 3,
      r: Math.floor(i / 3),
      cs: 1,
      rs: 1,
    })),
  },
  'mosaic-1big3': {
    cols: 2,
    rows: 3,
    cells: [
      { c: 0, r: 0, cs: 1, rs: 3 },
      { c: 1, r: 0, cs: 1, rs: 1 },
      { c: 1, r: 1, cs: 1, rs: 1 },
      { c: 1, r: 2, cs: 1, rs: 1 },
    ],
  },
  'mosaic-top2': {
    cols: 2,
    rows: 3,
    cells: [
      { c: 0, r: 0, cs: 2, rs: 2 },
      { c: 0, r: 2, cs: 1, rs: 1 },
      { c: 1, r: 2, cs: 1, rs: 1 },
    ],
  },
  'mosaic-five': {
    cols: 3,
    rows: 3,
    cells: [
      { c: 0, r: 0, cs: 2, rs: 2 },
      { c: 2, r: 0, cs: 1, rs: 1 },
      { c: 2, r: 1, cs: 1, rs: 1 },
      { c: 0, r: 2, cs: 2, rs: 1 },
      { c: 2, r: 2, cs: 1, rs: 1 },
    ],
  },
  'mosaic-triptych': {
    cols: 3,
    rows: 1,
    cells: [
      { c: 0, r: 0, cs: 1, rs: 1 },
      { c: 1, r: 0, cs: 1, rs: 1 },
      { c: 2, r: 0, cs: 1, rs: 1 },
    ],
  },
  'mosaic-diptych': {
    cols: 2,
    rows: 1,
    cells: [
      { c: 0, r: 0, cs: 1, rs: 1 },
      { c: 1, r: 0, cs: 1, rs: 1 },
    ],
  },
};
