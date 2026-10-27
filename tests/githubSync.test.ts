import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoeftDB } from '../src/db/db';
import type { Workout } from '../src/db/types';
import {
  getSyncState,
  gitBlobSha,
  installSyncHooks,
  parseRepo,
  saveSyncState,
  syncContent,
  syncNow,
  testConnection,
  toBase64,
} from '../src/lib/githubSync';
import { parseBackup } from '../src/lib/backupParse';

/** En lille falsk GitHub: ét repo med én fil. */
function fakeGitHub(opts: { private?: boolean; status?: number } = {}) {
  const repo = { file: null as null | { text: string; sha: string }, puts: [] as { message: string; sha?: string }[], conflictOnce: false };
  const fn = vi.fn(async (url: string, init: RequestInit = {}) => {
    if (opts.status) return new Response('{}', { status: opts.status });
    const method = init.method ?? 'GET';
    const accept = (init.headers as Record<string, string>).Accept;
    if (url.endsWith('/repos/me/data')) return Response.json({ private: opts.private ?? true, permissions: { push: true } });
    if (url.endsWith('/contents/loeft-backup.json')) {
      if (method === 'GET') {
        if (!repo.file) return new Response('{"message":"Not Found"}', { status: 404 });
        if (accept.includes('raw')) return new Response(repo.file.text);
        return Response.json({ sha: repo.file.sha, size: repo.file.text.length });
      }
      const body = JSON.parse(String(init.body)) as { message: string; content: string; sha?: string };
      repo.puts.push({ message: body.message, sha: body.sha });
      if (repo.conflictOnce) {
        repo.conflictOnce = false;
        return new Response('{}', { status: 409 });
      }
      if (repo.file && body.sha !== repo.file.sha) return new Response('{}', { status: 409 });
      const bytes = Uint8Array.from(atob(body.content), (c) => c.charCodeAt(0));
      const text = new TextDecoder().decode(bytes);
      const sha = await gitBlobSha(text);
      repo.file = { text, sha };
      return Response.json({ content: { sha } }, { status: 201 });
    }
    return new Response('{}', { status: 404 });
  });
  return { repo, fn };
}

let db: LoeftDB;
let n = 0;
const config = { owner: 'me', repo: 'data', token: 'github_pat_x' };

beforeEach(async () => {
  db = new LoeftDB(`sync-${++n}`);
  await db.open();
});
afterEach(() => vi.unstubAllGlobals());

function workout(id: string, endedAt?: number): Workout {
  return {
    id,
    name: 'Push day',
    startedAt: 1000,
    endedAt,
    exerciseIds: ['ex-flyes'],
    exercises: [{ exerciseId: 'ex-flyes', restSec: 90, sets: [{ id: `${id}-s`, type: 'normal', kg: 85, reps: 5, done: true }] }],
  };
}

describe('hjælpere', () => {
  it('læser repo-navn i flere former', () => {
    expect(parseRepo('Carlelg04/loeft-data')).toEqual({ owner: 'Carlelg04', repo: 'loeft-data' });
    expect(parseRepo('https://github.com/Carlelg04/loeft-data.git')).toEqual({ owner: 'Carlelg04', repo: 'loeft-data' });
    expect(parseRepo('loeft-data')).toBeNull();
  });
  it('git blob sha som git hash-object', async () => {
    expect(await gitBlobSha('hello\n')).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
  });
  it('base64 klarer æøå', () => {
    const b = toBase64('Bænkpres, Øvre ryg, Håndvægte');
    expect(new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)))).toBe('Bænkpres, Øvre ryg, Håndvægte');
  });
});

describe('indhold', () => {
  it('tager kun afsluttede træninger med og er stabilt', async () => {
    await db.workouts.bulkAdd([workout('done', 5000), workout('active')]);
    const a = await syncContent(db);
    expect(a.backup.data.workouts.map((w) => w.id)).toEqual(['done']);
    const routines = await db.routines.toArray();
    expect(a.backup.exportedAt).toBe(Math.max(5000, ...routines.map((r) => r.updatedAt)));
    // En ændring i den aktive træning ændrer ikke filen.
    await db.workouts.update('active', { name: 'Ny' });
    expect((await syncContent(db)).text).toBe(a.text);
    // Filen kan læses som en almindelig backup.
    expect(parseBackup(JSON.parse(a.text)).ok).toBe(true);
  });
  it('nøglen kommer aldrig med i filen', async () => {
    await saveSyncState({ config }, db);
    expect((await syncContent(db)).text).not.toContain('github_pat_');
  });
});

describe('forbindelse', () => {
  it('afviser offentlige repoer', async () => {
    vi.stubGlobal('fetch', fakeGitHub({ private: false }).fn);
    await expect(testConnection(config)).rejects.toThrow(/offentligt/);
  });
  it('forklarer en ugyldig nøgle', async () => {
    vi.stubGlobal('fetch', fakeGitHub({ status: 401 }).fn);
    await expect(testConnection(config)).rejects.toThrow(/Nøglen virker ikke/);
  });
});

describe('syncNow', () => {
  it('sender, springer uændret over og sender igen ved ændring', async () => {
    const gh = fakeGitHub();
    vi.stubGlobal('fetch', gh.fn);
    await saveSyncState({ config, dirty: true }, db);
    await db.workouts.add(workout('a', 5000));

    expect(await syncNow(db)).toBe('uploaded');
    expect(gh.repo.puts).toHaveLength(1);
    expect(gh.repo.puts[0].message).toMatch(/^Backup: 1 træning/);
    const s = await getSyncState(db);
    expect(s.dirty).toBe(false);
    expect(s.lastError).toBeUndefined();

    expect(await syncNow(db)).toBe('unchanged');
    expect(gh.repo.puts).toHaveLength(1);

    await db.workouts.add(workout('b', 9000));
    expect(await syncNow(db)).toBe('uploaded');
    expect(gh.repo.puts).toHaveLength(2);
    expect(gh.repo.puts[1].sha).toBe(s.lastRemoteSha);
    expect(JSON.parse(gh.repo.file!.text).data.workouts).toHaveLength(2);
  });

  it('prøver igen én gang ved konflikt', async () => {
    const gh = fakeGitHub();
    vi.stubGlobal('fetch', gh.fn);
    await saveSyncState({ config }, db);
    gh.repo.conflictOnce = true;
    expect(await syncNow(db)).toBe('uploaded');
    expect(gh.repo.puts).toHaveLength(2);
  });

  it('gemmer en forståelig fejl og beholder ændringen', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await saveSyncState({ config, dirty: true }, db);
    expect(await syncNow(db)).toBe('error');
    const s = await getSyncState(db);
    expect(s.dirty).toBe(true);
    expect(s.lastError).toMatch(/Ingen forbindelse/);
  });

  it('gør intet uden forbindelse til et repo', async () => {
    expect(await syncNow(db)).toBe('not-configured');
  });
});

describe('hooks', () => {
  it('afsluttede træninger og rutiner markerer ændring, sæt i en aktiv træning gør ikke', async () => {
    const calls: number[] = [];
    installSyncHooks(db, () => calls.push(1));
    const settle = () => new Promise((r) => setTimeout(r, 60));
    await settle();
    calls.length = 0;

    await db.workouts.add(workout('active'));
    await db.workouts.update('active', { name: 'Ændret' });
    await db.workouts.put({ ...workout('active'), name: 'Igen' });
    await settle();
    expect(calls).toHaveLength(0);

    await db.workouts.put(workout('active', 7000));
    await settle();
    expect(calls).toHaveLength(1);
    expect((await getSyncState(db)).dirty).toBe(true);

    await db.routines.update('routine-push', { name: 'Push' });
    await settle();
    expect(calls).toHaveLength(2);
  });
});
