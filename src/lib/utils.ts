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
 * Only date-only strings ("2024-01-15") are all-day.
 * Tempo's own task events always use ISO datetime strings
 * with explicit times and should never be flagged as allDay.
 * Google Calendar all-day events arrive as date-only strings.
 */
export function isAllDayTimeString(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso);
}