import type { NavigateFunction } from 'react-router';

/** Gå tilbage i appen, hvis der er en side at gå tilbage til. Ellers til fallback. */
export function goBackOr(navigate: NavigateFunction, fallback: string): void {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
  if (idx > 0) navigate(-1);
  else navigate(fallback, { replace: true });
}
