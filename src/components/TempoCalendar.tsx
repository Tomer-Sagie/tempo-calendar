import { useCallback, useMemo, useRef, useState } from 'react';
import { addDays, addMonths, addWeeks, subDays, subMonths, subWeeks } from 'date-fns';
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
import { HOUR_HEIGHT } from './TempoCalendarHelpers';
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
  defaultView?: CalendarView;
  onSelectEvent?: (event: CalendarEventType) => void;
  onSelectSlot?: (slot: { start: Date; end: Date }) => void;
  onEventDrop?: (eventId: string, newStart: Date, newEnd: Date) => void;
  className?: string;
  startHour?: number;
  endHour?: number;
  height?: number | string;
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
export function TempoCalendar({
  events,
  defaultView = 'week',
  onSelectEvent,
  onSelectSlot,
  onEventDrop,
  className,
  startHour = 6,
  endHour = 22,
}: TempoCalendarProps) {
  const [view, setView] = useState<CalendarView>(defaultView);
  const [date, setDate] = useState<Date>(new Date());

  const today = useMemo(() => new Date(), []);
  // Mutable ref the WeekView writes to on mount/resize; the drag handler
  // reads from it to convert horizontal pixel deltas into day offsets.
  const dayColumnWidthRef = useRef<number>(0) as DayColumnWidthRef;

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
        hourHeight: HOUR_HEIGHT,
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
        hourHeight: HOUR_HEIGHT,
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
      />

      {/* View */}
      <DndContext
        sensors={sensors}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex-1 min-h-0 animate-fade-in">
          {view === 'day' && (
            <TempoCalendarDayView
              date={date}
              events={events}
              startHour={startHour}
              endHour={endHour}
              onSelectEvent={onSelectEvent}
              onSelectSlot={onSelectSlot}
            />
          )}
          {view === 'week' && (
            <TempoCalendarWeekView
              date={date}
              events={events}
              startHour={startHour}
              endHour={endHour}
              onSelectEvent={onSelectEvent}
              onSelectSlot={onSelectSlot}
              dayColumnWidthRef={dayColumnWidthRef}
              dragGhost={dragGhost}
            />
          )}
          {view === 'month' && (
            <TempoCalendarMonthView
              date={date}
              events={events}
              onSelectEvent={onSelectEvent}
              onSelectDay={handleMonthDayClick}
            />
          )}
        </div>
      </DndContext>
    </div>
  );
}
