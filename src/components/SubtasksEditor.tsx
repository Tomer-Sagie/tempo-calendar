import { useState, useRef } from 'react';
import { Plus, X, GripVertical, Check, RotateCcw } from 'lucide-react';
import type { Subtask, SubtaskInput, SubtaskUpdate } from '../lib/types';

interface SubtasksEditorProps {
  taskId: string;
  subtasks: Subtask[];
  /** Persist a new subtask (server-side). */
  onAdd: (input: SubtaskInput) => Promise<Subtask>;
  /** Persist a subtask patch (server-side). */
  onUpdate: (id: string, updates: SubtaskUpdate) => Promise<Subtask>;
  /** Persist a delete (server-side). */
  onRemove: (id: string) => Promise<void>;
  /** Persist a reordering (server-side). */
  onReorder: (orderedIds: string[]) => Promise<void>;
}

export function SubtasksEditor({ taskId, subtasks, onAdd, onUpdate, onRemove, onReorder }: SubtasksEditorProps) {
  const [draft, setDraft] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const completed = subtasks.filter((s) => s.completed).length;
  const total = subtasks.length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  const handleAdd = async () => {
    const title = draft.trim();
    if (!title) return;
    setPendingId('__pending__');
    try {
      await onAdd({ task_id: taskId, title });
      setDraft('');
      inputRef.current?.focus();
    } finally {
      setPendingId(null);
    }
  };

  const handleToggle = async (sub: Subtask) => {
    setBusyId(sub.id);
    try {
      await onUpdate(sub.id, { completed: !sub.completed });
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (id: string) => {
    setBusyId(id);
    try {
      await onRemove(id);
    } finally {
      setBusyId(null);
    }
  };

  const handleDragStart = (id: string) => (e: React.DragEvent) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (targetId: string) => async (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;
    const ids = subtasks.map((s) => s.id);
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = [...ids];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setDragId(null);
    await onReorder(reordered);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-muted-foreground">
          Subtasks
          {total > 0 && (
            <span className="ml-2 text-[10px] font-normal text-muted-foreground/70">
              {completed} of {total} done
            </span>
          )}
        </label>
        {total > 0 && (
          <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
            {percent}%
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <ul className="space-y-1.5">
        {subtasks.map((s) => {
          const isBusy = busyId === s.id;
          const isDragging = dragId === s.id;
          return (
            <li
              key={s.id}
              draggable
              onDragStart={handleDragStart(s.id)}
              onDragOver={handleDragOver}
              onDrop={handleDrop(s.id)}
              className={`group flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5 transition-all ${
                isDragging ? 'opacity-50 scale-[0.98]' : 'hover:border-primary/30'
              }`}
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/40 group-hover:text-muted-foreground/70 active:cursor-grabbing" />
              <button
                type="button"
                onClick={() => handleToggle(s)}
                disabled={isBusy}
                className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                  s.completed
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground/30 hover:border-primary'
                }`}
                aria-label={s.completed ? 'Mark incomplete' : 'Mark complete'}
              >
                {s.completed && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
              </button>
              <span
                className={`flex-1 min-w-0 text-xs ${
                  s.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                }`}
              >
                {s.title}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(s.id)}
                disabled={isBusy}
                className="shrink-0 p-0.5 rounded text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove subtask"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-2 flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Add a step and press Enter"
          disabled={pendingId !== null}
          className="flex-1 px-2.5 py-1.5 text-xs border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder-muted-foreground bg-background disabled:opacity-60"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!draft.trim() || pendingId !== null}
          className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>
    </section>
  );
}

interface SubtaskProgressChipProps {
  subtasks: Subtask[];
  className?: string;
}

/**
 * Compact "n/m" + dot indicator for use in the task list rows.
 * Renders nothing when there are no subtasks.
 */
export function SubtaskProgressChip({ subtasks, className = '' }: SubtaskProgressChipProps) {
  if (subtasks.length === 0) return null;
  const completed = subtasks.filter((s) => s.completed).length;
  const total = subtasks.length;
  const allDone = completed === total;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0 ${
        allDone
          ? 'bg-primary/15 text-primary'
          : 'bg-muted text-muted-foreground'
      } ${className}`}
      title={`${completed} of ${total} subtasks done`}
    >
      {allDone ? <Check className="h-2.5 w-2.5" /> : <RotateCcw className="h-2.5 w-2.5" />}
      {completed}/{total}
    </span>
  );
}
