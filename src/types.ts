export type PaperGroup = 'photo' | 'paper' | 'postcard' | 'card' | 'other';

export interface PaperPreset {
  id: string;
  name: string;
  group: PaperGroup;
  /** 短边（横向或纵向都取较短的一边），单位 mm */
  shortMm: number;
  /** 长边，单位 mm；正方形时与短边相同 */
  longMm: number;
  /** 打开该纸张时默认方向 */
  defaultOrientation?: 'portrait' | 'landscape';
  /** 额外说明，例如英寸尺寸 */
  note?: string;
}

export type Orientation = 'portrait' | 'landscape';
export type FillMode = 'cover' | 'contain' | 'stretch';
export type MaskShape = 'rect' | 'rounded' | 'circle' | 'arch' | 'heart' | 'hexagon';

/** 归一化（0~1）的源图片裁切区域，用于分页海报、切片等特殊拼版 */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Frame {
  id: string;
  photoId: string;
  /** 版面坐标，单位 mm，页面左上角为原点 */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 旋转角度（deg），绕画框中心旋转 */
  rotation: number;
  mask: MaskShape;
  /** 圆角半径（mm），仅 rounded / arch / rect 需要 */
  radiusMm: number;
  fill: FillMode;
  /** 图片缩放（cover 模式下 >= 1） */
  zoom: number;
  /** 图片焦点，归一化 0~1 */
  focusX: number;
  focusY: number;
  /** 源图裁切覆盖，优先于 cover 计算 */
  crop?: CropRect;
  /** 白色卡纸留边（mm），可实现拍立得/相框效果 */
  matteMm: number;
  /** 底部额外留白（mm），拍立得效果 */
  matteBottomMm: number;
  matteColor: string;
  borderMm: number;
  borderColor: string;
  shadow: boolean;
  opacity: number;
  locked: boolean;
  name?: string;
}

export interface Page {
  id: string;
  presetId: string;
  widthMm: number;
  heightMm: number;
  orientation: Orientation;
  /** 页边距（mm） */
  marginMm: number;
  /** 模板/自动排版使用的间距（mm） */
  gapMm: number;
  background: string;
  /** 显示/导出裁切线 */
  cutLines: boolean;
  items: Frame[];
  /** 页面备注，例如「分页海报 2/4」 */
  note?: string;
}

export interface PhotoMeta {
  id: string;
  name: string;
  width: number;
  height: number;
  byteSize: number;
  /** 缩略图 dataURL，用于列表展示 */
  thumb: string;
  createdAt: number;
}

export interface Project {
  pages: Page[];
}

export interface UiState {
  activeTab: 'photos' | 'templates' | 'paper';
  selectedFrameId: string | null;
  /** 双击进入的「照片取景」模式 */
  cropFrameId: string | null;
  /** null 表示自适应窗口 */
  zoom: number | null;
  panX: number;
  panY: number;
  showMargins: boolean;
  showRulers: boolean;
  snapEnabled: boolean;
  exportDialogOpen: boolean;
  helpOpen: boolean;
  tilingDialogOpen: boolean;
}

export interface SnapLine {
  axis: 'x' | 'y';
  value: number;
  kind: 'page' | 'margin' | 'frame' | 'center';
}
