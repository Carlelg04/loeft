import { CaretLeftIcon } from '@phosphor-icons/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { goBackOr } from '../lib/nav';

type Tone = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg' | 'sm';

const toneClass: Record<Tone, string> = {
  primary: 'bg-accent text-accent-ink',
  secondary: 'bg-surface-2 text-text',
  ghost: 'bg-transparent text-text',
  danger: 'bg-danger-soft text-danger',
};
const sizeClass: Record<Size, string> = {
  sm: 'min-h-10 px-3 text-[15px]',
  md: 'min-h-12 px-4 text-base',
  lg: 'min-h-14 px-5 text-[17px]',
};

export function Button({
  tone = 'secondary',
  size = 'md',
  block,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: Size; block?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-ctl font-semibold transition-transform active:scale-[0.98] disabled:opacity-40 ${toneClass[tone]} ${sizeClass[size]} ${block ? 'w-full' : ''} ${className}`}
    />
  );
}

export function IconButton({
  label,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={`inline-flex size-12 shrink-0 items-center justify-center rounded-ctl text-text transition-transform active:scale-95 ${className}`}
    >
      {children}
    </button>
  );
}

/** Fast topbjælke med tilbage-knap, titel og handlinger. */
export function Header({
  title,
  back,
  right,
  children,
}: {
  title?: ReactNode;
  back?: boolean | string;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className="pt-safe sticky top-0 z-20 border-b border-line bg-bg">
      <div className="flex min-h-14 items-center gap-1 px-2">
        {back ? (
          <IconButton
            label="Tilbage"
            onClick={() => (typeof back === 'string' ? navigate(back) : goBackOr(navigate, '/'))}
          >
            <CaretLeftIcon size={24} weight="bold" />
          </IconButton>
        ) : (
          <div className="w-2" />
        )}
        <div className="min-w-0 flex-1">
          {typeof title === 'string' ? <h1 className="truncate text-[19px] font-semibold">{title}</h1> : title}
        </div>
        {right && <div className="flex items-center gap-1">{right}</div>}
      </div>
      {children}
    </header>
  );
}

export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto w-full max-w-xl px-4 pb-[calc(var(--chrome-h,0px)+24px)] ${className}`}>{children}</main>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mt-7 mb-2 flex items-center justify-between gap-2">
      <h2 className="text-[15px] font-semibold text-muted">{children}</h2>
      {right}
    </div>
  );
}

export function Empty({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line px-4 py-8 text-center">
      <p className="text-muted">{text}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-10 shrink-0 rounded-full border px-3.5 text-[15px] font-medium transition-colors ${
        active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-text'
      }`}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-ctl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 flex-1 rounded-[8px] px-2 text-[15px] font-medium transition-colors ${
            value === o.value ? 'bg-surface text-text shadow-sm' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[15px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-faint">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full min-h-12 rounded-ctl border border-line bg-surface px-3 text-[17px] text-text outline-none focus:border-accent';

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="tnum truncate text-[17px] font-semibold">{value}</div>
    </div>
  );
}
