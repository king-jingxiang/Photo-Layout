import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as RMouseEvent,
  type PointerEvent as RPointerEvent,
} from 'react';
import {
  ImagePlus,
  Lock,
  RotateCw,
  Sparkles,
  Upload,
  Loader2,
} from 'lucide-react';
import type { Frame, SnapLine } from '../types';
import { findPreset } from '../data/papers';
import { useActivePage, useAppStore, useSelectedFrame } from '../store/store';
import { getImage } from '../lib/image';
import { renderPage } from '../lib/render';
import {
  clamp,
  coverCrop,
  deg2rad,
  hitTestFrame,
  innerPhotoRect,
  pageToLocal,
  snapMove,
  type Point,
  type Rect,
} from '../lib/geometry';

type DragState =
  | {
      mode: 'move';
      frameId: string;
      start: Point;
      screenStart: Point;
      orig: Frame;
    }
  | {
      mode: 'resize';
      frameId: string;
      startScreen: Point;
      orig: Frame;
      sx: number;
      sy: number;
    }
  | {
      mode: 'rotate';
      frameId: string;
      centerScreen: Point;
      startAngle: number;
      orig: Frame;
    }
  | {
      mode: 'crop';
      frameId: string;
      start: Point;
      orig: Frame;
    }
  | {
      mode: 'pan';
      screenStart: Point;
      panX: number;
      panY: number;
    };

const CORNERS: Array<{ key: string; left: boolean; top: boolean; cursor: string }> = [
  { key: 'nw', left: true, top: true, cursor: 'nwse-resize' },
  { key: 'ne', left: false, top: true, cursor: 'nesw-resize' },
  { key: 'sw', left: true, top: false, cursor: 'nesw-resize' },
  { key: 'se', left: false, top: false, cursor: 'nwse-resize' },
];

const MIN_FRAME_MM = 8;

function rotateVector(x: number, y: number, deg: number): Point {
  const a = deg2rad(deg);
  return {
    x: x * Math.cos(a) - y * Math.sin(a),
    y: x * Math.sin(a) + y * Math.cos(a),
  };
}

function normalizeAngle(deg: number): number {
  let v = deg % 360;
  if (v > 180) v -= 360;
  if (v < -180) v += 360;
  return Math.round(v * 10) / 10;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function CanvasView() {
  const page = useActivePage();
  const pageCount = useAppStore((s) => s.project.pages.length);
  const pageIndex = useAppStore((s) =>
    s.project.pages.findIndex((p) => p.id === s.activePageId),
  );
  const photos = useAppStore((s) => s.photos);
  const hydrated = useAppStore((s) => s.hydrated);
  const busy = useAppStore((s) => s.busy);
  const zoomFactor = useAppStore((s) => s.ui.zoom);
  const panX = useAppStore((s) => s.ui.panX);
  const panY = useAppStore((s) => s.ui.panY);
  const showMargins = useAppStore((s) => s.ui.showMargins);
  const showRulers = useAppStore((s) => s.ui.showRulers);
  const snapEnabled = useAppStore((s) => s.ui.snapEnabled);
  const cropFrameId = useAppStore((s) => s.ui.cropFrameId);
  const selectedFrame = useSelectedFrame();
  const setPan = useAppStore((s) => s.setPan);
  const patchUi = useAppStore((s) => s.patchUi);
  const selectFrame = useAppStore((s) => s.selectFrame);
  const setCropFrame = useAppStore((s) => s.setCropFrame);
  const updateFrame = useAppStore((s) => s.updateFrame);
  const addPhotos = useAppStore((s) => s.addPhotos);
  const addSamples = useAppStore((s) => s.addSamples);
  const applyTemplate = useAppStore((s) => s.applyTemplate);
  const setTab = useAppStore((s) => s.setTab);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [snapLines, setSnapLines] = useState<SnapLine[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [cursor, setCursor] = useState('default');
  const [spacePressed, setSpacePressed] = useState(false);
  const [fileDragOver, setFileDragOver] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const spaceRef = useRef(false);

  const padX = 88;
  const padY = 112;
  const fitScale =
    size.w > 0 && size.h > 0
      ? Math.max(
          0.05,
          Math.min((size.w - padX) / page.widthMm, (size.h - padY) / page.heightMm),
        )
      : 1;
  const factor = zoomFactor ?? 1;
  const scale = fitScale * factor;
  const originX = size.w / 2 - (page.widthMm * scale) / 2 + panX;
  const originY = size.h / 2 - (page.heightMm * scale) / 2 + panY + 4;

  const viewRef = useRef({
    size,
    fitScale,
    scale,
    originX,
    originY,
    factor,
    page,
  });
  viewRef.current = { size, fitScale, scale, originX, originY, factor, page };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setSize({ w: Math.round(rect.width), h: Math.round(rect.height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 绘制预览
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w <= 0 || size.h <= 0) return;
    let raf = 0;
    raf = requestAnimationFrame(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelW = Math.round(size.w * dpr);
      const pixelH = Math.round(size.h * dpr);
      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW;
        canvas.height = pixelH;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.w, size.h);

      // 工作区底色与点阵
      ctx.fillStyle = '#e9e9ec';
      ctx.fillRect(0, 0, size.w, size.h);
      ctx.fillStyle = 'rgba(24, 24, 27, 0.055)';
      const gap = 24;
      const offset = 12;
      for (let y = offset; y < size.h; y += gap) {
        for (let x = offset; x < size.w; x += gap) {
          ctx.fillRect(x, y, 1, 1);
        }
      }

      const pw = page.widthMm * scale;
      const ph = page.heightMm * scale;

      // 纸张投影
      ctx.save();
      ctx.shadowColor = 'rgba(24, 24, 27, 0.18)';
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 10;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(originX, originY, pw, ph);
      ctx.restore();

      // 纸张内容（超出纸张的部分按打印效果裁掉）
      ctx.save();
      ctx.beginPath();
      ctx.rect(originX, originY, pw, ph);
      ctx.clip();
      ctx.translate(originX, originY);
      ctx.scale(scale, scale);
      renderPage(ctx, page, {
        getImage,
        cutLines: page.cutLines,
        marginGuides: showMargins,
      });

      if (snapLines.length) {
        ctx.strokeStyle = 'rgba(79, 70, 229, 0.8)';
        ctx.lineWidth = 1 / scale;
        ctx.setLineDash([3 / scale, 2 / scale]);
        for (const line of snapLines) {
          ctx.beginPath();
          if (line.axis === 'x') {
            ctx.moveTo(line.value, 0);
            ctx.lineTo(line.value, page.heightMm);
          } else {
            ctx.moveTo(0, line.value);
            ctx.lineTo(page.widthMm, line.value);
          }
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      ctx.restore();

      // 纸张描边
      ctx.strokeStyle = 'rgba(9, 9, 11, 0.10)';
      ctx.lineWidth = 1;
      ctx.strokeRect(originX + 0.5, originY + 0.5, pw - 1, ph - 1);

      // 标尺
      if (showRulers) {
        const stepMm = 10 * scale >= 34 ? 10 : 20 * scale >= 34 ? 20 : 50;
        const labelEvery = stepMm * 2;
        ctx.save();
        ctx.strokeStyle = 'rgba(113, 113, 122, 0.35)';
        ctx.fillStyle = 'rgba(113, 113, 122, 0.85)';
        ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
        ctx.lineWidth = 1;
        const topY = originY - 9;
        ctx.beginPath();
        ctx.moveTo(originX, topY);
        ctx.lineTo(originX + pw, topY);
        ctx.stroke();
        for (let mm = 0; mm <= page.widthMm; mm += stepMm) {
          const x = originX + mm * scale;
          const major = mm % labelEvery === 0;
          ctx.beginPath();
          ctx.moveTo(x, topY);
          ctx.lineTo(x, topY + (major ? 6 : 3));
          ctx.stroke();
          if (major) {
            ctx.textAlign = mm === 0 ? 'left' : 'center';
            ctx.fillText(String(Math.round(mm / 10)), x, topY - 3);
          }
        }
        const leftX = originX - 9;
        ctx.beginPath();
        ctx.moveTo(leftX, originY);
        ctx.lineTo(leftX, originY + ph);
        ctx.stroke();
        for (let mm = 0; mm <= page.heightMm; mm += stepMm) {
          const y = originY + mm * scale;
          const major = mm % labelEvery === 0;
          ctx.beginPath();
          ctx.moveTo(leftX, y);
          ctx.lineTo(leftX + (major ? 6 : 3), y);
          ctx.stroke();
          if (major) {
            ctx.textAlign = 'right';
            ctx.fillText(String(Math.round(mm / 10)), leftX - 1, y + 3);
          }
        }
        ctx.restore();
      }

      // 纸张名称与页码
      const presetName =
        page.presetId === 'custom'
          ? '自定义尺寸'
          : (findPreset(page.presetId)?.name ?? '自定义尺寸');
      const labelY = Math.max(12, originY - 30);
      ctx.save();
      ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = '#3f3f46';
      ctx.textAlign = 'left';
      ctx.fillText(
        `${presetName} · ${page.widthMm} × ${page.heightMm} mm`,
        originX,
        labelY,
      );
      ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = '#a1a1aa';
      ctx.textAlign = 'right';
      ctx.fillText(
        `第 ${pageIndex + 1} / ${pageCount} 页${page.note ? ` · ${page.note}` : ''}`,
        originX + pw,
        labelY,
      );
      ctx.restore();
    });
    return () => cancelAnimationFrame(raf);
  }, [
    page,
    pageIndex,
    pageCount,
    size,
    scale,
    originX,
    originY,
    showMargins,
    showRulers,
    snapLines,
    photos,
  ]);

  const getPagePoint = (clientX: number, clientY: number): { page: Point; screen: Point } => {
    const rect = containerRef.current?.getBoundingClientRect();
    const view = viewRef.current;
    const screen = {
      x: clientX - (rect?.left ?? 0),
      y: clientY - (rect?.top ?? 0),
    };
    return {
      page: {
        x: (screen.x - view.originX) / view.scale,
        y: (screen.y - view.originY) / view.scale,
      },
      screen,
    };
  };

  const frameAt = (point: Point): Frame | null => {
    const page = viewRef.current.page;
    for (let i = page.items.length - 1; i >= 0; i -= 1) {
      if (hitTestFrame(page.items[i], point)) return page.items[i];
    }
    return null;
  };

  const beginCanvasPointer = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || (e.button === 0 && spaceRef.current)) {
      dragRef.current = {
        mode: 'pan',
        screenStart: getPagePoint(e.clientX, e.clientY).screen,
        panX: useAppStore.getState().ui.panX,
        panY: useAppStore.getState().ui.panY,
      };
      containerRef.current?.setPointerCapture(e.pointerId);
      setCursor('grabbing');
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;
    const { page: point } = getPagePoint(e.clientX, e.clientY);
    const frame = frameAt(point);
    if (!frame) {
      selectFrame(null);
      return;
    }
    const state = useAppStore.getState();
    if (state.ui.cropFrameId !== frame.id) selectFrame(frame.id);
    containerRef.current?.setPointerCapture(e.pointerId);
    if (state.ui.cropFrameId === frame.id) {
      if (frame.locked || frame.fill !== 'cover' || frame.crop) return;
      dragRef.current = { mode: 'crop', frameId: frame.id, start: point, orig: frame };
      setCursor('grabbing');
    } else if (!frame.locked) {
      dragRef.current = { mode: 'move', frameId: frame.id, start: point, screenStart: getPagePoint(e.clientX, e.clientY).screen, orig: frame };
      setCursor('move');
    }
  };

  const beginResize = (e: RPointerEvent, sx: number, sy: number) => {
    const frame = selectedFrame;
    if (!frame || frame.locked) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = {
      mode: 'resize',
      frameId: frame.id,
      startScreen: getPagePoint(e.clientX, e.clientY).screen,
      orig: frame,
      sx,
      sy,
    };
    containerRef.current?.setPointerCapture(e.pointerId);
    setCursor('grabbing');
  };

  const beginRotate = (e: RPointerEvent) => {
    if (!selectedFrame || selectedFrame.locked) return;
    e.stopPropagation();
    e.preventDefault();
    const view = viewRef.current;
    const centerScreen = {
      x: view.originX + (selectedFrame.x + selectedFrame.w / 2) * view.scale,
      y: view.originY + (selectedFrame.y + selectedFrame.h / 2) * view.scale,
    };
    const p = getPagePoint(e.clientX, e.clientY).screen;
    dragRef.current = {
      mode: 'rotate',
      frameId: selectedFrame.id,
      centerScreen,
      startAngle: (Math.atan2(p.y - centerScreen.y, p.x - centerScreen.x) * 180) / Math.PI,
      orig: selectedFrame,
    };
    containerRef.current?.setPointerCapture(e.pointerId);
    setCursor('grabbing');
  };

  const handlePointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      const { page: point } = getPagePoint(e.clientX, e.clientY);
      const frame = frameAt(point);
      if (spaceRef.current) {
        setCursor('grab');
      } else if (!frame) {
        setCursor('default');
      } else if (cropFrameId === frame.id) {
        setCursor('grab');
      } else if (frame.locked) {
        setCursor('default');
      } else {
        setCursor('move');
      }
      return;
    }

    if (drag.mode === 'pan') {
      const p = getPagePoint(e.clientX, e.clientY).screen;
      setPan(
        drag.panX + (p.x - drag.screenStart.x),
        drag.panY + (p.y - drag.screenStart.y),
      );
      return;
    }

    if (drag.mode === 'crop') {
      const { page: point } = getPagePoint(e.clientX, e.clientY);
      const delta = { x: point.x - drag.start.x, y: point.y - drag.start.y };
      const image = getImage(drag.orig.photoId);
      if (!image) return;
      const local = rotateVector(delta.x, delta.y, -drag.orig.rotation);
      const inner = innerPhotoRect(drag.orig);
      const crop = coverCrop(
        image.width,
        image.height,
        inner.w,
        inner.h,
        drag.orig.zoom,
        drag.orig.focusX,
        drag.orig.focusY,
      );
      const nextFocusX = clamp(
        drag.orig.focusX - (local.x / inner.w) * (crop.sw / image.width),
        crop.sw / (2 * image.width),
        1 - crop.sw / (2 * image.width),
      );
      const nextFocusY = clamp(
        drag.orig.focusY - (local.y / inner.h) * (crop.sh / image.height),
        crop.sh / (2 * image.height),
        1 - crop.sh / (2 * image.height),
      );
      updateFrame(
        drag.frameId,
        { focusX: nextFocusX, focusY: nextFocusY },
        { historyKey: `crop-pan:${drag.frameId}` },
      );
      return;
    }

    if (drag.mode === 'move') {
      const { page: point } = getPagePoint(e.clientX, e.clientY);
      const delta = { x: point.x - drag.start.x, y: point.y - drag.start.y };
      let rect: Rect = {
        x: drag.orig.x + delta.x,
        y: drag.orig.y + delta.y,
        w: drag.orig.w,
        h: drag.orig.h,
      };
      let lines: SnapLine[] = [];
      if (snapEnabled) {
        const currentPage = useAppStore.getState().project.pages.find(
          (p) => p.id === useAppStore.getState().activePageId,
        );
        if (currentPage) {
          const targets: Array<{ rect: Rect; kind: SnapLine['kind'] }> = [
            { rect: { x: 0, y: 0, w: currentPage.widthMm, h: currentPage.heightMm }, kind: 'page' },
          ];
          if (currentPage.marginMm > 0) {
            targets.push({
              rect: {
                x: currentPage.marginMm,
                y: currentPage.marginMm,
                w: currentPage.widthMm - currentPage.marginMm * 2,
                h: currentPage.heightMm - currentPage.marginMm * 2,
              },
              kind: 'margin',
            });
          }
          for (const other of currentPage.items) {
            if (other.id === drag.frameId) continue;
            const box = {
              x: other.x,
              y: other.y,
              w: other.w,
              h: other.h,
            };
            if (other.rotation !== 0) {
              const a = deg2rad(other.rotation);
              const cos = Math.abs(Math.cos(a));
              const sin = Math.abs(Math.sin(a));
              const cx = other.x + other.w / 2;
              const cy = other.y + other.h / 2;
              const aw = other.w * cos + other.h * sin;
              const ah = other.w * sin + other.h * cos;
              targets.push({
                rect: { x: cx - aw / 2, y: cy - ah / 2, w: aw, h: ah },
                kind: 'frame',
              });
            } else {
              targets.push({ rect: box, kind: 'frame' });
            }
          }
          const snapped = snapMove(rect, targets, 1.2);
          rect = { ...rect, x: snapped.x, y: snapped.y };
          lines = snapped.lines;
        }
      }
      updateFrame(
        drag.frameId,
        { x: rect.x, y: rect.y },
        { historyKey: `move:${drag.frameId}` },
      );
      setSnapLines(lines);
      setHint(`${Math.round(rect.x)} , ${Math.round(rect.y)} mm`);
      return;
    }

    if (drag.mode === 'resize') {
      const p = getPagePoint(e.clientX, e.clientY).screen;
      const delta = { x: p.x - drag.startScreen.x, y: p.y - drag.startScreen.y };
      const local = rotateVector(delta.x, delta.y, -drag.orig.rotation);
      let newW = Math.max(MIN_FRAME_MM, drag.orig.w + drag.sx * local.x);
      let newH = Math.max(MIN_FRAME_MM, drag.orig.h + drag.sy * local.y);
      if (e.shiftKey) {
        const aspect = drag.orig.w / drag.orig.h;
        if (Math.abs(local.x / drag.orig.w) >= Math.abs(local.y / drag.orig.h)) {
          newH = newW / aspect;
        } else {
          newW = newH * aspect;
        }
      }
      newW = Math.max(MIN_FRAME_MM, newW);
      newH = Math.max(MIN_FRAME_MM, newH);
      const shift = rotateVector(
        (drag.sx * (newW - drag.orig.w)) / 2,
        (drag.sy * (newH - drag.orig.h)) / 2,
        drag.orig.rotation,
      );
      const center = {
        x: drag.orig.x + drag.orig.w / 2 + shift.x,
        y: drag.orig.y + drag.orig.h / 2 + shift.y,
      };
      updateFrame(
        drag.frameId,
        {
          x: center.x - newW / 2,
          y: center.y - newH / 2,
          w: newW,
          h: newH,
        },
        { historyKey: `resize:${drag.frameId}` },
      );
      setHint(`${Math.round(newW)} × ${Math.round(newH)} mm`);
      return;
    }

    if (drag.mode === 'rotate') {
      const p = getPagePoint(e.clientX, e.clientY).screen;
      const angle = (Math.atan2(p.y - drag.centerScreen.y, p.x - drag.centerScreen.x) * 180) / Math.PI;
      let delta = angle - drag.startAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      let rotation = drag.orig.rotation + delta;
      if (e.shiftKey) {
        rotation = Math.round(rotation / 15) * 15;
      } else {
        const nearest = Math.round(rotation / 90) * 90;
        if (Math.abs(rotation - nearest) < 3) rotation = nearest;
      }
      rotation = normalizeAngle(rotation);
      updateFrame(drag.frameId, { rotation }, { historyKey: `rotate:${drag.frameId}` });
      setHint(`${Math.round(rotation)}°`);
    }
  };

  const handlePointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    containerRef.current?.releasePointerCapture(e.pointerId);
    setSnapLines([]);
    setHint(null);
    setCursor(spaceRef.current ? 'grab' : 'default');
  };

  const handleDoubleClick = (e: RMouseEvent<HTMLCanvasElement>) => {
    const { page: point } = getPagePoint(e.clientX, e.clientY);
    const frame = frameAt(point);
    if (!frame) return;
    const state = useAppStore.getState();
    setCropFrame(state.ui.cropFrameId === frame.id ? null : frame.id);
  };

  // 滚轮：取景模式缩放照片，否则缩放视图（以指针为中心）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const state = useAppStore.getState();
      const pageNow = state.project.pages.find((p) => p.id === state.activePageId);
      if (!pageNow) return;
      const view = viewRef.current;
      const rect = el.getBoundingClientRect();
      const mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const pagePoint = {
        x: (mouse.x - view.originX) / view.scale,
        y: (mouse.y - view.originY) / view.scale,
      };

      const cropFrame = state.ui.cropFrameId
        ? pageNow.items.find((f) => f.id === state.ui.cropFrameId)
        : null;
      if (
        cropFrame &&
        cropFrame.fill === 'cover' &&
        !cropFrame.crop &&
        hitTestFrame(cropFrame, pagePoint)
      ) {
        const image = getImage(cropFrame.photoId);
        if (!image) return;
        const step = Math.exp(-e.deltaY * 0.0018);
        const newZoom = clamp(cropFrame.zoom * step, 1, 8);
        if (newZoom === cropFrame.zoom) return;
        const inner = innerPhotoRect(cropFrame);
        const local = pageToLocal(cropFrame, pagePoint);
        const fx = local.x / inner.w;
        const fy = local.y / inner.h;
        const before = coverCrop(
          image.width,
          image.height,
          inner.w,
          inner.h,
          cropFrame.zoom,
          cropFrame.focusX,
          cropFrame.focusY,
        );
        const nextCropW = before.sw * (cropFrame.zoom / newZoom);
        const nextCropH = before.sh * (cropFrame.zoom / newZoom);
        const focusX = clamp(
          cropFrame.focusX + fx * (before.sw - nextCropW) / image.width,
          nextCropW / (2 * image.width),
          1 - nextCropW / (2 * image.width),
        );
        const focusY = clamp(
          cropFrame.focusY + fy * (before.sh - nextCropH) / image.height,
          nextCropH / (2 * image.height),
          1 - nextCropH / (2 * image.height),
        );
        state.updateFrame(
          cropFrame.id,
          { zoom: newZoom, focusX, focusY },
          { historyKey: `crop-zoom:${cropFrame.id}` },
        );
        return;
      }

      const step = Math.exp(-e.deltaY * 0.0012);
      const nextFactor = clamp((state.ui.zoom ?? 1) * step, 0.3, 5);
      const nextScale = view.fitScale * nextFactor;
      const nextPanX =
        mouse.x - pagePoint.x * nextScale - (view.size.w / 2 - (pageNow.widthMm * nextScale) / 2);
      const nextPanY =
        mouse.y - pagePoint.y * nextScale - (view.size.h / 2 - (pageNow.heightMm * nextScale) / 2);
      state.patchUi({ zoom: nextFactor, panX: nextPanX, panY: nextPanY });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // 空格拖拽画布 + 快捷键
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const state = useAppStore.getState();
      if (state.ui.exportDialogOpen || state.ui.helpOpen || state.ui.tilingDialogOpen) return;
      if (e.code === 'Space') {
        const tag = e.target instanceof HTMLElement ? e.target.tagName : '';
        if (tag === 'BUTTON' || tag === 'A') return;
        e.preventDefault();
        spaceRef.current = true;
        setSpacePressed(true);
        setCursor('grab');
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        state.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        if (state.ui.selectedFrameId) {
          e.preventDefault();
          state.duplicateFrame(state.ui.selectedFrameId);
        }
        return;
      }
      if (mod && e.key === '0') {
        e.preventDefault();
        state.setZoom(null);
        return;
      }
      if (e.key === 'Escape') {
        if (state.ui.cropFrameId) {
          state.setCropFrame(null);
        } else {
          state.selectFrame(null);
        }
        return;
      }
      const frameId = state.ui.selectedFrameId;
      if (!frameId) return;
      const frame = state.project.pages
        .find((p) => p.id === state.activePageId)
        ?.items.find((f) => f.id === frameId);
      if (!frame || frame.locked) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        state.deleteFrame(frameId);
        return;
      }
      const step = e.shiftKey ? 5 : 0.5;
      const arrow = {
        ArrowLeft: { x: -step, y: 0 },
        ArrowRight: { x: step, y: 0 },
        ArrowUp: { x: 0, y: -step },
        ArrowDown: { x: 0, y: step },
      }[e.key];
      if (arrow) {
        e.preventDefault();
        state.updateFrame(
          frameId,
          { x: frame.x + arrow.x, y: frame.y + arrow.y },
          { historyKey: `nudge:${frameId}` },
        );
      }
    };
    const keyup = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceRef.current = false;
        setSpacePressed(false);
        setCursor('default');
      }
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
    };
  }, []);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setFileDragOver(false);
    if (e.dataTransfer.files?.length) void addPhotos(Array.from(e.dataTransfer.files));
  };

  const frameCount = page.items.length;
  const showEmptyPhotos = hydrated && photos.length === 0;
  const showEmptyPage = hydrated && photos.length > 0 && frameCount === 0;

  const overlayStyle = selectedFrame
    ? {
        left: originX + selectedFrame.x * scale,
        top: originY + selectedFrame.y * scale,
        width: selectedFrame.w * scale,
        height: selectedFrame.h * scale,
        transform: `rotate(${selectedFrame.rotation}deg)`,
      }
    : undefined;
  const isCrop = !!selectedFrame && cropFrameId === selectedFrame.id;

  return (
    <div
      ref={containerRef}
      className="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
      style={{ cursor: spacePressed && !dragRef.current ? 'grab' : cursor }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDragOver={(e) => {
        e.preventDefault();
        setFileDragOver(true);
      }}
      onDragLeave={() => setFileDragOver(false)}
      onDrop={handleDrop}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-label="排版画布"
        onPointerDown={beginCanvasPointer}
        onDoubleClick={handleDoubleClick}
      />

      {!hydrated ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-zinc-100/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-[12px] text-zinc-500 shadow-sm ring-1 ring-zinc-200">
            <Loader2 size={15} className="animate-spin text-indigo-500" />
            正在恢复本地项目…
          </div>
        </div>
      ) : null}

      {fileDragOver ? (
        <div className="pointer-events-none absolute inset-3 z-30 grid place-items-center rounded-2xl border-2 border-dashed border-indigo-400 bg-indigo-50/60">
          <div className="rounded-xl bg-white px-4 py-2 text-[12px] font-medium text-indigo-700 shadow-sm">
            松开以导入照片
          </div>
        </div>
      ) : null}

      {showEmptyPhotos ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-6">
          <div className="pointer-events-auto w-full max-w-[330px] rounded-2xl border border-zinc-200 bg-white/95 p-5 text-center shadow-xl backdrop-blur">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-indigo-50 text-indigo-600">
              <ImagePlus size={22} />
            </div>
            <h3 className="mt-3 text-[15px] font-semibold text-zinc-900">开始你的第一页作品</h3>
            <p className="mt-1.5 text-[11.5px] leading-4 text-zinc-500">
              导入照片后自动排版，支持 A4、相纸、明信片、证件卡等常用打印尺寸。
              照片只保存在本机，不会上传。
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} /> 上传照片
              </button>
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => void addSamples()}
                disabled={!!busy}
              >
                <Sparkles size={14} /> 加载示例照片
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void addPhotos(Array.from(e.target.files));
                e.target.value = '';
              }}
            />
            {busy ? (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-indigo-600">
                <Loader2 size={12} className="animate-spin" /> {busy}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {showEmptyPage ? (
        <div className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white/95 py-1.5 pl-3 pr-1.5 text-[11px] text-zinc-500 shadow-lg backdrop-blur">
            当前页面为空
            <button
              type="button"
              className="rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-500"
              onClick={() => applyTemplate('auto-grid')}
            >
              智能网格
            </button>
            <button
              type="button"
              className="rounded-full px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100"
              onClick={() => setTab('templates')}
            >
              浏览模板
            </button>
          </div>
        </div>
      ) : null}

      {isCrop ? (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-amber-200 bg-amber-50/95 px-3 py-1.5 text-[11px] text-amber-800 shadow-sm backdrop-blur">
          取景模式 · 拖动照片调整构图 · 滚轮缩放 · 双击空白或 Esc 退出
        </div>
      ) : null}

      {selectedFrame ? (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            ...overlayStyle,
            transformOrigin: '50% 50%',
          }}
        >
          <div
            className={`absolute inset-0 ${
              isCrop
                ? 'border-2 border-amber-400/90'
                : 'border-[1.5px] border-indigo-500/90'
            }`}
          />
          {isCrop ? (
            <div
              className="absolute border border-dashed border-amber-300/80"
              style={{
                left: `${((innerPhotoRect(selectedFrame).x + selectedFrame.w / 2) / selectedFrame.w) * 100}%`,
                top: `${((innerPhotoRect(selectedFrame).y + selectedFrame.h / 2) / selectedFrame.h) * 100}%`,
                width: `${(innerPhotoRect(selectedFrame).w / selectedFrame.w) * 100}%`,
                height: `${(innerPhotoRect(selectedFrame).h / selectedFrame.h) * 100}%`,
              }}
            />
          ) : null}

          {!isCrop && !selectedFrame.locked
            ? CORNERS.map((corner) => (
                <button
                  key={corner.key}
                  type="button"
                  aria-label={`调整${corner.key}`}
                  className="pointer-events-auto absolute h-2.5 w-2.5 rounded-full border border-indigo-500 bg-white shadow-sm"
                  style={{
                    left: corner.left ? -5 : undefined,
                    right: corner.left ? undefined : -5,
                    top: corner.top ? -5 : undefined,
                    bottom: corner.top ? undefined : -5,
                    cursor: corner.cursor,
                  }}
                  onPointerDown={(e) =>
                    beginResize(e, corner.left ? -1 : 1, corner.top ? -1 : 1)
                  }
                />
              ))
            : null}

          {!isCrop && !selectedFrame.locked ? (
            <button
              type="button"
              aria-label="旋转"
              className="pointer-events-auto absolute left-1/2 top-0 grid h-6 w-6 -translate-x-1/2 -translate-y-9 place-items-center rounded-full border border-indigo-500 bg-white text-indigo-600 shadow-sm"
              style={{ cursor: 'grab' }}
              onPointerDown={beginRotate}
            >
              <RotateCw size={11} />
            </button>
          ) : null}

          <div className="absolute -top-6 left-0 flex items-center gap-1 rounded bg-zinc-900/85 px-1.5 py-0.5 text-[9px] font-medium text-white shadow-sm">
            {selectedFrame.locked ? <Lock size={9} /> : null}
            {Math.round(selectedFrame.w)} × {Math.round(selectedFrame.h)} mm
            {selectedFrame.rotation !== 0 ? ` · ${Math.round(selectedFrame.rotation)}°` : ''}
            {isCrop ? ' · 取景' : ''}
          </div>
        </div>
      ) : null}

      {hint ? (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-md bg-zinc-900/80 px-2 py-1 text-[10px] font-medium tabular-nums text-white shadow-sm">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
