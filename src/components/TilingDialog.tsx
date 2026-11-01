import { useEffect, useState } from 'react';
import { AlertTriangle, Grid2X2, LayoutGrid, Sparkles } from 'lucide-react';
import { findPreset } from '../data/papers';
import { useActivePage, useAppStore, useSelectedFrame } from '../store/store';
import { NumberField, Modal } from './ui';

const PRESETS: Array<{ cols: number; rows: number; label: string; desc: string }> = [
  { cols: 2, rows: 2, label: '2 × 2', desc: '4 页 · 适合 A4 拼成 A2' },
  { cols: 3, rows: 3, label: '3 × 3', desc: '9 页 · 适合照片墙海报' },
  { cols: 4, rows: 4, label: '4 × 4', desc: '16 页 · 大幅面精细海报' },
];

function MiniGrid({ cols, rows }: { cols: number; rows: number }) {
  return (
    <div
      className="grid h-9 w-12 gap-[2px] rounded-[3px] bg-zinc-200 p-[2px]"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: cols * rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-[1px]"
          style={{ background: `hsl(${214 + (i % 8) * 16} 70% ${76 - (i % 3) * 6}%)` }}
        />
      ))}
    </div>
  );
}

export function TilingDialog() {
  const open = useAppStore((s) => s.ui.tilingDialogOpen);
  const patchUi = useAppStore((s) => s.patchUi);
  const buildPoster = useAppStore((s) => s.buildPoster);
  const photos = useAppStore((s) => s.photos);
  const selectedFrame = useSelectedFrame();
  const page = useActivePage();
  const [cols, setCols] = useState(2);
  const [rows, setRows] = useState(2);

  useEffect(() => {
    if (open) {
      setCols(2);
      setRows(2);
    }
  }, [open]);

  const close = () => patchUi({ tilingDialogOpen: false });
  const safeCols = Math.max(1, Math.min(8, Math.round(cols) || 1));
  const safeRows = Math.max(1, Math.min(8, Math.round(rows) || 1));
  const total = safeCols * safeRows;
  const photo = selectedFrame
    ? photos.find((p) => p.id === selectedFrame.photoId)
    : photos[0];
  const presetName = page.presetId === 'custom' ? '自定义纸张' : (findPreset(page.presetId)?.name ?? '纸张');

  return (
    <Modal
      open={open}
      onClose={close}
      title="分页海报（切割拼接）"
      subtitle="把一张照片按网格切成多张纸打印，再拼成一张大图。生成后会替换当前页。"
      width={620}
      footer={
        <>
          <button type="button" className="btn btn-soft" onClick={close}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary min-w-[140px]"
            onClick={() => buildPoster(safeCols, safeRows)}
            disabled={!photo}
          >
            <Sparkles size={14} />
            生成 {total} 页
          </button>
        </>
      }
    >
      <div className="space-y-4 px-5 py-4">
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
          {photo ? (
            <img
              src={photo.thumb}
              alt={photo.name}
              className="h-12 w-12 shrink-0 rounded-lg border border-zinc-200 object-cover"
            />
          ) : (
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-zinc-200 text-zinc-400">
              <LayoutGrid size={18} />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-zinc-800">
              {photo ? photo.name : '请先上传照片'}
            </p>
            <p className="mt-0.5 text-[10.5px] text-zinc-400">
              {photo
                ? `${photo.width} × ${photo.height} px · 每页 ${presetName} ${page.widthMm} × ${page.heightMm} mm`
                : '上传照片或加载示例后，才能生成分页海报'}
            </p>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="field-label">网格</p>
            <span className="chip">
              <Grid2X2 size={10} /> {safeCols} × {safeRows}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((item) => {
              const active = cols === item.cols && rows === item.rows;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setCols(item.cols);
                    setRows(item.rows);
                  }}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 transition ${
                    active
                      ? 'border-indigo-300 bg-indigo-50/70 ring-1 ring-indigo-200'
                      : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <MiniGrid cols={item.cols} rows={item.rows} />
                  <span className={`text-[12px] font-medium ${active ? 'text-indigo-700' : 'text-zinc-700'}`}>
                    {item.label}
                  </span>
                  <span className="text-center text-[9.5px] leading-3 text-zinc-400">{item.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="列数"
            value={cols}
            min={1}
            max={8}
            step={1}
            unit="列"
            onChange={(v) => setCols(Math.round(v))}
          />
          <NumberField
            label="行数"
            value={rows}
            min={1}
            max={8}
            step={1}
            unit="行"
            onChange={(v) => setRows(Math.round(v))}
          />
        </div>

        <div className="rounded-xl bg-zinc-900 px-4 py-3 text-white">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span className="font-medium uppercase tracking-wide">拼接结果</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 font-medium text-zinc-200">
              {total} 页
            </span>
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="tabular-nums text-[14px] font-semibold">
                {Math.round((page.widthMm * safeCols) / 10)} ×{' '}
                {Math.round((page.heightMm * safeRows) / 10)} cm
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">
                每页 {page.widthMm} × {page.heightMm} mm · 单张照片无缝切分
              </p>
            </div>
            <span className="rounded-md bg-emerald-400/15 px-2 py-1 text-[10.5px] font-medium text-emerald-300">
              导出 PDF 多页打印
            </span>
          </div>
        </div>

        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-4 text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            打印时请选择「实际尺寸 / 100%」并关闭「适应纸张」。打印机若无无边距打印，
            拼接处会出现约 3–5mm 白边，可裁掉后对齐粘贴。
          </span>
        </div>

        {!photo ? (
          <p className="text-[11px] text-red-600">当前图库没有照片，请先在「照片」标签上传或加载示例。</p>
        ) : null}
      </div>
    </Modal>
  );
}
