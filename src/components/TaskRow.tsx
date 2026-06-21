import { memo, useState, useRef } from 'react';
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
  const menuRef = useRef<HTMLDivElement>(null);
  const [unscheduling, setUnscheduling] = useState(false);

  const isOverdue =
    task.is_scheduled &&
    task.scheduled_end &&
    new Date(task.scheduled_end) < new Date() &&
    task.status === 'active';

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-accent/30 transition-colors group animate-slide-up">
      {/* Completion checkbox */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onComplete(task.id);
        }}
        disabled={isCompleting}
        className={`shrink-0 w-5 h-5 rounded-md border-[1.5px] flex items-center justify-center transition-all duration-150 ${
          isCompleting
            ? 'border-primary bg-primary/20'
            : 'border-muted-foreground/30 hover:border-primary hover:bg-primary/10'
        }`}
        aria-label="Complete task"
      >
        {isCompleting ? (
          <svg className="w-4 h-4 animate-checkmark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" fill="oklch(var(--primary) / 0.15)" stroke="var(--primary)" />
            <polyline points="7 12 10.5 15.5 17 9" stroke="var(--primary)" />
          </svg>
        ) : (
          <Check className="w-3 h-3 text-primary opacity-0 group-hover:opacity-50 transition-opacity" />
        )}
      </button>



      {/* Content */}
      <button
        type="button"
        className="flex-1 min-w-0 text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onEdit(task)}
      >
        <div className="flex items-center gap-1.5">
          <span className={`text-[13px] font-medium truncate ${isOverdue ? 'text-destructive' : 'text-foreground'}`}>
            {task.title}
          </span>
          {task.is_recurring && (
            <Repeat className="w-3 h-3 text-muted-foreground/50 shrink-0" />
          )}
          {task.is_habit && task.streak_count > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-warning">
              <Flame className="w-2.5 h-2.5 fill-warning/40" />
              {task.streak_count}
            </span>
          )}
          {subtasks && <SubtaskProgressChip subtasks={subtasks} />}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[12px] text-muted-foreground">{task.duration_minutes}m</span>
          {task.due_date && !task.is_recurring && (
            <span className="text-[12px] text-muted-foreground">{format(parseISO(task.due_date), 'MMM d')}</span>
          )}
          {(() => {
            const urgency = getUrgencyBadge(task);
            return urgency ? (
              <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${urgency.className}`}>
                {urgency.label}
              </span>
            ) : null;
          })()}
          {isScheduled && task.scheduled_start && (
            <span className="text-[11px] text-success">{format(parseISO(task.scheduled_start), 'h:mm a')}</span>
          )}
        </div>
      </button>

      {/* Actions */}
      <div className="relative shrink-0" ref={menuRef as React.RefObject<HTMLDivElement>}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!menuOpen) {
              const rect = e.currentTarget.getBoundingClientRect();
              setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
            }
            setMenuOpen(!menuOpen);
          }}
          className="p-1 rounded-md hover:bg-accent text-muted-foreground transition-colors sm:opacity-0 sm:group-hover:opacity-100"
          aria-label="More actions"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
            <div
              className="fixed w-44 bg-popover border border-border rounded-lg shadow-lg z-50 py-1 animate-slide-down"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(task); setMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
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
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Unschedule
                </button>
              )}
              {task.is_recurring && onSkipNext && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSkipNext(task.id); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                >
                  <SkipForward className="w-4 h-4" />
                  Skip next
                </button>
              )}
              <div className="border-t border-border my-1" />
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); setMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
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
  const menuRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-accent/30 transition-colors group animate-slide-up">
      {/* Completed checkmark */}
      <div className="shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
        <Check className="w-3 h-3 text-primary-foreground" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate text-muted-foreground line-through">
            {task.title}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="relative shrink-0" ref={menuRef as React.RefObject<HTMLDivElement>}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!menuOpen) {
              const rect = e.currentTarget.getBoundingClientRect();
              setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
            }
            setMenuOpen(!menuOpen);
          }}
          className="p-1 rounded-md hover:bg-accent text-muted-foreground transition-colors sm:opacity-0 sm:group-hover:opacity-100"
          aria-label="More actions"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
            <div className="fixed w-44 bg-popover border border-border rounded-lg shadow-lg z-50 py-1 animate-slide-down" style={{ top: menuPos.top, right: menuPos.right }}>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  setReopening(true);
                  await onReopen(task.id);
                  setReopening(false);
                  setMenuOpen(false);
                }}
                disabled={reopening}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                Reopen
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); setMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
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
