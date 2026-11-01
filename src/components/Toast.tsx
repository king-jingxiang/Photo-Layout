import { AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/store';

const TONE_STYLES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-zinc-200 bg-white text-zinc-700',
} as const;

const TONE_ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
} as const;

export function Toast() {
  const toast = useAppStore((s) => s.toast);
  if (!toast) return null;
  const Icon = TONE_ICONS[toast.tone];

  return (
    <div key={toast.id} className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
      <div
        className={`flex max-w-[520px] items-center gap-2 rounded-xl border px-3.5 py-2 text-[12px] font-medium shadow-lg ${TONE_STYLES[toast.tone]}`}
        style={{ animation: 'toast-in 200ms ease-out' }}
        role="status"
      >
        <Icon size={14} className="shrink-0" />
        <span className="leading-4">{toast.text}</span>
      </div>
    </div>
  );
}

export function BusyPill() {
  const busy = useAppStore((s) => s.busy);
  if (!busy) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-[70] flex justify-center px-4">
      <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white/95 px-3 py-1.5 text-[11.5px] font-medium text-zinc-600 shadow-lg backdrop-blur">
        <Loader2 size={13} className="animate-spin text-indigo-600" />
        {busy}
      </div>
    </div>
  );
}
