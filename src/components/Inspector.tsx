import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  Crop,
  Layers,
  Lock,
  Maximize2,
  RotateCcw,
  RotateCw,
  Sparkles,
  Trash2,
  Unlock,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Frame, MaskShape, PhotoMeta } from '../types';
import { findPreset } from '../data/papers';
import { effectiveDpi } from '../lib/geometry';
import { useActivePage, useAppStore, useSelectedFrame } from '../store/store';
import { Section, Segmented, SliderField, NumberField, ColorField, Switch } from './ui';

const SHAPES: Array<{
  value: MaskShape;
  label: string;
  style: CSSProperties;
}> = [
  { value: 'rect', label: '矩形', style: {} },
  { value: 'rounded', label: '圆角', style: { borderRadius: '26%' } },
  { value: 'circle', label: '圆形', style: { borderRadius: '50%' } },
  {
    value: 'arch',
    label: '拱形',
    style: { borderTopLeftRadius: '50%', borderTopRightRadius: '50%' },
  },
  {
    value: 'heart',
    label: '心形',
    style: {
      clipPath:
        'polygon(50% 100%, 6% 55%, 2% 32%, 12% 12%, 32% 4%, 50% 18%, 68% 4%, 88% 12%, 98% 32%, 94% 55%)',
    },
  },
  {
    value: 'hexagon',
    label: '六边形',
    style: { clipPath: 'polygon(50% 0, 98% 25%, 98% 75%, 50% 100%, 2% 75%, 2% 25%)' },
  },
];

function dpiBadge(dpi: number): { text: string; className: string } {
  if (dpi >= 300) {
    return { text: `${Math.round(dpi)} DPI · 高清`, className: 'bg-emerald-50 text-emerald-700' };
  }
  if (dpi >= 200) {
    return { text: `${Math.round(dpi)} DPI · 一般`, className: 'bg-amber-50 text-amber-700' };
  }
  return { text: `${Math.round(dpi)} DPI · 偏低`, className: 'bg-red-50 text-red-600' };
}

function FrameInspector({ frame }: { frame: Frame }) {
  const photos = useAppStore((s) => s.photos);
  const cropFrameId = useAppStore((s) => s.ui.cropFrameId);
  const updateFrame = useAppStore((s) => s.updateFrame);
  const deleteFrame = useAppStore((s) => s.deleteFrame);
  const duplicateFrame = useAppStore((s) => s.duplicateFrame);
  const moveFrameLayer = useAppStore((s) => s.moveFrameLayer);
  const alignFrame = useAppStore((s) => s.alignFrame);
  const fitFrameToPhoto = useAppStore((s) => s.fitFrameToPhoto);
  const fillFrame = useAppStore((s) => s.fillFrame);
  const resetCrop = useAppStore((s) => s.resetCrop);
  const rotateFrame = useAppStore((s) => s.rotateFrame);
  const replaceFramePhoto = useAppStore((s) => s.replaceFramePhoto);
  const setCropFrame = useAppStore((s) => s.setCropFrame);

  const photo = photos.find((p) => p.id === frame.photoId);
  const dpi = photo ? effectiveDpi(photo, frame) : 0;
  const badge = dpiBadge(dpi);
  const isCrop = cropFrameId === frame.id;

  const set = (patch: Partial<Frame>, key: string) =>
    updateFrame(frame.id, patch, { historyKey: `${key}:${frame.id}` });

  return (
    <div className="flex h-full flex-col overflow-y-auto scroll-thin">
      <div className="border-b border-zinc-100 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 gap-2.5">
            {photo ? (
              <img
                src={photo.thumb}
                alt={photo.name}
                className="h-12 w-12 shrink-0 rounded-lg border border-zinc-200 object-cover"
              />
            ) : (
              <div className="h-12 w-12 shrink-0 rounded-lg bg-zinc-100" />
            )}
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-medium text-zinc-800">
                {photo?.name ?? '照片缺失'}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className={`rounded px-1.5 py-0.5 text-[9.5px] font-medium ${badge.className}`}>
                  {badge.text}
                </span>
                {photo ? (
                  <span className="text-[9.5px] text-zinc-400">
                    {photo.width} × {photo.height} px
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              className="icon-btn h-7 w-7"
              title={frame.locked ? '解锁画框' : '锁定画框'}
              onClick={() => set({ locked: !frame.locked }, 'lock')}
            >
              {frame.locked ? <Lock size={13} /> : <Unlock size={13} />}
            </button>
            <button
              type="button"
              className="icon-btn h-7 w-7"
              title="复制画框 (Ctrl / ⌘ + D)"
              onClick={() => duplicateFrame(frame.id)}
            >
              <Copy size={13} />
            </button>
            <button
              type="button"
              className="icon-btn h-7 w-7 hover:text-red-600"
              title="删除画框 (Delete)"
              onClick={() => deleteFrame(frame.id)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>

      <Section title="照片构图">
        <div className="space-y-3">
          <Segmented
            value={frame.fill}
            onChange={(v) => set({ fill: v }, 'fill')}
            options={[
              { value: 'cover', label: '填满裁切' },
              { value: 'contain', label: '完整显示' },
              { value: 'stretch', label: '拉伸' },
            ]}
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              className={`btn h-8 flex-1 text-[11.5px] ${
                isCrop
                  ? 'border border-amber-300 bg-amber-50 text-amber-800'
                  : 'btn-soft'
              }`}
              onClick={() => setCropFrame(isCrop ? null : frame.id)}
              disabled={frame.locked || frame.fill !== 'cover'}
            >
              <Crop size={12} /> {isCrop ? '退出取景' : '取景调焦'}
            </button>
            <button
              type="button"
              className="btn btn-soft h-8 flex-1 text-[11.5px]"
              onClick={() => resetCrop(frame.id)}
            >
              <RotateCcw size={12} /> 重置构图
            </button>
          </div>
          {frame.fill === 'cover' ? (
            <SliderField
              label="照片缩放"
              value={frame.zoom}
              min={1}
              max={6}
              step={0.05}
              unit="×"
              onChange={(v) => set({ zoom: v }, 'zoom')}
            />
          ) : null}
          <p className="text-[10px] leading-4 text-zinc-400">
            双击画布中的照片可进入取景模式，拖动调整构图，滚轮缩放照片。
          </p>
          <div>
            <p className="field-label mb-1.5">替换照片</p>
            <div className="flex gap-1.5 overflow-x-auto scroll-thin pb-1">
              {photos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.name}
                  onClick={() => replaceFramePhoto(frame.id, p.id)}
                  className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-md border-2 transition ${
                    p.id === frame.photoId
                      ? 'border-indigo-500'
                      : 'border-transparent hover:border-zinc-300'
                  }`}
                >
                  <img src={p.thumb} alt={p.name} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="外形与边框">
        <div className="space-y-3">
          <div>
            <p className="field-label mb-1.5">形状蒙版</p>
            <div className="grid grid-cols-6 gap-1">
              {SHAPES.map((shape) => (
                <button
                  key={shape.value}
                  type="button"
                  title={shape.label}
                  onClick={() => set({ mask: shape.value }, 'mask')}
                  className={`flex flex-col items-center gap-1 rounded-lg py-1.5 transition ${
                    frame.mask === shape.value
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600'
                  }`}
                >
                  <span
                    className={`block h-5 w-5 ${
                      frame.mask === shape.value ? 'bg-indigo-500' : 'bg-zinc-400'
                    }`}
                    style={shape.style}
                  />
                  <span className="text-[8px] font-medium leading-none">{shape.label}</span>
                </button>
              ))}
            </div>
          </div>
          {frame.mask === 'rounded' ? (
            <SliderField
              label="圆角"
              value={frame.radiusMm}
              min={0}
              max={40}
              step={0.5}
              unit="mm"
              onChange={(v) => set({ radiusMm: v }, 'radius')}
            />
          ) : null}
          <div className="flex items-end gap-2">
            <NumberField
              label="旋转角度"
              unit="°"
              value={frame.rotation}
              step={1}
              onChange={(v) => set({ rotation: v }, 'rotation')}
              className="flex-1"
            />
            <button
              type="button"
              className="icon-btn border border-zinc-200"
              title="逆时针 90°"
              onClick={() => rotateFrame(frame.id, -90)}
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              className="icon-btn border border-zinc-200"
              title="顺时针 90°"
              onClick={() => rotateFrame(frame.id, 90)}
            >
              <RotateCw size={14} />
            </button>
          </div>
          <SliderField
            label="内边框"
            value={frame.borderMm}
            min={0}
            max={10}
            step={0.1}
            unit="mm"
            onChange={(v) => set({ borderMm: v }, 'border')}
          />
          {frame.borderMm > 0 ? (
            <ColorField
              label="边框颜色"
              value={frame.borderColor}
              onChange={(v) => set({ borderColor: v }, 'borderColor')}
            />
          ) : null}
          <SliderField
            label="照片留白"
            value={frame.matteMm}
            min={0}
            max={40}
            step={0.5}
            unit="mm"
            onChange={(v) => set({ matteMm: v }, 'matte')}
          />
          {frame.matteMm > 0 ? (
            <>
              <SliderField
                label="底部额外留白"
                value={frame.matteBottomMm}
                min={0}
                max={80}
                step={1}
                unit="mm"
                onChange={(v) => set({ matteBottomMm: v }, 'matteBottom')}
              />
              <div className="flex items-center justify-between gap-2">
                <ColorField
                  label="卡纸颜色"
                  value={frame.matteColor}
                  onChange={(v) => set({ matteColor: v }, 'matteColor')}
                />
              </div>
            </>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className="btn btn-soft h-7 px-2 text-[11px]"
              onClick={() =>
                set(
                  {
                    matteMm: Math.round(Math.min(frame.w, frame.h) * 0.055 * 10) / 10,
                    matteBottomMm: Math.round(Math.min(frame.w, frame.h) * 0.19 * 10) / 10,
                    matteColor: '#ffffff',
                    shadow: true,
                  },
                  'polaroid-style',
                )
              }
            >
              拍立得白框
            </button>
            <button
              type="button"
              className="btn btn-soft h-7 px-2 text-[11px]"
              onClick={() => set({ matteMm: 0, matteBottomMm: 0, shadow: false }, 'clear-matte')}
            >
              清除留白
            </button>
          </div>
          <div className="flex items-center justify-between">
            <Switch
              checked={frame.shadow}
              onChange={(v) => set({ shadow: v }, 'shadow')}
              label="投影"
            />
          </div>
          <SliderField
            label="不透明度"
            value={frame.opacity * 100}
            min={5}
            max={100}
            step={1}
            unit="%"
            onChange={(v) => set({ opacity: v / 100 }, 'opacity')}
          />
        </div>
      </Section>

      <Section title="位置与尺寸">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="X"
              unit="mm"
              value={frame.x}
              step={0.5}
              onChange={(v) => set({ x: v }, 'x')}
            />
            <NumberField
              label="Y"
              unit="mm"
              value={frame.y}
              step={0.5}
              onChange={(v) => set({ y: v }, 'y')}
            />
            <NumberField
              label="宽度"
              unit="mm"
              value={frame.w}
              min={8}
              step={0.5}
              onChange={(v) => set({ w: v }, 'w')}
            />
            <NumberField
              label="高度"
              unit="mm"
              value={frame.h}
              min={8}
              step={0.5}
              onChange={(v) => set({ h: v }, 'h')}
            />
          </div>

          <div>
            <p className="field-label mb-1.5">对齐到页边距</p>
            <div className="grid grid-cols-6 gap-1">
              {(
                [
                  { mode: 'left', label: '左', icon: ArrowLeft },
                  { mode: 'h', label: '中', icon: ArrowRight },
                  { mode: 'right', label: '右', icon: ArrowRight },
                  { mode: 'top', label: '上', icon: ArrowUp },
                  { mode: 'v', label: '中', icon: ArrowDown },
                  { mode: 'bottom', label: '下', icon: ArrowDown },
                ] as const
              ).map((item, index) => (
                <button
                  key={`${item.mode}-${index}`}
                  type="button"
                  className="flex flex-col items-center gap-0.5 rounded-md border border-zinc-200 py-1.5 text-[9px] text-zinc-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                  title={`对齐${item.label}`}
                  onClick={() => alignFrame(frame.id, item.mode)}
                >
                  <item.icon size={11} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              className="btn btn-soft h-8 text-[11px]"
              onClick={() => fitFrameToPhoto(frame.id)}
            >
              适应照片比例
            </button>
            <button
              type="button"
              className="btn btn-soft h-8 text-[11px]"
              onClick={() => fillFrame(frame.id)}
            >
              <Maximize2 size={12} /> 铺满页面
            </button>
          </div>

          <div>
            <p className="field-label mb-1.5 flex items-center gap-1">
              <Layers size={11} /> 图层顺序
            </p>
            <div className="grid grid-cols-4 gap-1">
              <button
                type="button"
                className="btn btn-soft h-7 px-1 text-[10px]"
                onClick={() => moveFrameLayer(frame.id, 'bottom')}
                title="移到最底层"
              >
                置底
              </button>
              <button
                type="button"
                className="btn btn-soft h-7 px-1 text-[10px]"
                onClick={() => moveFrameLayer(frame.id, 'down')}
                title="下移一层"
              >
                <ArrowDownToLine size={11} /> 下移
              </button>
              <button
                type="button"
                className="btn btn-soft h-7 px-1 text-[10px]"
                onClick={() => moveFrameLayer(frame.id, 'up')}
                title="上移一层"
              >
                <ArrowUpToLine size={11} /> 上移
              </button>
              <button
                type="button"
                className="btn btn-soft h-7 px-1 text-[10px]"
                onClick={() => moveFrameLayer(frame.id, 'top')}
                title="移到最顶层"
              >
                置顶
              </button>
            </div>
          </div>
        </div>
      </Section>

      <div className="px-4 py-3 text-[10px] leading-4 text-zinc-400">
        方向键微移 0.5 mm，Shift + 方向键快速移动 5 mm。拖动四角可缩放，顶部圆点可旋转。
      </div>
    </div>
  );
}

function PageInspector() {
  const page = useActivePage();
  const photos = useAppStore((s) => s.photos);
  const setTab = useAppStore((s) => s.setTab);
  const applyTemplate = useAppStore((s) => s.applyTemplate);
  const clearPage = useAppStore((s) => s.clearPage);
  const selectFrame = useAppStore((s) => s.selectFrame);
  const preset = findPreset(page.presetId);

  type LowQuality = { frame: Frame; photo: PhotoMeta; dpi: number };
  const lowQuality = page.items
    .map((frame): LowQuality | null => {
      const photo = photos.find((p) => p.id === frame.photoId);
      return photo ? { frame, photo, dpi: effectiveDpi(photo, frame) } : null;
    })
    .filter((item): item is LowQuality => item !== null && item.dpi < 240)
    .slice(0, 4);

  return (
    <div className="flex h-full flex-col overflow-y-auto scroll-thin">
      <div className="border-b border-zinc-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[13.5px] font-semibold text-zinc-900">当前页面</h2>
          <span className="chip">
            {page.items.length} 个画框 / {page.widthMm} × {page.heightMm} mm
          </span>
        </div>
        <p className="mt-1 text-[11px] text-zinc-400">
          点击画布中的照片即可单独调整；未选中时显示页面级工具。
        </p>
      </div>

      <Section title="页面">
        <div className="space-y-2 rounded-xl bg-zinc-50 p-3">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-zinc-500">纸张</span>
            <span className="font-medium text-zinc-800">{preset?.name ?? '自定义尺寸'}</span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-zinc-500">方向</span>
            <span className="text-zinc-700">
              {page.orientation === 'portrait' ? '纵向' : '横向'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-zinc-500">页边距 / 间距</span>
            <span className="text-zinc-700">
              {page.marginMm} mm / {page.gapMm} mm
            </span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-zinc-500">裁切线</span>
            <span className="text-zinc-700">{page.cutLines ? '已开启' : '关闭'}</span>
          </div>
        </div>
      </Section>

      {lowQuality.length ? (
        <Section title="打印质量提醒">
          <div className="rounded-lg bg-amber-50/80 p-2.5 ring-1 ring-amber-100">
            <p className="text-[11px] font-medium text-amber-800">
              有 {lowQuality.length} 张照片的打印分辨率偏低
            </p>
            <p className="mt-0.5 text-[10px] leading-4 text-amber-700/80">
              放大画框会降低有效 DPI。建议更换更高分辨率原图，或缩小打印尺寸。
            </p>
            <div className="mt-2 space-y-1">
              {lowQuality.map(({ frame, photo, dpi }) => (
                <button
                  key={frame.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-md bg-white/70 px-2 py-1 text-left text-[10.5px] text-zinc-600 hover:bg-white"
                  onClick={() => selectFrame(frame.id)}
                >
                  <span className="truncate">{photo.name}</span>
                  <span className="shrink-0 font-medium text-amber-700">{Math.round(dpi)} DPI</span>
                </button>
              ))}
            </div>
          </div>
        </Section>
      ) : null}

      <Section title="快速排版">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            className="btn btn-soft h-8 text-[11px]"
            onClick={() => applyTemplate('auto-grid')}
          >
            <Sparkles size={12} /> 智能网格
          </button>
          <button
            type="button"
            className="btn btn-soft h-8 text-[11px]"
            onClick={() => applyTemplate('contact-sheet')}
          >
            等比排版
          </button>
          <button
            type="button"
            className="btn btn-soft h-8 text-[11px]"
            onClick={() => setTab('templates')}
          >
            浏览全部模板
          </button>
          <button
            type="button"
            className="btn btn-soft h-8 text-[11px]"
            onClick={clearPage}
            disabled={page.items.length === 0}
          >
            清空页面
          </button>
        </div>
      </Section>

      <Section title="小提示">
        <ul className="space-y-1.5 text-[10.5px] leading-4 text-zinc-400">
          <li>· 双击照片：进入取景模式，拖动调整构图、滚轮缩放照片。</li>
          <li>· 画框四角：拖动缩放；Shift 拖动保持比例。</li>
          <li>· 画框上方圆点：旋转，接近 90° 会自动吸附。</li>
          <li>· 拖动时自动吸附页面边缘、页边距与其他画框。</li>
          <li>· 所有照片只在本机处理，刷新页面后仍会保留。</li>
        </ul>
      </Section>
    </div>
  );
}

export function Inspector() {
  const frame = useSelectedFrame();
  return (
    <aside className="hidden w-[300px] shrink-0 flex-col border-l border-zinc-200 bg-white lg:flex">
      {frame ? <FrameInspector frame={frame} /> : <PageInspector />}
    </aside>
  );
}
