import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Detect Mac/iOS for keyboard shortcut display. */
export const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
/** The platform-appropriate modifier key label (⌘ on Mac, Ctrl elsewhere). */
export const modKey = isMac ? '⌘' : 'Ctrl';