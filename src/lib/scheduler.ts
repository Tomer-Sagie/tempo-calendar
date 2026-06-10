import {
  parseISO,
  addDays,
  addMinutes,
  subMinutes,
  differenceInMinutes,
  isBefore,
  isAfter,
  format,
  getDay,
  startOfDay,
} from 'date-fns';
import type { Task, SchedulingSlot } from './types';
import type { CalendarEvent } from './google';

export interface SchedulerConfig {
  /** Default working hours start (24h) */
  defaultStartHour: number; // 9
  /** Default working hours end (24h) */
  defaultEndHour: number; // 17
  /** Minimum gap between events in minutes */
  minGapMinutes: number; // 15
  /** Consider weekends as available? */
  includeWeekends: boolean;
}

const DEFAULT_CONFIG: SchedulerConfig = {
  defaultStartHour: 9,
  defaultEndHour: 17,
  minGapMinutes: 15,
  includeWeekends: false,
};

/**
 * Get the working hours for a given day, respecting task-level overrides
 * and default config.
 */
function getWorkingHours(
  date: Date,
  task: Task,
  config: SchedulerConfig
): { startHour: number; endHour: number } {
  // Check scheduling_hours_override
  if (task.scheduling_hours_override) {
    try {
      const override = JSON.parse(task.scheduling_hours_override);
      const dayOfWeek = getDay(date); // 0=Sun, 6=Sat
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const hours = isWeekend ? override.weekend : override.weekday;
      if (hours && hours.length >= 2) {
        return {
          startHour: parseInt(hours[0], 10),
          endHour: parseInt(hours[1], 10),
        };
      }
    } catch { /* ignore invalid JSON */ }
  }

  // Check preferred_time_windows
  if (task.preferred_time_windows && task.preferred_time_windows.length > 0) {
    try {
      const window = JSON.parse(task.preferred_time_windows[0]);
      return {
        startHour: parseInt(window.start.split(':')[0], 10),
        endHour: parseInt(window.end.split(':')[0], 10),
      };
    } catch { /* ignore */ }
  }

  return {
    startHour: config.defaultStartHour,
    endHour: config.defaultEndHour,
  };
}

/**
 * Check if a given time range overlaps with any busy events.
 * Uses strict interval overlap: start < eventEnd && end > eventStart.
 * Touching boundaries (start === eventEnd) are NOT considered overlapping.
 */
function isOverlapping(
  start: Date,
  end: Date,
  busySlots: CalendarEvent[]
): boolean {
  return busySlots.some((event) => {
    const eventStart = parseISO(event.startTime);
    const eventEnd = parseISO(event.endTime);
    // Strict overlap: a task ending exactly when another starts is allowed
    return start < eventEnd && end > eventStart;
  });
}

/**
 * Check if a given date/time is blocked by task-level blocked times.
 */
function isInBlockedTime(date: Date, task: Task): boolean {
  const dayOfWeek = getDay(date); // 0=Sun
  const taskDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek; // convert to 1=Mon..7=Sun

  // Check blocked days
  if (task.blocked_days?.includes(taskDayOfWeek)) {
    return true;
  }

  // Check preferred_days (if set, only allow those days)
  if (task.preferred_days && task.preferred_days.length > 0) {
    if (!task.preferred_days.includes(taskDayOfWeek)) {
      return true;
    }
  }

  // Check blocked times
  if (task.blocked_times && task.blocked_times.length > 0) {
    const timeStr = format(date, 'HH:mm');
    for (const bt of task.blocked_times) {
      try {
        const block = JSON.parse(bt);
        if (timeStr >= block.start && timeStr < block.end) {
          return true;
        }
      } catch { /* ignore */ }
    }
  }

  return false;
}

/**
 * Check if the date falls within preferred_time_windows for the task.
 */
function isInPreferredTimeWindow(date: Date, task: Task): boolean {
  if (!task.preferred_time_windows || task.preferred_time_windows.length === 0) {
    return true; // no preference = always allowed
  }

  const timeStr = format(date, 'HH:mm');
  for (const tw of task.preferred_time_windows) {
    try {
      const window = JSON.parse(tw);
      if (timeStr >= window.start && timeStr < window.end) {
        return true;
      }
    } catch { /* ignore */ }
  }

  return false;
}

/**
 * Find available time slots for a given task on a specific date,
 * considering busy events.
 */
export function findSlotsForDate(
  date: Date,
  task: Task,
  busySlots: CalendarEvent[],
  config: SchedulerConfig = DEFAULT_CONFIG
): SchedulingSlot[] {
  // Skip blocked days
  if (isInBlockedTime(date, task)) {
    return [];
  }

  // Skip weekends if not configured
  if (!config.includeWeekends) {
    const dayOfWeek = getDay(date);
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const taskDay = dayOfWeek === 0 ? 7 : dayOfWeek;
      if (!task.preferred_days?.includes(taskDay)) {
        return [];
      }
    }
  }

  const { startHour, endHour } = getWorkingHours(date, task, config);
  const dayStart = new Date(date);
  dayStart.setHours(startHour, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(endHour, 0, 0, 0);

  const slots: SchedulingSlot[] = [];
  let cursor = new Date(dayStart);

  // Get busy events for this day only
  const dayBusySlots = busySlots.filter((event) => {
    const eventStart = parseISO(event.startTime);
    return (
      format(eventStart, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
  }).sort((a, b) => {
    return parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime();
  });

  while (cursor < dayEnd) {
    const slotEnd = addMinutes(cursor, task.duration_minutes);

    // If slot goes past end of day, stop
    if (slotEnd > dayEnd) break;

    // Check if this slot is in a preferred time window
    if (!isInPreferredTimeWindow(cursor, task)) {
      cursor = addMinutes(cursor, config.minGapMinutes);
      continue;
    }

    // Check if it overlaps with any busy event
    if (!isOverlapping(cursor, slotEnd, dayBusySlots)) {
      // Compute buffered start/end:
      // buffer_before_minutes adds padding BEFORE the task starts
      // buffer_after_minutes adds padding AFTER the task ends
      const bufferedStart = subMinutes(cursor, task.buffer_before_minutes);
      const bufferedEnd = addMinutes(slotEnd, task.buffer_after_minutes);

      // Check if buffered slot also doesn't overlap and stays within working hours
      if (!isOverlapping(bufferedStart, bufferedEnd, dayBusySlots) && bufferedStart >= dayStart) {
        slots.push({
          start: new Date(cursor),
          end: new Date(slotEnd),
          durationMinutes: task.duration_minutes,
        });
      }
    }

    cursor = addMinutes(cursor, config.minGapMinutes);
  }

  return slots;
}

/**
 * Find all available slots across multiple days up to the scheduling cutoff.
 */
export function findSlotsForTask(
  task: Task,
  busySlots: CalendarEvent[],
  config: SchedulerConfig = DEFAULT_CONFIG
): SchedulingSlot[] {
  const allSlots: SchedulingSlot[] = [];
  const maxDays = task.scheduling_cutoff_weeks * 7;
  const startDate = startOfDay(new Date());

  // If task has a deadline, don't schedule past it
  const deadline = task.deadline ? parseISO(task.deadline) : null;
  const dueDate = task.due_date
    ? parseISO(task.due_date)
    : null;

  // Calculate upper bound using integer days to avoid fractional-day issues
  const deadlineDays = deadline
    ? Math.floor(differenceInMinutes(deadline, startDate) / (24 * 60))
    : Infinity;
  const dueDays = dueDate && !deadline
    ? Math.floor(differenceInMinutes(dueDate, startDate) / (24 * 60))
    : Infinity;
  const upperDays = Math.min(maxDays, deadlineDays, dueDays);

  const upperBound = addDays(startDate, upperDays);

  let currentDate = new Date(startDate);

  while (currentDate <= upperBound) {
    const dateSlots = findSlotsForDate(currentDate, task, busySlots, config);
    allSlots.push(...dateSlots);
    currentDate = addDays(currentDate, 1);
  }

  // Sort by date then time
  allSlots.sort((a, b) => a.start.getTime() - b.start.getTime());

  return allSlots;
}

/**
 * Pick the best slot from a list of slots based on task preferences.
 * - ASAP tasks get the earliest slot
 * - Tasks with deadlines get the earliest slot that fits before the deadline
 * - Other tasks get the earliest slot
 */
export function pickBestSlot(slots: SchedulingSlot[], task: Task): SchedulingSlot | null {
  if (slots.length === 0) return null;

  // For ASAP priority, pick the earliest slot
  if (task.priority === 'ASAP') {
    return slots[0];
  }

  // For tasks with preferred time windows, try to find the best match
  if (task.preferred_time_windows && task.preferred_time_windows.length > 0) {
    for (const tw of task.preferred_time_windows) {
      try {
        const window = JSON.parse(tw);
        const windowStartMinutes = parseInt(window.start.split(':')[0]) * 60 +
          parseInt(window.start.split(':')[1] || '0', 10);
        const windowEndMinutes = parseInt(window.end.split(':')[0]) * 60 +
          parseInt(window.end.split(':')[1] || '0', 10);

        const preferredSlot = slots.find((slot) => {
          const slotMinutes = slot.start.getHours() * 60 + slot.start.getMinutes();
          return slotMinutes >= windowStartMinutes && slotMinutes < windowEndMinutes;
        });

        if (preferredSlot) return preferredSlot;
      } catch { /* ignore */ }
    }
  }

  // Default: return earliest slot
  return slots[0];
}

/**
 * Main scheduling function. Finds slots and picks the best one.
 */
export function scheduleTask(
  task: Task,
  busySlots: CalendarEvent[],
  config: SchedulerConfig = DEFAULT_CONFIG
): SchedulingSlot | null {
  const slots = findSlotsForTask(task, busySlots, config);

  if (slots.length === 0) {
    if (task.ignore_if_cannot_schedule) {
      return null;
    }
    return null;
  }

  const bestSlot = pickBestSlot(slots, task);

  return bestSlot;
}

/**
 * Sort tasks by priority: ASAP > HIGH > NORMAL > LOW
 * This is the canonical priority ordering used throughout.
 */
export const PRIORITY_ORDER: Record<string, number> = {
  ASAP: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

/**
 * Schedule multiple tasks in priority order.
 * Returns tasks with their scheduled slots.
 * Already-scheduled tasks are treated as busy blocks.
 */
export function scheduleMultipleTasks(
  tasks: Task[],
  busySlots: CalendarEvent[],
  config: SchedulerConfig = DEFAULT_CONFIG
): Array<{ task: Task; slot: SchedulingSlot | null }> {
  const sortedTasks = [...tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 99;
    const pb = PRIORITY_ORDER[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;

    // If same priority, tasks with deadlines come first
    if (a.deadline && !b.deadline) return -1;
    if (!a.deadline && b.deadline) return 1;

    return 0;
  });

  const results: Array<{ task: Task; slot: SchedulingSlot | null }> = [];
  let accumulatedBusy = [...busySlots];

  for (const task of sortedTasks) {
    const slot = scheduleTask(task, accumulatedBusy, config);
    results.push({ task, slot });

    // If task was scheduled, add it as a busy block for subsequent tasks
    if (slot) {
      const startTime = slot.start.toISOString();
      const endTime = slot.end.toISOString();
      accumulatedBusy.push({
        id: `scheduled-${task.id}`,
        title: task.title,
        description: task.description || '',
        source: 'task',
        calendar: 'scheduled',
        startTime,
        endTime,
        color: task.color,
      });
    }
  }

  return results;
}