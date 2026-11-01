import { PDFDocument } from 'pdf-lib';
import type { Page } from '../types';
import { getImage } from './image';
import { pagePixelSize, renderPageToCanvas } from './render';

const MAX_CANVAS_SIDE = 16000;
const MAX_CANVAS_PIXELS = 60_000_000;
const MM_PER_INCH = 25.4;
const PT_PER_INCH = 72;

export interface ExportOptions {
  dpi: number;
  /** JPEG 质量 0-1 */
  quality: number;
  /** 是否把裁切线渲染进导出文件 */
  includeCutLines: boolean;
}

export interface PreparedPage {
  page: Page;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  effectiveDpi: number;
}

export function safeExportDpi(page: Page, dpi: number): number {
  const widthIn = page.widthMm / MM_PER_INCH;
  const heightIn = page.heightMm / MM_PER_INCH;
  const maxInch = Math.max(widthIn, heightIn);
  const sideLimit = MAX_CANVAS_SIDE / Math.max(1, maxInch);
  // 同时限制总像素，避免 A2 / A1 在高 DPI 下占用过多内存
  const areaLimit = Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, widthIn * heightIn));
  const limit = Math.floor(Math.min(sideLimit, areaLimit));
  return Math.max(72, Math.min(dpi, limit));
}

export function estimateOutput(page: Page, dpi: number): { width: number; height: number; dpi: number } {
  const effective = safeExportDpi(page, dpi);
  const size = pagePixelSize(page, effective);
  return { ...size, dpi: effective };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('画布导出失败'))),
      type,
      quality,
    );
  });
}

export function preparePage(
  page: Page,
  options: ExportOptions,
): PreparedPage {
  const effectiveDpi = safeExportDpi(page, options.dpi);
  const canvas = renderPageToCanvas(page, effectiveDpi, {
    getImage,
    cutLines: options.includeCutLines ? page.cutLines : false,
  });
  return {
    page,
    canvas,
    width: canvas.width,
    height: canvas.height,
    effectiveDpi,
  };
}

export async function exportSingleImage(
  page: Page,
  options: ExportOptions,
  format: 'png' | 'jpeg',
): Promise<{ blob: Blob; width: number; height: number; effectiveDpi: number }> {
  const prepared = preparePage(page, options);
  const blob = await canvasToBlob(
    prepared.canvas,
    format === 'png' ? 'image/png' : 'image/jpeg',
    options.quality,
  );
  return {
    blob,
    width: prepared.width,
    height: prepared.height,
    effectiveDpi: prepared.effectiveDpi,
  };
}

export async function exportPdf(
  pages: Page[],
  options: ExportOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<{ blob: Blob; effectiveDpi: number }> {
  const doc = await PDFDocument.create();
  doc.setTitle('Photo Layout Studio 排版作品');
  doc.setCreator('Photo Layout Studio');
  doc.setProducer('Photo Layout Studio · pdf-lib');
  let lastDpi = options.dpi;
  for (let i = 0; i < pages.length; i += 1) {
    const prepared = preparePage(pages[i], options);
    lastDpi = prepared.effectiveDpi;
    const jpeg = await canvasToBlob(prepared.canvas, 'image/jpeg', options.quality);
    const bytes = new Uint8Array(await jpeg.arrayBuffer());
    const embedded = await doc.embedJpg(bytes);
    const widthPt = (prepared.page.widthMm / MM_PER_INCH) * PT_PER_INCH;
    const heightPt = (prepared.page.heightMm / MM_PER_INCH) * PT_PER_INCH;
    const pdfPage = doc.addPage([widthPt, heightPt]);
    pdfPage.drawImage(embedded, { x: 0, y: 0, width: widthPt, height: heightPt });
    onProgress?.(i + 1, pages.length);
    // 尽早释放大画布占用的内存
    prepared.canvas.width = 1;
    prepared.canvas.height = 1;
  }
  const bytes = await doc.save();
  const blob = new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' });
  return { blob, effectiveDpi: lastDpi };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function fileStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

async function dataUrlToImage(dataUrl: string): Promise<HTMLImageElement> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('打印图片加载失败'));
    img.src = dataUrl;
  });
  return img;
}

/**
 * 浏览器打印：使用隐藏 iframe + @page 尺寸，保证 1:1 毫米尺寸。
 * 提示用户关闭「适应页面 / 缩放」以获得真实尺寸。
 */
export async function printPages(
  pages: Page[],
  dpi: number,
  includeCutLines: boolean,
): Promise<void> {
  const page = pages[0];
  if (!page) return;
  const effective = safeExportDpi(page, dpi);
  const images: string[] = [];
  for (const p of pages) {
    const prepared = preparePage(p, {
      dpi: effective,
      quality: 0.95,
      includeCutLines,
    });
    images.push(prepared.canvas.toDataURL('image/jpeg', 0.95));
    prepared.canvas.width = 1;
    prepared.canvas.height = 1;
  }

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);
  const frameDoc = iframe.contentDocument;
  if (!frameDoc) {
    iframe.remove();
    throw new Error('无法创建打印文档');
  }
  const sizeCss = `${page.widthMm}mm ${page.heightMm}mm`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${sizeCss}; margin: 0; }
    html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { width: ${page.widthMm}mm; height: ${page.heightMm}mm; page-break-after: always; break-after: page; overflow: hidden; }
    .sheet:last-child { page-break-after: auto; break-after: auto; }
    img { display: block; width: 100%; height: 100%; }
  </style></head><body>${images
    .map((src) => `<div class="sheet"><img src="${src}" alt=""></div>`)
    .join('')}</body></html>`;
  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  const frames = Array.from(frameDoc.querySelectorAll('img'));
  await Promise.all(frames.map((img) => dataUrlToImage(img.src)));
  await new Promise((resolve) => setTimeout(resolve, 60));

  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();

  setTimeout(() => iframe.remove(), 4000);
}
