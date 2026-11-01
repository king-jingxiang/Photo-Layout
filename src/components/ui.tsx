import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { X } from 'lucide-react';

export function Section({
  title,
  children,
  action,
  className = '',
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-b border-zinc-100 px-4 py-4 last:border-b-0 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="panel-heading">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: Array<{ value: T; label: string; icon?: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={`seg-group ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`seg-item inline-flex items-center justify-center gap-1 ${
            value === option.value ? 'seg-item-active' : ''
          }`}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  accessory,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  accessory?: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="field-label">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="tabular-nums text-[12px] font-medium text-zinc-700">
            {Math.round(value * 10) / 10}
            <span className="ml-0.5 text-[10px] font-normal text-zinc-400">{unit}</span>
          </span>
          {accessory}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min = -9999,
  max = 9999,
  step = 0.1,
  unit = '',
  className = '',
}: {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(String(Math.round(value * 10) / 10));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(Math.round(value * 10) / 10));
  }, [value]);

  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      {label ? <span className="field-label">{label}</span> : null}
      <div className="relative">
        <input
          className="input pr-7 tabular-nums"
          type="number"
          value={draft}
          step={step}
          min={min}
          max={max}
          onFocus={() => {
            focused.current = true;
          }}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(n);
          }}
          onBlur={() => {
            focused.current = false;
            const n = Number(draft);
            if (!Number.isFinite(n) || draft.trim() === '') {
              setDraft(String(Math.round(value * 10) / 10));
            } else {
              const clamped = Math.min(max, Math.max(min, n));
              setDraft(String(clamped));
              if (clamped !== value) onChange(clamped);
            }
          }}
        />
        {unit ? (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400">
            {unit}
          </span>
        ) : null}
      </div>
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 py-1 text-left"
    >
      <span>
        <span className="block text-[12.5px] font-medium text-zinc-700">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[11px] leading-4 text-zinc-400">{description}</span>
        ) : null}
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-indigo-600' : 'bg-zinc-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-4.5' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="field-label">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-[11px] uppercase text-zinc-500">{value}</span>
        <span
          className="relative h-6 w-6 overflow-hidden rounded-md border border-zinc-200"
          style={{ backgroundColor: value }}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </span>
      </span>
    </label>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 640,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card" style={{ width, maxWidth: '100%' } as CSSProperties}>
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-[16px] font-semibold text-zinc-900">{title}</h2>
            {subtitle ? <p className="mt-1 text-[12px] text-zinc-500">{subtitle}</p> : null}
          </div>
          <button type="button" className="icon-btn -mr-1 -mt-1" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        {children}
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50/70 px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function EmptyHint({ icon, title, description, action }: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-8 text-center">
      <div className="mb-2 text-zinc-400">{icon}</div>
      <p className="text-[13px] font-medium text-zinc-700">{title}</p>
      <p className="mt-1 max-w-[220px] text-[11px] leading-4 text-zinc-400">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
