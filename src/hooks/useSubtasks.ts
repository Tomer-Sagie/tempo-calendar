import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchSubtasks,
  createSubtask as createSubtaskApi,
  updateSubtask as updateSubtaskApi,
  deleteSubtask as deleteSubtaskApi,
  reorderSubtasks as reorderSubtasksApi,
} from '../lib/subtasks';
import type { Subtask, SubtaskInput, SubtaskUpdate } from '../lib/types';

interface UseSubtasksReturn {
  subtasks: Subtask[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  add: (input: SubtaskInput) => Promise<Subtask>;
  update: (id: string, updates: SubtaskUpdate) => Promise<Subtask>;
  remove: (id: string) => Promise<void>;
  reorder: (orderedIds: string[]) => Promise<void>;
}

/**
 * Manages subtasks for a single parent task. Keeps an optimistic local
 * cache so the UI is responsive; rolls back on error.
 */
export function useSubtasks(taskId: string | null | undefined): UseSubtasksReturn {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!taskId) {
      setSubtasks([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSubtasks(taskId);
      if (mountedRef.current) {
        setSubtasks(data);
        setIsLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load subtasks');
        setIsLoading(false);
      }
    }
  }, [taskId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async (input: SubtaskInput): Promise<Subtask> => {
    setError(null);
    const created = await createSubtaskApi(input);
    if (mountedRef.current) {
      setSubtasks((prev) => [...prev, created].sort((a, b) => a.sort_order - b.sort_order));
    }
    return created;
  }, []);

  const update = useCallback(async (id: string, updates: SubtaskUpdate): Promise<Subtask> => {
    setError(null);
    const previous = subtasks.find((s) => s.id === id);
    if (mountedRef.current) {
      setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    }
    try {
      const updated = await updateSubtaskApi(id, updates);
      if (mountedRef.current) {
        setSubtasks((prev) => prev.map((s) => (s.id === id ? updated : s)));
      }
      return updated;
    } catch (err) {
      if (previous && mountedRef.current) {
        setSubtasks((prev) => prev.map((s) => (s.id === id ? previous : s)));
      }
      throw err;
    }
  }, [subtasks]);

  const remove = useCallback(async (id: string): Promise<void> => {
    setError(null);
    const previous = subtasks;
    if (mountedRef.current) {
      setSubtasks((prev) => prev.filter((s) => s.id !== id));
    }
    try {
      await deleteSubtaskApi(id);
    } catch (err) {
      if (mountedRef.current) setSubtasks(previous);
      throw err;
    }
  }, [subtasks]);

  const reorder = useCallback(async (orderedIds: string[]): Promise<void> => {
    setError(null);
    const previous = subtasks;
    if (mountedRef.current) {
      const rank = new Map(orderedIds.map((id, idx) => [id, idx] as const));
      setSubtasks((prev) =>
        [...prev].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
          .map((s, idx) => ({ ...s, sort_order: idx }))
      );
    }
    try {
      if (taskId) await reorderSubtasksApi(taskId, orderedIds);
    } catch (err) {
      if (mountedRef.current) setSubtasks(previous);
      throw err;
    }
  }, [subtasks, taskId]);

  return { subtasks, isLoading, error, refresh, add, update, remove, reorder };
}
