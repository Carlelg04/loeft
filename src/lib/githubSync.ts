import { useLiveQuery } from 'dexie-react-hooks';
import type { Transaction } from 'dexie';
import { db, type LoeftDB } from '../db/db';
import type { Settings } from '../db/types';
import { createBackup, type BackupFile } from './backup';

// Automatisk backup til et privat GitHub-repo. Telefonen er stadig den primære kilde;
// repoet er en sikkerhedskopi med historik (én commit pr. ændring).

export const SYNC_PATH = 'loeft-backup.json';
const API = 'https://api.github.com';

export interface SyncConfig {
  owner: string;
  repo: string;
  token: string;
}

export interface SyncState {
  config?: SyncConfig;
  dirty: boolean;
  lastSyncAt?: number;
  lastRemoteSha?: string;
  lastError?: string;
}

const EMPTY: SyncState = { dirty: false };

export async function getSyncState(d: LoeftDB = db): Promise<SyncState> {
  return { ...EMPTY, ...((await d.kv.get('sync'))?.value as Partial<SyncState> | undefined) };
}

export async function saveSyncState(patch: Partial<SyncState>, d: LoeftDB = db): Promise<void> {
  await d.transaction('rw', d.kv, async () => {
    const cur = await getSyncState(d);
    await d.kv.put({ key: 'sync', value: { ...cur, ...patch } });
  });
}

export async function clearSync(d: LoeftDB = db): Promise<void> {
  await d.kv.delete('sync');
}

export function useSyncState(): SyncState {
  return useLiveQuery(() => getSyncState(), [], EMPTY);
}

/** "Carlelg04/loeft-data" eller en GitHub-adresse giver ejer og repo. */
export function parseRepo(input: string): { owner: string; repo: string } | null {
  const s = input
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');
  const m = s.match(/^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

// ---------- Indhold ----------

const enc = new TextEncoder();

export function toBase64(s: string): string {
  const bytes = enc.encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Samme SHA-1 som git bruger for en fil, så uændrede data ikke giver en ny commit. */
export async function gitBlobSha(s: string): Promise<string> {
  const body = enc.encode(s);
  const head = enc.encode(`blob ${body.length}\0`);
  const all = new Uint8Array(head.length + body.length);
  all.set(head);
  all.set(body, head.length);
  const digest = await crypto.subtle.digest('SHA-1', all);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Backuppen der sendes: kun afsluttede træninger, og et tidsstempel der kun ændrer sig,
 * når data gør. En igangværende træning ændrer altså ikke filen.
 */
export async function syncContent(d: LoeftDB = db): Promise<{ text: string; backup: BackupFile }> {
  const b = await createBackup(d, 0);
  const workouts = b.data.workouts.filter((w) => w.endedAt).sort((x, y) => x.startedAt - y.startedAt);
  const stamp = Math.max(0, ...workouts.map((w) => w.endedAt ?? 0), ...b.data.routines.map((r) => r.updatedAt));
  const { lastBackupAt: _lastBackupAt, ...settings } = (b.data.settings ?? {}) as Settings;
  const backup: BackupFile = {
    ...b,
    exportedAt: stamp,
    data: {
      exercises: [...b.data.exercises].sort((x, y) => x.id.localeCompare(y.id)),
      routines: [...b.data.routines].sort((x, y) => x.order - y.order),
      workouts,
      settings,
    },
  };
  return { text: JSON.stringify(backup), backup };
}

// ---------- GitHub ----------

export class SyncError extends Error {}

// Kun headers, som GitHub tillader fra en browser (CORS). X-GitHub-Api-Version er ikke på listen,
// og uden den bruger GitHub standardversionen 2022-11-28.
function headers(token: string, raw = false): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
  };
}

async function call(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: 'no-store' });
  } catch {
    throw new SyncError('Ingen forbindelse til GitHub. Prøver igen, når der er net.');
  }
}

function explain(res: Response): SyncError {
  if (res.status === 401) return new SyncError('Nøglen virker ikke længere. Lav en ny nøgle, og forbind igen.');
  if (res.status === 403 || res.status === 404)
    return new SyncError('Nøglen har ikke adgang til repoet. Tjek at den må skrive i netop dette repo.');
  if (res.status === 429) return new SyncError('GitHub siger, der er for mange forespørgsler. Prøver igen senere.');
  return new SyncError(`GitHub svarede med fejl ${res.status}. Prøver igen senere.`);
}

const contentsUrl = (c: SyncConfig) => `${API}/repos/${c.owner}/${c.repo}/contents/${SYNC_PATH}`;

/** Tjekker nøgle og repo. Et offentligt repo afvises, så dine data ikke bliver synlige for andre. */
export async function testConnection(c: SyncConfig): Promise<{ remoteSha?: string }> {
  const res = await call(`${API}/repos/${c.owner}/${c.repo}`, { headers: headers(c.token) });
  if (res.status === 404) throw new SyncError('Repoet findes ikke, eller nøglen har ikke adgang til det.');
  if (!res.ok) throw explain(res);
  const info = (await res.json()) as { private?: boolean; permissions?: { push?: boolean } };
  if (info.private !== true) throw new SyncError('Repoet er offentligt. Gør det privat, så andre ikke kan se dine træninger.');
  if (info.permissions && info.permissions.push === false) throw new SyncError('Nøglen må ikke skrive i repoet. Giv den "Contents: Read and write".');
  return { remoteSha: await remoteSha(c) };
}

async function remoteSha(c: SyncConfig): Promise<string | undefined> {
  const res = await call(contentsUrl(c), { headers: headers(c.token) });
  if (res.status === 404) return undefined; // Ingen fil endnu, eller tomt repo.
  if (!res.ok) throw explain(res);
  return ((await res.json()) as { sha: string }).sha;
}

/** Henter backup-filen fra repoet som tekst, eller null hvis den ikke findes. */
export async function fetchRemote(c: SyncConfig): Promise<string | null> {
  const res = await call(contentsUrl(c), { headers: headers(c.token, true) });
  if (res.status === 404) return null;
  if (!res.ok) throw explain(res);
  return res.text();
}

async function put(c: SyncConfig, text: string, message: string, sha: string | undefined): Promise<Response> {
  return call(contentsUrl(c), {
    method: 'PUT',
    headers: { ...headers(c.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: toBase64(text), ...(sha ? { sha } : {}) }),
  });
}

function commitMessage(b: BackupFile, now: number): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  const n = b.data.workouts.length;
  return `Backup: ${n} ${n === 1 ? 'træning' : 'træninger'} (${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())})`;
}

export type SyncResult = 'uploaded' | 'unchanged' | 'not-configured' | 'offline' | 'error';

/** Sender backuppen, hvis den er ændret. Gemmer resultatet i sync-tilstanden. */
export async function syncNow(d: LoeftDB = db, now = Date.now): Promise<SyncResult> {
  const state = await getSyncState(d);
  const c = state.config;
  if (!c) return 'not-configured';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  try {
    const { text, backup } = await syncContent(d);
    const local = await gitBlobSha(text);
    if (local === state.lastRemoteSha) {
      await saveSyncState({ dirty: false, lastError: undefined, lastSyncAt: now() }, d);
      return 'unchanged';
    }
    let sha = await remoteSha(c);
    if (sha === local) {
      await saveSyncState({ dirty: false, lastError: undefined, lastSyncAt: now(), lastRemoteSha: local }, d);
      return 'unchanged';
    }
    let res = await put(c, text, commitMessage(backup, now()), sha);
    if (res.status === 409 || res.status === 422) {
      // Filen er ændret et andet sted siden. Historikken på GitHub bevarer den gamle version.
      sha = await remoteSha(c);
      res = await put(c, text, commitMessage(backup, now()), sha);
    }
    if (!res.ok) throw explain(res);
    const saved = ((await res.json()) as { content?: { sha?: string } }).content?.sha ?? local;
    await saveSyncState({ dirty: false, lastError: undefined, lastSyncAt: now(), lastRemoteSha: saved }, d);
    return 'uploaded';
  } catch (e) {
    const msg = e instanceof SyncError ? e.message : 'Backup til GitHub fejlede. Prøver igen senere.';
    await saveSyncState({ lastError: msg }, d);
    return 'error';
  }
}

// ---------- Hvornår der sendes ----------

let timer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<unknown> | null = null;
let again = false;

export function scheduleSync(delayMs = 3000): void {
  clearTimeout(timer);
  timer = setTimeout(() => void runSync(), delayMs);
}

export function runSync(): Promise<unknown> {
  if (running) {
    again = true;
    return running;
  }
  running = syncNow().finally(() => {
    running = null;
    if (again) {
      again = false;
      scheduleSync(1000);
    }
  });
  return running;
}

/** Markér at der er noget nyt at sende. Mange ændringer i træk giver én skrivning. */
function createMarkDirty(d: LoeftDB, onDirty: () => void) {
  let pending = false;
  return () => {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      void saveSyncState({ dirty: true }, d).then(onDirty);
    }, 0);
  };
}

/**
 * Lytter efter ændringer, der skal med i backuppen: rutiner, øvelser og afsluttede træninger.
 * Ændringer i en igangværende træning (hvert sæt) udløser ingenting.
 */
export function installSyncHooks(d: LoeftDB, onDirty: () => void = () => scheduleSync()): void {
  const markDirty = createMarkDirty(d, onDirty);
  // Hooks må ikke returnere noget: Dexie bruger returværdien som nøgle eller ekstra ændringer.
  const after = (tx: Transaction): void => {
    tx.on('complete', markDirty);
  };
  for (const table of [d.routines, d.exercises] as const) {
    const t = table as typeof d.routines;
    t.hook('creating', (_k, _o, tx) => {
      after(tx);
    });
    t.hook('updating', (_m, _k, _o, tx) => {
      after(tx);
    });
    t.hook('deleting', (_k, _o, tx) => {
      after(tx);
    });
  }
  d.workouts.hook('creating', (_k, obj, tx) => {
    if (obj.endedAt) after(tx);
  });
  d.workouts.hook('updating', (mods, _k, obj, tx) => {
    const m = mods as { endedAt?: number };
    if (obj.endedAt || ('endedAt' in m && m.endedAt)) after(tx);
  });
  d.workouts.hook('deleting', (_k, obj, tx) => {
    if (obj?.endedAt) after(tx);
  });
}

/** Start ved app-start: hooks, og forsøg igen når der kommer net eller appen åbnes. */
export function startAutoSync(): void {
  installSyncHooks(db);
  const retryIfDirty = () =>
    void getSyncState().then((s) => {
      if (s.config && s.dirty) scheduleSync(500);
    });
  window.addEventListener('online', retryIfDirty);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') retryIfDirty();
  });
  retryIfDirty();
}
