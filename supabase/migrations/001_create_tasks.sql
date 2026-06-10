-- Create tasks table for Tempo Calendar
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Basic fields
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,

  -- Due/deadline
  due_date DATE,
  due_time TIME,
  deadline TIMESTAMP WITH TIME ZONE,

  -- Priority: ASAP, HIGH, NORMAL, LOW
  priority TEXT DEFAULT 'NORMAL',

  -- Frequency
  frequency TEXT DEFAULT 'once',  -- once, daily, weekly, custom
  preferred_days INTEGER[],  -- [1,2,3] = Mon,Wed,Fri (1-7 for Mon-Sun)

  -- Time preferences (JSON array: [{"start":"09:00","end":"12:00"}])
  preferred_time_windows TEXT[],

  -- Behavior flags
  is_busy_block BOOLEAN DEFAULT false,
  can_split BOOLEAN DEFAULT false,
  ignore_if_cannot_schedule BOOLEAN DEFAULT false,
  is_habit BOOLEAN DEFAULT false,
  is_recurring BOOLEAN DEFAULT false,
  can_balance_across_days BOOLEAN DEFAULT false,

  -- Chunking
  min_chunk_duration INTEGER,
  max_chunks INTEGER,

  -- Scheduling
  scheduling_cutoff_weeks INTEGER DEFAULT 4,
  buffer_before_minutes INTEGER DEFAULT 0,
  buffer_after_minutes INTEGER DEFAULT 0,

  -- Blocked times (JSON array: [{"start":"13:00","end":"14:00"}])
  blocked_days INTEGER[],
  blocked_times TEXT[],

  -- Scheduling hours override (JSON: {"weekday":[],"weekend":[]})
  scheduling_hours_override TEXT,

  -- Appearance
  tags TEXT[],
  color TEXT DEFAULT '#3b82f6',
  notes TEXT,

  -- Skip days (for habits, array of dates)
  skip_days INTEGER[],

  -- Habit tracking
  streak_count INTEGER DEFAULT 0,
  completion_history DATE[],

  -- Google Calendar sync
  google_event_id TEXT,
  google_calendar_id TEXT,

  -- Scheduling status
  is_scheduled BOOLEAN DEFAULT false,
  scheduled_start TIMESTAMP WITH TIME ZONE,
  scheduled_end TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks(due_date);
CREATE INDEX IF NOT EXISTS tasks_priority_idx ON tasks(priority);
CREATE INDEX IF NOT EXISTS tasks_scheduled_idx ON tasks(is_scheduled);
CREATE INDEX IF NOT EXISTS tasks_frequency_idx ON tasks(frequency);
CREATE INDEX IF NOT EXISTS tasks_is_habit_idx ON tasks(is_habit);

-- Enable Row Level Security (but allow all operations for personal use)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for personal use (no auth required)
CREATE POLICY "Allow all on tasks" ON tasks
  FOR ALL USING (true) WITH CHECK (true);

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();