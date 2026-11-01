import { describe, expect, it } from 'vitest';
import type { Frame, PhotoMeta } from '../types';
import {
  clamp,
  coverCrop,
  effectiveDpi,
  frameAABB,
  hitTestFrame,
  localToPage,
  pageToLocal,
  rotatePoint,
  snapMove,
} from './geometry';
import { createFrame } from './layout';

function photo(width: number, height: number): PhotoMeta {
  return {
    id: 'p',
    name: 'p.jpg',
    width,
    height,
    byteSize: 0,
    thumb: '',
    createdAt: 0,
  };
}

describe('rotatePoint', () => {
  it('rotates 90 degrees around the centre', () => {
    const rotated = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90);
    expect(rotated.x).toBeCloseTo(0, 6);
    expect(rotated.y).toBeCloseTo(10, 6);
  });

  it('round-trips page ↔ local coordinates', () => {
    const frame: Frame = createFrame('p', { x: 20, y: 30, w: 100, h: 50 }, { rotation: 30 });
    const pagePoint = localToPage(frame, { x: 10, y: -5 });
    const back = pageToLocal(frame, pagePoint);
    expect(back.x).toBeCloseTo(10, 6);
    expect(back.y).toBeCloseTo(-5, 6);
  });
});

describe('hitTestFrame', () => {
  it('accepts points inside and rejects points outside', () => {
    const frame = createFrame('p', { x: 0, y: 0, w: 100, h: 50 });
    expect(hitTestFrame(frame, { x: 50, y: 25 })).toBe(true);
    expect(hitTestFrame(frame, { x: -1, y: 25 })).toBe(false);
    expect(hitTestFrame(frame, { x: 50, y: 60 })).toBe(false);
  });

  it('handles rotated frames using local coordinates', () => {
    const frame = createFrame('p', { x: 0, y: 0, w: 100, h: 50 }, { rotation: 90 });
    // 旋转 90° 后，原宽度方向变为竖直方向
    expect(hitTestFrame(frame, { x: 50, y: 75 })).toBe(true);
    expect(hitTestFrame(frame, { x: 5, y: 10 })).toBe(false);
  });
});

describe('frameAABB', () => {
  it('swaps width and height at 90 degrees', () => {
    const frame = createFrame('p', { x: 0, y: 0, w: 100, h: 50 }, { rotation: 90 });
    const box = frameAABB(frame);
    expect(box.w).toBeCloseTo(50, 6);
    expect(box.h).toBeCloseTo(100, 6);
    expect(box.x).toBeCloseTo(25, 6);
    expect(box.y).toBeCloseTo(-25, 6);
  });
});

describe('coverCrop', () => {
  it('centre-crops a landscape photo into a square at zoom 1', () => {
    const crop = coverCrop(4000, 3000, 100, 100, 1, 0.5, 0.5);
    expect(crop.sw).toBeCloseTo(3000, 6);
    expect(crop.sh).toBeCloseTo(3000, 6);
    expect(crop.sx).toBeCloseTo(500, 6);
    expect(crop.sy).toBeCloseTo(0, 6);
  });

  it('scales the crop rectangle down when zoomed in', () => {
    const crop = coverCrop(4000, 3000, 100, 100, 2, 0.5, 0.5);
    expect(crop.sw).toBeCloseTo(1500, 6);
    expect(crop.sx).toBeCloseTo(1250, 6);
    expect(crop.sy).toBeCloseTo(750, 6);
  });
});

describe('snapMove', () => {
  it('snaps to a nearby target edge and reports a guide line', () => {
    const rect = { x: 10.4, y: 10, w: 20, h: 20 };
    const result = snapMove(rect, [{ rect: { x: 10, y: 5, w: 50, h: 50 }, kind: 'page' }], 1);
    expect(result.x).toBeCloseTo(10, 6);
    expect(result.lines.some((line) => line.axis === 'x' && line.kind === 'page')).toBe(true);
  });

  it('leaves the rect untouched when nothing is within the threshold', () => {
    const rect = { x: 100, y: 100, w: 20, h: 20 };
    const result = snapMove(rect, [{ rect: { x: 0, y: 0, w: 20, h: 20 }, kind: 'frame' }], 0.5);
    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
    expect(result.lines).toHaveLength(0);
  });
});

describe('effectiveDpi', () => {
  it('uses the limiting axis for a cropped photo', () => {
    const frame = createFrame('p', { x: 0, y: 0, w: 100, h: 150 });
    expect(effectiveDpi(photo(3000, 2000), frame)).toBeCloseTo(2000 / (150 / 25.4), 5);
  });

  it('returns 0 for a degenerate frame', () => {
    const frame = createFrame('p', { x: 0, y: 0, w: 0, h: 0 });
    expect(effectiveDpi(photo(3000, 2000), frame)).toBe(0);
  });
});

describe('clamp', () => {
  it('bounds values', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-2, 0, 3)).toBe(0);
    expect(clamp(1.5, 0, 3)).toBe(1.5);
  });
});
