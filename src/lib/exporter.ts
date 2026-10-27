import { db } from '../db/db';
import { updateSettings } from '../state/settings';
import { backupFileName, createBackup, workoutsToCSV } from './backup';

export type ExportResult = 'shared' | 'downloaded' | 'cancelled';

/** Deler filen (iPhone og Android: "Gem i Filer") eller downloader den. */
export async function shareOrDownload(filename: string, mime: string, content: string): Promise<ExportResult> {
  const file = new File([content], filename, { type: mime });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}

export async function exportBackupFile(): Promise<ExportResult> {
  const backup = await createBackup(db);
  const res = await shareOrDownload(backupFileName(), 'application/json', JSON.stringify(backup));
  if (res !== 'cancelled') await updateSettings({ lastBackupAt: Date.now() });
  return res;
}

export async function exportCsvFile(): Promise<ExportResult> {
  const [workouts, exercises] = await Promise.all([db.workouts.toArray(), db.exercises.toArray()]);
  const csv = workoutsToCSV(workouts, new Map(exercises.map((e) => [e.id, e])));
  return shareOrDownload(backupFileName().replace('backup', 'traeninger').replace('.json', '.csv'), 'text/csv', csv);
}
