import { useState, useMemo } from 'react';
import { SidebarSkeleton } from './ui/skeleton';
import {
  parseISO,
  isToday,
  isTomorrow,
  differenceInDays,
  isPast,
  format,
} from 'date-fns';
import {
  Plus,
  CheckCircle2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { Task } from '../lib/types';

interface BentoSidebarProps {
  tasks: Task[];
  isLoading?: boolean;
  onQuickAdd: (title: string) => void;
  onAddTask: () => void;
  onSelectTask: (task: Task) => void;
  onViewAllTasks: () => void;
}

// ============================================================
// QuickAdd — inline task creation
// ============================================================

function QuickAdd({ onSubmit, onAdvanced }: { onSubmit: (title: string) => void; onAdvanced: () => void }) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue('');
  };

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className={cn(
          'group relative flex items-center gap-2 rounded-md border bg-card transition-all',
          focused ? 'border-primary/30' : 'border-border/40 hover:border-border',
        )}
      >
        <div className="pl-2.5 text-muted-foreground/40">
          <Plus className={cn('w-3.5 h-3.5 transition-transform', focused && 'rotate-90 text-primary')} />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Quick add task..."
          aria-label="Quick add task"
          className="flex-1 bg-transparent py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
        />
        {value.trim() && (
          <button
            type="submit"
            className="mr-1 px-2 py-0.5 text-[11px] font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors animate-scale-in"
          >
            Add
          </button>
        )}
        <button
          type="button"
          onClick={onAdvanced}
          className="mr-1 p-1 rounded text-muted-foreground/40 hover:text-foreground hover:bg-accent transition-colors"
          title="More options"
        >
          <Sparkles className="w-3 h-3" />
        </button>
      </form>
    </>
  );
}

// ============================================================
// TaskPreview — small task row for the sidebar
// ============================================================

function TaskPreview({ task, onClick }: { task: Task; onClick: () => void }) {
  const due = task.due_date ? parseISO(task.due_date) : null;
  let dueLabel: string | null = null;
  let dueClass = '';
  if (due) {
    if (isToday(due)) {
      dueLabel = 'Today';
      dueClass = 'text-destructive font-medium';
    } else if (isTomorrow(due)) {
      dueLabel = 'Tomorrow';
      dueClass = 'text-warning font-medium';
    } else if (isPast(due)) {
      dueLabel = 'Overdue';
      dueClass = 'text-overdue font-medium';
    } else {
      const days = differenceInDays(due, new Date());
      if (days <= 7) {
        dueLabel = format(due, 'EEE');
      } else {
        dueLabel = format(due, 'MMM d');
      }
    }
  }

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 py-1.5 px-1 rounded hover:bg-accent/30 transition-colors text-left group"
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: task.color || 'var(--muted-foreground)', opacity: task.color ? 1 : 0.3 }}
      />
      <span className="flex-1 min-w-0 text-[12px] text-foreground truncate">{task.title}</span>
      {dueLabel && (
        <span className={`text-[10px] shrink-0 tabular-nums ${dueClass || 'text-muted-foreground/50'}`}>{dueLabel}</span>
      )}
      <ChevronRight className="w-3 h-3 text-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ============================================================
// Main BentoSidebar
// ============================================================

export function BentoSidebar({
  tasks,
  isLoading,
  onQuickAdd,
  onAddTask,
  onSelectTask,
  onViewAllTasks,
}: BentoSidebarProps) {
  const activeTasks = useMemo(() => tasks.filter((t) => t.status === 'active'), [tasks]);
  const unscheduled = useMemo(() => activeTasks.filter((t) => !t.is_scheduled), [activeTasks]);

  const topUnscheduled = useMemo(() => {
    const rank: Record<string, number> = { ASAP: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
    return [...unscheduled]
      .sort((a, b) => {
        const pr = (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
        if (pr !== 0) return pr;
        return (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31');
      })
      .slice(0, 8);
  }, [unscheduled]);

  return (
    <div className="flex flex-col h-full">
      {/* Quick add */}
      <div className="px-3 py-2 border-b border-border/40">
        <QuickAdd onSubmit={onQuickAdd} onAdvanced={onAddTask} />
      </div>

      {/* Unscheduled tasks — the main content of the sidebar */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
            Unscheduled
          </span>
          {unscheduled.length > 0 && (
            <span className="text-[10px] text-muted-foreground/40 tabular-nums">{unscheduled.length}</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-1.5 tempo-scrollbar">
          {isLoading ? (
            <SidebarSkeleton />
          ) : topUnscheduled.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-8 h-8 rounded-md bg-success/10 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
              </div>
              <p className="text-[13px] font-medium text-foreground">All scheduled</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Add a task above and we'll find time.
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {topUnscheduled.map((t) => (
                <TaskPreview key={t.id} task={t} onClick={() => onSelectTask(t)} />
              ))}
              {unscheduled.length > topUnscheduled.length && (
                <button
                  onClick={onViewAllTasks}
                  className="w-full text-left text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1.5 px-1 -mx-1 mt-1"
                >
                  View all {unscheduled.length} tasks →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
