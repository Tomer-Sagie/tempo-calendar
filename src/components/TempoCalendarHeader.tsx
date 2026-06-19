import { useMemo, useState, useRef, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, ChevronDown, Check, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';
import type { CalendarView } from './TempoCalendarHelpers';
import type { GoogleCalendar } from '../lib/google';

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
  /** Google calendars for the inline picker. */
  calendars?: GoogleCalendar[];
  selectedCalendarIds?: string[];
  onToggleCalendar?: (calendarId: string) => void;
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
  calendars = [],
  selectedCalendarIds = [],
  onToggleCalendar,
}: TempoCalendarHeaderProps) {
  const [showCalPicker, setShowCalPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!showCalPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowCalPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCalPicker]);
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
    <div className="flex items-center gap-2">
      <button
        onClick={onToday}
        className={cn(
          'h-8 px-3 text-[11px] font-medium rounded-md border transition-colors',
          isSameDay(date, today)
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-card border-border text-foreground hover:bg-accent',
        )}
      >
        Today
      </button>

      <div className="flex items-center">
        <button
          onClick={onPrev}
          className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onNext}
          className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <h2 className="text-sm font-semibold text-foreground ml-0.5 tracking-tight">
        {title}
      </h2>

      <div className="flex-1" />

      {/* Calendar picker — inline dropdown when multiple Google calendars exist */}
      {calendars.length > 0 && onToggleCalendar && (
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowCalPicker((v) => !v)}
            className="h-8 px-2.5 flex items-center gap-1.5 text-[11px] font-medium rounded-md border border-border bg-card text-foreground hover:bg-accent transition-colors"
            aria-label="Select calendars"
            aria-expanded={showCalPicker}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{selectedCalendarIds.length > 0 ? `${selectedCalendarIds.length} cal` : 'Calendars'}</span>
            <ChevronDown className={cn('w-3 h-3 transition-transform', showCalPicker && 'rotate-180')} />
          </button>
          {showCalPicker && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 animate-slide-down" role="menu" aria-label="Select calendars">
              <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Synced calendars
              </div>
              {calendars.map((cal) => {
                const isSelected = selectedCalendarIds.includes(cal.id);
                return (
                  <button
                    key={cal.id}
                    onClick={() => { onToggleCalendar(cal.id); }}
                    role="menuitemcheckbox"
                    aria-checked={isSelected}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors"
                  >
                    <div
                      className="w-3 h-3 rounded-sm shrink-0 border"
                      style={{
                        backgroundColor: isSelected ? (cal.backgroundColor || '#999') : 'transparent',
                        borderColor: cal.backgroundColor || '#999',
                      }}
                    />
                    <span className="flex-1 text-left truncate">
                      {cal.summary}
                      {cal.primary && (
                        <span className="ml-1 text-[10px] text-muted-foreground">(primary)</span>
                      )}
                    </span>
                    {isSelected && <Check className="w-3 h-3 text-primary shrink-0" />}
                  </button>
                );
              })}
              <div className="border-t border-border mt-1 pt-1 px-3 pb-1">
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Toggle calendars to import as busy blocks.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center bg-muted/60 rounded-lg p-0.5">
        {(['day', 'week', 'month'] as const).map((v) => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            className={cn(
              'h-7 px-3 text-[11px] font-medium rounded-md transition-colors capitalize',
              view === v
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
