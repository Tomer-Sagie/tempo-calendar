import { useState, useMemo } from 'react';
import { modKey } from '../lib/utils';
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
  onScheduleAll: () => void;
  isScheduling?: boolean;
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
          'group relative flex items-center gap-2 rounded-lg border bg-card transition-all',
          focused ? 'border-primary/40 shadow-sm' : 'border-border hover:border-muted-foreground/20',
        )}
      >
        <div className="pl-3 text-muted-foreground">
          <Plus className={cn('w-4 h-4 transition-transform', focused && 'rotate-90 text-primary')} />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Quick add task..."
          className="flex-1 bg-transparent py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {value.trim() && (
          <button
            type="submit"
            className="mr-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors animate-scale-in"
          >
            Add
          </button>
        )}
        <button
          type="button"
          onClick={onAdvanced}
          className="mr-1.5 p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="More options — or try natural language: Buy milk tomorrow !high #errands ~30m"
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>
      </form>
      {!focused && !value && (
        <div className="flex items-center gap-2 mt-1.5 px-1">
          <kbd className="inline-flex items-center h-4 px-1 font-mono text-[9px] font-medium text-muted-foreground bg-muted border border-border rounded">
            Q
          </kbd>
          <span className="text-[10px] text-muted-foreground/60">to quick add</span>
          <span className="text-muted-foreground/30">·</span>
          <kbd className="inline-flex items-center h-4 px-1 font-mono text-[9px] font-medium text-muted-foreground bg-muted border border-border rounded">
            {modKey}+K
          </kbd>
          <span className="text-[10px] text-muted-foreground/60">command palette</span>
        </div>
      )}
    </>
  );
}

// ============================================================
// TaskPreview — small task row for the sidebar
// ============================================================

const PRIORITY_DOTS: Record<string, string> = {
  ASAP: 'bg-destructive',
  HIGH: 'bg-warning',
  NORMAL: 'bg-muted-foreground/40',
  LOW: 'bg-muted-foreground/20',
};

function TaskPreview({ task, onClick }: { task: Task; onClick: () => void }) {
  const due = task.due_date ? parseISO(task.due_date) : null;
  let dueLabel: string | null = null;
  let dueClass = 'text-muted-foreground';
  if (due) {
    if (isToday(due)) {
      dueLabel = 'Today';
      dueClass = 'text-destructive font-semibold';
    } else if (isTomorrow(due)) {
      dueLabel = 'Tomorrow';
      dueClass = 'text-warning font-medium';
    } else if (isPast(due)) {
      dueLabel = 'Overdue';
      dueClass = 'text-overdue font-semibold';
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
      className="w-full flex items-center gap-2 py-1.5 px-1 -mx-1 rounded-md hover:bg-accent/40 transition-colors text-left group"
    >
      <span
        className={cn('w-1.5 h-1.5 rounded-full shrink-0', PRIORITY_DOTS[task.priority] || 'bg-muted-foreground/20')}
        style={task.color ? { backgroundColor: task.color } : undefined}
      />
      <span className="flex-1 min-w-0 text-[13px] text-foreground truncate font-medium">{task.title}</span>
      <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">{task.duration_minutes}m</span>
      {dueLabel && (
        <span className={cn('text-[10px] shrink-0 tabular-nums', dueClass)}>{dueLabel}</span>
      )}
      <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
  onScheduleAll,
  isScheduling,
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
      <div className="px-3 py-2.5 border-b border-border/50">
        <QuickAdd onSubmit={onQuickAdd} onAdvanced={onAddTask} />
      </div>

      {/* Unscheduled tasks — the main content of the sidebar */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            Unscheduled
            {unscheduled.length > 0 && (
              <span className="text-foreground/40 tabular-nums">{unscheduled.length}</span>
            )}
          </div>
          {unscheduled.length > 0 && (
            <button
              onClick={onScheduleAll}
              disabled={isScheduling}
              className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {isScheduling ? (
                <>
                  <span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  Planning
                </>
              ) : (
                <>Schedule all</>
              )}
            </button>
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
