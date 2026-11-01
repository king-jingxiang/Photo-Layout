import type { PaperPreset, PaperGroup } from '../types';

/**
 * 常用打印纸张尺寸（单位 mm）。
 * 短边 / 长边按「较短边优先」记录，实际页面通过 orientation 决定横竖。
 * 数据来源：ISO 216、ANSI、常见相纸 / 明信片 / 证件卡标准尺寸。
 */
export const PAPER_PRESETS: PaperPreset[] = [
  // ISO A 系列
  { id: 'a3', name: 'A3', group: 'paper', shortMm: 297, longMm: 420, note: '29.7 × 42 cm' },
  { id: 'a4', name: 'A4', group: 'paper', shortMm: 210, longMm: 297, note: '21 × 29.7 cm' },
  { id: 'a5', name: 'A5', group: 'paper', shortMm: 148, longMm: 210, note: '14.8 × 21 cm' },
  { id: 'a6', name: 'A6', group: 'paper', shortMm: 105, longMm: 148, note: '10.5 × 14.8 cm' },
  { id: 'a2', name: 'A2', group: 'paper', shortMm: 420, longMm: 594, note: '42 × 59.4 cm' },
  { id: 'b5', name: 'B5', group: 'paper', shortMm: 176, longMm: 250, note: '17.6 × 25 cm' },

  // 美式纸张
  { id: 'letter', name: 'Letter', group: 'paper', shortMm: 215.9, longMm: 279.4, note: '8.5 × 11 in' },
  { id: 'legal', name: 'Legal', group: 'paper', shortMm: 215.9, longMm: 355.6, note: '8.5 × 14 in' },
  { id: 'tabloid', name: 'Tabloid', group: 'paper', shortMm: 279.4, longMm: 431.8, note: '11 × 17 in' },
  { id: 'half-letter', name: 'Half Letter', group: 'paper', shortMm: 139.7, longMm: 215.9, note: '5.5 × 8.5 in' },

  // 常见相纸（R 尺寸）
  { id: 'photo-3r', name: '3R 相纸', group: 'photo', shortMm: 89, longMm: 127, note: '3.5 × 5 in · 5 寸' },
  { id: 'photo-4r', name: '4R 相纸', group: 'photo', shortMm: 102, longMm: 152, note: '4 × 6 in · 6 寸' },
  { id: 'photo-5r', name: '5R 相纸', group: 'photo', shortMm: 127, longMm: 178, note: '5 × 7 in · 7 寸' },
  { id: 'photo-6r', name: '6R 相纸', group: 'photo', shortMm: 152, longMm: 203, note: '6 × 8 in · 8 寸' },
  { id: 'photo-8r', name: '8R 相纸', group: 'photo', shortMm: 203, longMm: 254, note: '8 × 10 in · 10 寸' },
  { id: 'photo-10r', name: '10R 相纸', group: 'photo', shortMm: 254, longMm: 305, note: '10 × 12 in · 12 寸' },
  { id: 'photo-square-5', name: '方形 5 × 5 in', group: 'photo', shortMm: 127, longMm: 127 },
  { id: 'photo-square-6', name: '方形 6 × 6 in', group: 'photo', shortMm: 152, longMm: 152 },
  { id: 'photo-square-8', name: '方形 8 × 8 in', group: 'photo', shortMm: 203, longMm: 203 },
  { id: 'photo-wallet', name: '钱包照 2.5 × 3.5 in', group: 'photo', shortMm: 63.5, longMm: 88.9 },
  { id: 'photo-panorama', name: '全景 4 × 12 in', group: 'photo', shortMm: 102, longMm: 305, defaultOrientation: 'landscape' },

  // 明信片
  { id: 'postcard-cn', name: '中国明信片', group: 'postcard', shortMm: 100, longMm: 148, note: '100 × 148 mm' },
  { id: 'postcard-4x6', name: '照片明信片 4 × 6 in', group: 'postcard', shortMm: 102, longMm: 152 },
  { id: 'postcard-5x7', name: '大号明信片 5 × 7 in', group: 'postcard', shortMm: 127, longMm: 178 },
  { id: 'postcard-a6', name: 'A6 明信片', group: 'postcard', shortMm: 105, longMm: 148 },

  // 证件卡 / 名片
  {
    id: 'card-cr80',
    name: 'CR80 证件卡',
    group: 'card',
    shortMm: 54,
    longMm: 85.6,
    defaultOrientation: 'landscape',
    note: '85.6 × 54 mm · 身份证 / 银行卡',
  },
  {
    id: 'card-id-cn',
    name: '身份证',
    group: 'card',
    shortMm: 54,
    longMm: 85.6,
    defaultOrientation: 'landscape',
    note: '85.6 × 54 mm · 含圆角',
  },
  {
    id: 'card-passport',
    name: '护照',
    group: 'card',
    shortMm: 88,
    longMm: 125,
    note: '88 × 125 mm',
  },
  {
    id: 'card-business',
    name: '名片',
    group: 'card',
    shortMm: 54,
    longMm: 90,
    defaultOrientation: 'landscape',
    note: '90 × 54 mm',
  },
  {
    id: 'card-wallet-2x3',
    name: '小卡 2 × 3 in',
    group: 'card',
    shortMm: 50.8,
    longMm: 76.2,
    defaultOrientation: 'landscape',
    note: '50.8 × 76.2 mm',
  },

  // 拍立得 / 其他
  { id: 'polaroid-mini', name: '拍立得 mini 相纸', group: 'other', shortMm: 54, longMm: 86, note: '54 × 86 mm' },
  { id: 'polaroid-square', name: '拍立得方形相纸', group: 'other', shortMm: 79, longMm: 79 },
  { id: 'polaroid-wide', name: '拍立得宽幅相纸', group: 'other', shortMm: 86, longMm: 108, defaultOrientation: 'landscape' },
  { id: 'strip-2x6', name: '照片条 2 × 6 in', group: 'other', shortMm: 51, longMm: 152 },
  { id: 'bookmark', name: '书签 50 × 150', group: 'other', shortMm: 50, longMm: 150 },
  { id: 'cd-cover', name: 'CD 封面 120 × 120', group: 'other', shortMm: 120, longMm: 120 },
];

export const PAPER_GROUP_NAMES: Record<PaperGroup, string> = {
  photo: '照片尺寸',
  paper: '打印纸张',
  postcard: '明信片',
  card: '证件 / 卡片',
  other: '拍立得 / 其他',
};

export function findPreset(id: string): PaperPreset | undefined {
  return PAPER_PRESETS.find((p) => p.id === id);
}

export function pageSizeFromPreset(
  preset: PaperPreset,
  orientation: 'portrait' | 'landscape',
): { widthMm: number; heightMm: number } {
  const isPortrait = orientation === 'portrait';
  return {
    widthMm: isPortrait ? preset.shortMm : preset.longMm,
    heightMm: isPortrait ? preset.longMm : preset.shortMm,
  };
}

export function defaultOrientationOf(preset: PaperPreset): 'portrait' | 'landscape' {
  if (preset.defaultOrientation) return preset.defaultOrientation;
  return 'portrait';
}

export function paperLabel(widthMm: number, heightMm: number): string {
  return `${round(widthMm, 1)} × ${round(heightMm, 1)} mm`;
}

function round(v: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
