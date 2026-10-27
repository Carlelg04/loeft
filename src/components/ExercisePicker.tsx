import { CheckIcon, MagnifyingGlassIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../db/db';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, type Equipment, type Exercise, type Muscle } from '../db/types';
import { uid } from '../lib/id';
import { searchExercises } from '../lib/search';
import { useExercises } from '../state/exercises';
import { useRecentExerciseIds } from '../state/insights';
import { ExerciseForm } from './ExerciseForm';
import { Sheet } from './Sheet';
import { Button, Chip, inputClass } from './ui';

export function exerciseSubtitle(e: Exercise): string {
  return `${MUSCLE_LABELS[e.primaryMuscle]}, ${EQUIPMENT_LABELS[e.equipment].toLowerCase()}`;
}

/** Søgning og filtre over øvelsesbiblioteket. Bruges både i vælgeren og på Øvelser-fanen. */
export function useExerciseFilter(all: Exercise[]) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const visible = useMemo(() => all.filter((e) => !e.archived), [all]);
  const muscles = useMemo(() => {
    const used = new Set(visible.map((e) => e.primaryMuscle));
    return (Object.keys(MUSCLE_LABELS) as Muscle[]).filter((m) => used.has(m));
  }, [visible]);
  const equipments = useMemo(() => {
    const used = new Set(visible.map((e) => e.equipment));
    return (Object.keys(EQUIPMENT_LABELS) as Equipment[]).filter((q) => used.has(q));
  }, [visible]);
  const results = useMemo(
    () =>
      searchExercises(
        query,
        visible.filter((e) => (!muscle || e.primaryMuscle === muscle) && (!equipment || e.equipment === equipment)),
      ),
    [visible, query, muscle, equipment],
  );
  const filtering = !!query.trim() || !!muscle || !!equipment;
  const reset = () => {
    setQuery('');
    setMuscle(null);
    setEquipment(null);
  };
  return { query, setQuery, muscle, setMuscle, equipment, setEquipment, muscles, equipments, results, filtering, reset };
}

export function FilterBar({ f }: { f: ReturnType<typeof useExerciseFilter> }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <MagnifyingGlassIcon size={20} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          aria-label="Søg i øvelser"
          placeholder="Søg, fx bænkpres eller curl"
          className={`${inputClass} pr-10 pl-10`}
          value={f.query}
          onChange={(e) => f.setQuery(e.target.value)}
          autoComplete="off"
        />
        {f.query && (
          <button
            type="button"
            aria-label="Ryd søgning"
            className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center text-muted"
            onClick={() => f.setQuery('')}
          >
            <XIcon size={18} />
          </button>
        )}
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {f.muscles.map((m) => (
          <Chip key={m} active={f.muscle === m} onClick={() => f.setMuscle(f.muscle === m ? null : m)}>
            {MUSCLE_LABELS[m]}
          </Chip>
        ))}
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {f.equipments.map((q) => (
          <Chip key={q} active={f.equipment === q} onClick={() => f.setEquipment(f.equipment === q ? null : q)}>
            {EQUIPMENT_LABELS[q]}
          </Chip>
        ))}
      </div>
    </div>
  );
}

export function ExerciseRow({
  e,
  selected,
  onClick,
  showCheck,
}: {
  e: Exercise;
  selected?: boolean;
  onClick: () => void;
  showCheck?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={showCheck ? selected : undefined}
      className="flex min-h-15 w-full items-center gap-3 border-b border-line py-2 text-left last:border-b-0 active:bg-surface-2"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{e.name}</span>
        <span className="block text-[14px] text-muted">
          {exerciseSubtitle(e)}
          {e.isCustom && <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[12px]">Egen</span>}
        </span>
      </span>
      {showCheck && (
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 ${
            selected ? 'border-accent bg-accent text-accent-ink' : 'border-line'
          }`}
          aria-hidden
        >
          {selected && <CheckIcon size={16} weight="bold" />}
        </span>
      )}
    </button>
  );
}

export async function createExercise(d: Omit<Exercise, 'id' | 'isCustom'>): Promise<Exercise> {
  const ex: Exercise = { ...d, id: uid(), isCustom: true };
  await db.exercises.add(ex);
  return ex;
}

/** Vælg én eller flere øvelser i en bottom sheet. Nye øvelser kan oprettes direkte. */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  multi = true,
  title = 'Tilføj øvelser',
}: {
  open: boolean;
  onClose: () => void;
  onPick: (ids: string[]) => void;
  multi?: boolean;
  title?: string;
}) {
  const all = useExercises() ?? [];
  const recent = useRecentExerciseIds(6);
  const f = useExerciseFilter(all);
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const byId = useMemo(() => new Map(all.map((e) => [e.id, e])), [all]);
  const recentList = recent.map((id) => byId.get(id)).filter((e): e is Exercise => !!e && !e.archived);

  useEffect(() => {
    if (open) {
      setSelected([]);
      setCreating(false);
      f.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (id: string) => {
    if (!multi) {
      onPick([id]);
      return;
    }
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={creating ? 'Ny øvelse' : title}
      footer={
        multi && !creating ? (
          <Button tone="primary" size="lg" block disabled={!selected.length} onClick={() => onPick(selected)}>
            {selected.length === 1 ? 'Tilføj 1 øvelse' : `Tilføj ${selected.length || ''} øvelser`.replace('  ', ' ')}
          </Button>
        ) : undefined
      }
    >
      {creating ? (
        <ExerciseForm
          initial={{ name: f.query.trim() }}
          existingNames={all.map((e) => e.name)}
          submitLabel={multi ? 'Opret og vælg' : 'Opret og brug'}
          onSave={async (d) => {
            const ex = await createExercise(d);
            setCreating(false);
            if (multi) setSelected((s) => [...s, ex.id]);
            else onPick([ex.id]);
          }}
        />
      ) : (
        <>
          <div className="sticky top-0 z-10 -mx-4 bg-surface px-4 pt-1 pb-2">
            <FilterBar f={f} />
          </div>
          {!f.filtering && recentList.length > 0 && (
            <>
              <h3 className="mt-2 text-[14px] font-semibold text-muted">Senest brugt</h3>
              {recentList.map((e) => (
                <ExerciseRow key={e.id} e={e} selected={selected.includes(e.id)} showCheck={multi} onClick={() => toggle(e.id)} />
              ))}
              <h3 className="mt-5 text-[14px] font-semibold text-muted">Alle øvelser</h3>
            </>
          )}
          {f.results.map((e) => (
            <ExerciseRow key={e.id} e={e} selected={selected.includes(e.id)} showCheck={multi} onClick={() => toggle(e.id)} />
          ))}
          {f.results.length === 0 && <p className="py-6 text-center text-muted">Ingen øvelser matcher.</p>}
          <Button tone="secondary" block className="mt-4" onClick={() => setCreating(true)}>
            <PlusIcon size={18} weight="bold" />
            {f.query.trim() ? `Opret "${f.query.trim()}"` : 'Opret ny øvelse'}
          </Button>
        </>
      )}
    </Sheet>
  );
}
