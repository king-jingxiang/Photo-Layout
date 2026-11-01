import type { Frame, PhotoMeta, SnapLine } from '../types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

export const deg2rad = (deg: number): number => (deg * Math.PI) / 180;

export function rotatePoint(p: Point, center: Point, deg: number): Point {
  const a = deg2rad(deg);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function frameCenter(frame: Frame): Point {
  return { x: frame.x + frame.w / 2, y: frame.y + frame.h / 2 };
}

/** 页面坐标 → 画框本地坐标（以画框中心为原点） */
export function pageToLocal(frame: Frame, p: Point): Point {
  const c = frameCenter(frame);
  const r = rotatePoint(p, c, -frame.rotation);
  return { x: r.x - c.x, y: r.y - c.y };
}

/** 画框本地坐标（中心为原点） → 页面坐标 */
export function localToPage(frame: Frame, p: Point): Point {
  const c = frameCenter(frame);
  return rotatePoint({ x: p.x + c.x, y: p.y + c.y }, c, frame.rotation);
}

export function hitTestFrame(frame: Frame, pagePoint: Point): boolean {
  const local = pageToLocal(frame, pagePoint);
  return Math.abs(local.x) <= frame.w / 2 && Math.abs(local.y) <= frame.h / 2;
}

/** 旋转画框在页面上的轴对齐包围盒 */
export function frameAABB(frame: Frame): Rect {
  const c = frameCenter(frame);
  const a = deg2rad(frame.rotation);
  const cos = Math.abs(Math.cos(a));
  const sin = Math.abs(Math.sin(a));
  const w = frame.w * cos + frame.h * sin;
  const h = frame.w * sin + frame.h * cos;
  return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

export interface CropRectPx {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** cover 模式下根据焦点与缩放计算源图裁切区域 */
export function coverCrop(
  imgW: number,
  imgH: number,
  destW: number,
  destH: number,
  zoom: number,
  focusX: number,
  focusY: number,
): CropRectPx {
  if (destW <= 0 || destH <= 0) return { sx: 0, sy: 0, sw: imgW, sh: imgH };
  const destAspect = destW / destH;
  const srcAspect = imgW / imgH;
  let baseW: number;
  let baseH: number;
  if (srcAspect > destAspect) {
    baseH = imgH;
    baseW = imgH * destAspect;
  } else {
    baseW = imgW;
    baseH = imgW / destAspect;
  }
  const z = Math.max(1, zoom);
  const sw = Math.max(1, baseW / z);
  const sh = Math.max(1, baseH / z);
  const cx = clamp(focusX * imgW, sw / 2, imgW - sw / 2);
  const cy = clamp(focusY * imgH, sh / 2, imgH - sh / 2);
  return { sx: cx - sw / 2, sy: cy - sh / 2, sw, sh };
}

/** 画框内部可用照片区域（sss = 卡纸留边后），页面本地坐标，中心为原点 */
export function innerPhotoRect(frame: Frame): Rect {
  const left = -frame.w / 2 + frame.matteMm;
  const top = -frame.h / 2 + frame.matteMm;
  const right = frame.w / 2 - frame.matteMm;
  const bottom = frame.h / 2 - frame.matteMm - frame.matteBottomMm;
  let w = right - left;
  let h = bottom - top;
  if (w < 2 || h < 2) {
    w = frame.w;
    h = frame.h;
    return { x: -w / 2, y: -h / 2, w, h };
  }
  return { x: left, y: top, w, h };
}

/** contain 模式下图片在画框内的居中矩形（单位 mm，本地坐标） */
export function containRect(
  imgW: number,
  imgH: number,
  inner: Rect,
): Rect {
  const imgAspect = imgW / imgH;
  const boxAspect = inner.w / inner.h;
  let w = inner.w;
  let h = inner.h;
  if (imgAspect > boxAspect) {
    h = inner.w / imgAspect;
  } else {
    w = inner.h * imgAspect;
  }
  return {
    x: inner.x + (inner.w - w) / 2,
    y: inner.y + (inner.h - h) / 2,
    w,
    h,
  };
}

export function unionRect(rects: Rect[]): Rect {
  if (!rects.length) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * 移动吸附：把画框移动到接近页面/页边距/其他画框的边缘或中线。
 * 返回修正后的左上角坐标以及需要绘制的参考线。
 */
export function snapMove(
  rect: Rect,
  targets: Array<{ rect: Rect; kind: SnapLine['kind'] }>,
  threshold: number,
): { x: number; y: number; lines: SnapLine[] } {
  const lines: SnapLine[] = [];
  let bestX: { delta: number; value: number; kind: SnapLine['kind'] } | null = null;
  let bestY: { delta: number; value: number; kind: SnapLine['kind'] } | null = null;

  const candidateX = (target: Rect) => [
    target.x - rect.x,
    target.x + target.w - (rect.x + rect.w),
    target.x + target.w / 2 - (rect.x + rect.w / 2),
    target.x - (rect.x + rect.w),
    target.x + target.w - rect.x,
  ];
  const candidateY = (target: Rect) => [
    target.y - rect.y,
    target.y + target.h - (rect.y + rect.h),
    target.y + target.h / 2 - (rect.y + rect.h / 2),
    target.y - (rect.y + rect.h),
    target.y + target.h - rect.y,
  ];

  const xLines = (t: Rect) => [t.x, t.x + t.w, t.x + t.w / 2];
  const yLines = (t: Rect) => [t.y, t.y + t.h, t.y + t.h / 2];

  for (const target of targets) {
    const xs = candidateX(target.rect);
    const xl = xLines(target.rect);
    for (let i = 0; i < xs.length; i += 1) {
      const delta = xs[i];
      if (Math.abs(delta) <= threshold && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) {
        bestX = { delta, value: xl[i] ?? xl[0], kind: target.kind };
      }
    }
    const ys = candidateY(target.rect);
    const yl = yLines(target.rect);
    for (let i = 0; i < ys.length; i += 1) {
      const delta = ys[i];
      if (Math.abs(delta) <= threshold && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) {
        bestY = { delta, value: yl[i] ?? yl[0], kind: target.kind };
      }
    }
  }

  if (bestX) {
    lines.push({ axis: 'x', value: bestX.value, kind: bestX.kind });
  }
  if (bestY) {
    lines.push({ axis: 'y', value: bestY.value, kind: bestY.kind });
  }
  return {
    x: rect.x + (bestX ? bestX.delta : 0),
    y: rect.y + (bestY ? bestY.delta : 0),
    lines,
  };
}

/** 打印有效 DPI：源像素 / 打印尺寸（英寸） */
export function effectiveDpi(photo: PhotoMeta, frame: Frame): number {
  const inner = innerPhotoRect(frame);
  const printedWidthIn = inner.w / 25.4;
  const printedHeightIn = inner.h / 25.4;
  if (printedWidthIn <= 0 || printedHeightIn <= 0) return 0;
  const dpiX = photo.width / printedWidthIn;
  const dpiY = photo.height / printedHeightIn;
  // 按裁切模式估算实际取用的像素宽度
  const aspectFrame = inner.w / inner.h;
  const aspectPhoto = photo.width / photo.height;
  if (aspectPhoto > aspectFrame) {
    return dpiY;
  }
  return aspectPhoto < aspectFrame ? dpiX : Math.min(dpiX, dpiY);
}

export function mmToInch(mm: number): number {
  return mm / 25.4;
}

export function formatNumber(v: number, digits = 1): string {
  const f = 10 ** digits;
  return String(Math.round(v * f) / f);
}
