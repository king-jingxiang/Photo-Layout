import { Download, HelpCircle, Lock } from 'lucide-react';
import { useAppStore } from '../store/store';

export function TopBar() {
  const patchUi = useAppStore((s) => s.patchUi);

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-zinc-200 bg-white px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 shadow-sm">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="4" width="18" height="12" rx="2" fill="#fff" />
            <rect x="5.5" y="6.5" width="6" height="4.5" rx="1" fill="#6366f1" />
            <rect x="13" y="6.5" width="3.5" height="7" rx="1" fill="#fbbf24" />
            <rect x="3" y="18.5" width="18" height="2.5" rx="1.25" fill="#a1a1aa" />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight text-zinc-900">
            Photo Layout Studio
          </div>
          <div className="hidden text-[10.5px] font-medium tracking-wide text-zinc-400 sm:block">
            照片排版 · 裁切拼贴 · 打印导出
          </div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <span className="mr-2 hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 lg:inline-flex">
          <Lock size={11} /> 照片仅在本机处理，不上传服务器
        </span>
        <button
          type="button"
          className="icon-btn"
          title="使用说明与快捷键"
          onClick={() => patchUi({ helpOpen: true })}
        >
          <HelpCircle size={17} />
        </button>
        <button
          type="button"
          className="btn btn-primary px-3.5"
          onClick={() => patchUi({ exportDialogOpen: true })}
        >
          <Download size={15} />
          导出 / 打印
        </button>
      </div>
    </header>
  );
}
