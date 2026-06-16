import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseEnhancedTask } from './enhancedParser';

// Freeze time so relative dates are deterministic
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-15T10:00:00Z')); // Monday
});

afterEach(() => {
  vi.useRealTimers();
});

describe('parseEnhancedTask', () => {
  // ── Basic title extraction ─────────────────────────────────
  describe('title extraction', () => {
    it('returns just the title for plain text', () => {
      const r = parseEnhancedTask('Buy groceries');
      expect(r.title).toBe('Buy groceries');
      expect(r.date).toBeUndefined();
      expect(r.time).toBeUndefined();
    });

    it('returns empty title for empty input', () => {
      const r = parseEnhancedTask('');
      expect(r.title).toBe('');
    });

    it('returns empty title for whitespace-only input', () => {
      const r = parseEnhancedTask('   ');
      expect(r.title).toBe('');
    });
  });

  // ── Typo correction ───────────────────────────────────────
  describe('typo correction', () => {
    it('corrects "tommorow" → "tomorrow"', () => {
      const r = parseEnhancedTask('Meeting tommorow');
      expect(r.date).toBe('2026-06-16'); // Tuesday (tomorrow)
      expect(r.title).toBe('Meeting');
    });

    it('corrects "wendsday" → "wednesday"', () => {
      const r = parseEnhancedTask('Lunch wendsday');
      // fuzzy match to wednesday → chrono parses it
      expect(r.title).toBe('Lunch');
    });

    it('corrects "februry" → "february"', () => {
      const r = parseEnhancedTask('Report februry');
      expect(r.title).toBe('Report');
    });

    it('corrects "thurday" → "thursday"', () => {
      const r = parseEnhancedTask('Meeting thurday');
      expect(r.title).toBe('Meeting');
    });

    it('corrects "h0our" → "hour" via fuzzy matching', () => {
      const r = parseEnhancedTask('Focus for 1 h0our');
      expect(r.duration_minutes).toBe(60);
    });

    it('corrects "minuts" → "minutes"', () => {
      const r = parseEnhancedTask('Quick task for 30 minuts');
      expect(r.duration_minutes).toBe(30);
    });
  });

  // ── Priority extraction ────────────────────────────────────
  describe('priority', () => {
    it('extracts !high', () => {
      const r = parseEnhancedTask('Fix bug !high');
      expect(r.priority).toBe('HIGH');
      expect(r.title).toBe('Fix bug');
    });

    it('extracts !1 as ASAP', () => {
      const r = parseEnhancedTask('Hotfix !1');
      expect(r.priority).toBe('ASAP');
    });

    it('extracts !low', () => {
      const r = parseEnhancedTask('Cleanup !low');
      expect(r.priority).toBe('LOW');
    });

    it('extracts !urgent as ASAP', () => {
      const r = parseEnhancedTask('Deploy !urgent');
      expect(r.priority).toBe('ASAP');
    });

    it('handles priority with other metadata', () => {
      const r = parseEnhancedTask('Fix server tomorrow !critical #ops ~2h');
      expect(r.priority).toBe('ASAP');
      expect(r.tags).toEqual(['ops']);
      expect(r.duration_minutes).toBe(120);
    });
  });

  // ── Tag extraction ─────────────────────────────────────────
  describe('tags', () => {
    it('extracts single tag', () => {
      const r = parseEnhancedTask('Code review #work');
      expect(r.tags).toEqual(['work']);
      expect(r.title).toBe('Code review');
    });

    it('extracts multiple tags', () => {
      const r = parseEnhancedTask('Research #ai #ml #work');
      expect(r.tags).toEqual(['ai', 'ml', 'work']);
    });

    it('normalizes tags to lowercase', () => {
      const r = parseEnhancedTask('Task #Work #Personal');
      expect(r.tags).toEqual(['work', 'personal']);
    });

    it('handles hyphenated tags', () => {
      const r = parseEnhancedTask('Task #code-review');
      expect(r.tags).toEqual(['code-review']);
    });
  });

  // ── Date/time extraction ───────────────────────────────────
  describe('date and time', () => {
    it('extracts "tomorrow at 5pm"', () => {
      const r = parseEnhancedTask('Meeting tomorrow at 5pm');
      expect(r.date).toBe('2026-06-16');
      expect(r.time).toBe('17:00');
      expect(r.title).toBe('Meeting');
    });

    it('extracts "friday at 9:30am"', () => {
      const r = parseEnhancedTask('Standup friday at 9:30am');
      expect(r.date).toBe('2026-06-19'); // Friday
      expect(r.time).toBe('09:30');
      expect(r.title).toBe('Standup');
    });

    it('normalizes "6 pm" → "6pm"', () => {
      const r = parseEnhancedTask('Call at 6 pm');
      expect(r.time).toBe('18:00');
    });

    it('handles "noon"', () => {
      const r = parseEnhancedTask('Lunch at noon');
      expect(r.time).toBe('12:00');
    });
  });

  // ── Duration extraction ────────────────────────────────────
  describe('duration', () => {
    it('extracts "for 1 hour"', () => {
      const r = parseEnhancedTask('Deep work for 1 hour');
      expect(r.duration_minutes).toBe(60);
    });

    it('extracts "for 2 hours 30 minutes"', () => {
      const r = parseEnhancedTask('Workshop for 2 hours 30 minutes');
      expect(r.duration_minutes).toBe(150);
    });

    it('extracts "~30m"', () => {
      const r = parseEnhancedTask('Quick call ~30m');
      expect(r.duration_minutes).toBe(30);
    });

    it('extracts "~2h30m"', () => {
      const r = parseEnhancedTask('Deep session ~2h30m');
      expect(r.duration_minutes).toBe(150);
    });

    it('extracts "for 45 min"', () => {
      const r = parseEnhancedTask('Yoga for 45 min');
      expect(r.duration_minutes).toBe(45);
    });

    it('extracts "for 2h30m"', () => {
      const r = parseEnhancedTask('Workshop for 2h30m');
      expect(r.duration_minutes).toBe(150);
    });

    it('extracts bare "for hour" (no number)', () => {
      const r = parseEnhancedTask('Focus for hour');
      expect(r.duration_minutes).toBe(60);
    });

    it('does NOT extract bare "2 hours" without prefix (avoids stealing from "in 2 hours")', () => {
      const r = parseEnhancedTask('Meeting in 2 hours');
      // "2 hours" should NOT be extracted as duration — chrono handles "in 2 hours" as relative time
      expect(r.duration_minutes).toBeUndefined();
    });
  });

  // ── Multi-day recurrence ───────────────────────────────────
  describe('multi-day recurrence', () => {
    it('extracts "every wednesday and friday"', () => {
      const r = parseEnhancedTask('Meeting every wednesday and friday');
      expect(r.frequency).toBe('weekly');
      expect(r.preferred_days).toEqual([3, 5]);
      expect(r.title).toBe('Meeting');
    });

    it('extracts "every monday, wednesday, friday"', () => {
      const r = parseEnhancedTask('Gym every monday, wednesday, friday');
      expect(r.frequency).toBe('weekly');
      expect(r.preferred_days).toEqual([1, 3, 5]);
    });

    it('extracts "every weekday"', () => {
      const r = parseEnhancedTask('Standup every weekday');
      expect(r.frequency).toBe('weekly');
      expect(r.preferred_days).toEqual([1, 2, 3, 4, 5]);
    });

    it('extracts "every weekend"', () => {
      const r = parseEnhancedTask('Relax every weekend');
      expect(r.frequency).toBe('weekly');
      expect(r.preferred_days).toEqual([6, 7]);
    });

    it('extracts "every day" as daily', () => {
      const r = parseEnhancedTask('Journal every day');
      expect(r.frequency).toBe('daily');
    });

    it('extracts "every tuesday" (single day)', () => {
      const r = parseEnhancedTask('Therapy every tuesday');
      expect(r.frequency).toBe('weekly');
      expect(r.preferred_days).toEqual([2]);
    });

    it('extracts "daily"', () => {
      const r = parseEnhancedTask('Meditate daily');
      expect(r.frequency).toBe('daily');
    });

    it('extracts "weekly"', () => {
      const r = parseEnhancedTask('Report weekly');
      expect(r.frequency).toBe('weekly');
    });

    it('extracts "every other tuesday"', () => {
      const r = parseEnhancedTask('Haircut every other tuesday');
      expect(r.frequency).toBe('weekly');
      expect(r.preferred_days).toEqual([2]);
    });

    it('extracts "biweekly monday"', () => {
      const r = parseEnhancedTask('Review biweekly monday');
      expect(r.frequency).toBe('weekly');
      expect(r.preferred_days).toEqual([1]);
    });

    it('extracts "3 times a week"', () => {
      const r = parseEnhancedTask('Exercise 3 times a week');
      expect(r.frequency).toBe('weekly');
    });
  });

  // ── Recurrence end date ────────────────────────────────────
  describe('recurrence end date', () => {
    it('extracts "until the end of july"', () => {
      const r = parseEnhancedTask('Class every monday until the end of july');
      expect(r.recurrence_end).toBe('2026-07-31');
    });

    it('extracts "until end of july" (no "the")', () => {
      const r = parseEnhancedTask('Class every monday until end of july');
      expect(r.recurrence_end).toBe('2026-07-31');
    });

    it('extracts "till december"', () => {
      const r = parseEnhancedTask('Training every day till december');
      expect(r.recurrence_end).toBe('2026-12-31');
    });

    it('extracts "until end of month"', () => {
      const r = parseEnhancedTask('Sprint every weekday until end of month');
      expect(r.recurrence_end).toBe('2026-06-30');
    });

    it('extracts "until end of year"', () => {
      const r = parseEnhancedTask('Report weekly until end of year');
      expect(r.recurrence_end).toBe('2026-12-31');
    });
  });

  // ── The user's exact example ───────────────────────────────
  describe('complex combined input', () => {
    it('handles the full example: "class repeating every wednesday and friday until the end of july at 6 pm for on h0our"', () => {
      const r = parseEnhancedTask(
        'class repeating every wednesday and friday until the end of july at 6 pm for on h0our'
      );
      expect(r.title).toBe('class');
      expect(r.frequency).toBe('weekly');
      expect(r.preferred_days).toEqual([3, 5]);
      expect(r.recurrence_end).toBe('2026-07-31');
      expect(r.time).toBe('18:00');
      expect(r.duration_minutes).toBe(60);
    });

    it('handles "Buy groceries tommorow at 5pm #errands !high ~30m"', () => {
      const r = parseEnhancedTask('Buy groceries tommorow at 5pm #errands !high ~30m');
      expect(r.title).toBe('Buy groceries');
      expect(r.date).toBe('2026-06-16');
      expect(r.time).toBe('17:00');
      expect(r.tags).toEqual(['errands']);
      expect(r.priority).toBe('HIGH');
      expect(r.duration_minutes).toBe(30);
    });

    it('handles "Gym every weekday at 7am for 45 min"', () => {
      const r = parseEnhancedTask('Gym every weekday at 7am for 45 min');
      expect(r.title).toBe('Gym');
      expect(r.frequency).toBe('weekly');
      expect(r.preferred_days).toEqual([1, 2, 3, 4, 5]);
      expect(r.time).toBe('07:00');
      expect(r.duration_minutes).toBe(45);
    });

    it('handles "Write blog post #writing ~2h30m daily"', () => {
      const r = parseEnhancedTask('Write blog post #writing ~2h30m daily');
      expect(r.title).toBe('Write blog post');
      expect(r.tags).toEqual(['writing']);
      expect(r.duration_minutes).toBe(150);
      expect(r.frequency).toBe('daily');
    });

    it('handles "half an hour meeting tomorrow"', () => {
      const r = parseEnhancedTask('half an hour meeting tomorrow');
      expect(r.duration_minutes).toBe(30);
      expect(r.date).toBe('2026-06-16');
    });

    it('handles "quarter of an hour focus session"', () => {
      const r = parseEnhancedTask('quarter of an hour focus session');
      expect(r.duration_minutes).toBe(15);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────
  describe('edge cases', () => {
    it('handles smart quotes and unicode', () => {
      const r = parseEnhancedTask('\u201CMeeting\u201D tomorrow');
      expect(r.title).toBe('"Meeting"');
      expect(r.date).toBe('2026-06-16');
    });

    it('handles multiple spaces', () => {
      const r = parseEnhancedTask('  Meeting   tomorrow   at   5pm  ');
      expect(r.title).toBe('Meeting');
      expect(r.time).toBe('17:00');
    });

    it('handles input with only metadata (no meaningful title)', () => {
      const r = parseEnhancedTask('tomorrow at 5pm !high #work');
      // Title fallback should still produce something
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.date).toBe('2026-06-16');
      expect(r.time).toBe('17:00');
      expect(r.priority).toBe('HIGH');
      expect(r.tags).toEqual(['work']);
    });

    it('does not extract duration from "meeting in an hour"', () => {
      const r = parseEnhancedTask('meeting in an hour');
      // "an" is no longer in word-to-number map, so "in an hour" stays as relative time
      expect(r.duration_minutes).toBeUndefined();
    });

    it('handles "for on 2 hours" with explicit time (duration not consumed by chrono)', () => {
      const r = parseEnhancedTask('Focus at 3pm for on 2 hours');
      expect(r.time).toBe('15:00');
      expect(r.duration_minutes).toBe(120);
    });

    it('handles "every mon wed fri at 9am"', () => {
      const r = parseEnhancedTask('Standup every mon wed fri at 9am');
      expect(r.frequency).toBe('weekly');
      expect(r.preferred_days).toEqual([1, 3, 5]);
      expect(r.time).toBe('09:00');
    });

    it('handles repeated same day: "every wednesday and wednesday"', () => {
      const r = parseEnhancedTask('Meeting every wednesday and wednesday');
      expect(r.preferred_days).toEqual([3]); // deduplicated
    });
  });
});
