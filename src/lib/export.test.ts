import { describe, expect, it } from 'vitest';
import type { Page } from '../types';
import { estimateOutput, safeExportDpi } from './export';

function page(widthMm: number, heightMm: number): Page {
  return {
    id: 'p',
    presetId: 'custom',
    widthMm,
    heightMm,
    orientation: widthMm > heightMm ? 'landscape' : 'portrait',
    marginMm: 0,
    gapMm: 0,
    background: '#fff',
    cutLines: false,
    items: [],
  };
}

describe('safeExportDpi', () => {
  it('keeps 300 DPI for common photo paper sizes', () => {
    expect(safeExportDpi(page(102, 152), 300)).toBe(300);
    expect(safeExportDpi(page(210, 297), 300)).toBe(300);
  });

  it('reduces very large paper at 600 DPI to stay under the pixel budget', () => {
    const dpi = safeExportDpi(page(420, 594), 600);
    expect(dpi).toBeLessThan(600);
    expect(dpi).toBeGreaterThan(300);
  });

  it('never returns less than 72 DPI', () => {
    expect(safeExportDpi(page(2000, 2000), 600)).toBeGreaterThanOrEqual(72);
  });
});

describe('estimateOutput', () => {
  it('matches A4 at 300 DPI', () => {
    const result = estimateOutput(page(210, 297), 300);
    expect(result.dpi).toBe(300);
    expect(result.width).toBe(2480);
    expect(result.height).toBe(3508);
  });

  it('reports the reduced DPI in the estimate', () => {
    const result = estimateOutput(page(420, 594), 600);
    expect(result.dpi).toBe(safeExportDpi(page(420, 594), 600));
    expect(result.width * result.height).toBeLessThanOrEqual(60_000_000 * 1.1);
  });
});
