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
  describe('allDay events (explicit local-midnight construction)', () => {
    it('constructs local midnight from date parts — NOT UTC midnight from date-only string', () => {
      const result = parseEventTime('2026-03-15', true);

      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(2);
      expect(result.getDate()).toBe(15);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('produces the same Date regardless of the time portion in the ISO string', () => {
      const a = parseEventTime('2026-03-15T00:00:00.000Z', true);
      const b = parseEventTime('2026-03-15T14:30:00.000Z', true);
      const c = parseEventTime('2026-03-15T23:59:59.999Z', true);

      expect(a.getTime()).toBe(b.getTime());
      expect(a.getTime()).toBe(c.getTime());
    });

    it('strips the time regardless of whether ISO string is full or date-only', () => {
      const fromFull = parseEventTime('2026-06-21T14:30:00.000Z', true);
      const fromDateOnly = parseEventTime('2026-06-21', true);

      expect(fromFull.getTime()).toBe(fromDateOnly.getTime());
    });
  });

  describe('non-allDay events (full ISO parsing)', () => {
    it('preserves the exact UTC time from the ISO string', () => {
      const result = parseEventTime('2026-03-15T14:30:00.000Z', false);

      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(2);
      expect(result.getUTCDate()).toBe(15);
      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(30);
    });

    it('produces different Dates for different time portions', () => {
      const a = parseEventTime('2026-03-15T09:00:00.000Z', false);
      const b = parseEventTime('2026-03-15T17:00:00.000Z', false);

      expect(a.getTime()).not.toBe(b.getTime());
    });
  });

  describe('correct branching — the regression test', () => {
    it('strips the time for allDay events but NOT for non-allDay events', () => {
      const allDay = parseEventTime('2026-03-15T12:00:00.000Z', true);
      const timed = parseEventTime('2026-03-15T12:00:00.000Z', false);

      expect(allDay.getHours()).toBe(0);
      expect(timed.getHours()).toBe(12);
    });

    it('uses local-midnight construction for allDay events (year/month/day constructor)', () => {
      const result = parseEventTime('2026-01-15T00:00:00.000Z', true);
      expect(result.getHours()).toBe(0);
      expect(result.getDate()).toBe(15);
    });
  });
});
