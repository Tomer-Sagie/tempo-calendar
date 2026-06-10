-- Migration 003: Add task lists, scheduling profiles, dependencies, and new task fields
-- Tempo Calendar v2 data model expansion

-- ============================================================
-- 1. New columns on tasks table
-- ============================================================

-- Auto-scheduling toggle (scheduler ignores tasks where auto_schedule = false)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS auto_schedule boolean DEFAULT true;

-- Lock toggle (locked tasks are treated as fixed busy blocks, never moved)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;

-- Completion tracking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Task status: active | completed | missed | skipped
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Foreign key to task lists
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS list_id uuid;

-- Foreign key to scheduling profiles
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduling_profile_id uuid;

-- Whether to sync this task back to external calendars
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sync_to_calendar boolean DEFAULT true;

-- Track last scheduling/missed timestamps for recalculation
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_scheduled_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_missed_at timestamptz;

-- Index on status for filtering
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
CREATE INDEX IF NOT EXISTS tasks_auto_schedule_idx ON tasks(auto_schedule);
CREATE INDEX IF NOT EXISTS tasks_list_id_idx ON tasks(list_id);

-- ============================================================
-- 2. Task lists table
-- ============================================================

CREATE TABLE IF NOT EXISTS task_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS task_lists_sort_order_idx ON task_lists(sort_order);

ALTER TABLE task_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on task_lists" ON task_lists
  FOR ALL USING (true) WITH CHECK (true);

-- Auto-update updated_at on task_lists
CREATE OR REPLACE FUNCTION update_task_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_lists_updated_at
  BEFORE UPDATE ON task_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_task_lists_updated_at();

-- Add foreign key from tasks to task_lists
ALTER TABLE tasks
  ADD CONSTRAINT fk_tasks_list
  FOREIGN KEY (list_id) REFERENCES task_lists(id)
  ON DELETE SET NULL;

-- ============================================================
-- 3. Scheduling profiles table
-- ============================================================

CREATE TABLE IF NOT EXISTS scheduling_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#8b5cf6',
  timezone TEXT DEFAULT 'America/New_York',
  is_default boolean DEFAULT false,
  windows JSONB NOT NULL DEFAULT '[]',
  -- Windows format: [{"day":1,"start":"09:00","end":"17:00"}, ...]
  -- day: 1=Mon..7=Sun (ISO weekday)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE scheduling_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on scheduling_profiles" ON scheduling_profiles
  FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_scheduling_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scheduling_profiles_updated_at
  BEFORE UPDATE ON scheduling_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduling_profiles_updated_at();

-- Add foreign key from tasks to scheduling_profiles
ALTER TABLE tasks
  ADD CONSTRAINT fk_tasks_scheduling_profile
  FOREIGN KEY (scheduling_profile_id) REFERENCES scheduling_profiles(id)
  ON DELETE SET NULL;

-- ============================================================
-- 4. Task dependencies table
-- ============================================================

CREATE TABLE IF NOT EXISTS task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(task_id, depends_on_task_id)
);

-- Prevent self-dependency via trigger
CREATE OR REPLACE FUNCTION prevent_self_dependency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.task_id = NEW.depends_on_task_id THEN
    RAISE EXCEPTION 'Task cannot depend on itself';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_self_dependency
  BEFORE INSERT OR UPDATE ON task_dependencies
  FOR EACH ROW
  EXECUTE FUNCTION prevent_self_dependency();

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS task_dependencies_task_id_idx ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS task_dependencies_depends_on_idx ON task_dependencies(depends_on_task_id);

ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on task_dependencies" ON task_dependencies
  FOR ALL USING (true) WITH CHECK (true);