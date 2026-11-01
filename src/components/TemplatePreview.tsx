import type { CSSProperties } from 'react';
import type { TemplateDef } from '../data/templates';

const HEART_CLIP =
  'polygon(50% 100%, 6% 55%, 2% 32%, 12% 12%, 32% 4%, 50% 18%, 68% 4%, 88% 12%, 98% 32%, 94% 55%)';

function cellStyle(index: number): CSSProperties {
  const hue = 208 + (index % 9) * 22;
  return {
    background: `linear-gradient(140deg, hsl(${hue} 72% 84%), hsl(${hue} 60% 62%))`,
  };
}

/** 模板结构缩略图：使用真实纸张比例与归一化格子示意 */
export function TemplatePreview({
  template,
  pageAspect,
}: {
  template: TemplateDef;
  pageAspect: number;
}) {
  const aspect = Math.min(Math.max(pageAspect, 0.55), 1.8);
  const landscape = aspect >= 1;

  if (template.previewPages) {
    return (
      <div className="relative grid h-[96px] w-full grid-cols-2 items-center justify-items-center gap-1.5 rounded-lg bg-zinc-100/80 p-2">
        {Array.from({ length: template.previewPages }).map((_, i) => {
          const hue = 214 + i * 16;
          return (
            <div
              key={`${template.id}-page-${i}`}
              className="relative h-full w-full overflow-hidden rounded-[2px] bg-white shadow-[0_1px_5px_rgba(24,24,27,0.14)] ring-1 ring-zinc-200"
              style={{ maxHeight: landscape ? '100%' : '100%' }}
            >
              <div
                className="absolute"
                style={{
                  left: `${(i % 2) * 50}%`,
                  top: `${Math.floor(i / 2) * 50}%`,
                  width: '50%',
                  height: '50%',
                  background: `linear-gradient(140deg, hsl(${hue} 72% 84%), hsl(${hue} 60% 62%))`,
                }}
              />
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                {Array.from({ length: 4 }).map((__, k) => (
                  <div key={k} className="border border-dashed border-white/50" />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const paperStyle: CSSProperties = landscape
    ? { width: '92%', aspectRatio: String(aspect) }
    : { height: '100%', aspectRatio: String(aspect) };

  return (
    <div
      className={`relative flex w-full items-center justify-center overflow-hidden rounded-lg ${
        landscape ? 'h-[78px]' : 'h-[96px]'
      } bg-zinc-100/80`}
    >
      <div
        className="relative overflow-hidden rounded-[2px] bg-white shadow-[0_2px_10px_rgba(24,24,27,0.14)] ring-1 ring-zinc-200"
        style={paperStyle}
      >
        {template.preview.map((cell, i) => (
          <div
            key={`${template.id}-${i}`}
            className={`absolute ${cell.white ? 'bg-white' : ''}`}
            style={{
              left: `${cell.x * 100}%`,
              top: `${cell.y * 100}%`,
              width: `${cell.w * 100}%`,
              height: `${cell.h * 100}%`,
              ...(cell.white ? {} : cellStyle(i)),
              ...(cell.mask === 'circle' ? { borderRadius: '50%' } : {}),
              ...(cell.mask === 'heart' ? { clipPath: HEART_CLIP } : {}),
              ...(cell.mask === 'rounded' ? { borderRadius: '14%' } : {}),
            }}
          >
            {cell.mask === 'heart' ? (
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 to-transparent" />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
