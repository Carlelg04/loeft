import { useNavigate } from 'react-router';
import { useDialogs } from '../components/Sheet';
import type { Routine, Workout } from '../db/types';
import { discardWorkout, getActiveWorkout, startWorkout } from './workout';

/** Starter en træning. Er en anden i gang, spørges der først. */
export function useStartWorkout() {
  const { confirm } = useDialogs();
  const navigate = useNavigate();
  return async (opts: { routine?: Routine; from?: Workout } = {}) => {
    const active = await getActiveWorkout();
    if (active) {
      const choice = await confirm({
        title: 'Du har en træning i gang',
        message: `${active.name} er ikke afsluttet.`,
        actions: [
          { label: 'Fortsæt træningen', value: 'resume', tone: 'primary' },
          { label: 'Kassér den og start ny', value: 'discard', tone: 'danger' },
        ],
      });
      if (choice === 'resume') return navigate('/workout');
      if (choice !== 'discard') return;
      await discardWorkout(active.id);
    }
    await startWorkout(opts);
    navigate('/workout');
  };
}
