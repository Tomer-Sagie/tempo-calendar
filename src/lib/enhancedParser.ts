import * as chrono from 'chrono-node';
import { format } from 'date-fns';

export interface ParsedTask {
  title: string;
  date?: string;
  time?: string;
  priority?: 'ASAP' | 'HIGH' | 'NORMAL' | 'LOW';
  tags?: string[];
  duration_minutes?: number;
  frequency?: 'daily' | 'weekly';
}

const PRIORITY_MAP: Record<string, 'ASAP' | 'HIGH' | 'NORMAL' | 'LOW'> = {
  '!asap': 'ASAP',
  '!critical': 'ASAP',
  '!urgent': 'ASAP',
  '!1': 'ASAP',
  '!high': 'HIGH',
  '!important': 'HIGH',
  '!2': 'HIGH',
  '!medium': 'NORMAL',
  '!normal': 'NORMAL',
  '!3': 'NORMAL',
  '!low': 'LOW',
  '!minor': 'LOW',
  '!4': 'LOW',
};

/**
 * Enhanced natural language task parser.
 *
 * Syntax:
 *   "Buy groceries tomorrow at 5pm #errands !high ~30m"
 *   "Review PRs friday #work !1 for 1h"
 *   "Standup monday 9:30am every day"
 *   "Write blog post #writing ~2h30m"
 *
 * Order of extraction matters: tags/priority first (to avoid confusing
 * chrono-node), then date/time, then duration from what's left.
 */
export function parseEnhancedTask(input: string): ParsedTask {
  const raw = input.trim();
  if (!raw) return { title: '' };

  let working = raw;

  // ── 1. Extract frequency markers ──────────────────────────────
  let frequency: 'daily' | 'weekly' | undefined;

  const everyMatch = working.match(/\bevery\s+day\b/i);
  if (everyMatch) {
    frequency = 'daily';
    working = working.replace(everyMatch[0], ' ');
  }

  if (!frequency) {
    const dailyMatch = working.match(/\bdaily\b/i);
    if (dailyMatch) {
      frequency = 'daily';
      working = working.replace(dailyMatch[0], ' ');
    }
  }

  const everyWeekdayMatch = working.match(/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (everyWeekdayMatch) {
    frequency = 'weekly';
    // Don't remove — chrono needs the weekday to determine the date
  }

  if (!frequency) {
    const weeklyMatch = working.match(/\bweekly\b/i);
    if (weeklyMatch) {
      frequency = 'weekly';
      working = working.replace(weeklyMatch[0], ' ');
    }
  }

  // ── 2. Extract tags ───────────────────────────────────────────
  const tags: string[] = [];
  const tagRegex = /#([\w-]+)/g;
  let tagMatch;
  while ((tagMatch = tagRegex.exec(working)) !== null) {
    tags.push(tagMatch[1].toLowerCase());
  }
  working = working.replace(/#[\w-]+/g, ' ');

  // ── 3. Extract priority ───────────────────────────────────────
  let priority: 'ASAP' | 'HIGH' | 'NORMAL' | 'LOW' | undefined;
  const prioRegex = /!(asap|critical|urgent|1|high|important|2|medium|normal|3|low|minor|4)\b/gi;
  let prioMatch;
  while ((prioMatch = prioRegex.exec(working)) !== null) {
    const key = prioMatch[0].toLowerCase();
    if (PRIORITY_MAP[key]) {
      priority = PRIORITY_MAP[key];
      break; // Take the first priority marker
    }
  }
  working = working.replace(prioRegex, ' ');

  // ── 4. Extract duration ───────────────────────────────────────
  let durationMinutes: number | undefined;
  const durationPatterns: Array<[RegExp, (m: RegExpMatchArray) => number]> = [
    // ~2h30m, ~2h, ~30m, ~90min
    [/[~～](\d+)\s*h\s*(\d+)\s*m(?:in)?/i, (m) => parseInt(m[1]) * 60 + parseInt(m[2])],
    [/[~～](\d+)\s*h(?:ours?)?/i, (m) => parseInt(m[1]) * 60],
    [/[~～](\d+)\s*m(?:in(?:utes?)?)?/i, (m) => parseInt(m[1])],
    // for 30m, for 1h, for 1h30m, for 90min
    [/\bfor\s+(\d+)\s*h\s*(\d+)\s*m(?:in)?/i, (m) => parseInt(m[1]) * 60 + parseInt(m[2])],
    [/\bfor\s+(\d+)\s*h(?:ours?)?(?:\s+and\s+(\d+)\s*m(?:in)?)?/i, (m) => parseInt(m[1]) * 60 + (m[2] ? parseInt(m[2]) : 0)],
    [/\bfor\s+(\d+)\s*m(?:in(?:utes?)?)?/i, (m) => parseInt(m[1])],
  ];

  for (const [pattern, extract] of durationPatterns) {
    const match = working.match(pattern);
    if (match) {
      durationMinutes = extract(match);
      working = working.replace(match[0], ' ');
      break;
    }
  }

  // ── 5. Parse date/time with chrono-node ───────────────────────
  const cleaned = working.replace(/\s+/g, ' ').trim();
  const results = chrono.parse(cleaned, new Date(), { forwardDate: true });

  let date: string | undefined;
  let time: string | undefined;
  let titleText = cleaned;

  if (results.length > 0) {
    const first = results[0];
    const parsedDate = first.start.date();

    date = format(parsedDate, 'yyyy-MM-dd');

    if (first.start.isCertain('hour')) {
      time = format(parsedDate, 'HH:mm');
    }

    // Strip the matched date text from the title
    const before = cleaned.slice(0, first.index);
    const after = cleaned.slice(first.index + first.text.length);
    titleText = `${before} ${after}`.replace(/\s+/g, ' ').trim();
  }

  // Final cleanup: remove dangling prepositions from title
  titleText = titleText
    .replace(/\s+on$/i, '')
    .replace(/\s+at$/i, '')
    .replace(/\s+for$/i, '')
    .replace(/\s+every$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Fallback: if we stripped everything, use original input
  if (!titleText) titleText = raw.replace(/#[\w-]+|!\w+/g, '').replace(/\s+/g, ' ').trim();
  if (!titleText) titleText = raw;

  return {
    title: titleText,
    date,
    time,
    priority,
    tags: tags.length > 0 ? tags : undefined,
    duration_minutes: durationMinutes,
    frequency,
  };
}
