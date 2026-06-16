import { useMemo } from 'react';
import { format, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import type { CalendarView } from './TempoCalendarHelpers';

interface TempoCalendarHeaderProps {
  /** The currently-displayed date. */
  date: Date;
  /** The active view (drives the title format and the prev/next step). */
  view: CalendarView;
  /** A stable "today" Date so the Today button's highlight is consistent across renders. */
  today: Date;
  /** Switch to a different view (day/week/month). */
  onViewChange: (view: CalendarView) => void;
  /** Move the displayed date backward (1 day, 1 week, or 1 month depending on `view`). */
  onPrev: () => void;
  /** Move the displayed date forward. */
  onNext: () => void;
  /** Snap the displayed date back to today. */
  onToday: () => void;
  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn?: 0 | 1;
}

/**
 * Header strip for the calendar: Today button, prev/next chevrons, the
 * current-period title, and the day/week/month view tabs on the right.
 *
 * Kept as a sibling of TempoCalendar so the orchestrator can stay focused on
 * state + DnD wiring.
 */
export function TempoCalendarHeader({
  date,
  view,
  today,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  weekStartsOn = 1,
}: TempoCalendarHeaderProps) {
  const title = useMemo(() => {
    if (view === 'day') return format(date, 'EEEE, MMMM d');
    if (view === 'week') {
      const ws = startOfWeek(date, { weekStartsOn });
      const we = endOfWeek(date, { weekStartsOn });
      if (ws.getMonth() === we.getMonth()) {
        return `${format(ws, 'MMMM d')} - ${format(we, 'd, yyyy')}`;
      }
      return `${format(ws, 'MMM d')} - ${format(we, 'MMM d, yyyy')}`;
    }
    return format(date, 'MMMM yyyy');
  }, [view, date, weekStartsOn]);

  return (
    <div className="flex items-center gap-2 px-1">
      <button
        onClick={onToday}
        className={cn(
          'h-9 px-3.5 text-xs font-semibold rounded-lg border transition-colors',
          isSameDay(date, today)
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-card border-border text-foreground hover:bg-accent',
        )}
      >
        Today
      </button>

      <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden">
        <button
          onClick={onPrev}
          className="h-9 w-9 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onNext}
          className="h-9 w-9 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors border-l border-border"
          aria-label="Next"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <h2 className="text-base font-semibold text-foreground ml-1 tracking-tight">
        {title}
      </h2>

      <div className="flex-1" />

      <div className="flex items-center bg-card border border-border rounded-lg p-0.5">
        {(['day', 'week', 'month'] as const).map((v) => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            className={cn(
              'h-8 px-3.5 text-xs font-medium rounded-md transition-colors capitalize',
              view === v
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
