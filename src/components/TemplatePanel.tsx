import { useState } from 'react';
import { LayoutTemplate, Sparkles } from 'lucide-react';
import {
  TEMPLATES,
  TEMPLATE_GROUP_NAMES,
  type TemplateGroup,
} from '../data/templates';
import { useActivePage, useAppStore } from '../store/store';
import { findPreset } from '../data/papers';
import { TemplatePreview } from './TemplatePreview';
import { EmptyHint } from './ui';

type Filter = 'all' | TemplateGroup;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'auto', label: '自动' },
  { value: 'collage', label: '拼贴' },
  { value: 'special', label: '特殊' },
];

export function TemplatePanel() {
  const applyTemplate = useAppStore((s) => s.applyTemplate);
  const photos = useAppStore((s) => s.photos);
  const page = useActivePage();
  const selectedFrameId = useAppStore((s) => s.ui.selectedFrameId);
  const [filter, setFilter] = useState<Filter>('all');

  const visible = TEMPLATES.filter((t) => filter === 'all' || t.group === filter);
  const groups: TemplateGroup[] = ['auto', 'collage', 'special'];
  const presetName =
    page.presetId === 'custom' ? '自定义纸张' : (findPreset(page.presetId)?.name ?? '自定义纸张');

  return (
    <div className="flex h-full flex-col overflow-y-auto scroll-thin px-3 pb-4">
      <div className="mt-3 rounded-xl bg-gradient-to-br from-indigo-50 via-white to-amber-50 p-3 ring-1 ring-indigo-100/70">
        <div className="flex items-center gap-2 text-[12px] font-medium text-zinc-800">
          <Sparkles size={14} className="text-indigo-600" />
          一键排版，也可逐张微调
        </div>
        <p className="mt-1 text-[10.5px] leading-4 text-zinc-500">
          模板会按当前纸张重新排列页面，使用「{presetName}」尺寸 {page.widthMm} × {page.heightMm}{' '}
          mm。应用后可拖动、缩放和裁切。
        </p>
      </div>

      <div className="mt-3">
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`flex-1 rounded-[7px] px-1.5 py-1.5 text-[11.5px] font-medium transition ${
                filter === f.value
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="mt-3">
          <EmptyHint
            icon={<LayoutTemplate size={26} strokeWidth={1.6} />}
            title="上传照片后使用模板"
            description="可以从左侧「照片」标签上传，或加载示例照片体验自动排版与裁切拼贴。"
          />
        </div>
      ) : null}

      {groups.map((group) => {
        const items = visible.filter((t) => t.group === group);
        if (!items.length) return null;
        return (
          <div key={group} className="mt-4">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="panel-heading">{TEMPLATE_GROUP_NAMES[group]}</h3>
              <span className="text-[10px] text-zinc-400">{items.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {items.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyTemplate(template.id)}
                  disabled={photos.length === 0}
                  className="group flex flex-col rounded-xl border border-zinc-200 bg-white p-1.5 text-left transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md disabled:pointer-events-none disabled:opacity-50"
                  title={template.desc}
                >
                  <TemplatePreview template={template} pageAspect={page.widthMm / page.heightMm} />
                  <div className="mt-1.5 flex items-start justify-between gap-1 px-0.5 pb-0.5">
                    <div className="min-w-0">
                      <p className="truncate text-[11.5px] font-medium text-zinc-800">
                        {template.name}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[9.5px] leading-3 text-zinc-400">
                        {template.desc}
                      </p>
                    </div>
                    {template.badge ? (
                      <span className="shrink-0 rounded bg-indigo-50 px-1 py-0.5 text-[8.5px] font-semibold text-indigo-600">
                        {template.badge}
                      </span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div className="mt-4 space-y-1 rounded-lg bg-zinc-50 p-2.5 text-[10.5px] leading-4 text-zinc-400">
        <p>
          · 单图模板（证件照、满版、心形等）会优先使用
          <span className="text-zinc-600">当前选中画框</span>的照片，否则使用图库第一张。
        </p>
        <p>· 「分页海报」会把一张照片切成多张纸，导出 PDF 后拼接打印。</p>
        <p>· 所有模板应用都可以用 Ctrl / ⌘ + Z 撤销。</p>
        {selectedFrameId ? (
          <p className="text-indigo-500">· 已选中一个画框，单图模板将使用它的照片。</p>
        ) : null}
      </div>
    </div>
  );
}
