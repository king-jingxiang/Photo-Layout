import type { PhotoMeta } from '../types';
import { uid } from './layout';

export interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  bitmap: ImageBitmap | null;
}

const imageCache = new Map<string, LoadedImage>();
const thumbCache = new Map<string, string>();

export function getImage(id: string): LoadedImage | undefined {
  return imageCache.get(id);
}

export function getThumb(id: string): string | undefined {
  return thumbCache.get(id);
}

export function setThumb(id: string, thumb: string): void {
  thumbCache.set(id, thumb);
}

export function setImage(id: string, image: LoadedImage): void {
  imageCache.set(id, image);
}

export function deleteImage(id: string): void {
  const cached = imageCache.get(id);
  if (cached?.bitmap) cached.bitmap.close();
  imageCache.delete(id);
  thumbCache.delete(id);
}

async function decodeBlob(blob: Blob): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  bitmap: ImageBitmap | null;
}> {
  try {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, bitmap };
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('图片解码失败'));
        el.src = url;
      });
      return {
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        bitmap: null,
      };
    } finally {
      // 图片元素已保留解码结果，可安全释放 URL
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

function makeThumb(image: LoadedImage, maxSide = 480): string {
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image.source, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.84);
}

export interface DecodedPhoto {
  meta: PhotoMeta;
  blob: Blob;
}

/** 解码用户上传的文件 / 持久化的 Blob，返回元数据与缩略图 */
export async function importPhotoBlob(
  blob: Blob,
  name: string,
  id = uid('photo'),
): Promise<DecodedPhoto> {
  const image = await decodeBlob(blob);
  const thumb = makeThumb(image);
  imageCache.set(id, image);
  thumbCache.set(id, thumb);
  const meta: PhotoMeta = {
    id,
    name,
    width: image.width,
    height: image.height,
    byteSize: blob.size,
    thumb,
    createdAt: Date.now(),
  };
  return { meta, blob };
}

export async function importPhotoFile(file: File): Promise<DecodedPhoto> {
  return importPhotoBlob(file, file.name.replace(/\.[^.]+$/, ''), uid('photo'));
}

/** 启动时从 IndexedDB 恢复照片到内存缓存 */
export async function restorePhoto(meta: PhotoMeta, blob: Blob): Promise<void> {
  imageCache.set(meta.id, await decodeBlob(blob).then((image) => ({ ...image })));
  thumbCache.set(meta.id, meta.thumb);
}

/** 生成示例照片，方便离线体验排版的完整流程 */
export async function createSamplePhotos(): Promise<DecodedPhoto[]> {
  const samples: Array<{
    name: string;
    w: number;
    h: number;
    colors: [string, string, string];
    sun: string;
    kind: 'mountain' | 'dune' | 'city' | 'sea' | 'abstract';
  }> = [
    { name: '示例 · 晨雾山谷', w: 1800, h: 1200, colors: ['#0f172a', '#5b7cfa', '#f2c4a8'], sun: '#ffe3b3', kind: 'mountain' },
    { name: '示例 · 海边日落', w: 1200, h: 1600, colors: ['#1e1b4b', '#f97316', '#fde68a'], sun: '#fff7d6', kind: 'sea' },
    { name: '示例 · 沙丘', w: 1600, h: 1067, colors: ['#3f1d0b', '#d97706', '#fde3b3'], sun: '#fff3c4', kind: 'dune' },
    { name: '示例 · 城市夜色', w: 1200, h: 1200, colors: ['#0b1020', '#4338ca', '#c084fc'], sun: '#fef08a', kind: 'city' },
    { name: '示例 · 几何构成', w: 1600, h: 900, colors: ['#0f766e', '#34d399', '#fef08a'], sun: '#ffffff', kind: 'abstract' },
    { name: '示例 · 山谷晨光', w: 1200, h: 1800, colors: ['#111827', '#0ea5e9', '#fbcfe8'], sun: '#fff1f2', kind: 'mountain' },
  ];

  const results: DecodedPhoto[] = [];
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const canvas = document.createElement('canvas');
    canvas.width = sample.w;
    canvas.height = sample.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    const gradient = ctx.createLinearGradient(0, 0, sample.w * 0.4, sample.h);
    gradient.addColorStop(0, sample.colors[0]);
    gradient.addColorStop(0.55, sample.colors[1]);
    gradient.addColorStop(1, sample.colors[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, sample.w, sample.h);

    const sunX = sample.w * (0.55 + index * 0.03);
    const sunY = sample.h * 0.38;
    const sunR = Math.min(sample.w, sample.h) * 0.12;
    const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 3.2);
    glow.addColorStop(0, sample.sun);
    glow.addColorStop(0.25, `${sample.sun}cc`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, sample.w, sample.h);
    ctx.fillStyle = sample.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();

    if (sample.kind === 'mountain') {
      for (let layer = 0; layer < 3; layer += 1) {
        ctx.fillStyle = `rgba(15,23,42,${0.25 + layer * 0.22})`;
        ctx.beginPath();
        ctx.moveTo(0, sample.h);
        const baseY = sample.h * (0.62 + layer * 0.09);
        for (let x = 0; x <= sample.w; x += sample.w / 5) {
          const peak = baseY - (x % 2 === 0 ? sample.h * 0.12 : sample.h * 0.04);
          ctx.lineTo(x, peak);
          ctx.lineTo(x + sample.w / 10, baseY + sample.h * 0.02);
        }
        ctx.lineTo(sample.w, sample.h);
        ctx.closePath();
        ctx.fill();
      }
    } else if (sample.kind === 'dune') {
      for (let layer = 0; layer < 4; layer += 1) {
        ctx.fillStyle = `rgba(60,20,5,${0.18 + layer * 0.16})`;
        ctx.beginPath();
        ctx.moveTo(0, sample.h);
        ctx.bezierCurveTo(
          sample.w * 0.3,
          sample.h * (0.55 + layer * 0.08),
          sample.w * 0.7,
          sample.h * (0.95 - layer * 0.06),
          sample.w,
          sample.h * (0.72 + layer * 0.05),
        );
        ctx.lineTo(sample.w, sample.h);
        ctx.closePath();
        ctx.fill();
      }
    } else if (sample.kind === 'city') {
      ctx.fillStyle = 'rgba(2,6,23,0.65)';
      for (let b = 0; b < 12; b += 1) {
        const bw = sample.w / 16;
        const bh = sample.h * (0.12 + ((b * 37) % 40) / 100);
        const bx = b * bw * 1.35;
        ctx.fillRect(bx, sample.h - bh, bw, bh);
        ctx.fillStyle = 'rgba(254,240,138,0.55)';
        for (let wy = sample.h - bh + 18; wy < sample.h - 12; wy += 22) {
          for (let wx = bx + 8; wx < bx + bw - 8; wx += 18) {
            if ((wx + wy) % 3 === 0) ctx.fillRect(wx, wy, 5, 8);
          }
        }
        ctx.fillStyle = 'rgba(2,6,23,0.65)';
      }
    } else if (sample.kind === 'sea') {
      ctx.fillStyle = 'rgba(8,47,73,0.45)';
      ctx.beginPath();
      ctx.moveTo(0, sample.h * 0.62);
      for (let x = 0; x <= sample.w; x += 24) {
        ctx.quadraticCurveTo(x + 12, sample.h * 0.62 - 8, x + 24, sample.h * 0.62);
      }
      ctx.lineTo(sample.w, sample.h);
      ctx.lineTo(0, sample.h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 10; i += 1) {
        ctx.beginPath();
        const yy = sample.h * (0.68 + i * 0.03);
        ctx.moveTo(sample.w * 0.1, yy);
        ctx.lineTo(sample.w * (0.35 + i * 0.03), yy);
        ctx.stroke();
      }
    } else {
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < 7; i += 1) {
        ctx.fillStyle = ['#fef08a', '#fb7185', '#38bdf8', '#ffffff', '#a3e635'][i % 5];
        const size = sample.w * (0.08 + ((i * 13) % 20) / 100);
        ctx.beginPath();
        ctx.arc(
          sample.w * (0.12 + i * 0.12),
          sample.h * (0.35 + ((i * 23) % 40) / 100),
          size,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 增加轻微颗粒感，避免纯色渐变过于平淡
    const grainCount = 1200;
    for (let i = 0; i < grainCount; i += 1) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * sample.w, Math.random() * sample.h, 2, 2);
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9),
    );
    if (!blob) continue;
    results.push(await importPhotoBlob(blob, sample.name));
  }
  return results;
}
