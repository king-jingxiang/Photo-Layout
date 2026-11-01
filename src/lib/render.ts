import type { Frame, Page } from '../types';
import type { LoadedImage } from './image';
import {
  clamp,
  containRect,
  coverCrop,
  frameAABB,
  innerPhotoRect,
} from './geometry';

export interface RenderOptions {
  getImage: (photoId: string) => LoadedImage | undefined;
  /** 绘制裁切线 */
  cutLines?: boolean;
  /** 预览用：绘制页边距参考线 */
  marginGuides?: boolean;
  /** 隐藏图片（导出缩略图时可选） */
  hideImages?: boolean;
}

const MM_FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

function shapePath(ctx: CanvasRenderingContext2D, frame: Frame): void {
  const w = frame.w;
  const h = frame.h;
  ctx.beginPath();
  switch (frame.mask) {
    case 'circle':
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case 'heart': {
      const hw = w / 2;
      const hh = h / 2;
      ctx.moveTo(0, hh * 0.78);
      ctx.bezierCurveTo(-hw * 0.35, hh * 0.34, -hw, hh * 0.12, -hw, -hh * 0.26);
      ctx.bezierCurveTo(-hw, -hh * 0.72, -hw * 0.42, -hh * 0.82, 0, -hh * 0.4);
      ctx.bezierCurveTo(hw * 0.42, -hh * 0.82, hw, -hh * 0.72, hw, -hh * 0.26);
      ctx.bezierCurveTo(hw, hh * 0.12, hw * 0.35, hh * 0.34, 0, hh * 0.78);
      ctx.closePath();
      break;
    }
    case 'hexagon': {
      const hw = w / 2;
      const hh = h / 2;
      for (let i = 0; i < 6; i += 1) {
        const angle = -Math.PI / 2 + i * (Math.PI / 3);
        const x = Math.cos(angle) * hw;
        const y = Math.sin(angle) * hh;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
    case 'arch': {
      const r = Math.min(w / 2, h * 0.5);
      ctx.moveTo(-w / 2, h / 2);
      ctx.lineTo(-w / 2, -h / 2 + r);
      ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
      ctx.lineTo(w / 2 - r, -h / 2);
      ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      ctx.lineTo(w / 2, h / 2);
      ctx.closePath();
      break;
    }
    case 'rounded': {
      const r = clamp(frame.radiusMm, 0, Math.min(w, h) / 2);
      drawRoundedRect(ctx, -w / 2, -h / 2, w, h, r);
      break;
    }
    default: {
      ctx.rect(-w / 2, -h / 2, w, h);
    }
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

function placeholder(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  label: string,
): void {
  ctx.save();
  ctx.fillStyle = '#f4f4f5';
  ctx.fillRect(frame.w / 2 * -1, frame.h / 2 * -1, frame.w, frame.h);
  ctx.strokeStyle = '#e4e4e7';
  ctx.lineWidth = 0.4;
  const step = 4;
  for (let x = -frame.w / 2; x < frame.w / 2; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, -frame.h / 2);
    ctx.lineTo(x + frame.h, frame.h / 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#71717a';
  ctx.font = `500 ${Math.max(2.6, Math.min(frame.w, frame.h) * 0.06)}px ${MM_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 0, frame.w * 0.9);
  ctx.restore();
}

function drawPhoto(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  image: LoadedImage,
): void {
  const inner = innerPhotoRect(frame);
  const imgW = image.width;
  const imgH = image.height;
  if (imgW <= 0 || imgH <= 0) return;

  if (frame.fill === 'contain') {
    const box = containRect(imgW, imgH, inner);
    ctx.drawImage(image.source, box.x, box.y, box.w, box.h);
    return;
  }

  if (frame.fill === 'stretch') {
    ctx.drawImage(image.source, inner.x, inner.y, inner.w, inner.h);
    return;
  }

  if (frame.crop) {
    const sx = clamp(frame.crop.x * imgW, 0, imgW - 1);
    const sy = clamp(frame.crop.y * imgH, 0, imgH - 1);
    const sw = clamp(frame.crop.w * imgW, 0.5, imgW - sx);
    const sh = clamp(frame.crop.h * imgH, 0.5, imgH - sy);
    ctx.drawImage(image.source, sx, sy, sw, sh, inner.x, inner.y, inner.w, inner.h);
    return;
  }

  const crop = coverCrop(imgW, imgH, inner.w, inner.h, frame.zoom, frame.focusX, frame.focusY);
  ctx.drawImage(
    image.source,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    inner.x,
    inner.y,
    inner.w,
    inner.h,
  );
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  image: LoadedImage | undefined,
): void {
  const cx = frame.x + frame.w / 2;
  const cy = frame.y + frame.h / 2;
  ctx.save();
  ctx.globalAlpha = clamp(frame.opacity, 0, 1);
  ctx.translate(cx, cy);
  ctx.rotate((frame.rotation * Math.PI) / 180);

  if (frame.shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.32)';
    ctx.shadowBlur = Math.min(frame.w, frame.h) * 0.035 + 0.8;
    ctx.shadowOffsetY = Math.min(frame.w, frame.h) * 0.015 + 0.4;
    ctx.fillStyle = frame.matteColor || '#ffffff';
    shapePath(ctx, frame);
    ctx.fill();
    ctx.restore();
  }

  shapePath(ctx, frame);
  ctx.clip();

  // 用白色/卡纸色打底，避免阴影和 alpha 透出页面底色
  ctx.fillStyle = frame.matteColor || '#ffffff';
  ctx.fillRect(-frame.w / 2, -frame.h / 2, frame.w, frame.h);

  if (image) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    drawPhoto(ctx, frame, image);
  } else {
    placeholder(ctx, frame, '照片缺失');
  }

  if (frame.borderMm > 0) {
    ctx.lineWidth = frame.borderMm * 2;
    ctx.strokeStyle = frame.borderColor;
    shapePath(ctx, frame);
    ctx.stroke();
  }

  ctx.restore();
}

/** 绘制一页内容，坐标系原点为页面左上角，单位为 mm */
export function renderPage(
  ctx: CanvasRenderingContext2D,
  page: Page,
  options: RenderOptions,
): void {
  ctx.save();
  ctx.fillStyle = page.background || '#ffffff';
  ctx.fillRect(0, 0, page.widthMm, page.heightMm);
  for (const frame of page.items) {
    const image = options.hideImages ? undefined : options.getImage(frame.photoId);
    drawFrame(ctx, frame, image);
  }

  if (options.marginGuides && page.marginMm > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.55)';
    ctx.lineWidth = 0.25;
    ctx.setLineDash([1.6, 1.2]);
    ctx.strokeRect(
      page.marginMm,
      page.marginMm,
      page.widthMm - page.marginMm * 2,
      page.heightMm - page.marginMm * 2,
    );
    ctx.restore();
  }

  if (options.cutLines) {
    ctx.save();
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.85)';
    ctx.lineWidth = 0.22;
    ctx.setLineDash([2, 1.4]);
    for (const frame of page.items) {
      const box = frameAABB(frame);
      ctx.strokeRect(box.x, box.y, box.w, box.h);
    }
    ctx.restore();
  }

  ctx.restore();
}

/** 计算页面在指定 DPI 下的像素尺寸 */
export function pagePixelSize(page: Page, dpi: number): { width: number; height: number } {
  return {
    width: Math.round((page.widthMm / 25.4) * dpi),
    height: Math.round((page.heightMm / 25.4) * dpi),
  };
}

/** 离屏渲染整页，用于导出 */
export function renderPageToCanvas(
  page: Page,
  dpi: number,
  options: Omit<RenderOptions, 'marginGuides'>,
): HTMLCanvasElement {
  const { width, height } = pagePixelSize(page, dpi);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布上下文');
  const scale = width / page.widthMm;
  ctx.scale(scale, scale);
  renderPage(ctx, page, options);
  return canvas;
}
