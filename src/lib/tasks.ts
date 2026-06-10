import { supabase } from './supabase';
import type { Task, TaskPriority, TaskFrequency } from './types';

export interface TaskInput {
  title: string;
  description?: string;
  duration_minutes: number;
  due_date?: string;
  due_time?: string;
  deadline?: string;
  priority?: TaskPriority;
  frequency?: TaskFrequency;
  preferred_days?: number[];
  preferred_time_windows?: string[];
  is_busy_block?: boolean;
  can_split?: boolean;
  ignore_if_cannot_schedule?: boolean;
  is_habit?: boolean;
  is_recurring?: boolean;
  can_balance_across_days?: boolean;
  min_chunk_duration?: number;
  max_chunks?: number;
  scheduling_cutoff_weeks?: number;
  buffer_before_minutes?: number;
  buffer_after_minutes?: number;
  blocked_days?: number[];
  blocked_times?: string[];
  scheduling_hours_override?: string;
  tags?: string[];
  color?: string;
  notes?: string;
  skip_days?: number[];
  google_event_id?: string;
  google_calendar_id?: string;
}

// Extended update type that also allows setting scheduling fields
// Note: We use Omit + override pattern to ensure null is accepted for nullable fields
export type TaskUpdate = Omit<Partial<TaskInput>, 'google_event_id'> & {
  is_scheduled?: boolean;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  google_event_id?: string | null;
  completion_history?: string[] | null;
};

export async function fetchTasks(): Promise<Task[]> {
  console.log('[Tasks] Fetching all tasks...');
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Tasks] Fetch error:', error);
    throw error;
  }

  console.log(`[Tasks] Fetched ${data?.length || 0} tasks`);
  return (data || []) as Task[];
}

export async function fetchUnscheduledTasks(): Promise<Task[]> {
  console.log('[Tasks] Fetching unscheduled tasks...');
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('is_scheduled', false)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Tasks] Fetch unscheduled error:', error);
    throw error;
  }

  console.log(`[Tasks] Fetched ${data?.length || 0} unscheduled tasks`);
  return (data || []) as Task[];
}

export async function createTask(input: TaskInput): Promise<Task> {
  console.log('[Tasks] Creating task:', input.title);

  const { data, error } = await supabase
    .from('tasks')
    .insert([input])
    .select()
    .single();

  if (error) {
    console.error('[Tasks] Create error:', error);
    throw error;
  }

  console.log('[Tasks] Created task:', data.id);
  return data as Task;
}

export async function updateTask(id: string, updates: TaskUpdate): Promise<Task> {
  console.log('[Tasks] Updating task:', id);

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Tasks] Update error:', error);
    throw error;
  }

  console.log('[Tasks] Updated task:', id);
  return data as Task;
}

export async function deleteTask(id: string): Promise<void> {
  console.log('[Tasks] Deleting task:', id);

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .select();

  if (error) {
    console.error('[Tasks] Delete error:', error);
    throw error;
  }

  console.log('[Tasks] Deleted task:', id);
}

export async function updateTaskSchedule(
  id: string,
  scheduledStart: string,
  scheduledEnd: string,
  googleEventId?: string | undefined
): Promise<Task> {
  console.log('[Tasks] Updating task schedule:', id, scheduledStart, scheduledEnd);

  const updates: TaskUpdate = {
    is_scheduled: true,
    scheduled_start: scheduledStart,
    scheduled_end: scheduledEnd,
  };

  if (googleEventId) {
    updates.google_event_id = googleEventId;
  }

  return updateTask(id, updates);
}

export async function markTaskComplete(id: string): Promise<Task> {
  return updateTask(id, {
    is_scheduled: false,
    scheduled_start: null,
    scheduled_end: null,
    completion_history: [],
  });
}

export async function unscheduleTask(id: string): Promise<Task> {
  return updateTask(id, {
    is_scheduled: false,
    scheduled_start: null,
    scheduled_end: null,
  });
}