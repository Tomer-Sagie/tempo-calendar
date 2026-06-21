import { memo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MoreHorizontal,
  Trash2,
  ExternalLink,
  XCircle,
  Check,
  RotateCcw,
  Flame,
  Repeat,
  SkipForward,
} from 'lucide-react';
import { SubtaskProgressChip } from './SubtasksEditor';
import type { Task, Subtask } from '../lib/types';
import { format, parseISO, isToday, isTomorrow, differenceInDays } from 'date-fns';

// ============================================================
// Shared helpers (used by both TaskRow variants below).
// ============================================================

function getUrgencyBadge(task: Task): { label: string; className: string } | null {
  if (!task.due_date) return null;
  const due = parseISO(task.due_date);
  if (isToday(due)) return { label: 'Due today', className: 'bg-destructive/10 text-destructive' };
  if (isTomorrow(due)) return { label: 'Tomorrow', className: 'bg-warning/10 text-warning' };
  const days = differenceInDays(due, new Date());
  if (days <= 3 && days >= 0) return { label: `${days}d left`, className: 'bg-warning/10 text-warning' };
  if (days < 0) return { label: 'Overdue', className: 'bg-overdue/10 text-overdue' };
  return null;
}

// ============================================================
// Active task row (completion checkbox, priority dot, content,
// action menu with Edit / Unschedule / Delete + confirm-delete flow).
// ============================================================

export interface TaskRowProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onUnschedule: (id: string) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  isScheduled?: boolean;
  isCompleting?: boolean;
  subtasks?: Subtask[];
  /** Called when the user skips the next occurrence of a recurring task. */
  onSkipNext?: (taskId: string) => void;
}

export const TaskRow = memo(function TaskRow({
  task,
  onEdit,
  onDelete,
  onUnschedule,
  onComplete,
  isScheduled,
  isCompleting,
  subtasks,
  onSkipNext,
}: TaskRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [unscheduling, setUnscheduling] = useState(false);

  const isOverdue =
    task.is_scheduled &&
    task.scheduled_end &&
    new Date(task.scheduled_end) < new Date() &&
    task.status === 'active';

  return (
    <div className="virtual-list-row flex items-center gap-2 px-3 py-2 hover:bg-accent/30 transition-colors group animate-slide-up">
      {/* Inline complete button — subtle, hover-revealed */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onComplete(task.id);
        }}
        disabled={isCompleting}
        className={`shrink-0 w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-150 ${
          isCompleting
            ? 'border-primary bg-primary/30 scale-110'
            : 'border-muted-foreground/20 opacity-0 group-hover:opacity-100 hover:border-primary hover:bg-primary/15'
        }`}
        aria-label="Complete task"
      >
        {isCompleting && <Check className="w-2.5 h-2.5 text-primary" />}
      </button>

      {/* Content */}
      <button
        type="button"
        className="flex-1 min-w-0 text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onEdit(task)}
      >
        <div className="flex items-center gap-1.5">
          <span className={`text-[12px] font-medium truncate ${isOverdue ? 'text-destructive' : 'text-foreground'}`}>
            {task.title}
          </span>
          {task.is_recurring && (
            <Repeat className="w-2.5 h-2.5 text-muted-foreground/40 shrink-0" />
          )}
          {task.is_habit && task.streak_count > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-warning/60">
              <Flame className="w-2 h-2" />
              {task.streak_count}
            </span>
          )}
          {subtasks && <SubtaskProgressChip subtasks={subtasks} />}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-muted-foreground/60">{task.duration_minutes}m</span>
          {task.due_date && !task.is_recurring && (
            <span className="text-[10px] text-muted-foreground/60">{format(parseISO(task.due_date), 'MMM d')}</span>
          )}
          {isScheduled && task.scheduled_start && (
            <span className="text-[10px] text-success/70">{format(parseISO(task.scheduled_start), 'h:mm a')}</span>
          )}
          {(() => {
            const urgency = getUrgencyBadge(task);
            return urgency ? (
              <span className="text-[10px] text-muted-foreground/60">
                {urgency.label}
              </span>
            ) : null;
          })()}
        </div>
      </button>

      {/* Actions — hover-only, portal menu */}
      <div className="relative shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!menuOpen) {
              const rect = e.currentTarget.getBoundingClientRect();
              setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
            }
            setMenuOpen(!menuOpen);
          }}
          className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
          aria-label="More actions"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
        {menuOpen && createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
            <div
              className="fixed w-40 bg-popover border border-border/50 rounded-md shadow-md z-50 py-0.5 animate-scale-in"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(task); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-foreground hover:bg-accent transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Edit
              </button>
              {isScheduled && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    setUnscheduling(true);
                    await onUnschedule(task.id);
                    setUnscheduling(false);
                    setMenuOpen(false);
                  }}
                  disabled={unscheduling}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Unschedule
                </button>
              )}
              {task.is_recurring && onSkipNext && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSkipNext(task.id); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-foreground hover:bg-accent transition-colors"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  Skip next
                </button>
              )}
              <div className="border-t border-border/40 my-0.5" />
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-destructive hover:bg-destructive/5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </>,
          document.body,
        )}
      </div>
    </div>
  );
});

// ============================================================
// Completed task row (read-only summary + Reopen / Delete menu).
// ============================================================

export interface CompletedTaskRowProps {
  task: Task;
  onReopen: (id: string) => Promise<void>;
  onDelete: (id: string) => void;
}

export const CompletedTaskRow = memo(function CompletedTaskRow({ task, onReopen, onDelete }: CompletedTaskRowProps) {
  const [reopening, setReopening] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  return (
    <div className="virtual-list-row flex items-center gap-2 px-3 py-2 hover:bg-accent/30 transition-colors group animate-slide-up">
      <div className="shrink-0 w-4 h-4 rounded-full bg-success/30 flex items-center justify-center">
        <Check className="w-2.5 h-2.5 text-success" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[12px] text-muted-foreground/60 line-through truncate block">
          {task.title}
        </span>
      </div>
      <div className="relative shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!menuOpen) {
              const rect = e.currentTarget.getBoundingClientRect();
              setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
            }
            setMenuOpen(!menuOpen);
          }}
          className="p-0.5 rounded text-muted-foreground/30 hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
          aria-label="More actions"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
        {menuOpen && createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
            <div className="fixed w-36 bg-popover border border-border/50 rounded-md shadow-md z-50 py-0.5 animate-scale-in" style={{ top: menuPos.top, right: menuPos.right }}>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  setReopening(true);
                  await onReopen(task.id);
                  setReopening(false);
                  setMenuOpen(false);
                }}
                disabled={reopening}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-foreground hover:bg-accent transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reopen
              </button>
              <div className="border-t border-border/40 my-0.5" />
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-destructive hover:bg-destructive/5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </>,
          document.body,
        )}
      </div>
    </div>
  );
});
