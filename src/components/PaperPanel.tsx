import { Check, RotateCw, SlidersHorizontal } from 'lucide-react';
import {
  PAPER_GROUP_NAMES,
  PAPER_PRESETS,
  pageSizeFromPreset,
} from '../data/papers';
import type { PaperGroup } from '../types';
import { useActivePage, useAppStore } from '../store/store';
import { ColorField, NumberField, Segmented, SliderField, Switch } from './ui';

const GROUPS: PaperGroup[] = ['photo', 'paper', 'postcard', 'card', 'other'];

export function PaperPanel() {
  const page = useActivePage();
  const setPaper = useAppStore((s) => s.setPaper);
  const setOrientation = useAppStore((s) => s.setOrientation);
  const setCustomSize = useAppStore((s) => s.setCustomSize);
  const updatePageSettings = useAppStore((s) => s.updatePageSettings);
  const showMargins = useAppStore((s) => s.ui.showMargins);
  const patchUi = useAppStore((s) => s.patchUi);

  return (
    <div className="flex h-full flex-col overflow-y-auto scroll-thin px-3 pb-5">
      <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10.5px] font-medium text-zinc-400">当前纸张</p>
            <p className="mt-0.5 text-[15px] font-semibold text-zinc-900">
              {page.widthMm} <span className="text-zinc-300">×</span> {page.heightMm}
              <span className="ml-1 text-[10px] font-normal text-zinc-400">mm</span>
            </p>
          </div>
          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
            {page.orientation === 'portrait' ? '纵向' : '横向'}
          </span>
        </div>
        <div className="mt-2.5">
          <Segmented
            value={page.orientation}
            onChange={(v) => setOrientation(v)}
            options={[
              { value: 'portrait', label: '纵向' },
              { value: 'landscape', label: '横向' },
            ]}
          />
        </div>
      </div>

      <div className="mt-4">
        <h3 className="panel-heading mb-2">标准尺寸</h3>
        <div className="space-y-3">
          {GROUPS.map((group) => (
            <div key={group}>
              <div className="mb-1 flex items-center gap-1.5 px-0.5">
                <span className="text-[10px] font-semibold tracking-wide text-zinc-400">
                  {PAPER_GROUP_NAMES[group]}
                </span>
                <span className="h-px flex-1 bg-zinc-100" />
              </div>
              <div className="space-y-0.5">
                {PAPER_PRESETS.filter((p) => p.group === group).map((preset) => {
                  const active = page.presetId === preset.id;
                  const dims = pageSizeFromPreset(
                    preset,
                    preset.defaultOrientation ?? 'portrait',
                  );
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setPaper(preset.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                        active
                          ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200'
                          : 'hover:bg-zinc-50'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-1 text-[12px] font-medium text-zinc-700">
                          {preset.name}
                          {active ? <Check size={12} className="text-indigo-600" /> : null}
                        </span>
                        {preset.note ? (
                          <span className="mt-0.5 block truncate text-[9.5px] text-zinc-400">
                            {preset.note}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 tabular-nums text-[10px] text-zinc-400">
                        {dims.widthMm} × {dims.heightMm}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="panel-heading">自定义尺寸</h3>
          <button
            type="button"
            className="icon-btn h-6 w-6"
            title="交换宽高"
            onClick={() => setCustomSize(page.heightMm, page.widthMm)}
          >
            <RotateCw size={12} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="宽度"
            unit="mm"
            value={page.widthMm}
            min={10}
            max={2000}
            onChange={(v) => setCustomSize(v, page.heightMm)}
          />
          <NumberField
            label="高度"
            unit="mm"
            value={page.heightMm}
            min={10}
            max={2000}
            onChange={(v) => setCustomSize(page.widthMm, v)}
          />
        </div>
        <p className="mt-2 text-[10px] leading-4 text-zinc-400">
          支持 10 - 2000 mm，适合特殊相纸、卡纸与手工裁切尺寸。
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-3 py-3">
        <h3 className="panel-heading mb-3">版面设置</h3>
        <div className="space-y-3">
          <SliderField
            label="页边距"
            unit="mm"
            value={page.marginMm}
            min={0}
            max={40}
            step={0.5}
            onChange={(v) => updatePageSettings({ marginMm: v })}
          />
          <SliderField
            label="模板间距"
            unit="mm"
            value={page.gapMm}
            min={0}
            max={20}
            step={0.5}
            onChange={(v) => updatePageSettings({ gapMm: v })}
          />
          <ColorField
            label="页面底色"
            value={page.background}
            onChange={(v) => updatePageSettings({ background: v })}
          />
          <Switch
            checked={page.cutLines}
            onChange={(v) => updatePageSettings({ cutLines: v })}
            label="显示 / 导出裁切线"
            description="证件照、裁切拼贴时建议开启"
          />
          <Switch
            checked={showMargins}
            onChange={(v) => patchUi({ showMargins: v })}
            label="显示页边距参考线"
            description="仅影响预览，不参与导出"
          />
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-amber-50/70 p-2.5 text-[10.5px] leading-4 text-amber-800/80 ring-1 ring-amber-100">
        <p className="flex items-center gap-1 font-medium">
          <SlidersHorizontal size={11} /> 打印建议
        </p>
        <p className="mt-1">
          照片类输出建议 300 DPI；大幅海报可用 150–200 DPI。打印时请选择「实际尺寸 / 100%」，关闭「适应页面」。
        </p>
      </div>
    </div>
  );
}
