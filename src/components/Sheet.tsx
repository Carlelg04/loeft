import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui';

let openSheets = 0;

/** Bottom sheet: glider op fra bunden, lukker ved tryk udenfor eller Escape. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    openSheets += 1;
    document.body.style.overflow = 'hidden';
    panel.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      openSheets -= 1;
      if (openSheets === 0) document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="anim-fade absolute inset-0 bg-black/55" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="anim-sheet pb-safe absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] max-w-xl flex-col rounded-t-[16px] bg-surface outline-none"
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line" aria-hidden />
        {title && <h2 className="shrink-0 px-4 pt-3 pb-2 text-lg font-semibold">{title}</h2>}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-line px-4 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Liste af handlinger i en sheet (menuer). */
export function SheetActions({
  items,
}: {
  items: { label: string; icon?: ReactNode; onClick: () => void; tone?: 'danger'; hidden?: boolean }[];
}) {
  return (
    <div className="-mx-2 flex flex-col">
      {items
        .filter((i) => !i.hidden)
        .map((i) => (
          <button
            key={i.label}
            type="button"
            onClick={i.onClick}
            className={`flex min-h-13 items-center gap-3 rounded-ctl px-3 text-left text-[17px] active:bg-surface-2 ${
              i.tone === 'danger' ? 'text-danger' : 'text-text'
            }`}
          >
            {i.icon && <span className="text-muted">{i.icon}</span>}
            {i.label}
          </button>
        ))}
    </div>
  );
}

// ---------- Bekræftelser og fortryd-beskeder ----------

type Tone = 'primary' | 'secondary' | 'danger';
interface ConfirmAction<T> {
  label: string;
  value: T;
  tone?: Tone;
}
interface ConfirmOptions<T> {
  title: string;
  message?: ReactNode;
  actions: ConfirmAction<T>[];
  cancelLabel?: string;
}
interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}
interface DialogsApi {
  confirm: <T>(opts: ConfirmOptions<T>) => Promise<T | null>;
  toast: (opts: ToastOptions) => void;
}

const DialogsContext = createContext<DialogsApi | null>(null);

export function useDialogs(): DialogsApi {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error('DialogsProvider mangler');
  return ctx;
}

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<{
    opts: ConfirmOptions<unknown>;
    resolve: (v: unknown) => void;
  } | null>(null);
  const [toastState, setToastState] = useState<(ToastOptions & { id: number }) | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const confirm = useCallback(<T,>(opts: ConfirmOptions<T>) => {
    return new Promise<T | null>((resolve) => {
      setConfirmState({ opts: opts as ConfirmOptions<unknown>, resolve: resolve as (v: unknown) => void });
    });
  }, []);

  const toast = useCallback((opts: ToastOptions) => {
    window.clearTimeout(timer.current);
    const id = Date.now();
    setToastState({ ...opts, id });
    timer.current = window.setTimeout(() => setToastState((t) => (t?.id === id ? null : t)), opts.duration ?? 5000);
  }, []);

  const close = (v: unknown) => {
    confirmState?.resolve(v);
    setConfirmState(null);
  };

  return (
    <DialogsContext.Provider value={{ confirm, toast }}>
      {children}
      <Sheet open={!!confirmState} onClose={() => close(null)} title={confirmState?.opts.title}>
        {confirmState?.opts.message && <div className="mb-4 text-[17px] text-muted">{confirmState.opts.message}</div>}
        <div className="flex flex-col gap-2">
          {confirmState?.opts.actions.map((a) => (
            <Button key={a.label} tone={a.tone ?? 'secondary'} size="lg" block onClick={() => close(a.value)}>
              {a.label}
            </Button>
          ))}
          <Button tone="ghost" size="lg" block onClick={() => close(null)}>
            {confirmState?.opts.cancelLabel ?? 'Annullér'}
          </Button>
        </div>
      </Sheet>
      {toastState &&
        createPortal(
          <div
            role="status"
            className="anim-bar fixed inset-x-0 z-40 mx-auto flex max-w-xl px-3"
            style={{ bottom: 'calc(var(--chrome-h, 0px) + 12px)' }}
          >
            <div className="flex min-h-12 w-full items-center gap-3 rounded-card bg-text px-4 text-bg shadow-lg">
              <span className="flex-1 text-[15px]">{toastState.message}</span>
              {toastState.actionLabel && (
                <button
                  type="button"
                  className="min-h-11 px-2 text-[15px] font-semibold"
                  onClick={() => {
                    toastState.onAction?.();
                    setToastState(null);
                  }}
                >
                  {toastState.actionLabel}
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </DialogsContext.Provider>
  );
}
