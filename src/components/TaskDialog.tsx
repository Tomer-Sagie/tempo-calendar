import { useId, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './ui/button';
import { SubtasksEditor } from './SubtasksEditor';
import { TaskDialogBasics } from './TaskDialogBasics';
import { TaskDialogAdvanced } from './TaskDialogAdvanced';
import type { TaskFormState } from './TaskDialogTypes';
import type { TaskInput } from '../lib/tasks';
import type { TaskList, SchedulingProfile, Subtask, SubtaskInput, SubtaskUpdate } from '../lib/types';

interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: TaskInput) => Promise<void>;
  initial?: Partial<TaskInput>;
  title?: string;
  taskLists?: TaskList[];
  schedulingProfiles?: SchedulingProfile[];
  /** Task id (only set when editing an existing task). Used to anchor
   *  the in-dialog subtasks editor. */
  taskId?: string;
  /**
   * If provided, enables the in-dialog subtasks editor. Only meaningful
   * when editing an existing task (which has an `id`). The host owns
   * the cache and persistence; we render it.
   */
  subtasksProps?: {
    subtasks: Subtask[];
    onAdd: (input: SubtaskInput) => Promise<Subtask>;
    onUpdate: (id: string, updates: SubtaskUpdate) => Promise<Subtask>;
    onRemove: (id: string) => Promise<void>;
    onReorder: (orderedIds: string[]) => Promise<void>;
  };
}

/**
 * Orchestrator for the task editor dialog. Owns the form state, save
 * handler, dialog chrome, in-dialog SubtasksEditor, and the legacy
 * "Expert settings" toggle (the deep knobs: locked, habit, can-split,
 * buffers, deadline, scheduling horizon, preferred time, notes).
 *
 * The user-facing layout is a 2-step progressive disclosure:
 *   - Step 1: <TaskDialogBasics />  (title, duration, due, priority, list)
 *   - Step 2: <TaskDialogAdvanced /> (description, tags, color, days)
 *   - "Expert settings" toggle below for the expert knobs.
 */
export function TaskDialog({ open, onClose, onSave, initial, title, taskLists = [], schedulingProfiles = [], subtasksProps, taskId }: TaskDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [form, setForm] = useState<TaskFormState>(() => ({
    title: initial?.title || '',
    description: initial?.description || '',
    duration_minutes: initial?.duration_minutes || 30,
    priority: (initial?.priority || 'NORMAL') as TaskFormState['priority'],
    frequency: (initial?.frequency || 'once') as TaskFormState['frequency'],
    due_date: initial?.due_date || '',
    color: initial?.color || '#2563EB',
    tags: (initial?.tags || []).join(', '),
    preferred_days: initial?.preferred_days || [],
    is_habit: initial?.is_habit || false,
    can_split: initial?.can_split || false,
    is_busy_block: initial?.is_busy_block || false,
    ignore_if_cannot_schedule: initial?.ignore_if_cannot_schedule || false,
    can_balance_across_days: initial?.can_balance_across_days || false,
    buffer_before_minutes: initial?.buffer_before_minutes || 0,
    buffer_after_minutes: initial?.buffer_after_minutes || 0,
    notes: initial?.notes || '',
    deadline: initial?.deadline || '',
    is_locked: initial?.is_locked || false,
    auto_schedule: initial?.auto_schedule !== false,
    scheduling_cutoff_weeks: initial?.scheduling_cutoff_weeks || 8,
    preferred_time_start: (() => {
      try { return initial?.preferred_time_windows?.[0] ? JSON.parse(initial.preferred_time_windows[0]).start : ''; }
      catch { return ''; }
    })(),
    preferred_time_end: (() => {
      try { return initial?.preferred_time_windows?.[0] ? JSON.parse(initial.preferred_time_windows[0]).end : ''; }
      catch { return ''; }
    })(),
    list_id: initial?.list_id || '',
    scheduling_profile_id: initial?.scheduling_profile_id || '',
  }));

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        title: form.title.trim(),
        description: form.description || undefined,
        duration_minutes: form.duration_minutes,
        priority: form.priority,
        frequency: form.frequency,
        due_date: form.due_date || undefined,
        color: form.color,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        preferred_days: form.preferred_days.length > 0 ? form.preferred_days : undefined,
        is_habit: form.is_habit,
        can_split: form.can_split,
        is_busy_block: form.is_busy_block,
        ignore_if_cannot_schedule: form.ignore_if_cannot_schedule,
        can_balance_across_days: form.can_balance_across_days,
        buffer_before_minutes: form.buffer_before_minutes || undefined,
        buffer_after_minutes: form.buffer_after_minutes || undefined,
        notes: form.notes || undefined,
        deadline: form.deadline || undefined,
        is_locked: form.is_locked,
        auto_schedule: form.auto_schedule,
        scheduling_cutoff_weeks: form.scheduling_cutoff_weeks,
        preferred_time_windows: form.preferred_time_start && form.preferred_time_end
          ? [JSON.stringify({ start: form.preferred_time_start, end: form.preferred_time_end })]
          : undefined,
        list_id: form.list_id || undefined,
        scheduling_profile_id: form.scheduling_profile_id || undefined,
      });
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content p-0"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <div>
              <Dialog.Title id={titleId} className="text-sm font-semibold text-foreground">
                {title || 'New task'}
              </Dialog.Title>
              <Dialog.Description id={descriptionId} className="mt-0.5 text-[11px] text-muted-foreground">
                Define the work and how it should fit into your calendar.
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="p-0.5 rounded hover:bg-accent text-muted-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-5">
            {/* Step 1: core task info */}
            <TaskDialogBasics
              form={form}
              setForm={setForm}
              taskLists={taskLists}
              schedulingProfiles={schedulingProfiles}
            />

            {/* Step 2: personalization (description, tags, color, days) */}
            <TaskDialogAdvanced form={form} setForm={setForm} />

            {/* Subtasks (only when editing an existing task) */}
            {subtasksProps && taskId && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 -mx-1">
                <SubtasksEditor
                  taskId={taskId}
                  subtasks={subtasksProps.subtasks}
                  onAdd={subtasksProps.onAdd}
                  onUpdate={subtasksProps.onUpdate}
                  onRemove={subtasksProps.onRemove}
                  onReorder={subtasksProps.onReorder}
                />
              </div>
            )}

            {/* Expert settings (deep knobs) */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Expert settings
            </button>

            {showAdvanced && (
              <section className="space-y-4 pt-3 border-t border-border">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'is_locked', label: 'Locked' },
                    { key: 'auto_schedule', label: 'Auto-schedule' },
                    { key: 'is_habit', label: 'Habit' },
                    { key: 'can_split', label: 'Can split' },
                    { key: 'is_busy_block', label: 'Busy block' },
                    { key: 'ignore_if_cannot_schedule', label: 'Skip if no slot' },
                    { key: 'can_balance_across_days', label: 'Balance across days' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(form as unknown as Record<string, boolean>)[key]}
                        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.checked }))}
                        className="rounded border-border text-primary focus:ring-ring w-4 h-4"
                      />
                      {label}
                    </label>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1.5">Buffer before (min)</label>
                    <input type="number" value={form.buffer_before_minutes} onChange={(e) => setForm((p) => ({ ...p, buffer_before_minutes: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background" min={0} step={5} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1.5">Buffer after (min)</label>
                    <input type="number" value={form.buffer_after_minutes} onChange={(e) => setForm((p) => ({ ...p, buffer_after_minutes: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background" min={0} step={5} />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Deadline</label>
                  <input type="date" value={form.deadline} onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))} className="w-full px-3 py-2 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1.5">Scheduling horizon (weeks)</label>
                    <input type="number" value={form.scheduling_cutoff_weeks} onChange={(e) => setForm((p) => ({ ...p, scheduling_cutoff_weeks: Math.max(1, parseInt(e.target.value) || 8) }))} className="w-full px-3 py-2 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background" min={1} max={52} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1.5">Preferred time</label>
                    <div className="flex items-center gap-2">
                      <input type="time" value={form.preferred_time_start} onChange={(e) => setForm((p) => ({ ...p, preferred_time_start: e.target.value }))} className="w-full px-2 py-2 text-xs border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background" />
                      <span className="text-xs text-muted-foreground">-</span>
                      <input type="time" value={form.preferred_time_end} onChange={(e) => setForm((p) => ({ ...p, preferred_time_end: e.target.value }))} className="w-full px-2 py-2 text-xs border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Internal notes" className="w-full px-3 py-2 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder-muted-foreground resize-none bg-background" />
                </div>
              </section>
            )}

            {saveError && (
              <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{saveError}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={onClose} className="flex-1 h-10">
                Cancel
              </Button>
              <Button type="submit" disabled={!form.title.trim() || saving} className="flex-1 h-10">
                {saving ? 'Saving...' : initial ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
