import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { BottomChrome } from './components/BottomChrome';
import { DialogsProvider } from './components/Sheet';
import { unlockAudio } from './lib/feedback';
import { useWakeLock } from './lib/wakeLock';
import { ExerciseDetailPage, ExerciseEditPage, ExercisesPage } from './pages/ExercisePages';
import { HistoryPage, WorkoutDetailPage, WorkoutEditPage } from './pages/HistoryPages';
import { RoutineEditPage, RoutineViewPage } from './pages/RoutinePages';
import { TrainPage } from './pages/TrainPage';
import { WorkoutPage } from './pages/WorkoutPage';
import { useSettings } from './state/settings';
import { useActiveWorkout } from './state/workout';
import type { ThemeSetting } from './db/types';

const StatsPage = lazy(() => import('./pages/StatsPage').then((m) => ({ default: m.StatsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const THEME_COLORS = { dark: '#121418', light: '#f3f5f8' };

function useTheme(theme: ThemeSetting) {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const resolved = theme === 'system' ? (mq.matches ? 'light' : 'dark') : theme;
      document.documentElement.dataset.theme = resolved;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved]);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Shell() {
  const settings = useSettings();
  const active = useActiveWorkout();
  useTheme(settings.theme);
  useWakeLock(!!active && settings.keepAwake);

  useEffect(() => {
    // Lyd må først spille efter et tryk (iPhone). Lås op ved hvert tryk, så den også virker efter baggrund.
    window.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
    void navigator.storage?.persist?.().catch(() => undefined);
    return () => window.removeEventListener('pointerdown', unlockAudio, { capture: true });
  }, []);

  return (
    <>
      <ScrollToTop />
      <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<TrainPage />} />
        <Route path="/workout" element={<WorkoutPage />} />
        <Route path="/routines/new" element={<RoutineEditPage />} />
        <Route path="/routines/:id" element={<RoutineViewPage />} />
        <Route path="/routines/:id/edit" element={<RoutineEditPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/history/:id" element={<WorkoutDetailPage />} />
        <Route path="/history/:id/edit" element={<WorkoutEditPage />} />
        <Route path="/exercises" element={<ExercisesPage />} />
        <Route path="/exercises/new" element={<ExerciseEditPage />} />
        <Route path="/exercises/:id" element={<ExerciseDetailPage />} />
        <Route path="/exercises/:id/edit" element={<ExerciseEditPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      <BottomChrome active={active} settings={settings} />
    </>
  );
}

export function App() {
  return (
    <HashRouter>
      <DialogsProvider>
        <Shell />
      </DialogsProvider>
    </HashRouter>
  );
}
