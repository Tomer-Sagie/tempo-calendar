import { useMemo } from 'react';
import { format, parseISO, isToday, differenceInMinutes } from 'date-fns';
import { Clock, CheckCircle2, Sun, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Task } from '../lib/types';

interface TodayFocusViewProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onAddTask: () => void;
  onClose: () => void;
  startHour?: number;
  endHour?: number;
  timeFormat?: '12h' | '24h';
}

/**
 * TodayFocusView — a focused timeline view showing only today's scheduled
 * tasks in a vertical timeline layout. Shows current time indicator,
 * task blocks positioned by time, and an empty "free time" visualization.
 */
export function TodayFocusView({
  tasks,
  onSelectTask,
  onAddTask,
  onClose,
  startHour = 6,
  endHour = 22,
  timeFormat = '12h',
}: TodayFocusViewProps) {
  const HOUR_HEIGHT = 64;
  const totalHours = endHour - startHour;

  const todayTasks = useMemo(() => {
    return tasks
      .filter(
        (t) =>
          t.is_scheduled &&
          t.scheduled_start &&
          t.scheduled_end &&
          isToday(parseISO(t.scheduled_start)),
      )
      .sort((a, b) => (a.scheduled_start || '').localeCompare(b.scheduled_start || ''));
  }, [tasks]);

  const completedCount = todayTasks.filter((t) => t.status === 'completed').length;
  const totalMinutes = todayTasks.reduce((sum, t) => sum + t.duration_minutes, 0);

  const now = new Date();
  const nowMinutesFromTop = (now.getHours() - startHour) * 60 + now.getMinutes();
  const nowOffset =
    nowMinutesFromTop >= 0 && nowMinutesFromTop <= totalHours * 60
      ? (nowMinutesFromTop / 60) * HOUR_HEIGHT
      : null;

  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let h = startHour; h <= endHour; h++) arr.push(h);
    return arr;
  }, [startHour, endHour]);

  const formatTime = (h: number) =>
    format(new Date().setHours(h, 0, 0, 0), timeFormat === '24h' ? 'HH:mm' : 'h a');

  const getTaskPosition = (task: Task) => {
    if (!task.scheduled_start || !task.scheduled_end) return null;
    const start = parseISO(task.scheduled_start);
    const end = parseISO(task.scheduled_end);
    const startMinutes = (start.getHours() - startHour) * 60 + start.getMinutes();
    const durationMinutes = differenceInMinutes(end, start);
    return {
      top: Math.max(0, (startMinutes / 60) * HOUR_HEIGHT),
      height: Math.max(32, (durationMinutes / 60) * HOUR_HEIGHT),
    };
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Sun className="w-4 h-4 text-warning" />
            Today
            <span className="text-sm font-normal text-muted-foreground">
              {format(new Date(), 'EEEE, MMM d')}
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {todayTasks.length} task{todayTasks.length !== 1 ? 's' : ''} ·{' '}
            {Math.round(totalMinutes / 60)}h planned · {completedCount} done
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to calendar
        </button>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto tempo-scrollbar">
        {todayTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Nothing scheduled today</p>
            <p className="text-xs text-muted-foreground max-w-[220px] leading-relaxed mb-4">
              Your day is wide open. Add a task and we'll find the right time.
            </p>
            <button
              onClick={onAddTask}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              Add a task
            </button>
          </div>
        ) : (
          <div className="relative px-5 py-4" style={{ height: totalHours * HOUR_HEIGHT + 32 }}>
            {/* Hour lines */}
            {hours.map((h) => (
              <div
                key={h}
                className="absolute left-16 right-0 border-t border-border/30"
                style={{ top: (h - startHour) * HOUR_HEIGHT }}
              >
                <span className="absolute -top-2.5 -left-14 text-[10px] font-medium text-muted-foreground tabular-nums w-12 text-right">
                  {formatTime(h)}
                </span>
              </div>
            ))}

            {/* Now line */}
            {nowOffset !== null && (
              <div
                className="absolute left-14 right-0 z-10 pointer-events-none"
                style={{ top: nowOffset }}
              >
                <div className="relative flex items-center">
                  <div className="w-2 h-2 rounded-full bg-destructive -ml-1" />
                  <div className="flex-1 h-[1.5px] bg-destructive" />
                </div>
              </div>
            )}

            {/* Task blocks */}
            {todayTasks.map((task) => {
              const pos = getTaskPosition(task);
              if (!pos) return null;
              const isCompleted = task.status === 'completed';
              return (
                <button
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className={cn(
                    'absolute left-16 right-4 rounded-lg border-l-[3px] px-3 py-2 text-left transition-all hover:shadow-md cursor-pointer',
                    isCompleted
                      ? 'bg-muted/60 border-muted-foreground/30 opacity-60'
                      : 'bg-primary/10 border-primary',
                  )}
                  style={{ top: pos.top, height: pos.height }}
                >
                  <div className="flex items-center gap-1.5">
                    {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />}
                    <span
                      className={cn(
                        'text-xs font-semibold truncate',
                        isCompleted && 'line-through text-muted-foreground',
                      )}
                    >
                      {task.title}
                    </span>
                  </div>
                  {pos.height > 40 && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                      <Clock className="w-2.5 h-2.5" />
                      <span className="tabular-nums">
                        {task.scheduled_start &&
                          format(parseISO(task.scheduled_start), timeFormat === '24h' ? 'HH:mm' : 'h:mma')}
                        {task.scheduled_end &&
                          ` – ${format(parseISO(task.scheduled_end), timeFormat === '24h' ? 'HH:mm' : 'h:mma')}`}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
