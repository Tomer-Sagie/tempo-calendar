import { useState, useRef, useEffect } from 'react';
import { Plus, Clock, Calendar, MoreHorizontal, Trash2, ExternalLink, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import type { Task } from '../lib/types';
import { format, parseISO } from 'date-fns';

interface TaskListProps {
  tasks: Task[];
  isLoading: boolean;
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onScheduleAll: () => Promise<void>;
  onUnschedule: (id: string) => Promise<void>;
}

const PRIORITY_DOTS: Record<string, string> = {
  ASAP: 'bg-destructive',
  HIGH: 'bg-warning',
  NORMAL: 'bg-muted-foreground/40',
  LOW: 'bg-muted-foreground/20',
};

export function TaskList({
  tasks, isLoading, onAddTask, onEditTask, onDeleteTask, onScheduleAll, onUnschedule,
}: TaskListProps) {
  const priorityRank: Record<string, number> = { ASAP: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
  const unscheduled = tasks
    .filter((t) => !t.is_scheduled)
    .sort((a, b) => {
      const byPriority = (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
      if (byPriority !== 0) return byPriority;
      return (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31');
    });
  const scheduled = tasks
    .filter((t) => t.is_scheduled)
    .sort((a, b) => (a.scheduled_start || '').localeCompare(b.scheduled_start || ''));
  const overdueCount = tasks.filter(t =>
    t.is_scheduled && t.scheduled_end && new Date(t.scheduled_end) < new Date() && t.status === 'active'
  ).length;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-semibold text-foreground">Tasks</h2>
          {unscheduled.length > 0 && (
            <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-md">
              {unscheduled.length}
            </span>
          )}
          {overdueCount > 0 && (
            <span className="text-xs font-medium bg-overdue/10 text-overdue px-2 py-0.5 rounded-md flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {overdueCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unscheduled.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onScheduleAll} className="h-8 px-3 text-xs">
              Schedule all
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onAddTask} className="h-8 w-8" title="Add task">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No tasks yet</p>
            <p className="text-sm text-muted-foreground mb-5 max-w-[200px] leading-relaxed">
              Add something you want to get done. We'll find the right time for it.
            </p>
            <Button size="sm" onClick={onAddTask} className="h-9 gap-2 px-4">
              <Plus className="w-4 h-4" />
              New task
            </Button>
          </div>
        )}

        {unscheduled.length > 0 && (
          <div>
            <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/40">
              Unscheduled
            </div>
            {unscheduled.map((task) => (
              <TaskRow key={task.id} task={task} onEdit={onEditTask} onDelete={onDeleteTask} onUnschedule={onUnschedule} />
            ))}
          </div>
        )}

        {scheduled.length > 0 && (
          <div>
            <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/40">
              Scheduled
            </div>
            {scheduled.map((task) => (
              <TaskRow key={task.id} task={task} onEdit={onEditTask} onDelete={onDeleteTask} onUnschedule={onUnschedule} isScheduled />
            ))}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <div className="w-3.5 h-3.5 border-2 border-border border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onUnschedule: (id: string) => Promise<void>;
  isScheduled?: boolean;
}

function TaskRow({ task, onEdit, onDelete, onUnschedule, isScheduled }: TaskRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [unscheduling, setUnscheduling] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menuOpen]);

  const isOverdue = task.is_scheduled && task.scheduled_end && new Date(task.scheduled_end) < new Date() && task.status === 'active';

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors group">
      {/* Priority indicator */}
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOTS[task.priority] || 'bg-muted-foreground/20'}`} />

      {/* Content */}
      <button
        type="button"
        className="flex-1 min-w-0 text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onEdit(task)}
      >
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-medium truncate ${isOverdue ? 'text-overdue' : 'text-foreground'}`}>
            {task.title}
          </span>
          {task.is_locked && (
            <span className="text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded-md shrink-0">locked</span>
          )}
          {task.is_habit && (
            <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md shrink-0">habit</span>
          )}
        </div>
        <div className="flex items-center gap-2.5 mt-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {task.duration_minutes}m
          </span>
          {task.due_date && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {format(parseISO(task.due_date), 'MMM d')}
            </span>
          )}
          {isScheduled && task.scheduled_start && (
            <span className="text-xs text-success flex items-center gap-1">
              {format(parseISO(task.scheduled_start), 'MMM d, h:mm a')}
            </span>
          )}
        </div>
      </button>

      {/* Actions */}
      <div className="relative shrink-0" ref={menuRef}>          <button
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setMenuPosition({
                top: rect.bottom + 4,
                right: window.innerWidth - rect.right,
              });
              setConfirmDelete(false);
              setMenuOpen(!menuOpen);
            }}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors sm:opacity-60 sm:group-hover:opacity-100"
            aria-label="More actions"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        {menuOpen && (
          <div
            className="fixed w-44 bg-popover border border-border rounded-lg shadow-lg z-50 py-1 animate-slide-down"
            style={{ top: menuPosition.top, right: menuPosition.right }}
          >
            {confirmDelete ? (
              <div className="p-3">
                <p className="mb-3 text-sm leading-snug text-foreground">Delete this task?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(task.id);
                      setConfirmDelete(false);
                      setMenuOpen(false);
                    }}
                    className="flex-1 rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                    className="flex-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
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
                <div className="border-t border-border my-1" />
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
