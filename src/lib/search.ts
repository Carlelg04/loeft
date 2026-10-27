import type { Exercise } from '../db/types';

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'oe')
    .replace(/å/g, 'aa')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Højst 1 redigering (indsæt, slet, erstat eller ombyt to nabobogstaver). */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la === lb) {
    const diff: number[] = [];
    for (let i = 0; i < la; i++) if (a[i] !== b[i]) diff.push(i);
    if (diff.length === 1) return true;
    if (diff.length === 2 && diff[1] === diff[0] + 1) return a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
    return false;
  }
  const [s, l] = la < lb ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < s.length && j < l.length) {
    if (s[i] === l[j]) {
      i++;
      j++;
    } else {
      if (skipped) return false;
      skipped = true;
      j++;
    }
  }
  return true;
}

function tokenMatches(q: string, words: string[]): number {
  let best = 0;
  for (const w of words) {
    if (w.startsWith(q)) best = Math.max(best, 3);
    else if (w.includes(q)) best = Math.max(best, 2);
    else if (q.length >= 4 && (withinOneEdit(q, w) || withinOneEdit(q, w.slice(0, q.length)))) best = Math.max(best, 1);
  }
  return best;
}

/** Score for en øvelse mod en søgning. 0 betyder intet match. */
export function scoreExercise(query: string, ex: Pick<Exercise, 'name' | 'aliases'>): number {
  const q = normalize(query);
  if (!q) return 1;
  const texts = [ex.name, ...ex.aliases].map(normalize);
  let best = 0;
  for (const t of texts) {
    if (t === q) return 100;
    if (t.startsWith(q)) best = Math.max(best, 60);
    else if (t.includes(q)) best = Math.max(best, 40);
  }
  if (best) return best;
  const qTokens = q.split(' ');
  for (const t of texts) {
    const words = t.split(' ');
    let total = 0;
    let ok = true;
    for (const qt of qTokens) {
      const m = tokenMatches(qt, words);
      if (!m) {
        ok = false;
        break;
      }
      total += m;
    }
    if (ok) best = Math.max(best, 5 + total);
  }
  return best;
}

export function searchExercises<T extends Pick<Exercise, 'name' | 'aliases'>>(query: string, list: T[]): T[] {
  if (!normalize(query)) return [...list].sort((a, b) => a.name.localeCompare(b.name, 'da'));
  return list
    .map((e) => ({ e, s: scoreExercise(query, e) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name, 'da'))
    .map((x) => x.e);
}
