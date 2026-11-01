import { createStore, del, get, keys, set } from 'idb-keyval';
import type { PhotoMeta, Project } from '../types';

const photoStore = createStore('photo-layout-studio', 'photos');
const PHOTO_PREFIX = 'photo:';
const PROJECT_KEY = 'photo-layout-studio::project-v1';

export interface StoredPhotoRecord {
  meta: PhotoMeta;
  blob: Blob;
}

function canUseStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.indexedDB;
  } catch {
    return false;
  }
}

export async function persistPhoto(meta: PhotoMeta, blob: Blob): Promise<void> {
  if (!canUseStorage()) return;
  try {
    await set(`${PHOTO_PREFIX}${meta.id}`, { meta, blob } satisfies StoredPhotoRecord, photoStore);
  } catch {
    // 存储配额不足时仍然允许当前会话使用照片
  }
}

export async function removePersistedPhoto(id: string): Promise<void> {
  if (!canUseStorage()) return;
  try {
    await del(`${PHOTO_PREFIX}${id}`, photoStore);
  } catch {
    /* noop */
  }
}

export async function loadPersistedPhotos(): Promise<StoredPhotoRecord[]> {
  if (!canUseStorage()) return [];
  try {
    const allKeys = await keys(photoStore);
    const records: StoredPhotoRecord[] = [];
    for (const key of allKeys) {
      if (typeof key !== 'string' || !key.startsWith(PHOTO_PREFIX)) continue;
      const record = await get<StoredPhotoRecord>(key, photoStore);
      if (record?.meta && record.blob instanceof Blob) records.push(record);
    }
    return records;
  } catch {
    return [];
  }
}

export function saveProjectLocal(project: Project): void {
  try {
    localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
  } catch {
    /* 隐私模式或空间不足时忽略 */
  }
}

export function loadProjectLocal(): Project | null {
  try {
    const raw = localStorage.getItem(PROJECT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Project;
    if (!parsed || !Array.isArray(parsed.pages) || parsed.pages.length === 0) return null;
    const valid = parsed.pages.every(
      (p) =>
        typeof p.id === 'string' &&
        typeof p.widthMm === 'number' &&
        typeof p.heightMm === 'number' &&
        Array.isArray(p.items),
    );
    return valid ? parsed : null;
  } catch {
    return null;
  }
}

export function clearProjectLocal(): void {
  try {
    localStorage.removeItem(PROJECT_KEY);
  } catch {
    /* noop */
  }
}
