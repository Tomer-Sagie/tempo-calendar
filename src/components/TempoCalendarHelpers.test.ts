import { describe, it, expect } from 'vitest';
import { isShortMidnightCrossing, parseEventTime, type CalendarEventType } from './TempoCalendarHelpers';

// ============================================================
// isShortMidnightCrossing
// ============================================================

/**
 * Build a minimal CalendarEventType for testing isShortMidnightCrossing.
 * Only the fields the function reads (allDay, start, end) are needed.
 */
function makeEv(overrides: {
  allDay?: boolean;
  start?: Date;
  end?: Date;
}): CalendarEventType {
  return {
    id: 'test-ev',
    title: 'Test',
    start: overrides.start ?? new Date('2026-03-09T10:00:00Z'),
    end: overrides.end ?? new Date('2026-03-09T11:00:00Z'),
    allDay: overrides.allDay ?? false,
  };
}

describe('isShortMidnightCrossing', () => {
  it('returns false for allDay events', () => {
    expect(
      isShortMidnightCrossing(
        makeEv({
          allDay: true,
          start: new Date('2026-03-09T22:00:00Z'),
          end: new Date('2026-03-10T02:00:00Z'),
        }),
      ),
    ).toBe(false);
  });

  it('returns false for zero-duration events', () => {
    const same = new Date('2026-03-09T10:00:00Z');
    expect(isShortMidnightCrossing(makeEv({ start: same, end: same }))).toBe(false);
  });

  it('returns false for negative-duration events (end before start)', () => {
    expect(
      isShortMidnightCrossing(
        makeEv({
          start: new Date('2026-03-09T10:00:00Z'),
          end: new Date('2026-03-09T09:00:00Z'),
        }),
      ),
    ).toBe(false);
  });

  it('returns false for a same-day event regardless of duration', () => {
    // 2-hour event entirely on the same day
    expect(
      isShortMidnightCrossing(
        makeEv({
          start: new Date('2026-03-09T10:00:00Z'),
          end: new Date('2026-03-09T12:00:00Z'),
        }),
      ),
    ).toBe(false);

    // 5-hour event still on the same day (just under 6h threshold)
    expect(
      isShortMidnightCrossing(
        makeEv({
          start: new Date('2026-03-09T09:00:00Z'),
          end: new Date('2026-03-09T14:00:00Z'),
        }),
      ),
    ).toBe(false);
  });

  it('returns true for short events (<6h) that cross midnight', () => {
    // 1-hour event: 11:30 PM → 12:30 AM (next day)
    expect(
      isShortMidnightCrossing(
        makeEv({
          start: new Date('2026-03-09T23:30:00Z'),
          end: new Date('2026-03-10T00:30:00Z'),
        }),
      ),
    ).toBe(true);

    // 3-hour event: 10 PM → 1 AM (next day)
    expect(
      isShortMidnightCrossing(
        makeEv({
          start: new Date('2026-03-09T22:00:00Z'),
          end: new Date('2026-03-10T01:00:00Z'),
        }),
      ),
    ).toBe(true);

    // Event ending at a non-zero time on the next day (was the original bug —
    // only events ending at exactly 00:00:00.000 were caught)
    expect(
      isShortMidnightCrossing(
        makeEv({
          start: new Date('2026-03-09T23:30:00Z'),
          end: new Date('2026-03-10T00:15:00Z'), // 45 min, ends at 12:15 AM
        }),
      ),
    ).toBe(true);
  });

  it('returns false for long events (≥6h) that cross midnight (they should show as multi-day)', () => {
    // 7-hour event: 9 PM → 4 AM (next day)
    expect(
      isShortMidnightCrossing(
        makeEv({
          start: new Date('2026-03-09T21:00:00Z'),
          end: new Date('2026-03-10T04:00:00Z'),
        }),
      ),
    ).toBe(false);

    // Exactly 6 hours: 10 PM → 4 AM — should NOT be caught (threshold is <6h)
    expect(
      isShortMidnightCrossing(
        makeEv({
          start: new Date('2026-03-09T22:00:00Z'),
          end: new Date('2026-03-10T04:00:00Z'),
        }),
      ),
    ).toBe(false);
  });

  it('returns true for events just under the 6h threshold crossing midnight', () => {
    // 5h 59min: just under 6h
    expect(
      isShortMidnightCrossing(
        makeEv({
          start: new Date('2026-03-09T22:01:00Z'),
          end: new Date('2026-03-10T04:00:00Z'),
        }),
      ),
    ).toBe(true);
  });
});

// ============================================================
// parseEventTime
// ============================================================

describe('parseEventTime', () => {
  describe('allDay task events (date-only parsing)', () => {
    it('parses only the date portion, ignoring the time in the ISO string', () => {
      const result = parseEventTime('2026-03-15T12:34:56.789Z', true, 'task');

      // Should be midnight local on March 15 (in UTC test env, midnight UTC)
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(2); // 0-indexed → March
      expect(result.getUTCDate()).toBe(15);
      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCMilliseconds()).toBe(0);
    });

    it('produces the same Date regardless of the time portion', () => {
      const a = parseEventTime('2026-03-15T00:00:00.000Z', true, 'task');
      const b = parseEventTime('2026-03-15T14:30:00.000Z', true, 'task');
      const c = parseEventTime('2026-03-15T23:59:59.999Z', true, 'task');

      // All three should resolve to the same midnight Date
      expect(a.getTime()).toBe(b.getTime());
      expect(a.getTime()).toBe(c.getTime());
    });
  });

  describe('non-allDay task events (full ISO parsing)', () => {
    it('preserves the exact UTC time from the ISO string', () => {
      const result = parseEventTime('2026-03-15T14:30:00.000Z', false, 'task');

      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(2);
      expect(result.getUTCDate()).toBe(15);
      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(30);
    });

    it('produces different Dates for different time portions', () => {
      const a = parseEventTime('2026-03-15T09:00:00.000Z', false, 'task');
      const b = parseEventTime('2026-03-15T17:00:00.000Z', false, 'task');

      // These should be different (9 AM vs 5 PM UTC)
      expect(a.getTime()).not.toBe(b.getTime());
    });
  });

  describe('Google events (always full ISO parsing)', () => {
    it('uses full ISO parsing for allDay Google events', () => {
      // Google allDay events come as date-only strings like "2026-03-15"
      // which parse fine with new Date() anyway
      const result = parseEventTime('2026-03-15', true, 'google');
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(2);
      expect(result.getUTCDate()).toBe(15);
    });

    it('uses full ISO parsing for timed Google events', () => {
      const result = parseEventTime('2026-03-15T14:30:00.000Z', false, 'google');
      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(30);
    });
  });

  describe('correct branching — the regression test', () => {
    it('strips the time for allDay task events but NOT for non-allDay task events', () => {
      // Same ISO string — only the branch matters
      const allDay = parseEventTime('2026-03-15T12:00:00.000Z', true, 'task');
      const timed = parseEventTime('2026-03-15T12:00:00.000Z', false, 'task');

      // allDay should be midnight, timed should be noon
      expect(allDay.getUTCHours()).toBe(0);
      expect(timed.getUTCHours()).toBe(12);
    });

    it('matches the behavior expected in real timezones (UTC-safety)', () => {
      // In non-UTC timezones (e.g. EST/UTC-5), new Date("2026-01-15T00:00:00.000Z")
      // would produce Jan 14 19:00 local. The allDay branch prevents that by
      // parsing only the date portion. While this test runs in UTC (so we can't
      // observe the EST shift), we verify the branch is correctly taken by
      // checking that allDay task events always land at midnight.
      const result = parseEventTime('2026-01-15T00:00:00.000Z', true, 'task');
      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCDate()).toBe(15); // Jan 15, never Jan 14
    });
  });
});
