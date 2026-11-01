export type TemplateGroup = 'auto' | 'collage' | 'special';
export type TemplateMode = 'multi' | 'single';

export interface PreviewCell {
  x: number;
  y: number;
  w: number;
  h: number;
  mask?: 'rect' | 'circle' | 'heart' | 'rounded';
  white?: boolean;
  tint?: number;
}

export interface TemplateDef {
  id: string;
  name: string;
  desc: string;
  group: TemplateGroup;
  mode: TemplateMode;
  badge?: string;
  /** 预览示意图，坐标归一化到预览卡片 */
  preview: PreviewCell[];
  /** 预览中显示多张纸（分页海报等） */
  previewPages?: number;
  /** 需要弹出参数面板 */
  needsDialog?: 'poster';
}

export const TEMPLATE_GROUP_NAMES: Record<TemplateGroup, string> = {
  auto: '自动排版',
  collage: '拼贴模板',
  special: '裁切与特殊工艺',
};

const gridPreview = (cols: number, rows: number, gap = 0.02): PreviewCell[] => {
  const cw = (1 - gap * (cols + 1)) / cols;
  const ch = (1 - gap * (rows + 1)) / rows;
  return Array.from({ length: cols * rows }, (_, i) => ({
    x: gap + (i % cols) * (cw + gap),
    y: gap + Math.floor(i / cols) * (ch + gap),
    w: cw,
    h: ch,
    tint: i,
  }));
};

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'auto-grid',
    name: '智能网格',
    desc: '按纸张比例自动计算行列，照片裁切填满格子',
    group: 'auto',
    mode: 'multi',
    badge: '推荐',
    preview: gridPreview(2, 2, 0.035),
  },
  {
    id: 'contact-sheet',
    name: '等比联系表',
    desc: '不裁切照片，保持原始长宽比，自动铺满页面',
    group: 'auto',
    mode: 'multi',
    preview: [
      { x: 0.06, y: 0.1, w: 0.54, h: 0.34, tint: 0 },
      { x: 0.64, y: 0.1, w: 0.28, h: 0.34, tint: 1 },
      { x: 0.06, y: 0.5, w: 0.28, h: 0.4, tint: 2 },
      { x: 0.38, y: 0.5, w: 0.54, h: 0.26, tint: 3 },
      { x: 0.38, y: 0.8, w: 0.26, h: 0.1, tint: 4 },
      { x: 0.66, y: 0.8, w: 0.26, h: 0.1, tint: 5 },
    ],
  },
  {
    id: 'mosaic-four',
    name: '经典四宫格',
    desc: '2 × 2 等分，适合四张照片的故事拼贴',
    group: 'collage',
    mode: 'multi',
    preview: gridPreview(2, 2, 0.03),
  },
  {
    id: 'mosaic-nine',
    name: '九宫格',
    desc: '3 × 3 等分，适合社交平台发布',
    group: 'collage',
    mode: 'multi',
    preview: gridPreview(3, 3, 0.025),
  },
  {
    id: 'mosaic-1big3',
    name: '一大三小',
    desc: '左侧主图贯穿全高，右侧三张配图',
    group: 'collage',
    mode: 'multi',
    preview: [
      { x: 0.04, y: 0.04, w: 0.54, h: 0.92, tint: 0 },
      { x: 0.62, y: 0.04, w: 0.34, h: 0.28, tint: 1 },
      { x: 0.62, y: 0.36, w: 0.34, h: 0.28, tint: 2 },
      { x: 0.62, y: 0.68, w: 0.34, h: 0.28, tint: 3 },
    ],
  },
  {
    id: 'mosaic-top2',
    name: '上大下双',
    desc: '上方一张横向主图，下方两张并排',
    group: 'collage',
    mode: 'multi',
    preview: [
      { x: 0.04, y: 0.04, w: 0.92, h: 0.58, tint: 0 },
      { x: 0.04, y: 0.66, w: 0.44, h: 0.3, tint: 1 },
      { x: 0.52, y: 0.66, w: 0.44, h: 0.3, tint: 2 },
    ],
  },
  {
    id: 'mosaic-five',
    name: '五格拼贴',
    desc: '主图 + 四张配图的不对称拼贴',
    group: 'collage',
    mode: 'multi',
    preview: [
      { x: 0.04, y: 0.04, w: 0.58, h: 0.58, tint: 0 },
      { x: 0.66, y: 0.04, w: 0.3, h: 0.28, tint: 1 },
      { x: 0.66, y: 0.35, w: 0.3, h: 0.28, tint: 2 },
      { x: 0.04, y: 0.66, w: 0.58, h: 0.3, tint: 3 },
      { x: 0.66, y: 0.66, w: 0.3, h: 0.3, tint: 4 },
    ],
  },
  {
    id: 'mosaic-triptych',
    name: '三联画',
    desc: '三张竖构图并排，像画廊一样展示',
    group: 'collage',
    mode: 'multi',
    preview: gridPreview(3, 1, 0.035),
  },
  {
    id: 'mosaic-diptych',
    name: '双联画',
    desc: '两张照片并排，适合前后对比',
    group: 'collage',
    mode: 'multi',
    preview: gridPreview(2, 1, 0.035),
  },
  {
    id: 'full-bleed',
    name: '满版单图',
    desc: '一张照片铺满整页，无留白',
    group: 'special',
    mode: 'single',
    preview: [{ x: 0.02, y: 0.02, w: 0.96, h: 0.96, tint: 0 }],
  },
  {
    id: 'polaroid',
    name: '拍立得白框',
    desc: '四周留白、底部加宽的经典拍立得相框',
    group: 'special',
    mode: 'single',
    preview: [
      { x: 0.12, y: 0.08, w: 0.76, h: 0.62, tint: 0 },
      { x: 0.12, y: 0.86, w: 0.76, h: 0.012, white: true },
    ],
  },
  {
    id: 'strip-4',
    name: '四连拍照片条',
    desc: '四张照片竖向排列，适合 2 × 6 in 照片条',
    group: 'special',
    mode: 'multi',
    preview: gridPreview(1, 4, 0.03),
  },
  {
    id: 'id-1inch',
    name: '证件照 · 1 寸',
    desc: '25 × 35 mm，自动重复排满，带裁切线',
    group: 'special',
    mode: 'single',
    badge: '证件',
    preview: gridPreview(3, 4, 0.02),
  },
  {
    id: 'id-2inch',
    name: '证件照 · 2 寸',
    desc: '35 × 49 mm，自动重复排满，带裁切线',
    group: 'special',
    mode: 'single',
    badge: '证件',
    preview: gridPreview(3, 3, 0.02),
  },
  {
    id: 'split-4',
    name: '裁切四分',
    desc: '一张照片切成 2 × 2 小块，可拆下重组',
    group: 'special',
    mode: 'single',
    badge: '裁切',
    preview: gridPreview(2, 2, 0.08),
  },
  {
    id: 'sliced',
    name: '错位切片',
    desc: '切成竖条并上下错位，制造艺术拼贴感',
    group: 'special',
    mode: 'single',
    badge: '裁切',
    preview: [
      { x: 0.03, y: 0.12, w: 0.17, h: 0.76, tint: 0 },
      { x: 0.22, y: 0.04, w: 0.17, h: 0.84, tint: 1 },
      { x: 0.41, y: 0.16, w: 0.17, h: 0.7, tint: 2 },
      { x: 0.6, y: 0.06, w: 0.17, h: 0.82, tint: 3 },
      { x: 0.79, y: 0.12, w: 0.17, h: 0.76, tint: 4 },
    ],
  },
  {
    id: 'heart',
    name: '心形剪影',
    desc: '心形蒙版裁切，适合纪念照片',
    group: 'special',
    mode: 'single',
    preview: [{ x: 0.14, y: 0.06, w: 0.72, h: 0.8, mask: 'heart', tint: 0 }],
  },
  {
    id: 'circle-3',
    name: '圆形三连',
    desc: '三张圆形照片横向排列',
    group: 'special',
    mode: 'multi',
    preview: [
      { x: 0.05, y: 0.33, w: 0.27, h: 0.27, mask: 'circle', tint: 0 },
      { x: 0.36, y: 0.33, w: 0.27, h: 0.27, mask: 'circle', tint: 1 },
      { x: 0.67, y: 0.33, w: 0.27, h: 0.27, mask: 'circle', tint: 2 },
    ],
  },
  {
    id: 'poster',
    name: '分页海报',
    desc: '一张照片切成多张纸打印，拼接成大幅海报',
    group: 'special',
    mode: 'single',
    badge: '分页',
    needsDialog: 'poster',
    previewPages: 4,
    preview: gridPreview(2, 2, 0.04),
  },
];

export function findTemplate(id: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
