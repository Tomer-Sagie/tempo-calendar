/**
 * Shared types and helpers for the TempoCalendar siblings.
 *
 * Lives in its own file (not in TempoCalendar.tsx) so the orchestrator
 * exports only a component and `react-refresh/only-export-components` is
 * happy. Sub-views import `HOUR_HEIGHT` / `getEventsForDay` / etc. from
 * here, the orchestrator re-exports the public types for backward compat
 * with `App.tsx` and `CalendarEvent.tsx`.
 */

import { startOfDay, endOfDay, isSameDay } from 'date-fns';
import { useState, useEffect } from 'react';

/**
 * Returns '#1a1a1a' (dark) or '#ffffff' (light) depending on background
 * luminance so text is always readable. Uses ITU-R BT.601 coefficients.
 * Falls back to white for non-hex / CSS-variable inputs.
 */
export function getContrastText(hex: string): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i);
  if (!m) return '#ffffff';
  const lum = (0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16)) / 255;
  return lum > 0.6 ? '#1a1a1a' : '#ffffff';
}

// ============================================================
// Public types
// ============================================================

export type CalendarEventVariant =
  | 'primary'
  | 'secondary'
  | 'warning'
  | 'destructive'
  | 'success'
  | 'muted';

export type CalendarView = 'day' | 'week' | 'month';

export interface CalendarEventType {
  id: string;
  title: string;
  start: Date;
  end: Date;
  variant?: CalendarEventVariant;
  allDay?: boolean;
  data?: {
    description?: string;
    source?: 'google' | 'task';
    color?: string;
    is_locked?: boolean;
    is_missed?: boolean;
    is_flexible?: boolean;
    is_completed?: boolean;
    is_skipped?: boolean;
    is_busy_block?: boolean;
    is_recurring?: boolean;
    /** True if this event is a chunk of a split task */
    is_split_chunk?: boolean;
    /** Position of this chunk within the split sequence */
    split_position?: 'first' | 'middle' | 'last' | 'only';
  };
}

/**
 * Shared ref type the WeekView writes its day-column width to so the
 * orchestrator's drag handler can convert horizontal pixel deltas into
 * day offsets. Using a ref (not state) avoids re-renders on resize.
 */
export type DayColumnWidthRef = { current: number };

/**
 * Live target of an in-progress drag — used by the WeekView to render
 * the translucent ghost rectangle at the day/time the event will land on.
 */
export interface DragGhostTarget {
  eventId: string;
  newStart: Date;
  newEnd: Date;
  title: string;
  variant?: CalendarEventVariant;
}

// ============================================================
// Shared helpers
// ============================================================

/** Default pixels per hour — used as fallback when CSS var unavailable. */
const DEFAULT_HOUR_HEIGHT = 56;

/**
 * Read the current hour height from the `--cal-hour-height` CSS custom
 * property, which changes based on the density setting (compact/standard/
 * comfortable). Falls back to 56px (standard) when running on the server
 * or when the variable is not set.
 */
export function getHourHeight(): number {
  if (typeof document === 'undefined') return DEFAULT_HOUR_HEIGHT;
  const val = getComputedStyle(document.documentElement).getPropertyValue('--cal-hour-height').trim();
  const parsed = parseInt(val, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_HOUR_HEIGHT;
}



/**
 * React hook that returns the current hour height and only re-renders when
 * the density CSS class on `<html>` actually changes. Uses a MutationObserver
 * on the `class` attribute so useMemo dependencies stay stable.
 */
export function useHourHeight(): number {
  const [hh, setHh] = useState(getHourHeight);
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const next = getHourHeight();
      setHh((prev) => (prev === next ? prev : next));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return hh;
}

export function getEventsForDay(events: CalendarEventType[], day: Date): CalendarEventType[] {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  return events.filter((ev) => {
    if (ev.allDay) {
      return isSameDay(ev.start, day) || isSameDay(ev.end, day) || (ev.start <= dayEnd && ev.end >= dayStart);
    }
    return ev.start < dayEnd && ev.end > dayStart;
  });
}

export function getAllDayEvents(events: CalendarEventType[]): CalendarEventType[] {
  return events.filter((e) => e.allDay);
}

interface PositionedEvent extends CalendarEventType {
  top: number;
  height: number;
  column: number;
  totalColumns: number;
  isStart: boolean;
  isEnd: boolean;
}

/**
 * Position events on a day, handling overlap with side-by-side columns.
 * Pure function — easy to unit-test if needed.
 *
 * Assumes `day` is already `startOfDay` (callers in DayView/WeekView pass
 * `startOfDay(...)`); the visibleStart then sets the hour, with minutes/
 * seconds/ms explicitly zeroed for safety.
 */
export function positionEvents(
  events: CalendarEventType[],
  day: Date,
  startHour: number,
  hourHeight?: number,
): PositionedEvent[] {
  const hh = hourHeight ?? DEFAULT_HOUR_HEIGHT;
  const dayStart = startOfDay(day);
  const visibleStart = new Date(dayStart);
  visibleStart.setHours(startHour, 0, 0, 0);
  const dayEnd = endOfDay(day);

  // Clip events to visible window
  const clipped = events
    .filter((e) => !e.allDay)
    .map((e) => {
      const start = e.start < visibleStart ? visibleStart : e.start;
      const end = e.end > dayEnd ? dayEnd : e.end;
      return { ...e, start, end };
    })
    .filter((e) => e.end > e.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const positioned: PositionedEvent[] = [];
  const columns: { end: Date }[][] = [[]];

  for (const ev of clipped) {
    // Find first column where this event fits (no overlap)
    let placed = false;
    for (let i = 0; i < columns.length; i++) {
      const last = columns[i][columns[i].length - 1];
      if (!last || last.end <= ev.start) {
        columns[i].push({ end: ev.end });
        const minutesFromTop = Math.max(0, (ev.start.getTime() - visibleStart.getTime()) / 60_000);
        const minutes = Math.max(15, (ev.end.getTime() - ev.start.getTime()) / 60_000);
        positioned.push({
          ...ev,
          top: (minutesFromTop / 60) * hh,
          height: (minutes / 60) * hh,
          column: i,
          totalColumns: 0, // filled in below
          isStart: true,
          isEnd: true,
        });
        placed = true;
        break;
      }
    }
    if (!placed) {
      const newCol = [{ end: ev.end }];
      columns.push(newCol);
      const minutesFromTop = Math.max(0, (ev.start.getTime() - visibleStart.getTime()) / 60_000);
      const minutes = Math.max(15, (ev.end.getTime() - ev.start.getTime()) / 60_000);
      positioned.push({
        ...ev,
        top: (minutesFromTop / 60) * hh,
        height: (minutes / 60) * hh,
        column: columns.length - 1,
        totalColumns: 0,
        isStart: true,
        isEnd: true,
      });
    }
  }

  // Determine totalColumns for clusters of overlapping events.
  // For simplicity, use total columns overall — good enough for daily layouts.
  const total = columns.length;
  return positioned.map((p) => ({ ...p, totalColumns: total }));
}
