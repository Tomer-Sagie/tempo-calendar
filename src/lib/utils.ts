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
 */
export function isAllDayTimeString(startIso: string, endIso?: string): boolean {
  // Date-only string (Google Calendar all-day events)
  if (/^\d{4}-\d{2}-\d{2}$/.test(startIso)) return true;

  if (!endIso) return false;

  // Extract HH:mm time portions using regex (robust against varying ISO formats)
  const timeMatch = (iso: string) => iso.match(/T(\d{2}:\d{2})/)?.[1] ?? '';
  const startTime = timeMatch(startIso);
  const endTime = timeMatch(endIso);

  if (!startTime || !endTime) return false;

  // Midnight-to-midnight: task spans the entire day (e.g. 2024-01-15T00:00 → 2024-01-16T00:00)
  // Verify dates differ — same-date 00:00→00:00 is zero-duration, not all-day
  if (startTime === '00:00' && endTime === '00:00' && startIso.slice(0, 10) !== endIso.slice(0, 10)) return true;

  // Full-day span: starts at midnight, ends near end of day
  if (startTime === '00:00' && endTime.startsWith('23:59')) return true;

  return false;
}