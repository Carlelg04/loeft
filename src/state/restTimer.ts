import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { RestTimer } from '../db/types';

export function useRestTimer(): RestTimer | null {
  return useLiveQuery(async () => ((await db.kv.get('restTimer'))?.value as RestTimer | undefined) ?? null, [], null);
}

export async function startRest(exerciseId: string, durationSec: number): Promise<void> {
  if (durationSec <= 0) {
    await db.kv.delete('restTimer');
    return;
  }
  const value: RestTimer = { endsAt: Date.now() + durationSec * 1000, durationSec, exerciseId };
  await db.kv.put({ key: 'restTimer', value });
}

/** Lægger sekunder til eller trækker fra. Bygger altid på sluttidspunktet. */
export async function adjustRest(deltaSec: number): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    const t = (await db.kv.get('restTimer'))?.value as RestTimer | undefined;
    if (!t) return;
    const endsAt = Math.max(Date.now(), t.endsAt + deltaSec * 1000);
    await db.kv.put({ key: 'restTimer', value: { ...t, endsAt, durationSec: Math.max(0, t.durationSec + deltaSec) } });
  });
}

export async function clearRest(): Promise<void> {
  await db.kv.delete('restTimer');
}
