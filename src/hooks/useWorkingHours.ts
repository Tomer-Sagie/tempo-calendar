import { useState, useEffect } from 'react';

export interface WorkingHoursState {
  start: string;
  end: string;
}

export function useWorkingHours(): [WorkingHoursState, (h: WorkingHoursState) => void] {
  const [state, setState] = useState<WorkingHoursState>(() => {
    if (typeof window === 'undefined') return { start: '09:00', end: '17:00' };
    try {
      const stored = localStorage.getItem('tempo-working-hours');
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return { start: '09:00', end: '17:00' };
  });
  useEffect(() => {
    try { localStorage.setItem('tempo-working-hours', JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);
  return [state, setState];
}
