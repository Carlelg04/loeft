import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Sheet, useDialogs } from '../components/Sheet';
import { REST_OPTIONS } from '../components/ExerciseForm';
import { GitHubBackup } from '../components/GitHubBackup';
import { Button, Header, inputClass, Page, Segmented } from '../components/ui';
import { db } from '../db/db';
import type { Settings } from '../db/types';
import { importBackup } from '../lib/backup';
import { formatDate, relativeDay } from '../lib/dates';
import { exportBackupFile, exportCsvFile } from '../lib/exporter';
import { formatRest } from '../lib/units';
import { updateSettings, useSettings } from '../state/settings';

declare const __APP_VERSION__: string;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-[15px] font-semibold text-muted">{title}</h2>
      <div className="overflow-hidden rounded-card bg-surface">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-3 border-b border-line px-4 py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div>{label}</div>
        {hint && <div className="text-[13px] text-faint">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-13 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-surface-2 ring-1 ring-line'}`}
    >
      <span
        className={`absolute top-1 left-1 size-6 rounded-full bg-surface shadow transition-transform ${checked ? 'translate-x-5' : ''}`}
        aria-hidden
      />
    </button>
  );
}

const set = (patch: Partial<Settings>) => void updateSettings(patch);

export function SettingsPage() {
  const s = useSettings();
  const { confirm, toast } = useDialogs();
  const fileInput = useRef<HTMLInputElement>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [wipe, setWipe] = useState(false);
  const counts = useLiveQuery(async () => ({
    workouts: await db.workouts.count(),
    routines: await db.routines.count(),
    exercises: await db.exercises.count(),
  }));

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  const onExport = async () => {
    const r = await exportBackupFile();
    if (r !== 'cancelled') toast({ message: 'Backup gemt' });
  };

  const onImportFile = async (file: File) => {
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      await confirm({ title: 'Kunne ikke læse filen', message: 'Filen er ikke en JSON-backup fra appen.', actions: [], cancelLabel: 'OK' });
      return;
    }
    const { parseBackup } = await import('../lib/backupParse');
    const parsed = parseBackup(raw);
    if (!parsed.ok) {
      await confirm({ title: 'Kunne ikke importere', message: parsed.error, actions: [], cancelLabel: 'OK' });
      return;
    }
    const d = parsed.backup.data;
    const mode = await confirm({
      title: 'Importér backup',
      message: `${d.workouts.length} træninger, ${d.exercises.length} øvelser og ${d.routines.length} rutiner. Eksporteret ${formatDate(parsed.backup.exportedAt)}.`,
      actions: [
        { label: 'Flet med mine data', value: 'merge' as const, tone: 'primary' },
        { label: 'Erstat alle mine data', value: 'replace' as const, tone: 'danger' },
      ],
    });
    if (!mode) return;
    if (mode === 'replace') {
      const ok = await confirm({
        title: 'Erstat alle data?',
        message: 'Alt, der ligger i appen nu, slettes og erstattes af backuppen.',
        actions: [{ label: 'Erstat alt', value: true, tone: 'danger' }],
      });
      if (!ok) return;
    }
    await importBackup(db, parsed.backup, mode);
    toast({ message: 'Backup importeret' });
  };

  return (
    <>
      <Header back="/stats" title="Indstillinger" />
      <Page>
        <Group title="Træning">
          <Row label="Vægtenhed">
            <div className="w-36">
              <Segmented
                label="Vægtenhed"
                value={s.unit}
                onChange={(unit) => set({ unit })}
                options={[
                  { value: 'kg', label: 'kg' },
                  { value: 'lb', label: 'lb' },
                ]}
              />
            </div>
          </Row>
          <Row label="Standard pausetid" hint="Bruges til nye øvelser">
            <select
              aria-label="Standard pausetid"
              className={`${inputClass} w-28 text-center`}
              value={s.defaultRestSec}
              onChange={(e) => set({ defaultRestSec: Number(e.target.value) })}
            >
              {REST_OPTIONS.map((sec) => (
                <option key={sec} value={sec}>
                  {formatRest(sec)}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Forrige fra">
            <select
              aria-label="Forrige-værdier fra"
              className={`${inputClass} w-44`}
              value={s.previousFrom}
              onChange={(e) => set({ previousFrom: e.target.value as Settings['previousFrom'] })}
            >
              <option value="any_workout">Enhver træning</option>
              <option value="same_routine">Samme rutine</option>
            </select>
          </Row>
        </Group>

        <Group title="Under træning">
          <Row label="Hold skærmen tændt" hint="Så pausetimeren kan ses og høres">
            <Toggle label="Hold skærmen tændt" checked={s.keepAwake} onChange={(keepAwake) => set({ keepAwake })} />
          </Row>
          <Row label="Lyd når pausen er slut" hint="Lydløs-knappen kan slå den fra">
            <Toggle label="Lyd" checked={s.sound} onChange={(sound) => set({ sound })} />
          </Row>
          <Row label="Vibration" hint="Kun Android. iPhone understøtter det ikke fra web">
            <Toggle label="Vibration" checked={s.vibrate} onChange={(vibrate) => set({ vibrate })} />
          </Row>
        </Group>

        <Group title="Udseende">
          <Row label="Tema">
            <div className="w-56">
              <Segmented
                label="Tema"
                value={s.theme}
                onChange={(theme) => set({ theme })}
                options={[
                  { value: 'dark', label: 'Mørkt' },
                  { value: 'light', label: 'Lyst' },
                  { value: 'system', label: 'System' },
                ]}
              />
            </div>
          </Row>
        </Group>

        <Group title="Automatisk backup til GitHub">
          <GitHubBackup />
        </Group>

        <Group title="Data">
          <div className="flex flex-col gap-2 p-4">
            <p className="text-[15px] text-muted">
              Alt ligger kun på denne telefon. Tag en backup jævnligt, og gem den i Filer, iCloud eller Drev.
            </p>
            <p className="text-[15px]">
              Seneste backup: {s.lastBackupAt ? `${relativeDay(s.lastBackupAt)} (${formatDate(s.lastBackupAt)})` : 'aldrig'}
            </p>
            <Button tone="primary" size="lg" block onClick={() => void onExport()}>
              Eksportér backup
            </Button>
            <Button size="lg" block onClick={() => fileInput.current?.click()}>
              Importér backup
            </Button>
            <Button size="lg" block onClick={() => void exportCsvFile()}>
              Eksportér som CSV
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void onImportFile(f);
              }}
            />
          </div>
          <Row label="Vedvarende lagring" hint="Beskytter mod at browseren rydder data">
            <span className="text-[15px] text-muted">{persisted === null ? 'Ukendt' : persisted ? 'Til' : 'Fra'}</span>
          </Row>
          {counts && (
            <Row label="Indhold">
              <span className="tnum text-[15px] text-muted">
                {counts.workouts} træninger, {counts.routines} rutiner
              </span>
            </Row>
          )}
        </Group>

        <Group title="Farezone">
          <div className="p-4">
            <Button tone="danger" size="lg" block onClick={() => setWipe(true)}>
              Slet alle data
            </Button>
          </div>
        </Group>

        <p className="mt-6 text-center text-[13px] text-faint">Løft version {__APP_VERSION__}</p>
      </Page>

      <WipeSheet open={wipe} onClose={() => setWipe(false)} />
    </>
  );
}

function WipeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (open) setText('');
  }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title="Slet alle data?">
      <p className="text-muted">
        Alle træninger, rutiner og egne øvelser slettes fra telefonen. Det kan ikke fortrydes. Appen starter forfra med
        startrutinerne.
      </p>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-[15px] font-medium">Skriv SLET for at bekræfte</span>
        <input className={inputClass} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" autoCapitalize="characters" />
      </label>
      <div className="mt-4 flex flex-col gap-2">
        <Button
          tone="danger"
          size="lg"
          block
          disabled={text.trim().toUpperCase() !== 'SLET'}
          onClick={async () => {
            await db.delete();
            window.location.reload();
          }}
        >
          Slet alle data
        </Button>
        <Button tone="ghost" size="lg" block onClick={onClose}>
          Annullér
        </Button>
      </div>
    </Sheet>
  );
}
