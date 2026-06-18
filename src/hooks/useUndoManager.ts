import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { Task } from '../lib/types';
import { updateTask } from '../lib/tasks';

interface UndoSnapshot {
  /** Task states keyed by task id. Only tasks whose schedule changed. */
  tasksById: Map<string, Pick<Task, 'id' | 'is_scheduled' | 'scheduled_start' | 'scheduled_end' | 'is_locked'>>;
  /** Human-readable action label (e.g. "3 tasks rescheduled"). */
  label: string;
}

/**
 * Simple depth-1 undo manager for scheduling actions.
 *
 * Before a destructive scheduling operation the caller captures the
 * current task state via `capture(tasks, label)`. After the operation
 * completes, `showToast()` renders a Sonner toast with an Undo button.
 * Clicking Undo iterates the captured snapshot and reverts each task's
 * schedule fields via `updateTask`, then calls `onRestore()` to
 * refresh the local state.
 *
 * Only the most recent snapshot is retained (depth: 1) per the spec:
 *   "Last auto-schedule action only. Simple undo stack (depth: 1)."
 */
export function useUndoManager() {
  const snapshotRef = useRef<UndoSnapshot | null>(null);

  /**
   * Capture a snapshot of ALL active tasks' scheduling state before a
   * scheduling action. This includes both scheduled and unscheduled
   * tasks so that a full "Schedule All" can be cleanly undone.
   */
  const capture = useCallback((tasks: Task[], label: string) => {
    const tasksById = new Map<string, Pick<Task, 'id' | 'is_scheduled' | 'scheduled_start' | 'scheduled_end' | 'is_locked'>>();
    for (const t of tasks) {
      if (t.status === 'active') {
        tasksById.set(t.id, {
          id: t.id,
          is_scheduled: t.is_scheduled,
          scheduled_start: t.scheduled_start,
          scheduled_end: t.scheduled_end,
          is_locked: t.is_locked,
        });
      }
    }
    snapshotRef.current = { tasksById, label };
  }, []);

  /**
   * Show a Sonner toast with an Undo button for the last captured snapshot.
   * If no snapshot exists this is a no-op.
   *
   * @param opts.onRestore Called after the DB revert completes so the
   *                       host can refresh its local state.
   * @param opts.label     Optional override for the toast label (e.g.
   *                       "5 tasks scheduled"). When omitted the label
   *                       passed to `capture()` is used.
   */
  const showToast = useCallback((opts: { onRestore: () => Promise<void>; label?: string }) => {
    const snap = snapshotRef.current;
    if (!snap) return;
    // Clear the snapshot so a second showToast() is harmless.
    const snapToRestore = snap;
    snapshotRef.current = null;

    const displayLabel = opts.label ?? snapToRestore.label;
    toast.success(displayLabel, {
      description: 'Click Undo to revert.',
      action: {
        label: 'Undo',
        onClick: async () => {
          try {
            // Revert each task's schedule fields to the captured state.
            const reverts: Promise<unknown>[] = [];
            for (const [id, prev] of snapToRestore.tasksById) {
              reverts.push(
                updateTask(id, {
                  is_scheduled: prev.is_scheduled,
                  scheduled_start: prev.scheduled_start,
                  scheduled_end: prev.scheduled_end,
                  is_locked: prev.is_locked,
                }),
              );
            }
            await Promise.all(reverts);
            toast.success('Undone', { description: 'Tasks reverted to their previous state.' });
          } catch (err) {
            toast.error('Could not undo', {
              description: err instanceof Error ? err.message : 'Unknown error',
            });
          }
          // Always refresh local state regardless of revert outcome.
          try { await opts.onRestore(); } catch { /* refresh failure is non-critical */ }
        },
      },
      duration: 8000,
    });
  }, []);

  /**
   * Discard any pending snapshot (e.g. if no tasks were actually moved).
   */
  const clear = useCallback(() => {
    snapshotRef.current = null;
  }, []);

  return { capture, showToast, clear };
}
