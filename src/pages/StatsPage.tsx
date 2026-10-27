import { GearIcon } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Empty, Header, IconButton, Page, Segmented, SectionTitle, Stat } from '../components/ui';
import { MUSCLE_LABELS } from '../db/types';
import { setsPerMuscle, startOfWeek, weeklyBuckets, weekStreak } from '../lib/calc';
import { formatShortDate } from '../lib/dates';
import { formatNumber, kgToDisplay } from '../lib/units';
import { useExerciseMap } from '../state/exercises';
import { useSettings } from '../state/settings';
import { useFinishedWorkouts } from './HistoryPages';

const WEEKS = 12;

export function StatsPage() {
  const navigate = useNavigate();
  const workouts = useFinishedWorkouts();
  const exMap = useExerciseMap();
  const settings = useSettings();
  const [days, setDays] = useState<'7' | '30'>('7');
  const typeOf = (id: string) => exMap.get(id)?.type;

  const weeks = useMemo(() => weeklyBuckets(workouts ?? [], typeOf, WEEKS), [workouts, exMap]); // eslint-disable-line react-hooks/exhaustive-deps
  const streak = useMemo(() => weekStreak(workouts ?? []), [workouts]);
  const muscles = useMemo(
    () => [...setsPerMuscle(workouts ?? [], exMap, Number(days)).entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]),
    [workouts, exMap, days],
  );
  const thisWeek = weeks[weeks.length - 1]?.workouts ?? 0;
  const maxMuscle = Math.max(1, ...muscles.map(([, n]) => n));

  return (
    <>
      <Header
        title="Statistik"
        right={
          <IconButton label="Indstillinger" onClick={() => navigate('/settings')}>
            <GearIcon size={24} />
          </IconButton>
        }
      />
      <Page>
        <div className="mt-4 grid grid-cols-3 gap-3 rounded-card bg-surface p-4">
          <Stat label="Træninger" value={workouts?.length ?? 0} />
          <Stat label="Denne uge" value={thisWeek} />
          <Stat label="Uger i træk" value={streak} />
        </div>

        {workouts && workouts.length === 0 ? (
          <div className="mt-6">
            <Empty text="Statistikken fylder sig op, når du har gemt din første træning." />
          </div>
        ) : (
          <>
            <SectionTitle>Træninger pr. uge</SectionTitle>
            <Bars values={weeks.map((w) => w.workouts)} labels={weeks.map((w) => w.weekStart)} format={(v) => String(v)} />

            <SectionTitle>Volumen pr. uge ({settings.unit === 'kg' ? 'ton' : '1.000 lb'})</SectionTitle>
            <Bars
              values={weeks.map((w) => kgToDisplay(w.volume, settings.unit) / 1000)}
              labels={weeks.map((w) => w.weekStart)}
              format={(v) => (v ? formatNumber(v, 1) : '')}
            />

            <SectionTitle>Sæt pr. muskelgruppe</SectionTitle>
            <Segmented
              label="Periode"
              value={days}
              onChange={setDays}
              options={[
                { value: '7', label: 'Sidste 7 dage' },
                { value: '30', label: 'Sidste 30 dage' },
              ]}
            />
            {muscles.length === 0 ? (
              <p className="py-6 text-center text-muted">Ingen sæt i perioden.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {muscles.map(([m, n]) => (
                  <li key={m} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-[15px]">
                    <span className="truncate">{MUSCLE_LABELS[m]}</span>
                    <span className="h-3 overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${(n / maxMuscle) * 100}%` }} />
                    </span>
                    <span className="tnum text-right font-semibold">{formatNumber(n, 1)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[13px] text-faint">Primær muskel tæller 1 sæt, sekundær 0,5. Opvarmning tæller ikke.</p>
          </>
        )}
      </Page>
    </>
  );
}

function Bars({ values, labels, format }: { values: number[]; labels: number[]; format: (v: number) => string }) {
  const max = Math.max(...values, 0);
  const current = startOfWeek(Date.now());
  return (
    <div className="rounded-card bg-surface p-3">
      <div className="flex h-36 items-end gap-1" role="img" aria-label={values.map((v, i) => `Uge ${formatShortDate(labels[i])}: ${format(v) || 0}`).join('. ')}>
        {values.map((v, i) => (
          <div key={labels[i]} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="tnum text-[11px] text-muted">{v ? format(v) : ''}</span>
            <div
              className={`w-full rounded-t-[4px] ${labels[i] === current ? 'bg-accent' : 'bg-accent/45'}`}
              style={{ height: max ? `${Math.max(v ? 4 : 0, (v / max) * 100)}%` : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-faint">
        <span>{formatShortDate(labels[0])}</span>
        <span>Denne uge</span>
      </div>
    </div>
  );
}
