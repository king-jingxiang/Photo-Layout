import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Printer,
} from 'lucide-react';
import type { Page } from '../types';
import { findPreset } from '../data/papers';
import { useActivePage, useAppStore } from '../store/store';
import {
  downloadBlob,
  estimateOutput,
  exportPdf,
  exportSingleImage,
  fileStamp,
  printPages,
  safeExportDpi,
  type ExportOptions,
} from '../lib/export';
import { Modal, Segmented, SliderField, Switch } from './ui';

type ExportFormat = 'pdf' | 'png' | 'jpeg' | 'print';
type Scope = 'current' | 'all';

const FORMATS: Array<{
  value: ExportFormat;
  label: string;
  hint: string;
  icon: typeof FileText;
}> = [
  { value: 'pdf', label: 'PDF', hint: '多页 · 精确纸张尺寸', icon: FileText },
  { value: 'png', label: 'PNG', hint: '无损 · 适合存档', icon: ImageIcon },
  { value: 'jpeg', label: 'JPEG', hint: '小体积 · 适合分享', icon: ImageIcon },
  { value: 'print', label: '打印', hint: '浏览器 1:1 直接打印', icon: Printer },
];

const DPI_OPTIONS = [150, 300, 600];

function pageTitle(page: Page, index: number): string {
  const preset = findPreset(page.presetId);
  return `${preset?.name ?? '自定义'} · 第 ${index + 1} 页`;
}

function mmToCm(mm: number): string {
  return `${Math.round((mm / 10) * 10) / 10} cm`;
}

export function ExportDialog() {
  const open = useAppStore((s) => s.ui.exportDialogOpen);
  const patchUi = useAppStore((s) => s.patchUi);
  const toastMessage = useAppStore((s) => s.toastMessage);
  const pages = useAppStore((s) => s.project.pages);
  const activePageId = useAppStore((s) => s.activePageId);

  const page = useActivePage();
  const pageIndex = Math.max(
    0,
    pages.findIndex((p) => p.id === activePageId),
  );

  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [scope, setScope] = useState<Scope>('current');
  const [dpi, setDpi] = useState(300);
  const [quality, setQuality] = useState(92);
  const [includeCutLines, setIncludeCutLines] = useState(true);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setIncludeCutLines(page.cutLines);
    setError(null);
    setProgress(null);
    setWorking(false);
  }, [open, page.cutLines]);

  const close = () => {
    if (working) return;
    patchUi({ exportDialogOpen: false });
  };

  const targetPages = scope === 'all' ? pages : [page];
  const supportsScope = format === 'pdf' || format === 'print';
  const effectiveDpi = safeExportDpi(page, dpi);
  const estimate = estimateOutput(page, dpi);
  const dpiReduced = effectiveDpi < dpi;

  const mixedSizes = pages.some(
    (p) =>
      Math.abs(p.widthMm - page.widthMm) > 0.5 || Math.abs(p.heightMm - page.heightMm) > 0.5,
  );

  const runExport = async () => {
    setWorking(true);
    setError(null);
    setProgress(null);
    try {
      const options: ExportOptions = {
        dpi,
        quality: quality / 100,
        includeCutLines,
      };
      const stamp = fileStamp();

      if (format === 'pdf') {
        const result = await exportPdf(targetPages, options, (done, total) =>
          setProgress({ done, total }),
        );
        downloadBlob(result.blob, `photo-layout-${stamp}.pdf`);
        toastMessage(
          `PDF 已导出：${targetPages.length} 页 · ${result.effectiveDpi} DPI`,
          'success',
        );
      } else if (format === 'print') {
        await printPages(targetPages, dpi, includeCutLines);
        toastMessage('已打开系统打印窗口，请选择实际纸张并关闭缩放', 'info');
      } else {
        const result = await exportSingleImage(page, options, format);
        const extension = format === 'png' ? 'png' : 'jpg';
        downloadBlob(
          result.blob,
          `photo-layout-page-${pageIndex + 1}-${stamp}.${extension}`,
        );
        toastMessage(
          `${format.toUpperCase()} 已导出：${result.width} × ${result.height}px`,
          'success',
        );
      }
      patchUi({ exportDialogOpen: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : '导出失败，请重试';
      setError(message);
      toastMessage(message, 'error');
    } finally {
      setWorking(false);
      setProgress(null);
    }
  };

  const primaryLabel =
    format === 'pdf'
      ? `导出 PDF（${targetPages.length} 页）`
      : format === 'print'
        ? `打印 ${targetPages.length} 页`
        : format === 'png'
          ? '下载 PNG'
          : '下载 JPEG';

  return (
    <Modal
      open={open}
      onClose={close}
      title="导出与打印"
      subtitle="预览与导出使用同一套渲染管线，所见即所得；PDF 页面尺寸与实际纸张一致。"
      width={700}
      footer={
        <>
          <button type="button" className="btn btn-soft" onClick={close} disabled={working}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary min-w-[150px]"
            onClick={() => void runExport()}
            disabled={working}
          >
            {working ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {working ? '正在处理…' : primaryLabel}
          </button>
        </>
      }
    >
      <div className="space-y-4 px-5 py-4">
        <div>
          <p className="field-label mb-2">导出格式</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FORMATS.map((item) => {
              const Icon = item.icon;
              const active = format === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setFormat(item.value);
                    if (item.value === 'png' || item.value === 'jpeg') setScope('current');
                  }}
                  disabled={working}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition ${
                    active
                      ? 'border-indigo-300 bg-indigo-50/70 ring-1 ring-indigo-200'
                      : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium ${active ? 'text-indigo-700' : 'text-zinc-700'}`}>
                    <Icon size={14} />
                    {item.label}
                  </span>
                  <span className="text-[10px] leading-3.5 text-zinc-400">{item.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        {supportsScope ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 px-3 py-2.5">
            <div>
              <p className="text-[12px] font-medium text-zinc-700">导出范围</p>
              <p className="mt-0.5 text-[10.5px] text-zinc-400">
                共 {pages.length} 页
                {mixedSizes ? ' · 当前项目包含不同纸张尺寸' : ''}
              </p>
            </div>
            <Segmented
              value={scope}
              onChange={(v) => setScope(v)}
              options={[
                { value: 'current', label: `当前页` },
                { value: 'all', label: `全部 ${pages.length} 页` },
              ]}
              className="w-[220px]"
            />
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="field-label mb-2">输出分辨率</p>
            <div className="flex gap-1.5">
              {DPI_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDpi(value)}
                  disabled={working}
                  className={`flex-1 rounded-lg border py-1.5 text-[12px] font-medium transition ${
                    dpi === value
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
                  }`}
                >
                  {value} DPI
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10.5px] leading-4 text-zinc-400">
              打印照片建议 300 DPI；普通海报 150–200 DPI 已足够。
            </p>
          </div>

          {format === 'jpeg' || format === 'pdf' ? (
            <SliderField
              label="JPEG 质量"
              value={quality}
              min={60}
              max={100}
              step={1}
              unit="%"
              onChange={setQuality}
            />
          ) : (
            <div className="rounded-lg bg-zinc-50 px-3 py-2 text-[10.5px] leading-4 text-zinc-400">
              {format === 'png'
                ? 'PNG 使用无损压缩，文件更大，适合后续再次编辑。'
                : '打印会按当前纸张尺寸生成 1:1 页面，不缩放。'}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 px-3 py-2.5">
          <Switch
            checked={includeCutLines}
            onChange={setIncludeCutLines}
            label="包含裁切线"
            description={
              page.cutLines
                ? '当前页已开启裁切线，导出时会一并绘制'
                : '当前页未开启裁切线；此处仅控制导出文件'
            }
          />
        </div>

        <div className="rounded-xl bg-zinc-900 px-4 py-3 text-white">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              输出预览
            </span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-zinc-200">
              {targetPages.length} 页
            </span>
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium">{pageTitle(page, pageIndex)}</p>
              <p className="mt-1 text-[11px] text-zinc-400">
                {mmToCm(page.widthMm)} × {mmToCm(page.heightMm)} ·{' '}
                {page.widthMm} × {page.heightMm} mm
              </p>
            </div>
            <div className="text-right">
              <p className="tabular-nums text-[13px] font-semibold text-emerald-300">
                {effectiveDpi} DPI
              </p>
              <p className="tabular-nums text-[11px] text-zinc-400">
                {estimate.width} × {estimate.height} px
              </p>
            </div>
          </div>
        </div>

        {dpiReduced ? (
          <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-4 text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              纸张尺寸过大，为保证浏览器稳定，本次导出会降到 {effectiveDpi} DPI
              （单边最大 16000px、总量约 6000 万像素）。如需更高精度，可拆分为多页或减小纸张。
            </span>
          </div>
        ) : null}

        {format === 'print' ? (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2.5 text-[11px] leading-4 text-indigo-900">
            <p className="font-medium">打印提示</p>
            <p className="mt-1 text-indigo-800/80">
              在系统打印窗口中选择「{findPreset(page.presetId)?.name ?? '自定义'}」纸张，
              缩放设为 100% / 实际尺寸，并关闭「适应页面」。建议使用无边距照片纸以获得满版效果。
            </p>
          </div>
        ) : null}

        {progress ? (
          <div className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-[11.5px] text-zinc-600">
            <Loader2 size={13} className="animate-spin text-indigo-600" />
            正在渲染第 {progress.done} / {progress.total} 页…
          </div>
        ) : null}

        {error ? (
          <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] text-red-700">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
