import {
  Eye,
  Magnet,
  Maximize2,
  Proportions,
  Redo2,
  Ruler,
  ScanLine,
  Sparkles,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { findPreset } from '../data/papers';
import { useActivePage, useAppStore } from '../store/store';
import { clamp } from '../lib/geometry';

export function CanvasToolbar() {
  const page = useActivePage();
  const canUndo = useAppStore((s) => s.past.length > 0);
  const canRedo = useAppStore((s) => s.future.length > 0);
  const zoom = useAppStore((s) => s.ui.zoom);
  const showRulers = useAppStore((s) => s.ui.showRulers);
  const showMargins = useAppStore((s) => s.ui.showMargins);
  const snapEnabled = useAppStore((s) => s.ui.snapEnabled);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const setZoom = useAppStore((s) => s.setZoom);
  const patchUi = useAppStore((s) => s.patchUi);
  const applyTemplate = useAppStore((s) => s.applyTemplate);
  const clearPage = useAppStore((s) => s.clearPage);
  const updatePageSettings = useAppStore((s) => s.updatePageSettings);

  const percent = Math.round((zoom ?? 1) * 100);
  const presetName =
    page.presetId === 'custom' ? '自定义尺寸' : (findPreset(page.presetId)?.name ?? '自定义');
  const zoomBy = (delta: number) => {
    setZoom(clamp((zoom ?? 1) * delta, 0.3, 5));
  };

  return (
    <div className="flex h-11 shrink-0 items-center gap-1 border-b border-zinc-200 bg-white px-2.5">
      <button
        type="button"
        className="icon-btn"
        title="撤销 (Ctrl / ⌘ + Z)"
        onClick={undo}
        disabled={!canUndo}
      >
        <Undo2 size={15} />
      </button>
      <button
        type="button"
        className="icon-btn"
        title="重做 (Ctrl / ⌘ + Shift + Z)"
        onClick={redo}
        disabled={!canRedo}
      >
        <Redo2 size={15} />
      </button>

      <span className="mx-1 h-5 w-px bg-zinc-200" />

      <div className="hidden items-baseline gap-1.5 lg:flex">
        <span className="max-w-[120px] truncate text-[12px] font-medium text-zinc-700">
          {presetName}
        </span>
        <span className="text-[10.5px] tabular-nums text-zinc-400">
          {page.widthMm} × {page.heightMm} mm
        </span>
      </div>

      <span className="mx-1 hidden h-5 w-px bg-zinc-200 lg:block" />

      <button
        type="button"
        className="btn h-7 px-2 text-[11.5px] text-zinc-600"
        title="按纸张比例自动分行列"
        onClick={() => applyTemplate('auto-grid')}
      >
        <Sparkles size={12} /> 智能网格
      </button>
      <button
        type="button"
        className="btn hidden h-7 px-2 text-[11.5px] text-zinc-600 sm:inline-flex"
        title="保持原始比例排版，不裁切"
        onClick={() => applyTemplate('contact-sheet')}
      >
        <Proportions size={12} /> 等比排版
      </button>
      <button
        type="button"
        className="icon-btn h-7 w-7"
        title="清空当前页画框"
        onClick={clearPage}
        disabled={page.items.length === 0}
      >
        <Trash2 size={13} />
      </button>

      <div className="ml-auto flex items-center gap-0.5">
        <button
          type="button"
          className={`icon-btn ${showMargins ? 'icon-btn-active' : ''}`}
          title="页边距参考线（仅预览）"
          onClick={() => patchUi({ showMargins: !showMargins })}
        >
          <Eye size={15} />
        </button>
        <button
          type="button"
          className={`icon-btn ${page.cutLines ? 'icon-btn-active' : ''}`}
          title="裁切线（预览与导出）"
          onClick={() => updatePageSettings({ cutLines: !page.cutLines })}
        >
          <ScanLine size={15} />
        </button>
        <button
          type="button"
          className={`icon-btn ${showRulers ? 'icon-btn-active' : ''}`}
          title="标尺"
          onClick={() => patchUi({ showRulers: !showRulers })}
        >
          <Ruler size={15} />
        </button>
        <button
          type="button"
          className={`icon-btn ${snapEnabled ? 'icon-btn-active' : ''}`}
          title="拖动时吸附对齐"
          onClick={() => patchUi({ snapEnabled: !snapEnabled })}
        >
          <Magnet size={15} />
        </button>

        <span className="mx-1 h-5 w-px bg-zinc-200" />

        <button type="button" className="icon-btn" title="缩小" onClick={() => zoomBy(1 / 1.25)}>
          <ZoomOut size={15} />
        </button>
        <button
          type="button"
          className="min-w-[46px] rounded-md px-1 py-1 text-center text-[11px] font-medium tabular-nums text-zinc-600 hover:bg-zinc-100"
          title="点击恢复适应窗口"
          onClick={() => setZoom(null)}
        >
          {percent}%
        </button>
        <button type="button" className="icon-btn" title="放大" onClick={() => zoomBy(1.25)}>
          <ZoomIn size={15} />
        </button>
        <button type="button" className="icon-btn" title="适应窗口 (Ctrl + 0)" onClick={() => setZoom(null)}>
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
  );
}
