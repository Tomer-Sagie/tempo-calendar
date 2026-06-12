/**
 * Single source of truth for the app version and changelog.
 * Imported by both App.tsx (for the displayed version) and
 * VersionBadge.tsx (for the popover and "new" indicator logic).
 */

export const TEMPO_VERSION = 'v1.2.0';

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: 'v1.2.0',
    date: '2026-06-11',
    changes: [
      'NowCard: live "what\'s happening this hour" with progress bar',
      'StreakCard: consecutive completion days counter',
      'TomorrowPreview: next day\'s scheduled tasks',
      'VersionBadge: corner changelog with "what\'s new" popover',
    ],
  },
  {
    version: 'v1.1.1',
    date: '2026-06-11',
    changes: [
      'Vitest + 64 unit tests for scheduler & rescheduler',
      'Time-of-day determinism via vi.setSystemTime + TZ=UTC',
    ],
  },
  {
    version: 'v1.1.0',
    date: '2026-06-10',
    changes: [
      'Editorial font pairing: Fraunces, Instrument Sans, IBM Plex Mono',
      'CommandPalette (Cmd/Ctrl+K) with natural-language date parsing',
      'Sonner toasts for scheduling feedback',
      'Drag-and-drop event move on the calendar',
    ],
  },
];
