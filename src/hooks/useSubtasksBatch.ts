import { useEffect, useState, useRef, useCallback } from 'react';
import { fetchSubtasksForTasks, updateSubtask, deleteSubtask } from '../lib/subtasks';
import type { Subtask } from '../lib/types';

/**
 * Load subtasks for many tasks in a single round-trip and keep the
 * map in sync with optimistic mutations. Returns the map and a few
 * mutators that mirror what the in-dialog editor needs.
 */
export function useSubtasksBatch(taskIds: string[]) {
  const [byTaskId, setByTaskId] = useState<Map<string, Subtask[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(false);
  const key = taskIds.slice().sort().join('|');

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (taskIds.length === 0) {
        if (mountedRef.current) setByTaskId(new Map());
        return;
      }
      setIsLoading(true);
      try {
        const map = await fetchSubtasksForTasks(taskIds);
        if (!cancelled && mountedRef.current) {
          setByTaskId(map);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled && mountedRef.current) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const refresh = useCallback(async () => {
    if (taskIds.length === 0) return;
    const map = await fetchSubtasksForTasks(taskIds);
    if (mountedRef.current) setByTaskId(map);
  }, [taskIds.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Optimistic toggle used by the list-row chip. */
  const toggle = useCallback(async (taskId: string, subtaskId: string, completed: boolean) => {
    // Optimistic local update
    setByTaskId((prev) => {
      const next = new Map(prev);
      const arr = (next.get(taskId) || []).map((s) =>
        s.id === subtaskId ? { ...s, completed, completed_at: completed ? new Date().toISOString() : null } : s
      );
      next.set(taskId, arr);
      return next;
    });
    try {
      const updated = await updateSubtask(subtaskId, { completed });
      setByTaskId((prev) => {
        const next = new Map(prev);
        const arr = (next.get(taskId) || []).map((s) => (s.id === subtaskId ? updated : s));
        next.set(taskId, arr);
        return next;
      });
    } catch {
      // Roll back on error by re-fetching
      refresh();
      throw new Error('Could not update subtask');
    }
  }, [refresh]);

  const remove = useCallback(async (taskId: string, subtaskId: string) => {
    setByTaskId((prev) => {
      const next = new Map(prev);
      const arr = (next.get(taskId) || []).filter((s) => s.id !== subtaskId);
      next.set(taskId, arr);
      return next;
    });
    try {
      await deleteSubtask(subtaskId);
    } catch {
      refresh();
      throw new Error('Could not delete subtask');
    }
  }, [refresh]);

  return { byTaskId, isLoading, refresh, toggle, remove };
}
