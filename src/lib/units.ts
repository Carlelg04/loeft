export const LOCALE = 'da-DK';
const LB_PER_KG = 2.2046226218;

/** "82,5", "82.5" og " 82 " giver tal. Tom eller ugyldig tekst giver undefined. */
export function parseDecimal(input: string): number | undefined {
  const s = input.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return undefined;
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(s)) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export function parseInteger(input: string): number | undefined {
  const n = parseDecimal(input);
  if (n === undefined) return undefined;
  return Math.round(n);
}

/** "8-10" giver { min: 8, max: 10 }, "8" giver { min: 8 }. */
export function parseRepRange(input: string): { min?: number; max?: number } {
  const s = input.trim();
  if (s === '') return {};
  const m = s.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    return a < b ? { min: a, max: b } : { min: a };
  }
  const n = parseInteger(s);
  return n === undefined ? {} : { min: n };
}

export function kgToDisplay(kg: number, unit: 'kg' | 'lb'): number {
  return unit === 'lb' ? kg * LB_PER_KG : kg;
}

export function displayToKg(value: number, unit: 'kg' | 'lb'): number {
  return unit === 'lb' ? value / LB_PER_KG : value;
}

const formatters = new Map<string, Intl.NumberFormat>();
function nf(maxDecimals: number, grouping: boolean): Intl.NumberFormat {
  const key = `${maxDecimals}-${grouping}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: maxDecimals, useGrouping: grouping });
    formatters.set(key, f);
  }
  return f;
}

export function formatNumber(n: number, maxDecimals = 2, grouping = true): string {
  return nf(maxDecimals, grouping).format(n);
}

/** Vægt til visning i den valgte enhed, uden enhed. */
export function formatWeight(kg: number, unit: 'kg' | 'lb', grouping = false): string {
  const v = kgToDisplay(kg, unit);
  return formatNumber(v, unit === 'lb' ? 1 : 2, grouping);
}

/** Sekunder til "1:05" eller "1:02:03". */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = String(sec).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/** Varighed i ord: "1 t 12 min", "45 min", "40 sek". */
export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  if (ms < 60000) return `${Math.max(0, Math.round(ms / 1000))} sek`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} t` : `${h} t ${m} min`;
}

export function formatRest(sec: number): string {
  if (sec <= 0) return 'Fra';
  return formatClock(sec);
}
