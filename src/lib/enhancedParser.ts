import * as chrono from 'chrono-node';
import { format, addDays } from 'date-fns';

// ============================================================
// Parsed Task Result
// ============================================================

export interface ParsedTask {
  title: string;
  date?: string;
  time?: string;
  priority?: 'ASAP' | 'HIGH' | 'NORMAL' | 'LOW';
  tags?: string[];
  duration_minutes?: number;
  frequency?: 'daily' | 'weekly';
  recurrence_end?: string;   // ISO date — series stops after this date
  preferred_days?: number[]; // 1=Mon..7=Sun — days the task can land on
}

// ============================================================
// Levenshtein Distance (for typo-tolerant matching)
// ============================================================

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

// ============================================================
// Keyword Dictionaries
// ============================================================

const WEEKDAYS: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
  friday: 5, saturday: 6, sunday: 7,
  mon: 1, tue: 2, tues: 2, wed: 3, wedn: 3, thu: 4, thur: 4, thurs: 4,
  fri: 5, sat: 6, sun: 7,
};
const WEEKDAY_KEYS = Object.keys(WEEKDAYS);

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8,
  oct: 9, nov: 10, dec: 11,
};
const MONTH_KEYS = Object.keys(MONTHS);

const TIME_UNITS = ['hour', 'hours', 'hr', 'hrs',
  'minute', 'minutes', 'min', 'mins',
  'second', 'seconds', 'sec', 'secs'];

const RELATIVE_DATES = [
  'today', 'tonight', 'tomorrow', 'tmr', 'tmrw', 'yesterday',
  'next', 'last', 'this', 'coming', 'following', 'previous',
  'after', 'before', 'ago', 'now',
];

const FREQUENCY_WORDS = [
  'every', 'each', 'daily', 'weekly', 'monthly', 'yearly',
  'repeating', 'repeat', 'recurring', 'recur',
  'biweekly', 'fortnightly', 'annually',
  'weekday', 'weekdays', 'weekend', 'weekends',
];

const SCHEDULING_WORDS = [
  'until', 'till', 'til', 'by', 'before', 'due', 'deadline',
  'starting', 'starts', 'begin', 'begins',
  'morning', 'afternoon', 'evening', 'night', 'noon', 'midnight',
];

const PREPOSITIONS_NOISE = [
  'on', 'at', 'in', 'for', 'the', 'of', 'a', 'to', 'from', 'by', 'with',
  'until', 'till', 'til',
  'next', 'last', 'this', 'every', 'each',
  'repeating', 'repeat', 'recurring', 'recur',
  'am', 'pm',
];

/** All date-related keywords that should be removed from the title. */
const ALL_DATE_KEYWORDS = [
  ...WEEKDAY_KEYS, ...MONTH_KEYS, ...TIME_UNITS,
  ...RELATIVE_DATES, ...FREQUENCY_WORDS, ...SCHEDULING_WORDS,
  ...PREPOSITIONS_NOISE,
  'end', 'ends', 'day', 'week', 'month', 'year', 'time',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

// ============================================================
// Priority Map
// ============================================================

const PRIORITY_MAP: Record<string, 'ASAP' | 'HIGH' | 'NORMAL' | 'LOW'> = {
  '!asap': 'ASAP', '!critical': 'ASAP', '!urgent': 'ASAP', '!1': 'ASAP',
  '!high': 'HIGH', '!important': 'HIGH', '!2': 'HIGH',
  '!medium': 'NORMAL', '!normal': 'NORMAL', '!3': 'NORMAL',
  '!low': 'LOW', '!minor': 'LOW', '!4': 'LOW',
};

// ============================================================
// Step 1 — Normalise: fix typos, expand abbreviations
// ============================================================

function normalise(input: string, ref: Date): string {
  let s = input;

  // Unicode & whitespace — normalise smart quotes to ASCII
  s = s.replace(/[\u201C\u201D\u2018\u2019]/g, (ch) =>
    ch === '\u201C' || ch === '\u201D' ? '"' : "'",
  ).replace(/\u00a0/g, ' ');
  s = s.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();

  // "half an hour" / "quarter of an hour" — special-case before word-to-number
  // Prefix with "for" so duration extraction (which requires "for"/~" prefix) catches them.
  s = s.replace(/\bhalf\s+an?\s+hour\b/gi, 'for 30 minutes');
  s = s.replace(/\bquarter\s+(?:of\s+)?an?\s+hour\b/gi, 'for 15 minutes');

  // Common misspellings that are too close to non-date keywords for fuzzy matching
  s = s.replace(/\bminuts\b/gi, 'minutes');
  s = s.replace(/\btommorow\b/gi, 'tomorrow');

  // Numbers written as words → digits (no "an" — it breaks "in an hour")
  const wordNums: Record<string, string> = {
    one: '1', two: '2', three: '3', four: '4', five: '5',
    six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
    eleven: '11', twelve: '12', half: '30', quarter: '15',
  };
  for (const [w, d] of Object.entries(wordNums)) {
    s = s.replace(new RegExp(`\\b${w}\\b`, 'gi'), d);
  }

  // Fuzzy-correct every word against ALL date-related keywords.
  // Include weekdays, months, time units, and all keyword categories so
  // typos like "februry", "wendsday", "h0our" are caught.
  const allCorrections = [
    ...WEEKDAY_KEYS, ...MONTH_KEYS, ...TIME_UNITS,
    'today', 'tonight', 'tomorrow', 'yesterday',
    'every', 'daily', 'weekly', 'monthly', 'yearly',
    'repeating', 'repeat', 'recurring', 'recur',
    'until', 'till', 'starting', 'morning', 'afternoon', 'evening', 'night',
    'noon', 'midnight', "o'clock", 'hour', 'minute', 'second',
    'biweekly', 'fortnightly', 'annually', 'coming', 'following',
    // Compound date words — exact-matched so they aren't fuzzy-corrupted
    // (e.g. "weekday" fuzzy-matching "weekly")
    'weekday', 'weekdays', 'weekend', 'weekends',
  ];
  const corrections = new Map(allCorrections.map((k) => [k, k]));

  // Common English words that are ≤2 edits from a date keyword but are NOT typos.
  // Skip fuzzy correction for these to prevent false positives.
  const fuzzySkip = new Set(['report', 'return', 'before', 'people', 'person']);

  s = s.replace(/[\w']+/g, (word) => {
    const lower = word.toLowerCase();
    if (corrections.has(lower)) return lower;
    // Skip short words, pure numbers, and words starting with digits (e.g. "9am", "30m")
    if (lower.length <= 3 || /^\d/.test(lower)) return word;
    // Use length-based Levenshtein thresholds to avoid false positives:
    //   ≤3 chars → no fuzzy (already skipped above)
    //   4-5 chars → max distance 1  (prevents "for"→"mon", "Deep"→"sep")
    //   6+ chars → max distance 2   (catches "wendsday", "februry")
    const maxDist = lower.length <= 5 ? 1 : 2;
    if (fuzzySkip.has(lower)) return word;
    for (const keyword of corrections.keys()) {
      if (Math.abs(lower.length - keyword.length) > maxDist) continue;
      if (levenshtein(lower, keyword) <= maxDist) return keyword;
    }
    return word;
  });

  // Preposition / filler stripping — "6 pm" → "6pm", "for on" → "for"
  s = s.replace(/(\d)\s*(am|pm)\b/gi, '$1$2');
  s = s.replace(/\bfor\s+on\s+(?=\d)/gi, 'for ');
  s = s.replace(/\bfor\s+on\s+(?=(?:hour|hr|minute|min)\b)/gi, 'for 1 ');
  s = s.replace(/\bon\s+the\s+/gi, 'on ');
  s = s.replace(/\bat\s+the\s+/gi, 'at ');
  s = s.replace(/\s+/g, ' ').trim();

  // Relative date expansions (order matters — longest first)
  const refStr = format(ref, 'yyyy-MM-dd');
  const relativeExpansions: Array<[RegExp, string]> = [
    [/^the day after tomorrow$/i, format(addDays(ref, 2), 'yyyy-MM-dd')],
    [/^day after tomorrow$/i, format(addDays(ref, 2), 'yyyy-MM-dd')],
    [/^day before yesterday$/i, format(addDays(ref, -2), 'yyyy-MM-dd')],
    [/^next week$/i, format(addDays(ref, 7), 'yyyy-MM-dd')],
    [/^next month$/i, format(addDays(ref, 30), 'yyyy-MM-dd')],
    [/^next year$/i, format(addDays(ref, 365), 'yyyy-MM-dd')],
    [/^last week$/i, format(addDays(ref, -7), 'yyyy-MM-dd')],
    [/^last month$/i, format(addDays(ref, -30), 'yyyy-MM-dd')],
    [/^this week$/i, format(ref, 'yyyy-MM-dd')],
    [/^this weekend$/i, format(addDays(ref, 6 - ref.getDay()), 'yyyy-MM-dd')],
    [/^tonight$/i, refStr],
    [/^today$/i, refStr],
    [/^tomorrow$/i, format(addDays(ref, 1), 'yyyy-MM-dd')],
    [/^tmr$/i, format(addDays(ref, 1), 'yyyy-MM-dd')],
    [/^tmrw$/i, format(addDays(ref, 1), 'yyyy-MM-dd')],
    [/^yesterday$/i, format(addDays(ref, -1), 'yyyy-MM-dd')],
    [/^noon$/i, '12:00'],
    [/^midnight$/i, '00:00'],
  ];

  for (const [pattern, replacement] of relativeExpansions) {
    s = s.replace(pattern, replacement);
  }

  // "6 o'clock" → "6:00"
  s = s.replace(/(\d{1,2})\s*o'?clock/gi, '$1:00');

  return s;
}

// ============================================================
// Step 3 — Extract multi-day recurrence
// ============================================================

function extractMultiDayRecurrence(
  text: string,
): { text: string; days?: number[]; frequency?: 'daily' | 'weekly' } {
  const s = text;

  // Standalone "daily"
  const dailyStandalone = s.match(/\bdaily\b/i);
  if (dailyStandalone) {
    return {
      text: s.replace(dailyStandalone[0], ' ').replace(/\s+/g, ' ').trim(),
      frequency: 'daily',
    };
  }

  // Standalone "weekly"
  const weeklyStandalone = s.match(/\bweekly\b/i);
  if (weeklyStandalone) {
    return {
      text: s.replace(weeklyStandalone[0], ' ').replace(/\s+/g, ' ').trim(),
      frequency: 'weekly',
    };
  }

  // "every day" / "each day"
  const dailyMatch = s.match(/\b(?:every|each)\s+day\b/i);
  if (dailyMatch) {
    return {
      text: s.replace(dailyMatch[0], ' ').replace(/\s+/g, ' ').trim(),
      frequency: 'daily',
    };
  }

  // "every weekday" / "weekdays"
  const weekdayMatch = s.match(/\b(?:every\s+)?week\s?days?\b/i);
  if (weekdayMatch) {
    return {
      text: s.replace(weekdayMatch[0], ' ').replace(/\s+/g, ' ').trim(),
      days: [1, 2, 3, 4, 5],
      frequency: 'weekly',
    };
  }

  // "every weekend" / "weekends"
  const weekendMatch = s.match(/\b(?:every\s+)?week\s?ends?\b/i);
  if (weekendMatch) {
    return {
      text: s.replace(weekendMatch[0], ' ').replace(/\s+/g, ' ').trim(),
      days: [6, 7],
      frequency: 'weekly',
    };
  }

  // Multi-day: "every wednesday and friday" / "every mon, wed, fri" / "every mon wed fri"
  // Each day after the separator is an independent alternation (no backreference).
  // Separator: comma, and/or/&/+, or just whitespace between day names.
  const dayAlt = '(?:' + WEEKDAY_KEYS.join('|') + ')';
  // Separator between day names: commas, spaces, or connectors like "and"
  // Uses [\s,]+ to handle "monday, wednesday" (comma without preceding space)
  const sep = '[\\s,]+(?:and\\s+|or\\s+|&\\s*|\\+\\s*)?';
  const multiDayPattern = new RegExp(
    '\\b(?:every|each)\\s+' + dayAlt + '(?:' + sep + dayAlt + ')+',
    'gi',
  );
  const multiMatch = s.match(multiDayPattern);
  if (multiMatch) {
    const phrase = multiMatch[0];
    const dayPattern = new RegExp('\\b(' + WEEKDAY_KEYS.join('|') + ')\\b', 'gi');
    const found: number[] = [];
    let dm: RegExpExecArray | null;
    while ((dm = dayPattern.exec(phrase)) !== null) {
      const iso = WEEKDAYS[dm[1].toLowerCase()];
      if (iso && !found.includes(iso)) found.push(iso);
    }
    if (found.length > 0) {
      // Remove the entire matched phrase (not just individual day words)
      // to avoid leaving connectors like "and" behind.
      let cleaned = s.replace(phrase, ' ');

      return {
        text: cleaned.replace(/\s+/g, ' ').trim(),
        days: found.sort((a, b) => a - b),
        frequency: 'weekly',
      };
    }
  }

  // "N times a week" → weekly
  const nTimesMatch = s.match(/\b(\d+)\s*(?:x|times?)\s*(?:a|per)\s*week\b/i);
  if (nTimesMatch) {
    return {
      text: s.replace(nTimesMatch[0], ' ').replace(/\s+/g, ' ').trim(),
      frequency: 'weekly',
    };
  }

  // "every other tuesday" / "biweekly monday"
  const everyOtherMatch = s.match(/\b(?:every\s+other|biweekly|fortnightly)\s+(\w+)\b/i);
  if (everyOtherMatch) {
    const dayIso = WEEKDAYS[everyOtherMatch[1].toLowerCase()];
    if (dayIso) {
      return {
        text: s.replace(everyOtherMatch[0], ' ').replace(/\s+/g, ' ').trim(),
        days: [dayIso],
        frequency: 'weekly',
      };
    }
  }

  // Single day with "every": "every tuesday"
  const singleDayMatch = s.match(/\b(?:every|each)\s+(\w+)\b/i);
  if (singleDayMatch) {
    const dayIso = WEEKDAYS[singleDayMatch[1].toLowerCase()];
    if (dayIso) {
      return {
        text: s.replace(singleDayMatch[0], ' ').replace(/\s+/g, ' ').trim(),
        days: [dayIso],
        frequency: 'weekly',
      };
    }
  }

  return { text: s };
}

// ============================================================
// Step 4 — Extract recurrence end date ("until end of july")
// ============================================================

function extractRecurrenceEnd(text: string, ref: Date): { text: string; end?: string } {
  let s = text;

  // "until end of <month>" — e.g. "until the end of july", "till end of month"
  const endOfMonthPattern = /\b(?:until|till|til)\s+(?:the\s+)?(?:end\s+(?:of\s+)?)?(\w+)\b/i;
  const endMatch = s.match(endOfMonthPattern);
  if (endMatch) {
    const afterUntil = endMatch[1].toLowerCase();
    const monthIdx = MONTHS[afterUntil];
    if (monthIdx !== undefined) {
      const year = ref.getMonth() > monthIdx ? ref.getFullYear() + 1 : ref.getFullYear();
      const lastDay = new Date(year, monthIdx + 1, 0);
      s = s.replace(endMatch[0], ' ');
      return { text: s.replace(/\s+/g, ' ').trim(), end: format(lastDay, 'yyyy-MM-dd') };
    }

    // "until end of month" / "till end of this month"
    if (afterUntil === 'month' || afterUntil === 'this') {
      const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
      s = s.replace(endMatch[0], ' ');
      return { text: s.replace(/\s+/g, ' ').trim(), end: format(lastDay, 'yyyy-MM-dd') };
    }

    // "until end of year"
    if (afterUntil === 'year') {
      s = s.replace(endMatch[0], ' ');
      return { text: s.replace(/\s+/g, ' ').trim(), end: `${ref.getFullYear()}-12-31` };
    }
  }

  // Strip remaining "until/till" so chrono doesn't get confused
  s = s.replace(/\b(?:until|till|til)\s+/gi, ' ');

  return { text: s.replace(/\s+/g, ' ').trim() };
}

// ============================================================
// Step 6 — Extract duration ("for 1 hour", "~30m", "for 2h30m")
// ============================================================

const DURATION_PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => number]> = [
  // "for 1 hour 30 minutes", "for 2 hours and 15 minutes"
  [/\bfor\s+(\d+)\s*(?:hour|hr|h)s?\s*(?:and\s+)?(\d+)\s*(?:minute|min|m)s?\b/i,
    (m) => parseInt(m[1]) * 60 + parseInt(m[2])],
  // "for 2h30m"
  [/\bfor\s+(\d+)\s*h\s*(\d+)\s*m(?:in)?\b/i,
    (m) => parseInt(m[1]) * 60 + parseInt(m[2])],
  // "for 1 hour" / "for 2 hours"
  [/\bfor\s+(\d+)\s*(?:hour|hr|h)s?\b/i,
    (m) => parseInt(m[1]) * 60],
  // "for 30 minutes" / "for 45 mins"
  [/\bfor\s+(\d+)\s*(?:minute|min|m)s?\b/i,
    (m) => parseInt(m[1])],
  // "for hour" / "for hours" — bare unit after "for" (no number) → 60 min
  [/\bfor\s+(?:hour|hr|h)s?\b/i, () => 60],
  // "for minutes" / "for mins" → 30 min default
  [/\bfor\s+(?:minute|min|m)s?\b/i, () => 30],
  // "~2h30m"
  [/[~～](\d+)\s*h\s*(\d+)\s*m(?:in)?/i,
    (m) => parseInt(m[1]) * 60 + parseInt(m[2])],
  // "~2h"
  [/[~～](\d+)\s*(?:hour|hr|h)s?/i,
    (m) => parseInt(m[1]) * 60],
  // "~30m"
  [/[~～](\d+)\s*(?:minute|min|m)s?/i,
    (m) => parseInt(m[1])],
];

function extractDuration(text: string): { text: string; minutes?: number } {
  let s = text;
  for (const [pattern, extract] of DURATION_PATTERNS) {
    const match = s.match(pattern);
    if (match) {
      const minutes = extract(match);
      if (minutes > 0 && minutes < 24 * 60) {
        s = s.replace(match[0], ' ');
        return { text: s.replace(/\s+/g, ' ').trim(), minutes };
      }
    }
  }
  return { text: s };
}

// ============================================================
// Step 7 — Clean title
// ============================================================

function cleanTitle(text: string): string {
  let s = text;

  // Remove remaining date keywords (word-boundary match, case-insensitive)
  const kwPattern = new RegExp(
    '\\b(?:' + ALL_DATE_KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b',
    'gi',
  );
  s = s.replace(kwPattern, ' ');

  // Remove dangling prepositions at start/end
  s = s.replace(/^(?:on|at|in|for|the|of|a|an|to|from|by|with)\s+/i, '');
  s = s.replace(/\s+(?:on|at|in|for|the|of|to|from|by|with)$/i, '');

  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

// ============================================================
// Main Parser
// ============================================================

/**
 * Enhanced natural language task parser with typo correction.
 *
 * Handles inputs like:
 *   "class repeating every wednesday and friday until the end of july at 6 pm for on h0our"
 *   "Buy groceries tommorow at 5pm #errands !high ~30m"
 *   "Review PRs wendsday #work !1 for 1h"
 *   "Standup every monday wednesday friday 9:30am"
 *   "Gym every weekday at 7am for 45 min"
 *   "Write blog post #writing ~2h30m daily"
 *
 * Extraction order:
 *   1. Normalise (fix typos, expand abbreviations)
 *   2. Tags & priority
 *   3. Multi-day recurrence
 *   4. Recurrence end date
 *   5. Duration (before chrono — "for"/~" prefix won't clash with "in 2 hours")
 *   6. Date/time (chrono-node)
 *   7. Clean title
 */
export function parseEnhancedTask(input: string): ParsedTask {
  const ref = new Date();
  const raw = input.trim();
  if (!raw) return { title: '' };

  // ── 1. Normalise ──────────────────────────────────────────────
  let working = normalise(raw, ref);

  // ── 2. Extract tags ───────────────────────────────────────────
  const tags: string[] = [];
  const tagRegex = /#([\w-]+)/g;
  let tagMatch;
  while ((tagMatch = tagRegex.exec(working)) !== null) {
    tags.push(tagMatch[1].toLowerCase());
  }
  working = working.replace(/#[\w-]+/g, ' ').replace(/\s+/g, ' ').trim();

  // ── 3. Extract priority ───────────────────────────────────────
  let priority: 'ASAP' | 'HIGH' | 'NORMAL' | 'LOW' | undefined;
  const prioRegex = /!(?:asap|critical|urgent|1|high|important|2|medium|normal|3|low|minor|4)\b/gi;
  let prioMatch;
  while ((prioMatch = prioRegex.exec(working)) !== null) {
    const key = prioMatch[0].toLowerCase();
    if (PRIORITY_MAP[key]) {
      priority = PRIORITY_MAP[key];
      break;
    }
  }
  working = working.replace(prioRegex, ' ').replace(/\s+/g, ' ').trim();

  // ── 4. Extract multi-day recurrence ───────────────────────────
  const recurrence = extractMultiDayRecurrence(working);
  working = recurrence.text;
  const frequency = recurrence.frequency;
  const preferredDays = recurrence.days;

  // ── 5. Extract recurrence end date ────────────────────────────
  const endResult = extractRecurrenceEnd(working, ref);
  working = endResult.text;
  const recurrenceEnd = endResult.end;

  // ── 6. Extract duration BEFORE chrono ─────────────────────────
  // All patterns require "for" or "~" prefix, so they won't interfere
  // with chrono's relative time parsing (e.g. "in 2 hours").
  const durResult = extractDuration(working);
  working = durResult.text;
  const durationMinutes = durResult.minutes;

  // ── 7. Parse remaining date/time with chrono-node ─────────────
  let date: string | undefined;
  let time: string | undefined;
  const chronoResults = chrono.parse(working, ref, { forwardDate: true });

  if (chronoResults.length > 0) {
    const first = chronoResults[0];
    const parsedDate = first.start.date();

    date = format(parsedDate, 'yyyy-MM-dd');

    if (first.start.isCertain('hour')) {
      time = format(parsedDate, 'HH:mm');
    }

    // Strip chrono's matched text
    const before = working.slice(0, first.index);
    const after = working.slice(first.index + first.text.length);
    working = `${before} ${after}`.replace(/\s+/g, ' ').trim();
  }

  // ── 8. Clean title ────────────────────────────────────────────
  let title = cleanTitle(working);

  // Fallback: if we stripped everything, use original input minus tags/priority
  if (!title) {
    title = raw.replace(/#[\w-]+|!\w+/g, '').replace(/\s+/g, ' ').trim();
  }
  if (!title) title = raw;

  return {
    title,
    date,
    time,
    priority,
    tags: tags.length > 0 ? tags : undefined,
    duration_minutes: durationMinutes,
    frequency,
    recurrence_end: recurrenceEnd,
    preferred_days: preferredDays,
  };
}
