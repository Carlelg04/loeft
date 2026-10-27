import { useEffect, useRef, useState, type Ref } from 'react';

/** Rul feltet fri af tastaturet, når det åbner. */
function ensureVisible(el: HTMLElement) {
  const vv = window.visualViewport;
  const viewH = vv ? vv.height : window.innerHeight;
  const r = el.getBoundingClientRect();
  if (r.bottom > viewH - 24 || r.top < 72) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/**
 * Talfelt til træning: markerer alt ved fokus, gemmer løbende (debounce) og ved blur,
 * og "Næste" på tastaturet flytter videre.
 */
export function NumInput({
  value,
  format,
  parse,
  onCommit,
  onEnter,
  placeholder,
  decimal,
  label,
  className = '',
  inputRef,
}: {
  value: number | undefined;
  format: (n: number) => string;
  parse: (s: string) => number | undefined;
  onCommit: (n: number | undefined) => void;
  onEnter?: () => void;
  placeholder?: string;
  decimal?: boolean;
  label: string;
  className?: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const [text, setText] = useState(value === undefined ? '' : format(value));
  const focused = useRef(false);
  const pending = useRef<number | undefined>(undefined);
  const latest = useRef(text);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  // Følg værdien udefra, men aldrig mens jeg skriver.
  useEffect(() => {
    if (!focused.current) {
      const t = value === undefined ? '' : format(value);
      setText(t);
      latest.current = t;
    }
  }, [value, format]);

  const flush = () => {
    if (pending.current === undefined) return;
    window.clearTimeout(pending.current);
    pending.current = undefined;
    const n = parse(latest.current);
    if (n !== value) commitRef.current(n);
  };

  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      enterKeyHint={onEnter ? 'next' : 'done'}
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => {
        focused.current = true;
        const el = e.currentTarget;
        requestAnimationFrame(() => el.setSelectionRange(0, el.value.length));
        window.setTimeout(() => ensureVisible(el), 320);
      }}
      onBlur={() => {
        focused.current = false;
        if (pending.current === undefined) pending.current = -1;
        flush();
        const n = parse(latest.current);
        const t = n === undefined ? '' : format(n);
        setText(t);
        latest.current = t;
      }}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        latest.current = t;
        window.clearTimeout(pending.current);
        pending.current = window.setTimeout(flush, 300);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (pending.current === undefined) pending.current = -1;
          flush();
          if (onEnter) onEnter();
          else e.currentTarget.blur();
        }
      }}
      className={`tnum h-11 w-full rounded-[8px] bg-surface-2 px-1 text-center text-[18px] font-semibold text-text outline-none focus:bg-surface focus:ring-2 focus:ring-accent ${className}`}
    />
  );
}
