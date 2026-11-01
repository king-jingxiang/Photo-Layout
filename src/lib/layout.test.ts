import { describe, expect, it } from 'vitest';
import type { PhotoMeta } from '../types';
import { defaultPage, layoutContactSheet, layoutGrid, layoutIdSheet, layoutSliced, layoutSplit, MOSAIC_DEFS, layoutMosaic, buildPosterTiles } from './layout';

function photo(id: string, width: number, height: number): PhotoMeta {
  return {
    id,
    name: `${id}.jpg`,
    width,
    height,
    byteSize: 1024,
    thumb: '',
    createdAt: 0,
  };
}

function inside(frame: { x: number; y: number; w: number; h: number }, width: number, height: number) {
  return frame.x >= -0.001 && frame.y >= -0.001 && frame.x + frame.w <= width + 0.001 && frame.y + frame.h <= height + 0.001;
}

describe('layoutGrid', () => {
  it('places every photo inside the A4 content area without overlap', () => {
    const page = defaultPage('a4');
    const photos = [
      photo('a', 4000, 3000),
      photo('b', 3000, 4000),
      photo('c', 2000, 2000),
      photo('d', 4000, 3000),
      photo('e', 3000, 2000),
    ];
    const frames = layoutGrid(page, photos);
    expect(frames).toHaveLength(photos.length);
    for (const frame of frames) {
      expect(frame.w).toBeGreaterThan(10);
      expect(frame.h).toBeGreaterThan(10);
      expect(inside(frame, page.widthMm, page.heightMm)).toBe(true);
    }
  });

  it('returns nothing without photos', () => {
    expect(layoutGrid(defaultPage('a4'), [])).toEqual([]);
  });
});

describe('layoutContactSheet', () => {
  it('preserves each photo aspect ratio and stays on the page', () => {
    const page = defaultPage('a4');
    const photos = [
      photo('wide', 4000, 2000),
      photo('tall', 2000, 4000),
      photo('square', 3000, 3000),
    ];
    const frames = layoutContactSheet(page, photos);
    expect(frames).toHaveLength(3);
    for (const frame of frames) {
      const source = photos.find((p) => p.id === frame.photoId)!;
      expect(frame.w / frame.h).toBeCloseTo(source.width / source.height, 4);
      expect(inside(frame, page.widthMm, page.heightMm)).toBe(true);
    }
  });

  it('strictly keeps the total height within the page for many photos', () => {
    const page = defaultPage('a4');
    const photos = Array.from({ length: 30 }, (_, i) => photo(`p${i}`, 3000, 2000));
    const frames = layoutContactSheet(page, photos);
    expect(frames).toHaveLength(30);
    const bottom = Math.max(...frames.map((f) => f.y + f.h));
    expect(bottom).toBeLessThanOrEqual(page.heightMm + 0.001);
  });
});

describe('layoutMosaic', () => {
  it('fills the grid without exceeding the content area', () => {
    const page = defaultPage('a4');
    const photos = [photo('a', 2000, 3000), photo('b', 3000, 2000), photo('c', 2000, 2000)];
    const def = MOSAIC_DEFS['mosaic-1big3'];
    const frames = layoutMosaic(page, photos, def);
    expect(frames).toHaveLength(def.cells.length);
    const right = Math.max(...frames.map((f) => f.x + f.w));
    const bottom = Math.max(...frames.map((f) => f.y + f.h));
    expect(right).toBeLessThanOrEqual(page.widthMm - page.marginMm + 0.001);
    expect(bottom).toBeLessThanOrEqual(page.heightMm - page.marginMm + 0.001);
  });
});

describe('layoutIdSheet', () => {
  it('repeats a 1-inch ID photo on a 4R sheet with exact millimetre sizes', () => {
    const page = { ...defaultPage('photo-4r'), marginMm: 0, gapMm: 2 };
    const frames = layoutIdSheet(page, photo('id', 1000, 1400), 25, 35);
    expect(frames.length).toBeGreaterThan(6);
    for (const frame of frames) {
      expect(frame.w).toBeCloseTo(25, 5);
      expect(frame.h).toBeCloseTo(35, 5);
      expect(inside(frame, page.widthMm, page.heightMm)).toBe(true);
    }
  });
});

describe('layoutSplit / layoutSliced', () => {
  const page = defaultPage('a4');
  const source = photo('source', 4000, 3000);

  it('split crops cover the full normalised source without exceeding it', () => {
    for (const frame of layoutSplit(page, source, 2, 2)) {
      const crop = frame.crop!;
      expect(crop.x).toBeGreaterThanOrEqual(0);
      expect(crop.y).toBeGreaterThanOrEqual(0);
      expect(crop.x + crop.w).toBeLessThanOrEqual(1.000001);
      expect(crop.y + crop.h).toBeLessThanOrEqual(1.000001);
      expect(crop.w).toBeGreaterThan(0);
      expect(crop.h).toBeGreaterThan(0);
    }
  });

  it('sliced strips keep valid crop rectangles', () => {
    const frames = layoutSliced(page, source, 5);
    expect(frames).toHaveLength(5);
    for (const frame of frames) {
      const crop = frame.crop!;
      expect(crop.x).toBeGreaterThanOrEqual(0);
      expect(crop.x + crop.w).toBeLessThanOrEqual(1.000001);
      expect(crop.y).toBeGreaterThanOrEqual(0);
      expect(crop.y + crop.h).toBeLessThanOrEqual(1.000001);
      expect(crop.h).toBeGreaterThan(0.01);
    }
  });
});

describe('buildPosterTiles', () => {
  it('creates one page per grid cell and splits the crop evenly', () => {
    const page = defaultPage('a4');
    const pages = buildPosterTiles(page, photo('poster', 4000, 3000), 2, 2);
    expect(pages).toHaveLength(4);
    expect(pages[0].note).toContain('1/4');
    expect(pages[3].note).toContain('4/4');
    const crops = pages.map((p) => p.items[0].crop!);
    const totalWidth = crops[0].w + crops[1].w;
    expect(totalWidth).toBeCloseTo(crops[2].w + crops[3].w, 6);
    expect(crops[0].y).toBeCloseTo(crops[1].y, 6);
    for (const p of pages) {
      expect(p.marginMm).toBe(0);
      expect(p.items).toHaveLength(1);
    }
  });
});
