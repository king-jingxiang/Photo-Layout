import { create } from 'zustand';
import type { Frame, Page, PhotoMeta, Project, UiState } from '../types';
import {
  defaultOrientationOf,
  findPreset,
  pageSizeFromPreset,
} from '../data/papers';
import { findTemplate } from '../data/templates';
import {
  buildPosterTiles,
  contentRect,
  createFrame,
  defaultPage,
  layoutCircles,
  layoutContactSheet,
  layoutFull,
  layoutGrid,
  layoutHeart,
  layoutIdSheet,
  layoutMosaic,
  layoutPolaroid,
  layoutSliced,
  layoutSplit,
  layoutStrip,
  MOSAIC_DEFS,
  uid,
} from '../lib/layout';
import {
  createSamplePhotos,
  deleteImage,
  importPhotoFile,
  restorePhoto,
  type DecodedPhoto,
} from '../lib/image';
import {
  loadPersistedPhotos,
  loadProjectLocal,
  persistPhoto,
  removePersistedPhoto,
  saveProjectLocal,
} from '../lib/persist';
import { clamp, effectiveDpi, frameAABB, frameCenter } from '../lib/geometry';

const MAX_HISTORY = 40;

function cloneProject(project: Project): Project {
  if (typeof structuredClone === 'function') return structuredClone(project);
  return JSON.parse(JSON.stringify(project)) as Project;
}

let historyKey: string | null = null;
let historyTime = 0;
let initStarted = false;
let toastSeq = 0;
let toastTimer: number | undefined;

const initialPage = defaultPage('a4');
const initialProject: Project = { pages: [initialPage] };

export interface ToastState {
  id: number;
  text: string;
  tone: 'info' | 'error' | 'success';
}

interface AppStore {
  photos: PhotoMeta[];
  project: Project;
  activePageId: string;
  past: Project[];
  future: Project[];
  hydrated: boolean;
  busy: string | null;
  toast: ToastState | null;
  ui: UiState;

  init: () => Promise<void>;
  addPhotos: (files: File[]) => Promise<void>;
  addSamples: () => Promise<void>;
  removePhoto: (photoId: string) => Promise<void>;

  setTab: (tab: UiState['activeTab']) => void;
  patchUi: (patch: Partial<UiState>) => void;
  selectFrame: (frameId: string | null) => void;
  setCropFrame: (frameId: string | null) => void;
  setZoom: (zoom: number | null) => void;
  setPan: (x: number, y: number) => void;
  toastMessage: (text: string, tone?: ToastState['tone']) => void;

  setActivePage: (pageId: string) => void;
  addPage: () => void;
  duplicatePage: () => void;
  deletePage: (pageId: string) => void;
  clearPage: () => void;
  updatePageSettings: (
    patch: Partial<Pick<Page, 'marginMm' | 'gapMm' | 'background' | 'cutLines'>>,
  ) => void;
  setPaper: (presetId: string) => void;
  setOrientation: (orientation: Page['orientation']) => void;
  setCustomSize: (widthMm: number, heightMm: number) => void;

  applyTemplate: (templateId: string) => void;
  buildPoster: (cols: number, rows: number) => void;

  updateFrame: (frameId: string, patch: Partial<Frame>, opts?: { historyKey?: string }) => void;
  addPhotoToPage: (photoId: string) => void;
  replaceFramePhoto: (frameId: string, photoId: string) => void;
  deleteFrame: (frameId: string) => void;
  duplicateFrame: (frameId: string) => void;
  moveFrameLayer: (frameId: string, dir: 'up' | 'down' | 'top' | 'bottom') => void;
  alignFrame: (frameId: string, mode: 'h' | 'v' | 'left' | 'right' | 'top' | 'bottom') => void;
  fitFrameToPhoto: (frameId: string) => void;
  fillFrame: (frameId: string) => void;
  resetCrop: (frameId: string) => void;
  rotateFrame: (frameId: string, delta: number) => void;

  undo: () => void;
  redo: () => void;
}

function activePageOf(state: Pick<AppStore, 'project' | 'activePageId'>): Page {
  return state.project.pages.find((p) => p.id === state.activePageId) ?? state.project.pages[0];
}

function mapPage(project: Project, pageId: string, fn: (page: Page) => Page): Project {
  return {
    ...project,
    pages: project.pages.map((p) => (p.id === pageId ? fn(p) : p)),
  };
}

function selectedFrameOf(state: Pick<AppStore, 'project' | 'activePageId' | 'ui'>): Frame | null {
  const page = activePageOf(state);
  return page.items.find((f) => f.id === state.ui.selectedFrameId) ?? null;
}

function pickSinglePhoto(state: AppStore): PhotoMeta | null {
  const frame = selectedFrameOf(state);
  if (frame) {
    const photo = state.photos.find((p) => p.id === frame.photoId);
    if (photo) return photo;
  }
  return state.photos[0] ?? null;
}

function validSelection(project: Project, pageId: string, frameId: string | null): string | null {
  if (!frameId) return null;
  const page = project.pages.find((p) => p.id === pageId);
  return page?.items.some((f) => f.id === frameId) ? frameId : null;
}

export const useAppStore = create<AppStore>((set, get) => {
  /** 提交项目改动；key 相同且时间相近的连续操作会合并为一条历史 */
  const commit = (next: Project, key?: string) => {
    const state = get();
    const now = Date.now();
    const shouldRecord =
      !key || key !== historyKey || now - historyTime > 1200;
    if (shouldRecord) {
      set({
        past: [...state.past, cloneProject(state.project)].slice(-MAX_HISTORY),
        future: [],
      });
    }
    historyKey = key ?? null;
    historyTime = now;
    const activePageId = next.pages.some((p) => p.id === state.activePageId)
      ? state.activePageId
      : next.pages[0].id;
    set({
      project: next,
      activePageId,
      ui: {
        ...state.ui,
        selectedFrameId: validSelection(next, activePageId, state.ui.selectedFrameId),
        cropFrameId: validSelection(next, activePageId, state.ui.cropFrameId),
      },
    });
  };

  const mutateActivePage = (fn: (page: Page) => Page, key?: string) => {
    const state = get();
    const page = activePageOf(state);
    commit(mapPage(state.project, page.id, fn), key);
  };

  return {
    photos: [],
    project: initialProject,
    activePageId: initialPage.id,
    past: [],
    future: [],
    hydrated: false,
    busy: null,
    toast: null,
    ui: {
      activeTab: 'photos',
      selectedFrameId: null,
      cropFrameId: null,
      zoom: null,
      panX: 0,
      panY: 0,
      showMargins: true,
      showRulers: true,
      snapEnabled: true,
      exportDialogOpen: false,
      helpOpen: false,
      tilingDialogOpen: false,
    },

    init: async () => {
      if (get().hydrated || initStarted) return;
      initStarted = true;
      const saved = loadProjectLocal();
      const project = saved ?? { pages: [defaultPage('a4')] };
      set({
        project,
        activePageId: project.pages[0].id,
        past: [],
        future: [],
      });
      try {
        const stored = await loadPersistedPhotos();
        const restored: PhotoMeta[] = [];
        for (const record of stored) {
          try {
            await restorePhoto(record.meta, record.blob);
            restored.push(record.meta);
          } catch {
            /* 单张照片损坏时跳过 */
          }
        }
        set({ photos: restored, hydrated: true });
      } catch {
        set({ hydrated: true });
      }
    },

    addPhotos: async (files) => {
      const imageFiles = files.filter((f) => f.type.startsWith('image/'));
      if (!imageFiles.length) {
        get().toastMessage('请选择图片文件（JPG / PNG / WebP 等）', 'error');
        return;
      }
      set({ busy: `正在导入 ${imageFiles.length} 张照片…` });
      const added: PhotoMeta[] = [];
      for (const file of imageFiles) {
        try {
          const decoded: DecodedPhoto = await importPhotoFile(file);
          added.push(decoded.meta);
          await persistPhoto(decoded.meta, decoded.blob);
        } catch {
          get().toastMessage(`无法读取「${file.name}」`, 'error');
        }
      }
      const photos = [...get().photos, ...added];
      set({ photos, busy: null });
      if (added.length) {
        get().toastMessage(`已添加 ${added.length} 张照片`, 'success');
        const page = activePageOf(get());
        if (page.items.length === 0) {
          get().applyTemplate('auto-grid');
        }
      }
    },

    addSamples: async () => {
      if (get().busy) return;
      set({ busy: '正在生成示例照片…' });
      try {
        const samples = await createSamplePhotos();
        for (const sample of samples) await persistPhoto(sample.meta, sample.blob);
        const photos = [...get().photos, ...samples.map((s) => s.meta)];
        set({ photos, busy: null });
        get().toastMessage('已加载 6 张示例照片', 'success');
        const page = activePageOf(get());
        if (page.items.length === 0) get().applyTemplate('auto-grid');
      } catch {
        set({ busy: null });
        get().toastMessage('示例照片生成失败', 'error');
      }
    },

    removePhoto: async (photoId) => {
      const state = get();
      deleteImage(photoId);
      await removePersistedPhoto(photoId);
      const nextProject: Project = {
        ...state.project,
        pages: state.project.pages.map((page) => ({
          ...page,
          items: page.items.filter((f) => f.photoId !== photoId),
        })),
      };
      commit(nextProject);
      set({ photos: state.photos.filter((p) => p.id !== photoId) });
      get().toastMessage('已从图库与版面中移除该照片');
    },

    setTab: (activeTab) => set({ ui: { ...get().ui, activeTab } }),

    patchUi: (patch) => set({ ui: { ...get().ui, ...patch } }),

    selectFrame: (frameId) =>
      set({ ui: { ...get().ui, selectedFrameId: frameId, cropFrameId: null } }),

    setCropFrame: (frameId) =>
      set({ ui: { ...get().ui, cropFrameId: frameId, selectedFrameId: frameId ?? get().ui.selectedFrameId } }),

    setZoom: (zoom) =>
      set({ ui: { ...get().ui, zoom, ...(zoom === null ? { panX: 0, panY: 0 } : {}) } }),

    setPan: (panX, panY) => set({ ui: { ...get().ui, panX, panY } }),

    toastMessage: (text, tone = 'info') => {
      toastSeq += 1;
      const id = toastSeq;
      set({ toast: { id, text, tone } });
      if (toastTimer) window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => {
        if (get().toast?.id === id) set({ toast: null });
      }, 3200);
    },

    setActivePage: (pageId) => {
      if (!get().project.pages.some((p) => p.id === pageId)) return;
      set({
        activePageId: pageId,
        ui: { ...get().ui, selectedFrameId: null, cropFrameId: null },
      });
    },

    addPage: () => {
      const state = get();
      const current = activePageOf(state);
      const page = defaultPage(current.presetId, current.orientation);
      page.widthMm = current.widthMm;
      page.heightMm = current.heightMm;
      page.orientation = current.orientation;
      page.marginMm = current.marginMm;
      page.gapMm = current.gapMm;
      const index = state.project.pages.findIndex((p) => p.id === current.id);
      const pages = [...state.project.pages];
      pages.splice(index + 1, 0, page);
      commit({ pages });
      set({ activePageId: page.id, ui: { ...state.ui, selectedFrameId: null, cropFrameId: null } });
    },

    duplicatePage: () => {
      const state = get();
      const current = activePageOf(state);
      const copy: Page = {
        ...cloneProject({ pages: [current] }).pages[0],
        id: uid('page'),
        items: current.items.map((frame) => ({ ...frame, id: uid('frame') })),
        note: current.note,
      };
      const index = state.project.pages.findIndex((p) => p.id === current.id);
      const pages = [...state.project.pages];
      pages.splice(index + 1, 0, copy);
      commit({ pages });
      set({
        activePageId: copy.id,
        ui: { ...state.ui, selectedFrameId: null, cropFrameId: null },
      });
    },

    deletePage: (pageId) => {
      const state = get();
      if (state.project.pages.length <= 1) {
        get().toastMessage('至少保留一页', 'error');
        return;
      }
      const pages = state.project.pages.filter((p) => p.id !== pageId);
      const activePageId =
        state.activePageId === pageId ? pages[0].id : state.activePageId;
      commit({ pages });
      set({
        activePageId,
        ui: { ...state.ui, selectedFrameId: null, cropFrameId: null },
      });
    },

    clearPage: () => {
      mutateActivePage((page) => ({ ...page, items: [] }));
      set({ ui: { ...get().ui, selectedFrameId: null, cropFrameId: null } });
      get().toastMessage('已清空当前页面');
    },

    updatePageSettings: (patch) => {
      mutateActivePage(
        (page) => ({ ...page, ...patch }),
        `page:${Object.keys(patch).join(',')}`,
      );
    },

    setPaper: (presetId) => {
      const preset = findPreset(presetId);
      if (!preset) return;
      const orientation = defaultOrientationOf(preset);
      const { widthMm, heightMm } = pageSizeFromPreset(preset, orientation);
      mutateActivePage((page) => ({
        ...page,
        presetId: preset.id,
        orientation,
        widthMm,
        heightMm,
        marginMm: preset.group === 'paper' ? 6 : 0,
      }));
      set({ ui: { ...get().ui, selectedFrameId: null, cropFrameId: null } });
    },

    setOrientation: (orientation) => {
      mutateActivePage((page) => {
        const size = pageSizeFromPreset(
          findPreset(page.presetId) ?? {
            id: 'custom',
            name: '自定义',
            group: 'paper',
            shortMm: Math.min(page.widthMm, page.heightMm),
            longMm: Math.max(page.widthMm, page.heightMm),
          },
          orientation,
        );
        return { ...page, orientation, widthMm: size.widthMm, heightMm: size.heightMm };
      });
    },

    setCustomSize: (widthMm, heightMm) => {
      const w = clamp(widthMm, 10, 2000);
      const h = clamp(heightMm, 10, 2000);
      mutateActivePage((page) => ({
        ...page,
        presetId: 'custom',
        widthMm: Math.round(w * 10) / 10,
        heightMm: Math.round(h * 10) / 10,
        orientation: w > h ? 'landscape' : 'portrait',
      }));
    },

    applyTemplate: (templateId) => {
      const state = get();
      const template = findTemplate(templateId);
      if (!template) return;
      if (template.needsDialog === 'poster') {
        set({ ui: { ...state.ui, tilingDialogOpen: true } });
        return;
      }
      if (!state.photos.length) {
        get().toastMessage('请先上传照片，或加载示例照片', 'error');
        return;
      }
      const page = activePageOf(state);
      const single = pickSinglePhoto(state);
      const photos = state.photos;
      let frames: Frame[] = [];

      switch (templateId) {
        case 'auto-grid':
          frames = layoutGrid(page, photos);
          break;
        case 'contact-sheet':
          frames = layoutContactSheet(page, photos);
          break;
        case 'mosaic-four':
        case 'mosaic-nine':
        case 'mosaic-1big3':
        case 'mosaic-top2':
        case 'mosaic-five':
        case 'mosaic-triptych':
        case 'mosaic-diptych':
          frames = layoutMosaic(page, photos, MOSAIC_DEFS[templateId]);
          break;
        case 'full-bleed':
          frames = single ? layoutFull(page, single) : [];
          break;
        case 'polaroid':
          frames = single ? layoutPolaroid(page, single) : [];
          break;
        case 'strip-4':
          frames = layoutStrip(page, photos);
          break;
        case 'id-1inch':
          frames = single ? layoutIdSheet(page, single, 25, 35) : [];
          break;
        case 'id-2inch':
          frames = single ? layoutIdSheet(page, single, 35, 49) : [];
          break;
        case 'split-4':
          frames = single ? layoutSplit(page, single, 2, 2) : [];
          break;
        case 'sliced':
          frames = single ? layoutSliced(page, single) : [];
          break;
        case 'heart':
          frames = single ? layoutHeart(page, single) : [];
          break;
        case 'circle-3':
          frames = layoutCircles(page, photos);
          break;
        default:
          return;
      }

      if (!frames.length) {
        get().toastMessage('当前纸张尺寸太小，无法应用该模板', 'error');
        return;
      }

      const needsCutLines =
        templateId.startsWith('id-') || templateId === 'split-4';
      mutateActivePage((p) => ({
        ...p,
        items: frames,
        cutLines: needsCutLines ? true : p.cutLines,
      }));
      set({ ui: { ...get().ui, selectedFrameId: null, cropFrameId: null } });
      get().toastMessage(`已应用「${template.name}」`, 'success');
    },

    buildPoster: (cols, rows) => {
      const state = get();
      const photo = pickSinglePhoto(state);
      if (!photo) {
        get().toastMessage('请先上传照片', 'error');
        return;
      }
      const page = activePageOf(state);
      const tiles = buildPosterTiles(page, photo, cols, rows);
      const index = state.project.pages.findIndex((p) => p.id === page.id);
      const pages = [...state.project.pages];
      pages.splice(index, 1, ...tiles);
      commit({ pages });
      set({
        activePageId: tiles[0].id,
        ui: { ...state.ui, selectedFrameId: null, cropFrameId: null, tilingDialogOpen: false },
      });
      get().toastMessage(`已生成 ${cols * rows} 页分页海报，可导出 PDF 打印`, 'success');
    },

    updateFrame: (frameId, patch, opts = {}) => {
      const page = activePageOf(get());
      const key = opts.historyKey ?? `frame:${frameId}:${Object.keys(patch).join(',')}`;
      mutateActivePage(
        (p) => ({
          ...p,
          items: p.items.map((f) => (f.id === frameId ? { ...f, ...patch } : f)),
        }),
        key,
      );
    },

    addPhotoToPage: (photoId) => {
      const state = get();
      const photo = state.photos.find((p) => p.id === photoId);
      if (!photo) return;
      const page = activePageOf(state);
      const area = contentRect(page);
      const aspect = photo.width / photo.height;
      let w = Math.min(area.w * 0.62, area.h * 0.7 * aspect);
      let h = w / aspect;
      if (h > area.h * 0.7) {
        h = area.h * 0.7;
        w = h * aspect;
      }
      const offset = Math.min(page.items.length * 6, 30);
      const frame = createFrame(photo.id, {
        x: clamp(area.x + (area.w - w) / 2 + offset, area.x, area.x + area.w - w),
        y: clamp(area.y + (area.h - h) / 2 + offset, area.y, area.y + area.h - h),
        w,
        h,
      });
      mutateActivePage((p) => ({ ...p, items: [...p.items, frame] }));
      set({ ui: { ...get().ui, selectedFrameId: frame.id, cropFrameId: null } });
    },

    replaceFramePhoto: (frameId, photoId) => {
      get().updateFrame(frameId, { photoId });
    },

    deleteFrame: (frameId) => {
      mutateActivePage((p) => ({
        ...p,
        items: p.items.filter((f) => f.id !== frameId),
      }));
      set({ ui: { ...get().ui, selectedFrameId: null, cropFrameId: null } });
    },

    duplicateFrame: (frameId) => {
      const state = get();
      const page = activePageOf(state);
      const source = page.items.find((f) => f.id === frameId);
      if (!source) return;
      const area = contentRect(page);
      const copy: Frame = {
        ...cloneProject({ pages: [{ ...page, items: [source] }] }).pages[0].items[0],
        id: uid('frame'),
        x: clamp(source.x + 6, area.x, area.x + area.w - source.w),
        y: clamp(source.y + 6, area.y, area.y + area.h - source.h),
      };
      mutateActivePage((p) => ({ ...p, items: [...p.items, copy] }));
      set({ ui: { ...get().ui, selectedFrameId: copy.id, cropFrameId: null } });
    },

    moveFrameLayer: (frameId, dir) => {
      mutateActivePage((p) => {
        const items = [...p.items];
        const index = items.findIndex((f) => f.id === frameId);
        if (index < 0) return p;
        const [frame] = items.splice(index, 1);
        if (dir === 'top') items.push(frame);
        else if (dir === 'bottom') items.unshift(frame);
        else if (dir === 'up') items.splice(Math.min(index + 1, items.length), 0, frame);
        else items.splice(Math.max(index - 1, 0), 0, frame);
        return { ...p, items };
      });
    },

    alignFrame: (frameId, mode) => {
      const state = get();
      const page = activePageOf(state);
      const frame = page.items.find((f) => f.id === frameId);
      if (!frame) return;
      const area = contentRect(page);
      const bbox = frameAABB(frame);
      let dx = 0;
      let dy = 0;
      if (mode === 'h') dx = area.x + area.w / 2 - (bbox.x + bbox.w / 2);
      if (mode === 'v') dy = area.y + area.h / 2 - (bbox.y + bbox.h / 2);
      if (mode === 'left') dx = area.x - bbox.x;
      if (mode === 'right') dx = area.x + area.w - (bbox.x + bbox.w);
      if (mode === 'top') dy = area.y - bbox.y;
      if (mode === 'bottom') dy = area.y + area.h - (bbox.y + bbox.h);
      get().updateFrame(frameId, { x: frame.x + dx, y: frame.y + dy }, { historyKey: `align:${frameId}` });
    },

    fitFrameToPhoto: (frameId) => {
      const frame = selectedFrameOf(get());
      if (!frame || frame.id !== frameId) return;
      const photo = get().photos.find((p) => p.id === frame.photoId);
      if (!photo) return;
      const aspect = photo.width / photo.height;
      const center = frameCenter(frame);
      const h = frame.w / aspect;
      get().updateFrame(
        frameId,
        { h, y: center.y - h / 2, fill: 'cover', zoom: 1, focusX: 0.5, focusY: 0.5, crop: undefined },
        { historyKey: `fit:${frameId}` },
      );
    },

    fillFrame: (frameId) => {
      const page = activePageOf(get());
      const area = contentRect(page);
      get().updateFrame(
        frameId,
        { x: area.x, y: area.y, w: area.w, h: area.h, rotation: 0 },
        { historyKey: `fill:${frameId}` },
      );
    },

    resetCrop: (frameId) => {
      get().updateFrame(
        frameId,
        { zoom: 1, focusX: 0.5, focusY: 0.5, crop: undefined },
        { historyKey: `reset-crop:${frameId}` },
      );
    },

    rotateFrame: (frameId, delta) => {
      const frame = selectedFrameOf(get());
      if (!frame || frame.id !== frameId) return;
      const rotation = (Math.round((frame.rotation + delta) * 10) / 10) % 360;
      get().updateFrame(frameId, { rotation }, { historyKey: `rotate:${frameId}` });
    },

    undo: () => {
      const state = get();
      if (!state.past.length) return;
      const previous = state.past[state.past.length - 1];
      historyKey = null;
      set({
        project: previous,
        past: state.past.slice(0, -1),
        future: [...state.future, cloneProject(state.project)].slice(-MAX_HISTORY),
        activePageId: previous.pages.some((p) => p.id === state.activePageId)
          ? state.activePageId
          : previous.pages[0].id,
        ui: {
          ...state.ui,
          selectedFrameId: validSelection(
            previous,
            previous.pages.some((p) => p.id === state.activePageId)
              ? state.activePageId
              : previous.pages[0].id,
            state.ui.selectedFrameId,
          ),
          cropFrameId: null,
        },
      });
    },

    redo: () => {
      const state = get();
      if (!state.future.length) return;
      const next = state.future[state.future.length - 1];
      historyKey = null;
      set({
        project: next,
        past: [...state.past, cloneProject(state.project)].slice(-MAX_HISTORY),
        future: state.future.slice(0, -1),
        activePageId: next.pages.some((p) => p.id === state.activePageId)
          ? state.activePageId
          : next.pages[0].id,
        ui: {
          ...state.ui,
          selectedFrameId: validSelection(
            next,
            next.pages.some((p) => p.id === state.activePageId)
              ? state.activePageId
              : next.pages[0].id,
            state.ui.selectedFrameId,
          ),
          cropFrameId: null,
        },
      });
    },
  };
});

export function useActivePage(): Page {
  return useAppStore((s) => s.project.pages.find((p) => p.id === s.activePageId) ?? s.project.pages[0]);
}

export function useSelectedFrame(): Frame | null {
  return useAppStore((s) => {
    const page = s.project.pages.find((p) => p.id === s.activePageId) ?? s.project.pages[0];
    return page.items.find((f) => f.id === s.ui.selectedFrameId) ?? null;
  });
}

export { effectiveDpi };

/** 自动保存项目到 localStorage（防抖） */
let saveTimer: number | undefined;
let lastSaved: Project | null = null;
useAppStore.subscribe((state) => {
  if (!state.hydrated || state.project === lastSaved) return;
  lastSaved = state.project;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => saveProjectLocal(state.project), 500);
});
