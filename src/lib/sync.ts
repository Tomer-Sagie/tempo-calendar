import type { Task } from './types';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getAccessToken,
} from './google';

export interface SyncResult {
  success: boolean;
  googleEventId?: string;
  error?: string;
}

const RECURRENCE_DAY_MAP: Record<number, string> = {
  1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA', 7: 'SU',
};

function buildRecurrence(task: Task): string[] | undefined {
  if (task.frequency === 'once') return undefined;
  if (!task.preferred_days || task.preferred_days.length === 0) return undefined;

  const days = task.preferred_days.slice().sort()
    .map((d) => RECURRENCE_DAY_MAP[d]).filter(Boolean);
  if (days.length === 0) return undefined;

  const until = new Date();
  until.setMonth(until.getMonth() + 3);
  const untilStr = until.toISOString().replace(/[-:]|\.\d{3}/g, '');
  return [`RRULE:FREQ=WEEKLY;BYDAY=${days.join(',')};UNTIL=${untilStr}`];
}

function buildEventPayload(task: Task, startISO: string, endISO: string) {
  return {
    summary: task.title,
    description: task.description || task.notes || undefined,
    start: { dateTime: startISO, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    end: { dateTime: endISO, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    colorId: '9', // Blue/Indigo for tasks
    ...(buildRecurrence(task) ? { recurrence: buildRecurrence(task)! } : {}),
  };
}

export async function syncTaskToGoogle(
  task: Task, scheduledStart: string, scheduledEnd: string
): Promise<SyncResult> {
  console.log('[Sync] Creating Google event for task:', task.title);
  if (!getAccessToken()) {
    return { success: false, error: 'Not connected to Google Calendar' };
  }
  try {
    const ev = await createCalendarEvent(buildEventPayload(task, scheduledStart, scheduledEnd));
    console.log('[Sync] Created Google event:', ev.id);
    return { success: true, googleEventId: ev.id };
  } catch (err: any) {
    console.error('[Sync] Failed to create Google event:', err);
    return { success: false, error: err?.message || 'Failed to create Google event' };
  }
}

export async function updateTaskInGoogle(
  task: Task, scheduledStart: string, scheduledEnd: string
): Promise<SyncResult> {
  console.log('[Sync] Updating Google event for task:', task.title);
  if (!getAccessToken()) {
    return { success: false, error: 'Not connected to Google Calendar' };
  }
  if (!task.google_event_id) {
    return syncTaskToGoogle(task, scheduledStart, scheduledEnd);
  }
  try {
    await updateCalendarEvent(task.google_event_id, buildEventPayload(task, scheduledStart, scheduledEnd));
    console.log('[Sync] Updated Google event:', task.google_event_id);
    return { success: true, googleEventId: task.google_event_id };
  } catch (err: any) {
    console.error('[Sync] Failed to update Google event:', err);
    return { success: false, error: err?.message || 'Failed to update Google event' };
  }
}

export async function removeTaskFromGoogle(task: Task): Promise<SyncResult> {
  console.log('[Sync] Removing Google event for task:', task.title);
  if (!getAccessToken()) {
    return { success: false, error: 'Not connected to Google Calendar' };
  }
  if (!task.google_event_id) return { success: true };
  try {
    await deleteCalendarEvent(task.google_event_id);
    console.log('[Sync] Deleted Google event:', task.google_event_id);
    return { success: true };
  } catch (err: any) {
    console.error('[Sync] Failed to delete Google event:', err);
    return { success: false, error: err?.message || 'Failed to delete Google event' };
  }
}

export function isRecurringTask(task: Task): boolean {
  return task.frequency !== 'once' && (task.preferred_days?.length ?? 0) > 0;
}