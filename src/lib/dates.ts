import { LOCALE } from './units';

const DAY = 86400000;

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "i dag", "i går", "for 3 dage siden", "for 2 uger siden". */
export function relativeDay(t: number, now = Date.now()): string {
  const days = Math.round((startOfDay(now) - startOfDay(t)) / DAY);
  if (days <= 0) return 'i dag';
  if (days === 1) return 'i går';
  if (days < 14) return `for ${days} dage siden`;
  if (days < 60) return `for ${Math.floor(days / 7)} uger siden`;
  const months = Math.floor(days / 30);
  return months < 24 ? `for ${months} måneder siden` : `for ${Math.floor(days / 365)} år siden`;
}

const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const monthFmt = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });

export const formatDateTime = (t: number) => dateTimeFmt.format(t);
export const formatDate = (t: number) => dateFmt.format(t);
export const formatShortDate = (t: number) => shortDateFmt.format(t);
export function formatMonth(t: number): string {
  const s = monthFmt.format(t);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Til <input type="datetime-local">. */
export function toLocalInput(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(s: string): number | undefined {
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : undefined;
}
