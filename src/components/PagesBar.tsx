import { useEffect, useRef } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import type { Page } from '../types';
import { getImage } from '../lib/image';
import { renderPage } from '../lib/render';
import { useAppStore } from '../store/store';

function PageThumb({ page }: { page: Page }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photos = useAppStore((s) => s.photos);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const maxCssW = 80;
    const maxCssH = 56;
    const ratio = page.widthMm / page.heightMm;
    let cssW = maxCssW;
    let cssH = cssW / ratio;
    if (cssH > maxCssH) {
      cssH = maxCssH;
      cssW = cssH * ratio;
    }
    const pxW = Math.max(1, Math.round(cssW * dpr));
    const pxH = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW;
      canvas.height = pxH;
    }
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scale = pxW / page.widthMm;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    renderPage(ctx, page, {
      getImage,
      cutLines: false,
      marginGuides: false,
    });
  }, [page, photos]);

  return (
    <div className="grid h-[62px] w-full place-items-center overflow-hidden rounded-lg bg-zinc-100/80">
      <canvas
        ref={canvasRef}
        className="rounded-[1px] shadow-[0_1px_4px_rgba(24,24,27,0.18)] ring-1 ring-zinc-200"
      />
    </div>
  );
}

export function PagesBar() {
  const pages = useAppStore((s) => s.project.pages);
  const activePageId = useAppStore((s) => s.activePageId);
  const setActivePage = useAppStore((s) => s.setActivePage);
  const addPage = useAppStore((s) => s.addPage);
  const duplicatePage = useAppStore((s) => s.duplicatePage);
  const deletePage = useAppStore((s) => s.deletePage);

  return (
    <div className="flex h-[100px] shrink-0 items-center gap-2 border-t border-zinc-200 bg-white px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scroll-thin py-2">
        {pages.map((page, index) => {
          const active = page.id === activePageId;
          return (
            <button
              key={page.id}
              type="button"
              onClick={() => setActivePage(page.id)}
              title={page.note ?? `第 ${index + 1} 页`}
              className={`group flex w-[92px] shrink-0 flex-col gap-1 rounded-xl border p-1.5 text-left transition ${
                active
                  ? 'border-indigo-300 bg-indigo-50/60 ring-1 ring-indigo-200'
                  : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              <PageThumb page={page} />
              <div className="flex items-center justify-between px-0.5">
                <span
                  className={`text-[10px] font-medium ${active ? 'text-indigo-700' : 'text-zinc-500'}`}
                >
                  第 {index + 1} 页
                </span>
                <span className="text-[9px] tabular-nums text-zinc-400">
                  {page.widthMm}×{page.heightMm}
                </span>
              </div>
              {page.note ? (
                <span className="truncate px-0.5 text-[9px] leading-3 text-zinc-400">
                  {page.note}
                </span>
              ) : null}
            </button>
          );
        })}
        <button
          type="button"
          onClick={addPage}
          className="flex h-[88px] w-[70px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-300 bg-white text-zinc-400 transition hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-600"
          title="新建页面"
        >
          <Plus size={16} />
          <span className="text-[10px] font-medium">添加页</span>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 border-l border-zinc-100 pl-2">
        <button
          type="button"
          className="icon-btn"
          title="复制当前页"
          onClick={duplicatePage}
        >
          <Copy size={14} />
        </button>
        <button
          type="button"
          className="icon-btn"
          title="删除当前页"
          onClick={() => deletePage(activePageId)}
          disabled={pages.length <= 1}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
