import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Detect Mac/iOS for keyboard shortcut display. */
export const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
/** The platform-appropriate modifier key label (⌘ on Mac, Ctrl elsewhere). */
export const modKey = isMac ? '⌘' : 'Ctrl';

/**
 * Detect whether a time string represents an all-day event.
 * Handles:
 * 1. Date-only strings from Google Calendar ("2024-01-15")
 * 2. Midnight-to-midnight spans (start=00:00, end=00:00 next day)
 * 3. Full-day spans (start=00:00, end=23:59+)
 *
 * Time checks use **local** time (parsed via `new Date(iso)`), not the UTC
 * portion of the ISO string. ISO strings are always in UTC, so a task
 * spanning midnight EST (05:00Z) must be detected by checking local hours
 * on the parsed Date, not the "05:00" substring in the ISO text.
 */
export function isAllDayTimeString(startIso: string, endIso?: string): boolean {
  // Date-only string (Google Calendar all-day events)
  if (/^\d{4}-\d{2}-\d{2}$/.test(startIso)) return true;

  if (!endIso) return false;

  // Parse to local Date objects so we check hours in LOCAL time, not UTC.
  // The old implementation extracted HH:mm from the ISO string which is
  // always UTC. A task spanning midnight EST (05:00 UTC) would show
  // "05:00" in the ISO string and fail the "00:00" check.
  const startDate = new Date(startIso);
  const endDate = new Date(endIso);

  // Guard against invalid date strings
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return false;

  const isLocalMidnight = (d: Date): boolean =>
    d.getHours() === 0 &&
    d.getMinutes() === 0 &&
    d.getSeconds() === 0 &&
    d.getMilliseconds() === 0;

  // Midnight-to-midnight: task spans the entire day (e.g. local midnight → local midnight next day).
  // Compare local dates component-by-component (avoid toDateString() which is
  // implementation-dependent per spec).
  if (
    isLocalMidnight(startDate) &&
    isLocalMidnight(endDate) &&
    (startDate.getFullYear() !== endDate.getFullYear() ||
     startDate.getMonth() !== endDate.getMonth() ||
     startDate.getDate() !== endDate.getDate())
  ) {
    return true;
  }

  // Full-day span: starts at local midnight, ends near end of day (23:59).
  if (
    isLocalMidnight(startDate) &&
    endDate.getHours() === 23 &&
    endDate.getMinutes() === 59
  ) {
    return true;
  }

  return false;
}