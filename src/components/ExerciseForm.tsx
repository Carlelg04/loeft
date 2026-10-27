import { useState } from 'react';
import {
  EQUIPMENT_LABELS,
  EXERCISE_TYPE_LABELS,
  MUSCLE_LABELS,
  type Equipment,
  type Exercise,
  type ExerciseType,
  type Muscle,
} from '../db/types';
import { formatRest } from '../lib/units';
import { Button, Chip, Field, inputClass } from './ui';

export type ExerciseDraft = Omit<Exercise, 'id' | 'isCustom'>;

export const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300];
const MUSCLES = (Object.keys(MUSCLE_LABELS) as Muscle[]).filter((m) => m !== 'neck');

export function ExerciseForm({
  initial,
  onSave,
  submitLabel = 'Gem øvelse',
  existingNames = [],
}: {
  initial?: Partial<ExerciseDraft>;
  onSave: (d: ExerciseDraft) => void;
  submitLabel?: string;
  existingNames?: string[];
}) {
  const [d, setD] = useState<ExerciseDraft>({
    name: '',
    aliases: [],
    type: 'weight_reps',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'machine',
    ...initial,
  });
  const set = <K extends keyof ExerciseDraft>(k: K, v: ExerciseDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  const name = d.name.trim();
  const duplicate =
    name.length > 0 && existingNames.some((n) => n.toLowerCase() === name.toLowerCase() && n !== initial?.name);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name) return;
        onSave({ ...d, name, aliases: d.aliases.map((a) => a.trim()).filter(Boolean) });
      }}
    >
      <Field label="Navn" hint={duplicate ? 'Der findes allerede en øvelse med det navn.' : undefined}>
        <input className={inputClass} value={d.name} onChange={(e) => set('name', e.target.value)} autoComplete="off" required />
      </Field>
      <Field label="Andre navne (til søgning)" hint="Adskil med komma, fx Bænkpres, Bench">
        <input
          className={inputClass}
          value={d.aliases.join(', ')}
          onChange={(e) => set('aliases', e.target.value.split(','))}
          autoComplete="off"
        />
      </Field>
      <Field label="Type">
        <select className={inputClass} value={d.type} onChange={(e) => set('type', e.target.value as ExerciseType)}>
          {(Object.keys(EXERCISE_TYPE_LABELS) as ExerciseType[]).map((t) => (
            <option key={t} value={t}>
              {EXERCISE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Primær muskel">
        <select className={inputClass} value={d.primaryMuscle} onChange={(e) => set('primaryMuscle', e.target.value as Muscle)}>
          {MUSCLES.map((m) => (
            <option key={m} value={m}>
              {MUSCLE_LABELS[m]}
            </option>
          ))}
        </select>
      </Field>
      <div>
        <span className="mb-1.5 block text-[15px] font-medium text-muted">Sekundære muskler</span>
        <div className="flex flex-wrap gap-2">
          {MUSCLES.filter((m) => m !== d.primaryMuscle).map((m) => {
            const on = d.secondaryMuscles.includes(m);
            return (
              <Chip
                key={m}
                active={on}
                onClick={() => set('secondaryMuscles', on ? d.secondaryMuscles.filter((x) => x !== m) : [...d.secondaryMuscles, m])}
              >
                {MUSCLE_LABELS[m]}
              </Chip>
            );
          })}
        </div>
      </div>
      <Field label="Udstyr">
        <select className={inputClass} value={d.equipment} onChange={(e) => set('equipment', e.target.value as Equipment)}>
          {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((q) => (
            <option key={q} value={q}>
              {EQUIPMENT_LABELS[q]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Pausetid">
        <select
          className={inputClass}
          value={d.defaultRestSec ?? ''}
          onChange={(e) => set('defaultRestSec', e.target.value === '' ? undefined : Number(e.target.value))}
        >
          <option value="">Standard fra indstillinger</option>
          {REST_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {formatRest(s)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Note">
        <textarea
          className={`${inputClass} min-h-20 py-2`}
          value={d.notes ?? ''}
          onChange={(e) => set('notes', e.target.value || undefined)}
          placeholder="Fx sædehøjde 4, greb i midten"
        />
      </Field>
      <Button type="submit" tone="primary" size="lg" block disabled={!name}>
        {submitLabel}
      </Button>
    </form>
  );
}
