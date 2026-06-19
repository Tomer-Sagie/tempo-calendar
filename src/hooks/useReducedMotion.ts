import { useEffect, useState } from 'react';

/**
 * Returns `true` when the user has enabled "prefers-reduced-motion" in their
 * OS accessibility settings. Re-evaluates live when the preference changes.
 *
 * Usage:
 *   const reduced = useReducedMotion();
 *   <motion.div animate={reduced ? {} : { scale: 1.05 }} />
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}
