import {
  BarbellIcon,
  ChartBarIcon,
  ClockCounterClockwiseIcon,
  ListMagnifyingGlassIcon,
  XIcon,
} from '@phosphor-icons/react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';
import type { Settings, Workout } from '../db/types';
import { beep, vibrate } from '../lib/feedback';
import { formatClock } from '../lib/units';
import { useNow } from '../lib/useNow';
import { adjustRest, clearRest, useRestTimer } from '../state/restTimer';

const HIDE_NAV = [/^\/workout/, /^\/routines\/new/, /^\/routines\/[^/]+\/edit/, /^\/history\/[^/]+\/edit/, /^\/exercises\/new/, /^\/exercises\/[^/]+\/edit/];

/** Alt der ligger fast i bunden: pausetimer, aktiv træning, opdatering og navigation. */
export function BottomChrome({ active, settings }: { active: Workout | null | undefined; settings: Settings }) {
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const showNav = !HIDE_NAV.some((r) => r.test(pathname));
  // Træn-fanen viser selv træningen, og på træningsskærmen giver bjælken ingen mening.
  const hideActiveBar = pathname === '/' || pathname.startsWith('/workout');

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--chrome-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl">
      <UpdateBar hidden={!!active} />
      <div className="flex flex-col gap-2 px-2 pb-2 empty:hidden">
        <RestTimerBar settings={settings} />
        {active && !hideActiveBar && <ActiveWorkoutBar workout={active} />}
      </div>
      {showNav ? <BottomNav /> : <div className="pb-safe" />}
    </div>
  );
}

function BottomNav() {
  const items = [
    { to: '/', label: 'Træn', icon: BarbellIcon, end: true },
    { to: '/history', label: 'Historik', icon: ClockCounterClockwiseIcon },
    { to: '/exercises', label: 'Øvelser', icon: ListMagnifyingGlassIcon },
    { to: '/stats', label: 'Statistik', icon: ChartBarIcon },
  ];
  return (
    <nav aria-label="Hovedmenu" className="pb-safe border-t border-line bg-bg">
      <ul className="grid grid-cols-4">
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[12px] font-medium ${isActive ? 'text-accent' : 'text-muted'}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={24} weight={isActive ? 'fill' : 'regular'} />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function ActiveWorkoutBar({ workout }: { workout: Workout }) {
  const navigate = useNavigate();
  const now = useNow(1000);
  return (
    <button
      type="button"
      onClick={() => navigate('/workout')}
      className="anim-bar flex min-h-14 w-full items-center gap-3 rounded-card bg-accent px-4 text-left text-accent-ink shadow-lg active:scale-[0.99]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium opacity-80">Træning i gang</span>
        <span className="block truncate font-semibold">{workout.name}</span>
      </span>
      <span className="tnum text-lg font-semibold">{formatClock((now - workout.startedAt) / 1000)}</span>
    </button>
  );
}

const AUTO_CLEAR_AFTER_MS = 5 * 60 * 1000;

function RestTimerBar({ settings }: { settings: Settings }) {
  const timer = useRestTimer();
  const now = useNow(250, !!timer);
  const fired = useRef<number | null>(null);
  const remainingMs = timer ? timer.endsAt - now : 0;
  const finished = !!timer && remainingMs <= 0;

  useEffect(() => {
    if (!timer || !finished || fired.current === timer.endsAt) return;
    fired.current = timer.endsAt;
    // Kun lyd, hvis vi er tæt på sluttidspunktet. Ikke når appen åbnes længe efter.
    if (Date.now() - timer.endsAt < 3000) {
      if (settings.sound) beep(3);
      if (settings.vibrate) vibrate([250, 120, 250, 120, 250]);
    }
  }, [timer, finished, settings.sound, settings.vibrate]);

  useEffect(() => {
    if (timer && finished && now - timer.endsAt > AUTO_CLEAR_AFTER_MS) void clearRest();
  }, [timer, finished, now]);

  if (!timer) return null;
  const total = Math.max(1, timer.durationSec * 1000);
  const progress = finished ? 1 : 1 - remainingMs / total;

  return (
    <div
      role="timer"
      aria-label={finished ? 'Pausen er slut' : 'Pause'}
      className={`anim-bar relative overflow-hidden rounded-card shadow-lg ${finished ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text'}`}
    >
      {!finished && (
        <div
          className="absolute inset-y-0 left-0 bg-accent-soft"
          style={{ width: `${progress * 100}%`, transition: 'width 250ms linear' }}
          aria-hidden
        />
      )}
      <div className="relative flex min-h-16 items-center gap-1 px-2">
        <div className="min-w-0 flex-1 pl-2">
          <div className="text-[13px] font-medium opacity-80">{finished ? 'Pausen er slut' : 'Pause'}</div>
          <div className="tnum text-[28px] leading-tight font-semibold">
            {finished ? `+${formatClock(-remainingMs / 1000)}` : formatClock(Math.ceil(remainingMs / 1000))}
          </div>
        </div>
        {!finished && (
          <>
            <TimerButton label="15 sekunder mindre" onClick={() => void adjustRest(-15)}>
              −15
            </TimerButton>
            <TimerButton label="15 sekunder mere" onClick={() => void adjustRest(15)}>
              +15
            </TimerButton>
          </>
        )}
        <TimerButton label={finished ? 'Luk' : 'Spring over'} onClick={() => void clearRest()} wide={!finished}>
          {finished ? <XIcon size={22} weight="bold" /> : 'Spring over'}
        </TimerButton>
      </div>
    </div>
  );
}

function TimerButton({
  label,
  onClick,
  children,
  wide,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`tnum flex min-h-12 items-center justify-center rounded-ctl px-2 text-[15px] font-semibold active:scale-95 ${wide ? 'min-w-24' : 'min-w-12'} bg-black/10`}
    >
      {children}
    </button>
  );
}

/** Ny version klar. Vises aldrig under en træning, og genindlæser kun ved tryk. */
function UpdateBar({ hidden }: { hidden: boolean }) {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: () => undefined,
  });
  if (!needRefresh || hidden) return null;
  return (
    <div className="px-2 pb-2">
      <div className="anim-bar flex min-h-12 items-center gap-3 rounded-card bg-surface-2 px-4 shadow-lg">
        <span className="flex-1 text-[15px]">Ny version af appen er klar.</span>
        <button type="button" className="min-h-11 font-semibold text-accent" onClick={() => void updateServiceWorker(true)}>
          Genindlæs
        </button>
      </div>
    </div>
  );
}
