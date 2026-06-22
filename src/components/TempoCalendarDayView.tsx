import { useEffect, useMemo, useRef } from 'react';
import {
  format,
  isToday,
  isSameDay,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  differenceInMinutes,
} from 'date-fns';
import { DraggableEvent } from './CalendarEvent';
import { cn } from '../lib/utils';
import { CalendarDays } from 'lucide-react';
import {
  useHourHeight,
  getEventsForDay,
  getAllDayEvents,
  positionEvents,
  getContrastText,
  isShortMidnightCrossing,
  type CalendarEventType,
} from './TempoCalendarHelpers';


interface DayViewProps {
  date: Date;
  events: CalendarEventType[];
  startHour: number;
  endHour: number;
  onSelectEvent?: (event: CalendarEventType) => void;
  onSelectSlot?: (slot: { start: Date; end: Date }) => void;
  onCompleteEvent?: (event: CalendarEventType) => void;
  onSkipEvent?: (event: CalendarEventType) => void;
  /** Resize ghost — translucent preview of the new size during resize. */
  resizeGhost?: import('./TempoCalendarHelpers').DragGhostTarget | null;
  /** Start a resize operation on a task event. */
  onResizeStart?: (eventId: string, direction: 'top' | 'bottom', clientY: number) => void;
  /** '12h' (default) or '24h'. */
  timeFormat?: '12h' | '24h';
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
  onCompleteEvent,
  onSkipEvent,
  resizeGhost,
  onResizeStart,
  timeFormat = '12h',
}: DayViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const HOUR_HEIGHT = useHourHeight();
  const nowLineRef = useRef<HTMLDivElement>(null);
  const dayEvents = useMemo(() => getEventsForDay(events, date), [events, date]);
  // Multi-day events that aren't allDay but span multiple days should also
  // appear in the all-day strip rather than being clipped into the time grid.
  // Exception: short midnight-crossing events stay in the time grid.
  const allDayEvents = useMemo(() => {
    const allDay = getAllDayEvents(dayEvents);
    const multiDayTimed = dayEvents.filter(
      (e) => !e.allDay && !isSameDay(e.start, e.end) && !isShortMidnightCrossing(e),
    );
    // Deduplicate (an event could match both) — don't mutate the cached array
    const seen = new Set(allDay.map((e) => e.id));
    const extra = multiDayTimed.filter((ev) => !seen.has(ev.id));
    return [...allDay, ...extra];
  }, [dayEvents]);
  const allDayIds = useMemo(() => new Set(allDayEvents.map((e) => e.id)), [allDayEvents]);
  const timedEvents = useMemo(
    () => dayEvents.filter((e) => !allDayIds.has(e.id)),
    [dayEvents, allDayIds],
  );
  const positioned = useMemo(
    () => positionEvents(timedEvents, date, startHour, HOUR_HEIGHT),
    [timedEvents, date, startHour, HOUR_HEIGHT],
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

    // Update now-line position via RAF instead of forcing re-renders
    const updateNowLine = () => {
      if (!nowLineRef.current) return;
      const n = new Date();
      const mins = (n.getHours() - startHour) * 60 + n.getMinutes();
      if (mins >= 0 && mins <= (endHour - startHour) * 60) {
        nowLineRef.current.style.top = `${(mins / 60) * HOUR_HEIGHT}px`;
        nowLineRef.current.style.display = '';
      } else {
        nowLineRef.current.style.display = 'none';
      }
    };
    const id = setInterval(updateNowLine, 60_000);
    updateNowLine();
    return () => clearInterval(id);
  }, [date, startHour, endHour, HOUR_HEIGHT]);

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
    for (let h = startHour; h < endHour; h++) arr.push(h);
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
    <div className="flex flex-col h-full bg-card rounded-xl border border-border/50 overflow-hidden">
      {/* All-day row */}
      {allDayEvents.length > 0 && (
        <div className="border-b border-border/40 bg-card/50 px-3 py-1.5 flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 shrink-0">All day</span>
          <div className="flex gap-1 flex-wrap">
            {allDayEvents.map((ev) => {
              const evColor = ev.data?.color || '';
              const isLocked = ev.data?.is_locked;
              const isGoogle = ev.data?.source === 'google';
              const isFlexible = !isLocked && !isGoogle && ev.data?.source === 'task';
              return (
                <button
                  key={ev.id}
                  onClick={() => onSelectEvent?.(ev)}
                  className={cn(
                    'px-2 py-0.5 text-[11px] font-medium rounded transition-colors hover:brightness-95 truncate max-w-[200px]',
                    isFlexible && 'all-day-flexible border border-dashed border-muted-foreground/20',
                    !isFlexible && 'border border-solid',
                  )}
                  style={{
                    backgroundColor: evColor ? `${evColor}14` : (isLocked ? 'var(--event-locked)' : 'var(--muted)'),
                    color: evColor ? getContrastText(evColor) : 'var(--foreground)',
                    borderColor: evColor ? `${evColor}40` : (isLocked ? 'var(--event-locked-border)' : 'var(--border)'),
                  }}
                >
                  {ev.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Scrollable time grid — always visible so users can click slots */}
      <div ref={containerRef} className="flex-1 overflow-y-auto tempo-scrollbar relative">
        {/* Subtle empty-state overlay when no events */}
        {events.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-6 bg-card/60 backdrop-blur-[1px] pointer-events-none" role="status">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-3">
              <CalendarDays className="w-5 h-5 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Nothing scheduled today</p>
            <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">
              Click any time slot to create a task. Press <kbd className="inline-flex items-center h-4 px-1 font-mono text-[10px] font-medium bg-muted border border-border rounded mx-0.5">Q</kbd> to quick-add.
            </p>
          </div>
        )}
        <div
          className="relative grid grid-cols-[56px_1fr]"
          style={{ height: (endHour - startHour) * HOUR_HEIGHT }}
        >
          {/* Hour gutter */}
          <div className="border-r border-border/70 bg-card">
            {hours.map((h) => (
              <div key={h} data-hour={h} className="relative border-b border-border/20" style={{ height: HOUR_HEIGHT }}>
                <span className="absolute top-0 right-2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground/60 bg-card px-1 tabular-nums">
                  {format(setHours(date, h), timeFormat === '24h' ? 'HH:mm' : 'h a')}
                </span>
              </div>
            ))}
          </div>

          {/* Event grid */}
          <div className="relative" onClick={handleGridClick}>
            {/* Hour lines */}
            {hours.map((h) => (
              <div key={h} data-hour={h} className="border-b border-border/20" style={{ height: HOUR_HEIGHT }} />
            ))}

            {/* Half-hour lines (subtle) */}
            {hours.slice(0, -1).map((h) => (
              <div
                key={`half-${h}`}
                className="absolute left-0 right-0 h-px bg-border/15 pointer-events-none"
                style={{ top: (h - startHour) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
              />
            ))}

            {/* Now line */}
            {nowOffset !== null && (
              <div ref={nowLineRef} className="absolute left-0 right-0 z-[5] pointer-events-none" style={{ top: nowOffset }}>
                <div className="relative flex items-center">
                  <div
                    className="w-2 h-2 rounded-full bg-primary border-2 border-primary -ml-[4px] now-dot"
                  />
                  <div
                    className="flex-1 h-px bg-primary"
                  />
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
                  onComplete={onCompleteEvent}
                  onSkip={onSkipEvent}
                  draggable={ev.data?.source === 'task' && !ev.data?.is_locked}
                  isLocked={ev.data?.is_locked}
                  onResizeStart={ev.data?.source === 'task' && !ev.data?.is_locked ? (dir, y) => onResizeStart?.(ev.id, dir, y) : undefined}
                  positionStyle={{
                    top: ev.top,
                    height: Math.max(24, ev.height - 2),
                    left,
                    width,
                  }}
                />
              );
            })}

            {/* Resize ghost — translucent preview of new size */}
            {resizeGhost &&
              (() => {
                const visibleStart = setMilliseconds(
                  setSeconds(setMinutes(setHours(date, startHour), 0), 0),
                  0,
                );
                const minutesFromTop = differenceInMinutes(resizeGhost.newStart, visibleStart);
                const durationMin = differenceInMinutes(resizeGhost.newEnd, resizeGhost.newStart);
                const top = Math.max(0, (minutesFromTop / 60) * HOUR_HEIGHT);
                const visibleMaxTop = (endHour - startHour) * HOUR_HEIGHT;
                const height = Math.max(24, Math.min(visibleMaxTop - top, (durationMin / 60) * HOUR_HEIGHT));
                const left = '4px';
                const width = 'calc(100% - 8px)';
                const variantClass =
                  resizeGhost.variant === 'warning'
                    ? 'bg-warning/20 border-warning text-foreground'
                    : resizeGhost.variant === 'destructive'
                    ? 'bg-destructive/20 border-destructive text-foreground'
                    : resizeGhost.variant === 'success'
                    ? 'bg-success/20 border-success text-foreground'
                    : resizeGhost.variant === 'secondary'
                    ? 'bg-event-task/30 border-event-task-border text-foreground'
                    : resizeGhost.variant === 'muted'
                    ? 'bg-muted border-muted-foreground/30 text-foreground'
                    : 'bg-primary/20 border-primary text-foreground';
                return (
                  <div
                    data-resize-ghost="true"
                    className={cn(
                      'absolute z-30 rounded-md border-2 border-dashed pointer-events-none flex flex-col px-1.5 py-1 overflow-hidden',
                      variantClass,
                      'shadow-lg',
                    )}
                    style={{ top, height, left, width }}
                    aria-hidden
                  >
                    <div className="flex items-center gap-1">
                      <span className="font-semibold truncate text-[10px]">{resizeGhost.title}</span>
                    </div>
                    <div data-ghost-time className="text-[9px] opacity-75 num">
                      {format(resizeGhost.newStart, timeFormat === '24h' ? 'HH:mm' : 'h:mma')} - {format(resizeGhost.newEnd, timeFormat === '24h' ? 'HH:mm' : 'h:mma')}
                    </div>
                  </div>
                );
              })()}
          </div>
        </div>
      </div>
    </div>
  );
}
