export type TaskPriority = 'ASAP' | 'HIGH' | 'NORMAL' | 'LOW';
export type TaskFrequency = 'once' | 'daily' | 'weekly' | 'custom';

export interface Task {
  id: string;
  created_at: string;
  updated_at: string;

  // Basic
  title: string;
  description: string | null;
  duration_minutes: number;

  // Due/deadline
  due_date: string | null;
  due_time: string | null;
  deadline: string | null;

  // Priority
  priority: TaskPriority;

  // Frequency
  frequency: TaskFrequency;
  preferred_days: number[] | null; // 1=Mon..7=Sun

  // Time preferences
  preferred_time_windows: string[] | null; // ['{"start":"09:00","end":"12:00"}']

  // Behavior
  is_busy_block: boolean;
  can_split: boolean;
  ignore_if_cannot_schedule: boolean;
  is_habit: boolean;
  is_recurring: boolean;
  can_balance_across_days: boolean;

  // Chunking
  min_chunk_duration: number | null;
  max_chunks: number | null;

  // Scheduling
  scheduling_cutoff_weeks: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;

  // Blocked times
  blocked_days: number[] | null;
  blocked_times: string[] | null;

  // Hours override
  scheduling_hours_override: string | null;

  // Appearance
  tags: string[] | null;
  color: string;
  notes: string | null;

  // Skip days
  skip_days: number[] | null;

  // Habit tracking
  streak_count: number;
  completion_history: string[] | null;

  // Google sync
  google_event_id: string | null;
  google_calendar_id: string | null;

  // Scheduling status
  is_scheduled: boolean;
  scheduled_start: string | null;
  scheduled_end: string | null;
}

export interface TimeWindow {
  start: string; // "09:00"
  end: string;   // "12:00"
}

export interface SchedulingSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
}

export interface SchedulingResult {
  taskId: string;
  scheduled: boolean;
  slots: SchedulingSlot[];
  conflicts: string[];
}