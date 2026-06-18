import { useCallback, useEffect, useRef, useState } from 'react';
import { addDays, addMonths, addWeeks, subDays, subMonths, subWeeks, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
} from '@dnd-kit/core';
import { computeEventDrop } from '../lib/drag';
import { cn } from '../lib/utils';
import { TempoCalendarHeader } from './TempoCalendarHeader';
import { TempoCalendarDayView } from './TempoCalendarDayView';
import { TempoCalendarWeekView } from './TempoCalendarWeekView';
import { TempoCalendarMonthView } from './TempoCalendarMonthView';
import { getHourHeight } from './TempoCalendarHelpers';
import type {
  CalendarEventType,
  CalendarView,
  DayColumnWidthRef,
  DragGhostTarget,
} from './TempoCalendarHelpers';

// Re-export shared types so existing consumers (App.tsx, CalendarEvent.tsx)
// don't need to change their imports.
export type {
  CalendarEventType,
  CalendarEventVariant,
  CalendarView,
  DayColumnWidthRef,
  DragGhostTarget,
} from './TempoCalendarHelpers';

export interface TempoCalendarProps {
  events: CalendarEventType[];
  /** Show skeleton loading state instead of the calendar grid. */
  isLoading?: boolean;
  defaultView?: CalendarView;
  onSelectEvent?: (event: CalendarEventType) => void;
  onSelectSlot?: (slot: { start: Date; end: Date }) => void;
  onEventDrop?: (eventId: string, newStart: Date, newEnd: Date) => void;
  /** Resize a task by dragging top or bottom edge */
  onEventResize?: (eventId: string, newStart: Date, newEnd: Date) => void;
  /**
   * Called whenever the visible calendar range changes (date, view, or
   * navigation). The parent can use this to generate recurring task
   * occurrences for the exact window the user is looking at instead of a
   * hardcoded global range.
   */
  onViewRangeChange?: (range: { start: Date; end: Date }) => void;
  /** When this date reference changes, the calendar navigates to it. */
  navigateToDate?: Date;
  className?: string;
  startHour?: number;
  endHour?: number;
  height?: number | string;
  /** 0 = Sunday, 1 = Monday (default). Persisted in localStorage. */
  weekStartsOn?: 0 | 1;
  /** '12h' (default) or '24h'. Persisted in localStorage. */
  timeFormat?: '12h' | '24h';
}

/**
 * TempoCalendar — a day/week/month calendar with drag-and-drop event moves.
 *
 * The orchestrator owns the cross-view state (date, view, drag ghost) and
 * the DnD wiring. Sibling files own the per-view rendering:
 *   - TempoCalendarHeader    — Today + prev/next + title + view tabs
 *   - TempoCalendarDayView   — single-day grid
 *   - TempoCalendarWeekView  — 7-day grid + drag-ghost preview
 *   - TempoCalendarMonthView — month grid
 *
 * Shared types and helpers (HOUR_HEIGHT, getEventsForDay, positionEvents,
 * CalendarEventType, etc.) live in TempoCalendarHelpers.ts and are
 * re-exported here for backward-compat with `App.tsx` and
 * `CalendarEvent.tsx`.
 */
/**
 * Calendar skeleton — grey placeholder blocks shown during initial load.
 */
function CalendarSkeleton({ startHour, endHour }: { startHour: number; endHour: number }) {
  const hh = getHourHeight();
  const hours: number[] = [];
  for (let h = startHour; h <= endHour; h++) hours.push(h);
  return (
    <div className="flex flex-col h-full bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-[64px_1fr]" style={{ height: (endHour - startHour) * hh }}>
          <div className="border-r border-border">
            {hours.map((h) => (
              <div key={h} className="border-b border-border/40" style={{ height: hh }}>
                <div className="skeleton w-8 h-3 ml-auto mr-3 mt-1" />
              </div>
            ))}
          </div>
          <div className="relative">
            {hours.map((h) => (
              <div key={h} className="border-b border-border/30" style={{ height: hh }} />
            ))}
            {[0.15, 0.35, 0.55, 0.7].map((pos, i) => (
              <div
                key={i}
                className="absolute left-2 right-4 skeleton rounded-md"
                style={{ top: `${pos * 100}%`, height: i % 2 === 0 ? 48 : 32, opacity: 0.5 - i * 0.08 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TempoCalendar({
  events,
  isLoading,
  defaultView = 'week',
  onSelectEvent,
  onSelectSlot,
  onEventDrop,
  onEventResize,
  onViewRangeChange,
  navigateToDate,
  className,
  startHour = 6,
  endHour = 22,
  weekStartsOn = 1,
  timeFormat = '12h',
}: TempoCalendarProps) {
  const [view, setView] = useState<CalendarView>(defaultView);
  const [date, setDate] = useState<Date>(new Date());

  // Navigate to an externally-requested date (e.g. keyboard shortcut "T" for today)
  const prevNavigateRef = useRef(navigateToDate);
  useEffect(() => {
    if (navigateToDate && navigateToDate !== prevNavigateRef.current) {
      setDate(navigateToDate);
    }
    prevNavigateRef.current = navigateToDate;
  }, [navigateToDate]);

  // today is read fresh each render so the "Today" button stays accurate
  // if the app is open across midnight. Cheap enough to not memoize.
  const today = new Date();
  // Mutable ref the WeekView writes to on mount/resize; the drag handler
  // reads from it to convert horizontal pixel deltas into day offsets.
  const dayColumnWidthRef = useRef<number>(0) as DayColumnWidthRef;

  // Notify parent of visible range changes so recurring occurrences
  // can be generated for the exact window the user is looking at.
  useEffect(() => {
    if (!onViewRangeChange) return;
    let start: Date;
    let end: Date;
    if (view === 'day') {
      start = startOfDay(date);
      end = endOfDay(date);
    } else if (view === 'week') {
      start = startOfWeek(date, { weekStartsOn });
      end = endOfWeek(date, { weekStartsOn });
    } else {
      start = startOfMonth(date);
      end = endOfMonth(date);
    }
    onViewRangeChange({ start, end });
  }, [date, view, onViewRangeChange, weekStartsOn]);

  const handlePrev = useCallback(() => {
    if (view === 'day') setDate((d) => subDays(d, 1));
    else if (view === 'week') setDate((d) => subWeeks(d, 1));
    else setDate((d) => subMonths(d, 1));
  }, [view]);

  const handleNext = useCallback(() => {
    if (view === 'day') setDate((d) => addDays(d, 1));
    else if (view === 'week') setDate((d) => addWeeks(d, 1));
    else setDate((d) => addMonths(d, 1));
  }, [view]);

  const handleToday = useCallback(() => setDate(new Date()), []);

  const handleMonthDayClick = useCallback((day: Date) => {
    setDate(day);
    setView('day');
  }, []);

  // Drag-and-drop: 5px activation distance to avoid hijacking clicks
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  /**
   * Live ghost target computed on every drag-move. `null` when sub-threshold
   * or when the event is unknown — the WeekView hides the overlay accordingly.
   */
  const [dragGhost, setDragGhost] = useState<DragGhostTarget | null>(null);

  // Resize state: tracks which event is being resized, from which edge,
  // and the initial position. The actual ghost is computed in a document
  // mousemove listener so it stays smooth even when the cursor leaves the
  // calendar grid.
  const [resizeState, setResizeState] = useState<{
    eventId: string;
    direction: 'top' | 'bottom';
    initialStart: Date;
    initialEnd: Date;
    startY: number;
    hourHeight: number;
  } | null>(null);
  const [resizeGhost, setResizeGhost] = useState<DragGhostTarget | null>(null);
  const resizeGhostRef = useRef(resizeGhost);
  useEffect(() => { resizeGhostRef.current = resizeGhost; }, [resizeGhost]);

  const handleResizeStart = useCallback((eventId: string, direction: 'top' | 'bottom', clientY: number) => {
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;
    setResizeState({
      eventId,
      direction,
      initialStart: new Date(ev.start),
      initialEnd: new Date(ev.end),
      startY: clientY,
      hourHeight: getHourHeight(),
    });
  }, [events]);

  // Document-level mousemove/mouseup for resize — stays active even when
  // the cursor leaves the calendar grid.
  useEffect(() => {
    if (!resizeState) return;
    const MIN_DURATION_MINUTES = 15;    const onMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizeState.startY;
      const deltaMinutes = Math.round(deltaY / resizeState.hourHeight * 60 / 15) * 15;
      let newStart = new Date(resizeState.initialStart);
      let newEnd = new Date(resizeState.initialEnd);
      if (resizeState.direction === 'top') {
        // Dragging the top edge down (positive delta) moves start later (shorter).
        // Dragging up (negative delta) moves start earlier (longer).
        newStart = new Date(resizeState.initialStart.getTime() + deltaMinutes * 60 * 1000);
        // Clamp: start cannot go past end minus minimum duration
        const maxStart = new Date(resizeState.initialEnd.getTime() - MIN_DURATION_MINUTES * 60 * 1000);
        if (newStart > maxStart) newStart = maxStart;
      } else {
        // Dragging the bottom edge down (positive delta) moves end later (longer).
        // Dragging up (negative delta) moves end earlier (shorter).
        newEnd = new Date(resizeState.initialEnd.getTime() + deltaMinutes * 60 * 1000);
        // Clamp: end cannot go before start plus minimum duration
        const minEnd = new Date(resizeState.initialStart.getTime() + MIN_DURATION_MINUTES * 60 * 1000);
        if (newEnd < minEnd) newEnd = minEnd;
      }
      const ev = events.find((e) => e.id === resizeState.eventId);
      if (ev) {
        setResizeGhost({
          eventId: resizeState.eventId,
          newStart,
          newEnd,
          title: ev.title,
          variant: ev.variant,
        });
      }
    };
    const onMouseUp = () => {
      const ghost = resizeGhostRef.current;
      if (ghost && resizeState) {
        const durationMin = (ghost.newEnd.getTime() - ghost.newStart.getTime()) / (60 * 1000);
        if (durationMin >= MIN_DURATION_MINUTES) {
          onEventResize?.(resizeState.eventId, ghost.newStart, ghost.newEnd);
        }
      }
      setResizeState(null);
      setResizeGhost(null);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [resizeState, events, onEventResize]);

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const ev =
        event.active.data?.current?.event ??
        events.find((e) => e.id === String(event.active.id));
      if (!ev) {
        setDragGhost(null);
        return;
      }
      const result = computeEventDrop({
        start: ev.start,
        end: ev.end,
        deltaX: event.delta.x,
        deltaY: event.delta.y,
        hourHeight: getHourHeight(),
        dayColumnWidth: dayColumnWidthRef.current,
        view,
      });
      if (!result) {
        setDragGhost(null);
        return;
      }
      setDragGhost({
        eventId: ev.id,
        newStart: result.newStart,
        newEnd: result.newEnd,
        title: ev.title,
        variant: ev.variant,
      });
    },
    [events, view],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDragGhost(null);
      if (!onEventDrop) return;
      const id = String(event.active.id);
      const ev = events.find((e) => e.id === id);
      if (!ev) return;
      // Pure-function drag math; see src/lib/drag.ts for snapping rules.
      const result = computeEventDrop({
        start: ev.start,
        end: ev.end,
        deltaX: event.delta.x,
        deltaY: event.delta.y,
        hourHeight: getHourHeight(),
        dayColumnWidth: dayColumnWidthRef.current,
        view,
      });
      if (!result) return;
      onEventDrop(id, result.newStart, result.newEnd);
    },
    [events, onEventDrop, view],
  );

  const handleDragCancel = useCallback(() => setDragGhost(null), []);

  return (
    <div className={cn('flex flex-col h-full gap-3', className)}>
      <TempoCalendarHeader
        date={date}
        view={view}
        today={today}
        onViewChange={setView}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        weekStartsOn={weekStartsOn}
      />

      {/* View — skeleton during initial load, calendar grid once events arrive */}
      {isLoading ? (
        <div className="flex-1 min-h-0">
          <CalendarSkeleton startHour={startHour} endHour={endHour} />
        </div>
      ) : (
      <DndContext
        sensors={sensors}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex-1 min-h-0">
          {view === 'day' && (
            <div className="h-full animate-fade-in" key="day">
              <TempoCalendarDayView
                date={date}
                events={events}
                startHour={startHour}
                endHour={endHour}
                onSelectEvent={onSelectEvent}
                onSelectSlot={onSelectSlot}
                resizeGhost={resizeGhost}
                onResizeStart={handleResizeStart}
                timeFormat={timeFormat}
              />
            </div>
          )}
          {view === 'week' && (
            <div className="h-full animate-fade-in" key="week">
              <TempoCalendarWeekView
                date={date}
                events={events}
                startHour={startHour}
                endHour={endHour}
                onSelectEvent={onSelectEvent}
                onSelectSlot={onSelectSlot}
                dayColumnWidthRef={dayColumnWidthRef}
                dragGhost={dragGhost}
                resizeGhost={resizeGhost}
                onResizeStart={handleResizeStart}
                weekStartsOn={weekStartsOn}
                timeFormat={timeFormat}
              />
            </div>
          )}
          {view === 'month' && (
            <div className="h-full animate-fade-in" key="month">
              <TempoCalendarMonthView
                date={date}
                events={events}
                onSelectEvent={onSelectEvent}
                onSelectDay={handleMonthDayClick}
                weekStartsOn={weekStartsOn}
              />
            </div>
          )}
        </div>
      </DndContext>
      )}
    </div>
  );
}
