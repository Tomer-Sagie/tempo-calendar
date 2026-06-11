-- Migration 004: Add user_id columns and auth isolation
-- Tempo Calendar multi-user support

-- ============================================================
-- 1. Add user_id to tasks table
-- ============================================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing rows to set a placeholder user_id if needed
-- Note: This will leave existing rows without user_id until a user is assigned
-- In production, you'd need a migration strategy for existing data

CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks(user_id);

-- ============================================================
-- 2. Add user_id to task_lists table
-- ============================================================

ALTER TABLE task_lists ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS task_lists_user_id_idx ON task_lists(user_id);

-- ============================================================
-- 3. Add user_id to scheduling_profiles table
-- ============================================================

ALTER TABLE scheduling_profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS scheduling_profiles_user_id_idx ON scheduling_profiles(user_id);

-- ============================================================
-- 4. Add user_id to task_dependencies table (via denormalized lookup)
-- ============================================================
-- Note: task_dependencies inherits user_id via task_id -> tasks.user_id
-- We add it for direct RLS filtering

ALTER TABLE task_dependencies ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS task_dependencies_user_id_idx ON task_dependencies(user_id);

-- ============================================================
-- 5. Create user_settings table
-- ============================================================

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone TEXT DEFAULT 'America/New_York',
  default_scheduling_profile_id UUID REFERENCES scheduling_profiles(id) ON DELETE SET NULL,
  default_view TEXT DEFAULT 'week',
  theme_preference TEXT DEFAULT 'system',
  notification_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS user_settings_user_id_idx ON user_settings(user_id);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User settings are user-private" ON user_settings
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Auto-update updated_at on user_settings
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();

-- ============================================================
-- 6. Update RLS policies for tasks
-- ============================================================

DROP POLICY IF EXISTS "Allow all on tasks" ON tasks;

CREATE POLICY "Tasks are user-private" ON tasks
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 7. Update RLS policies for task_lists
-- ============================================================

DROP POLICY IF EXISTS "Allow all on task_lists" ON task_lists;

CREATE POLICY "Task lists are user-private" ON task_lists
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 8. Update RLS policies for scheduling_profiles
-- ============================================================

DROP POLICY IF EXISTS "Allow all on scheduling_profiles" ON scheduling_profiles;

CREATE POLICY "Scheduling profiles are user-private" ON scheduling_profiles
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 9. Update RLS policies for task_dependencies
-- ============================================================

DROP POLICY IF EXISTS "Allow all on task_dependencies" ON task_dependencies;

CREATE POLICY "Task dependencies are user-private" ON task_dependencies
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 10. Trigger to auto-set user_id on insert
-- ============================================================

CREATE OR REPLACE FUNCTION set_user_id_from_auth()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tasks
DROP TRIGGER IF EXISTS tasks_set_user_id ON tasks;
CREATE TRIGGER tasks_set_user_id
  BEFORE INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id_from_auth();

-- Apply trigger to task_lists
DROP TRIGGER IF EXISTS task_lists_set_user_id ON task_lists;
CREATE TRIGGER task_lists_set_user_id
  BEFORE INSERT ON task_lists
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id_from_auth();

-- Apply trigger to scheduling_profiles
DROP TRIGGER IF EXISTS scheduling_profiles_set_user_id ON scheduling_profiles;
CREATE TRIGGER scheduling_profiles_set_user_id
  BEFORE INSERT ON scheduling_profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id_from_auth();

-- Apply trigger to task_dependencies
DROP TRIGGER IF EXISTS task_dependencies_set_user_id ON task_dependencies;
CREATE TRIGGER task_dependencies_set_user_id
  BEFORE INSERT ON task_dependencies
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id_from_auth();

-- ============================================================
-- 11. Trigger to auto-create user_settings on signup
-- ============================================================

CREATE OR REPLACE FUNCTION create_user_settings_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on auth.users after insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_settings_on_signup();

-- ============================================================
-- 12. Grant permissions to authenticated users
-- ============================================================

-- These are needed for the trigger to work properly
GRANT ALL ON tasks TO authenticated;
GRANT ALL ON task_lists TO authenticated;
GRANT ALL ON scheduling_profiles TO authenticated;
GRANT ALL ON task_dependencies TO authenticated;
GRANT ALL ON user_settings TO authenticated;
