import { Images, LayoutTemplate, Settings2 } from 'lucide-react';
import { useAppStore } from '../store/store';
import { PhotoPanel } from './PhotoPanel';
import { TemplatePanel } from './TemplatePanel';
import { PaperPanel } from './PaperPanel';
import type { UiState } from '../types';

const TABS: Array<{
  id: UiState['activeTab'];
  label: string;
  icon: typeof Images;
}> = [
  { id: 'photos', label: '照片', icon: Images },
  { id: 'templates', label: '模板', icon: LayoutTemplate },
  { id: 'paper', label: '纸张', icon: Settings2 },
];

export function LeftPanel() {
  const activeTab = useAppStore((s) => s.ui.activeTab);
  const setTab = useAppStore((s) => s.setTab);

  return (
    <aside className="hidden w-[300px] shrink-0 flex-col border-r border-zinc-200 bg-white md:flex">
      <div className="flex h-11 shrink-0 items-center gap-0.5 border-b border-zinc-100 px-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[12px] font-medium transition ${
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'photos' ? <PhotoPanel /> : null}
        {activeTab === 'templates' ? <TemplatePanel /> : null}
        {activeTab === 'paper' ? <PaperPanel /> : null}
      </div>
    </aside>
  );
}
