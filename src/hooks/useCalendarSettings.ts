import { useState, useEffect } from 'react';

export type CalendarDensity = 'compact' | 'standard' | 'comfortable';

export function useCalendarSettings() {
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(() => {
    try { return (localStorage.getItem('tempo-week-start') === '0' ? 0 : 1); } catch { return 1; }
  });
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>(() => {
    try { return (localStorage.getItem('tempo-time-format') as '12h' | '24h') || '12h'; } catch { return '12h'; }
  });
  const [density, setDensity] = useState<CalendarDensity>(() => {
    try { return (localStorage.getItem('tempo-density') as CalendarDensity) || 'standard'; } catch { return 'standard'; }
  });
  useEffect(() => { try { localStorage.setItem('tempo-week-start', String(weekStartsOn)); } catch { /* */ } }, [weekStartsOn]);
  useEffect(() => { try { localStorage.setItem('tempo-time-format', timeFormat); } catch { /* */ } }, [timeFormat]);
  useEffect(() => { try { localStorage.setItem('tempo-density', density); } catch { /* */ } }, [density]);
  // Apply density as a CSS class on the root element
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('density-compact', 'density-standard', 'density-comfortable');
    root.classList.add(`density-${density}`);
  }, [density]);
  return { weekStartsOn, setWeekStartsOn, timeFormat, setTimeFormat, density, setDensity };
}
