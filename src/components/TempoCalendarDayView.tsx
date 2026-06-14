import { useEffect, useMemo, useRef, useState } from 'react';
import {
  format,
  isToday,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
} from 'date-fns';
import { DraggableEvent } from './CalendarEvent';
import {
  HOUR_HEIGHT,
  getEventsForDay,
  getAllDayEvents,
  positionEvents,
  type CalendarEventType,
} from './TempoCalendarHelpers';

interface DayViewProps {
  date: Date;
  events: CalendarEventType[];
  startHour: number;
  endHour: number;
  onSelectEvent?: (event: CalendarEventType) => void;
  onSelectSlot?: (slot: { start: Date; end: Date }) => void;
}

/**
 * Single-day grid: hour gutter on the left, all-day strip on top, the
 * time grid on the right with half-hour lines, a "now" line when the
 * displayed day is today, and positioned events.
 *
 * Sibling of TempoCalendar (the orchestrator). Receives only what it needs.
 */
export function TempoCalendarDayView({
  date,
  events,
  startHour,
  endHour,
  onSelectEvent,
  onSelectSlot,
}: DayViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);
  const dayEvents = useMemo(() => getEventsForDay(events, date), [events, date]);
  const allDayEvents = useMemo(() => getAllDayEvents(dayEvents), [dayEvents]);
  const timedEvents = useMemo(() => dayEvents.filter((e) => !e.allDay), [dayEvents]);
  const positioned = useMemo(
    () => positionEvents(timedEvents, date, startHour),
    [timedEvents, date, startHour],
  );

  // Scroll to current time on mount and tick every minute
  useEffect(() => {
    if (!containerRef.current) return;
    const now = new Date();
    if (!isToday(date)) {
      containerRef.current.scrollTop = 0;
      return;
    }
    const minutesFromTop = Math.max(0, (now.getHours() - startHour) * 60 + now.getMinutes());
    const target = (minutesFromTop / 60) * HOUR_HEIGHT - 80;
    containerRef.current.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });

    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [date, startHour]);

  // Now line (computed inline — cheap, no need to memoize)
  const nowOffset = isToday(date)
    ? (() => {
        const now = new Date();
        const minutesFromTop = (now.getHours() - startHour) * 60 + now.getMinutes();
        if (minutesFromTop < 0 || minutesFromTop > (endHour - startHour) * 60) return null;
        return (minutesFromTop / 60) * HOUR_HEIGHT;
      })()
    : null;

  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let h = startHour; h <= endHour; h++) arr.push(h);
    return arr;
  }, [startHour, endHour]);

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSelectSlot) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top + (containerRef.current?.scrollTop || 0);
    const hour = Math.min(endHour - 1, Math.max(startHour, Math.floor(y / HOUR_HEIGHT) + startHour));
    const minute = Math.round((y % HOUR_HEIGHT) / HOUR_HEIGHT * 60 / 15) * 15;
    const start = setMilliseconds(setSeconds(setMinutes(setHours(date, hour), minute), 0), 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    onSelectSlot({ start, end });
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* All-day row */}
      {allDayEvents.length > 0 && (
        <div className="border-b border-border bg-muted/20 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground shrink-0">All day</span>
          <div className="flex gap-1.5">
            {allDayEvents.map((ev) => (
              <button
                key={ev.id}
                onClick={() => onSelectEvent?.(ev)}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-accent hover:bg-accent/70 text-foreground transition-colors truncate max-w-[200px]"
              >
                {ev.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scrollable time grid */}
      <div ref={containerRef} className="flex-1 overflow-y-auto tempo-scrollbar">
        <div
          className="relative grid grid-cols-[64px_1fr]"
          style={{ height: (endHour - startHour) * HOUR_HEIGHT }}
        >
          {/* Hour gutter */}
          <div className="border-r border-border bg-card">
            {hours.map((h) => (
              <div key={h} className="relative h-14 border-b border-border/40">
                <span className="absolute top-0 right-3 -translate-y-1/2 text-[10px] font-medium text-muted-foreground bg-card px-1 tabular-nums">
                  {format(setHours(date, h), 'h a')}
                </span>
              </div>
            ))}
          </div>

          {/* Event grid */}
          <div className="relative" onClick={handleGridClick}>
            {/* Hour lines */}
            {hours.map((h) => (
              <div key={h} className="h-14 border-b border-border/40" />
            ))}

            {/* Half-hour lines (subtle) */}
            {hours.slice(0, -1).map((h) => (
              <div
                key={`half-${h}`}
                className="absolute left-0 right-0 h-px bg-border/30 pointer-events-none"
                style={{ top: (h - startHour) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
              />
            ))}

            {/* Now line */}
            {nowOffset !== null && (
              <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: nowOffset }}>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-primary -ml-1 shadow-[0_0_0_4px_oklch(1_0_0)]" />
                  <div className="flex-1 h-px bg-primary/60" />
                </div>
              </div>
            )}

            {/* Events */}
            {positioned.map((ev) => {
              const width =
                ev.totalColumns > 0
                  ? `calc((100% - 8px) / ${ev.totalColumns})`
                  : 'calc(100% - 8px)';
              const left =
                ev.totalColumns > 0
                  ? `calc(4px + (100% - 8px) * ${ev.column} / ${ev.totalColumns})`
                  : '4px';
              return (
                <DraggableEvent
                  key={ev.id}
                  event={ev}
                  onClick={(e) => onSelectEvent?.(e)}
                  draggable={ev.data?.source === 'task' && !ev.data?.is_locked}
                  isLocked={ev.data?.is_locked}
                  positionStyle={{
                    top: ev.top,
                    height: Math.max(24, ev.height - 2),
                    left,
                    width,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

