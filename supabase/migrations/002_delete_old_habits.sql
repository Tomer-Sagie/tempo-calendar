-- Delete any old stuck habits that couldn't be deleted via UI
-- This fixes the "cannot delete habits" bug
DELETE FROM tasks WHERE is_habit = true;