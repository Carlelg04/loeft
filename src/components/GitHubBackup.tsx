import { useState } from 'react';
import { db } from '../db/db';
import { formatTime, relativeDay } from '../lib/dates';
import { importBackup } from '../lib/backup';
import {
  clearSync,
  fetchRemote,
  parseRepo,
  runSync,
  saveSyncState,
  SyncError,
  testConnection,
  useSyncState,
  type SyncConfig,
} from '../lib/githubSync';
import { useDialogs } from './Sheet';
import { Button, Field, inputClass } from './ui';

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';
const NEW_REPO_URL = 'https://github.com/new';

async function countFinished(): Promise<number> {
  return (await db.workouts.toArray()).filter((w) => w.endedAt).length;
}

/** Henter og validerer backuppen i repoet. null hvis der ingen er. */
async function loadRemote(c: SyncConfig) {
  const text = await fetchRemote(c);
  if (text === null) return null;
  const { parseBackup } = await import('../lib/backupParse');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SyncError('Filen i repoet er ikke en gyldig backup.');
  }
  const parsed = parseBackup(raw);
  if (!parsed.ok) throw new SyncError(parsed.error);
  return parsed.backup;
}

export function GitHubBackup() {
  const sync = useSyncState();
  const { confirm, toast } = useDialogs();
  const [repoText, setRepoText] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setError(null);
    const repo = parseRepo(repoText);
    if (!repo) return setError('Skriv repoet som ejer/navn, fx Carlelg04/loeft-data.');
    if (!token.trim()) return setError('Indsæt adgangsnøglen.');
    const config: SyncConfig = { ...repo, token: token.trim() };
    setBusy(true);
    try {
      const { remoteSha } = await testConnection(config);
      if (remoteSha) {
        const remote = await loadRemote(config);
        if (remote) {
          const local = await countFinished();
          const n = remote.data.workouts.length;
          const choice = await confirm({
            title: 'Der ligger allerede en backup',
            message: `Repoet har ${n} ${n === 1 ? 'træning' : 'træninger'}. Telefonen har ${local}. Hvad skal der ske?`,
            actions: [
              { label: local === 0 ? 'Hent mine data' : 'Hent og flet med telefonen', value: local === 0 ? 'replace' : 'merge', tone: 'primary' },
              ...(local > 0 ? [{ label: 'Erstat telefonens data', value: 'replace', tone: 'danger' as const }] : []),
              { label: 'Behold telefonens data', value: 'keep', tone: 'secondary' },
            ],
          });
          if (!choice) return;
          if (choice !== 'keep') await importBackup(db, remote, choice as 'merge' | 'replace');
        }
      }
      await saveSyncState({ config, dirty: true, lastError: undefined, lastRemoteSha: remoteSha });
      setToken('');
      setRepoText('');
      await runSync();
      toast({ message: 'Automatisk backup er slået til' });
    } catch (e) {
      setError(e instanceof SyncError ? e.message : 'Kunne ikke forbinde til GitHub.');
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!sync.config) return;
    setBusy(true);
    try {
      const remote = await loadRemote(sync.config);
      if (!remote) {
        toast({ message: 'Der ligger ingen backup i repoet endnu' });
        return;
      }
      const n = remote.data.workouts.length;
      const mode = await confirm({
        title: 'Hent fra GitHub',
        message: `Backuppen har ${n} ${n === 1 ? 'træning' : 'træninger'}.`,
        actions: [
          { label: 'Flet med telefonen', value: 'merge' as const, tone: 'primary' },
          { label: 'Erstat telefonens data', value: 'replace' as const, tone: 'danger' },
        ],
      });
      if (!mode) return;
      await importBackup(db, remote, mode);
      toast({ message: 'Data hentet fra GitHub' });
    } catch (e) {
      toast({ message: e instanceof SyncError ? e.message : 'Kunne ikke hente fra GitHub' });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    const c = await confirm({
      title: 'Slå automatisk backup fra?',
      message: 'Nøglen slettes fra telefonen. Backuppen og historikken på GitHub bliver liggende.',
      actions: [{ label: 'Slå fra', value: true, tone: 'danger' }],
    });
    if (!c) return;
    await clearSync();
    toast({ message: 'Automatisk backup er slået fra' });
  };

  if (sync.config) {
    const { owner, repo } = sync.config;
    const status = sync.lastError
      ? sync.lastError
      : sync.dirty
        ? 'Venter på at sende de seneste ændringer.'
        : sync.lastSyncAt
          ? `Alt er sendt. Seneste tjek ${relativeDay(sync.lastSyncAt)} kl. ${formatTime(sync.lastSyncAt)}.`
          : 'Klar.';
    return (
      <div className="flex flex-col gap-3 p-4" data-testid="github-backup">
        <p className="text-[15px]">
          Sender til{' '}
          <a className="font-semibold text-accent underline" href={`https://github.com/${owner}/${repo}/commits`} target="_blank" rel="noreferrer">
            {owner}/{repo}
          </a>
          , hver gang du gemmer en træning eller ændrer en rutine.
        </p>
        <p role="status" className={`text-[15px] ${sync.lastError ? 'text-danger' : 'text-muted'}`}>
          {status}
        </p>
        <Button tone="primary" size="lg" block disabled={busy} onClick={() => void runSync()}>
          Send backup nu
        </Button>
        <Button size="lg" block disabled={busy} onClick={() => void restore()}>
          Hent fra GitHub
        </Button>
        <Button tone="ghost" size="lg" block className="text-danger" onClick={() => void disconnect()}>
          Slå automatisk backup fra
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 p-4"
      data-testid="github-backup"
      onSubmit={(e) => {
        e.preventDefault();
        void connect();
      }}
    >
      <p className="text-[15px] text-muted">
        Send automatisk en backup til et privat GitHub-repo, hver gang du gemmer en træning. Hver backup bliver en version, du kan gå tilbage til.
      </p>
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[15px]">
        <li>
          Opret et <strong>privat</strong> repo, fx loeft-data:{' '}
          <a className="text-accent underline" href={NEW_REPO_URL} target="_blank" rel="noreferrer">
            github.com/new
          </a>
        </li>
        <li>
          Lav en nøgle:{' '}
          <a className="text-accent underline" href={TOKEN_URL} target="_blank" rel="noreferrer">
            ny adgangsnøgle
          </a>
          . Vælg "Only select repositories" og kun det repo. Under Permissions: Contents, "Read and write". Udløb: så lang tid som muligt.
        </li>
        <li>Indsæt repo og nøgle herunder.</li>
      </ol>
      <Field label="Repo">
        <input
          className={inputClass}
          value={repoText}
          onChange={(e) => setRepoText(e.target.value)}
          placeholder="Carlelg04/loeft-data"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </Field>
      <Field label="Adgangsnøgle" hint="Gemmes kun på denne telefon og kommer aldrig med i backup-filer.">
        <input
          className={inputClass}
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="github_pat_..."
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </Field>
      {error && (
        <p role="alert" className="text-[15px] text-danger">
          {error}
        </p>
      )}
      <Button type="submit" tone="primary" size="lg" block disabled={busy}>
        {busy ? 'Forbinder' : 'Forbind'}
      </Button>
    </form>
  );
}
