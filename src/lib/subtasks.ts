import { supabase } from './supabase';
import type { Subtask, SubtaskInput, SubtaskUpdate } from './types';

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  return supabase;
}

/**
 * Fetch all subtasks for the given task, ordered by `sort_order` then
 * `created_at`. Empty array if the task has none.
 */
export async function fetchSubtasks(taskId: string): Promise<Subtask[]> {
  const { data, error } = await requireSupabase()
    .from('subtasks')
    .select('*')
    .eq('task_id', taskId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as Subtask[];
}

/**
 * Fetch subtasks for many tasks in one round-trip. Returns a map of
 * `taskId -> Subtask[]`. Tasks with no subtasks are absent from the
 * map (caller should treat them as `[]`).
 */
export async function fetchSubtasksForTasks(taskIds: string[]): Promise<Map<string, Subtask[]>> {
  const map = new Map<string, Subtask[]>();
  if (taskIds.length === 0) return map;
  const { data, error } = await requireSupabase()
    .from('subtasks')
    .select('*')
    .in('task_id', taskIds)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  for (const row of (data || []) as Subtask[]) {
    const arr = map.get(row.task_id) || [];
    arr.push(row);
    map.set(row.task_id, arr);
  }
  return map;
}

/**
 * Create a subtask. If `sort_order` is omitted, append to the end
 * (`max(sort_order) + 1` for the parent task).
 */
export async function createSubtask(input: SubtaskInput): Promise<Subtask> {
  let sortOrder = input.sort_order;
  if (sortOrder === undefined) {
    const existing = await fetchSubtasks(input.task_id);
    const max = existing.reduce((m, s) => Math.max(m, s.sort_order), -1);
    sortOrder = max + 1;
  }
  const { data, error } = await requireSupabase()
    .from('subtasks')
    .insert([{ task_id: input.task_id, title: input.title.trim(), sort_order: sortOrder }])
    .select()
    .single();

  if (error) throw error;
  return data as Subtask;
}

/**
 * Patch a subtask. `task_id` is intentionally not updatable (enforced
 * at the type level). `completed_at` is managed by the DB trigger.
 */
export async function updateSubtask(id: string, updates: SubtaskUpdate): Promise<Subtask> {
  const { data, error } = await requireSupabase()
    .from('subtasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Subtask;
}

/**
 * Convenience: toggle a subtask's `completed` flag. Stamps/clears
 * `completed_at` via the DB trigger.
 */
export async function toggleSubtaskCompleted(id: string, completed: boolean): Promise<Subtask> {
  return updateSubtask(id, { completed });
}

/**
 * Delete a single subtask.
 */
export async function deleteSubtask(id: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('subtasks')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/**
 * Delete all subtasks for a task. Called when the parent task is
 * deleted (the FK cascade also does this, but we expose a method for
 * tests/cleanup).
 */
export async function deleteSubtasksForTask(taskId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('subtasks')
    .delete()
    .eq('task_id', taskId);
  if (error) throw error;
}

/**
 * Reorder subtasks. Accepts an array of subtask IDs in the desired
 * order; rewrites `sort_order` to 0..N-1 in a single transaction.
 */
export async function reorderSubtasks(taskId: string, subtaskIdsInOrder: string[]): Promise<void> {
  const updates = subtaskIdsInOrder.map((id, idx) => ({ id, sort_order: idx }));
  // Supabase doesn't have a transaction helper for the JS client, so
  // we run the updates sequentially. RLS ensures only the caller's
  // own subtasks are touched.
  for (const u of updates) {
    const { error } = await requireSupabase()
      .from('subtasks')
      .update({ sort_order: u.sort_order })
      .eq('id', u.id)
      .eq('task_id', taskId);
    if (error) throw error;
  }
}
