import { Plus, AlertTriangle } from 'lucide-react';

interface TaskListToolbarProps {
  unscheduledCount: number;
  overdueCount: number;
  completedCount: number;
  showCompleted: boolean;
  onToggleCompleted: () => void;
  onScheduleAll: () => void;
  onAddTask: () => void;
  onBackToCalendar?: () => void;
}

/**
 * Minimal Reclaim-style toolbar — thin border, plain buttons, no heavy chrome.
 */
export function TaskListToolbar({
  unscheduledCount,
  overdueCount,
  completedCount,
  showCompleted,
  onToggleCompleted,
  onScheduleAll,
  onAddTask,
  onBackToCalendar,
}: TaskListToolbarProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
      <div className="flex items-center gap-2 min-w-0">
        {onBackToCalendar && (
          <button
            onClick={onBackToCalendar}
            className="p-1 -ml-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Back to calendar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        )}
        <h2 className="text-[13px] font-semibold text-foreground">Tasks</h2>
        {unscheduledCount > 0 && (
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
            {unscheduledCount}
          </span>
        )}
        {overdueCount > 0 && (
          <span className="text-[11px] font-medium text-destructive flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {overdueCount}
          </span>
        )}
        {completedCount > 0 && (
          <button
            onClick={onToggleCompleted}
            aria-expanded={showCompleted}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {completedCount} done
          </button>
        )}
      </div>
      <div className="flex items-center gap-1">
        {unscheduledCount > 0 && (
          <button
            onClick={onScheduleAll}
            className="h-7 px-2.5 text-[11px] font-medium rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Schedule all
          </button>
        )}
        <button
          onClick={onAddTask}
          className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Add task"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
