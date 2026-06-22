import { useEffect, useMemo, useRef } from 'react';
import {
  format,
  startOfWeek,
  addDays,
  isToday,
  isSameDay,
  differenceInMinutes,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  startOfDay,
} from 'date-fns';
import { DraggableEvent } from './CalendarEvent';
import { cn } from '../lib/utils';
import { CalendarDays } from 'lucide-react';
import {
  useHourHeight,
  getEventsForDay,
  getAllDayEvents,
  getMultiDayEvents,
  packMultiDayRows,
  positionEvents,
  getContrastText,
  type CalendarEventType,
  type DayColumnWidthRef,
  type DragGhostTarget,
} from './TempoCalendarHelpers';

interface WeekViewProps {
  date: Date;
  events: CalendarEventType[];
  startHour: number;
  endHour: number;
  onSelectEvent?: (event: CalendarEventType) => void;
  onSelectSlot?: (slot: { start: Date; end: Date }) => void;
  onCompleteEvent?: (event: CalendarEventType) => void;
  onSkipEvent?: (event: CalendarEventType) => void;
  /** Ref the parent reads to compute horizontal drag → day offset. */
  dayColumnWidthRef: DayColumnWidthRef;
  /**
   * Live target of the in-progress drag, used to render a translucent
   * ghost rectangle at the day/time the event will land on. `null` when no
   * drag is active or when the drag is sub-threshold.
   */
  dragGhost?: DragGhostTarget | null;
  /** Resize ghost — translucent preview of the new size during resize. */
  resizeGhost?: DragGhostTarget | null;
  /** Start a resize operation on a task event. */
  onResizeStart?: (eventId: string, direction: 'top' | 'bottom', clientY: number) => void;
  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn?: 0 | 1;
  /** '12h' (default) or '24h'. */
  timeFormat?: '12h' | '24h';
}

/**
 * Seven-day grid: day-header row, optional all-day strip, and a scrollable
 * time grid with one column per weekday. Renders the drag-ghost preview at
 * the day/time the active drag will land on, clamped to the visible week.
 */
export function TempoCalendarWeekView({
  date,
  events,
  startHour,
  endHour,
  onSelectEvent,
  onSelectSlot,
  onCompleteEvent,
  onSkipEvent,
  dayColumnWidthRef,
  dragGhost,
  resizeGhost,
  onResizeStart,
  weekStartsOn = 1,
  timeFormat = '12h',
}: WeekViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const HOUR_HEIGHT = useHourHeight();
  const nowLineRef = useRef<HTMLDivElement>(null);
  const weekStart = useMemo(() => startOfWeek(date, { weekStartsOn }), [date, weekStartsOn]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Measure the day-column width on mount + on resize so the parent drag
  // handler can convert horizontal pixel deltas into day offsets.
  useEffect(() => {
    if (!gridRef.current) return;
    const update = () => {
      const total = gridRef.current?.clientWidth ?? 0;
      // Grid is `56px_repeat(7,1fr)`; subtract the 56px gutter for accuracy.
      dayColumnWidthRef.current = total > 0 ? Math.max(1, (total - 56) / 7) : 0;
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(gridRef.current);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [dayColumnWidthRef, weekStart]);

  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let h = startHour; h < endHour; h++) arr.push(h);
    return arr;
  }, [startHour, endHour]);

  // Pre-position events per day
  const dayPositions = useMemo(() => {
    return days.map((d) =>
      positionEvents(getEventsForDay(events, d).filter((e) => !e.allDay), d, startHour, HOUR_HEIGHT),
    );
  }, [days, events, startHour, HOUR_HEIGHT]);

  // Multi-day spanning events: compute which events span across days and
  // pack them into rows so they render as continuous bars (like Google Calendar).
  const multiDaySpans = useMemo(
    () => getMultiDayEvents(events, weekStart, days),
    [events, weekStart, days],
  );
  const multiDayRows = useMemo(() => packMultiDayRows(multiDaySpans), [multiDaySpans]);

  // Single-day all-day events (not multi-day) — rendered as pills per day
  const multiDayIds = useMemo(
    () => new Set(multiDaySpans.map((s) => s.event.id)),
    [multiDaySpans],
  );
  const allDayPerDay = useMemo(
    () => days.map((d) => getAllDayEvents(getEventsForDay(events, d)).filter((ev) => !multiDayIds.has(ev.id))),
    [days, events, multiDayIds],
  );
  const hasAllDay = multiDaySpans.length > 0 || allDayPerDay.some((d) => d.length > 0);

  // Scroll to current time on mount and update now-line via RAF (no React re-render)
  useEffect(() => {
    if (!containerRef.current) return;
    const now = new Date();
    const isCurrentWeek = days.some((d) => isSameDay(d, now));
    if (!isCurrentWeek) {
      containerRef.current.scrollTop = 0;
      return;
    }
    const minutesFromTop = Math.max(0, (now.getHours() - startHour) * 60 + now.getMinutes());
    const target = (minutesFromTop / 60) * HOUR_HEIGHT - 80;
    containerRef.current.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });

    // Update now-line position via RAF instead of setInterval + setState
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
    // Re-render once per minute for hour labels, but update now-line position smoothly
    const id = setInterval(updateNowLine, 60_000);
    updateNowLine();
    return () => clearInterval(id);
  }, [days, startHour, endHour, HOUR_HEIGHT]);

  // Now line position (computed inline — cheap, no need to memoize)
  const nowOffset = (() => {
    const now = new Date();
    if (!days.some((d) => isSameDay(d, now))) return null;
    const minutesFromTop = (now.getHours() - startHour) * 60 + now.getMinutes();
    if (minutesFromTop < 0 || minutesFromTop > (endHour - startHour) * 60) return null;
    return (minutesFromTop / 60) * HOUR_HEIGHT;
  })();

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>, day: Date) => {
    if (!onSelectSlot) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top + (containerRef.current?.scrollTop || 0);
    const hour = Math.min(endHour - 1, Math.max(startHour, Math.floor(y / HOUR_HEIGHT) + startHour));
    const minute = Math.round((y % HOUR_HEIGHT) / HOUR_HEIGHT * 60 / 15) * 15;
    const start = setMilliseconds(setSeconds(setMinutes(setHours(day, hour), minute), 0), 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    onSelectSlot({ start, end });
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border/50 overflow-hidden">
      {/* Day header row */}
      <div className={cn('grid border-b border-border/50 bg-card', 'grid-cols-[56px_repeat(7,1fr)]')}>
        <div className="border-r border-border" />
        {days.map((d) => {
          const t = isToday(d);
          return (
            <div
              key={d.toISOString()}
              className={cn(                  'flex flex-col items-center py-2.5 border-r border-border/30 last:border-r-0 transition-colors',
                t && 'bg-primary/5',
              )}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {format(d, 'EEE')}
              </span>
              <span
                className={cn(
                  'mt-0.5 text-sm font-semibold tabular-nums w-6 h-6 flex items-center justify-center rounded-full transition-colors',
                  t ? 'bg-primary text-primary-foreground' : 'text-foreground',
                )}
              >
                {format(d, 'd')}
              </span>
            </div>
          );
        })}
      </div>

      {/* All-day row — spanning bars for multi-day events + pills for single-day all-day */}
      {hasAllDay && (
        <div className="border-b border-border/50 bg-card">
          {/* Multi-day spanning events — each gets its own row spanning columns */}
          {multiDaySpans.length > 0 && (
            <div className="relative" style={{ minHeight: (Math.max(...multiDayRows, 0) + 1) * 24 + 4 }}>
              {/* Grid column lines for positioning reference */}
              <div className="absolute inset-0 grid grid-cols-[56px_repeat(7,1fr)] pointer-events-none">
                <div />
                {days.map((d) => (
                  <div key={d.toISOString()} className="border-r border-border/20 last:border-r-0" />
                ))}
              </div>
              {multiDaySpans.map((span, idx) => {
                const ev = span.event;
                const row = multiDayRows[idx];
                const evColor = ev.data?.color || '';
                const isLocked = ev.data?.is_locked;
                const isGoogle = ev.data?.source === 'google';
                const isFlexible = !isLocked && !isGoogle && ev.data?.source === 'task';
                const bgColor = evColor || '#7c8aff';
                const textColor = evColor ? getContrastText(evColor) : '#ffffff';
                const left = `calc(56px + (100% - 56px) * ${span.startCol} / 7)`;
                const width = `calc((100% - 56px) * ${span.endCol - span.startCol + 1} / 7)`;
                const topPx = row * 24 + 2;
                return (
                  <button
                    key={ev.id}
                    onClick={() => onSelectEvent?.(ev)}
                    className={cn(
                      'absolute h-[22px] text-[10px] font-medium rounded truncate transition-colors hover:brightness-95 px-1.5 flex items-center border-l-[3px]',
                      isFlexible && 'all-day-flexible border-dashed',
                      !isFlexible && 'border-solid',
                    )}
                    style={{
                      backgroundColor: bgColor,
                      color: textColor,
                      borderLeftColor: textColor,
                      left,
                      width,
                      top: topPx,
                    }}
                    title={ev.title}
                  >
                    {ev.title}
                  </button>
                );
              })}
            </div>
          )}
          {/* Single-day all-day events — compact pills per day column */}
          {allDayPerDay.some((d) => d.length > 0) && (
            <div className="grid grid-cols-[56px_repeat(7,1fr)]">
              <div className="border-r border-border/70" />
              {days.map((d, i) => (
                <div
                  key={d.toISOString()}
                  className="border-r border-border/30 last:border-r-0 py-0.5 min-h-[24px] flex flex-wrap gap-0.5 items-start"
                >
                  {allDayPerDay[i].slice(0, 2).map((ev) => {
                    const evColor = ev.data?.color || '';
                    const isLocked = ev.data?.is_locked;
                    const isGoogle = ev.data?.source === 'google';
                    const isFlexible = !isLocked && !isGoogle && ev.data?.source === 'task';
                    const bgColor = evColor || '#7c8aff';
                    const textColor = evColor ? getContrastText(evColor) : '#ffffff';
                    return (
                      <button
                        key={ev.id}
                        onClick={() => onSelectEvent?.(ev)}
                        className={cn(
                          'w-full text-left px-1.5 py-0.5 text-[10px] font-medium rounded truncate transition-colors hover:brightness-95',
                          isFlexible && 'all-day-flexible border border-dashed border-muted-foreground/15',
                          !isFlexible && 'border border-solid',
                        )}
                        style={{ backgroundColor: bgColor, color: textColor, borderColor: evColor ? `${evColor}40` : 'var(--border)' }}
                      >
                        {ev.title}
                      </button>
                    );
                  })}
                  {allDayPerDay[i].length > 2 && (
                    <span className="text-[9px] font-medium text-muted-foreground px-1">
                      +{allDayPerDay[i].length - 2}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
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
            <p className="text-sm font-medium text-foreground mb-1">Nothing scheduled this week</p>
            <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">
              Click any time slot to create a task. Press <kbd className="inline-flex items-center h-4 px-1 font-mono text-[10px] font-medium bg-muted border border-border rounded mx-0.5">Q</kbd> to quick-add.
            </p>
          </div>
        )}
        <div
          ref={gridRef}
          className="relative grid grid-cols-[56px_repeat(7,1fr)]"
          style={{ height: (endHour - startHour) * HOUR_HEIGHT }}
        >
          {/* Hour gutter */}              <div className="border-r border-border/70">
            {hours.map((h) => (
              <div key={h} data-hour={h} className="relative border-b border-border/20" style={{ height: HOUR_HEIGHT }}>
                <span className="absolute top-0 right-2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground/60 bg-card px-1 tabular-nums">
                  {format(setHours(date, h), timeFormat === '24h' ? 'HH:mm' : 'h a')}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d, dayIdx) => {
            const t = isToday(d);
            const positioned = dayPositions[dayIdx];
            return (
              <div
                key={d.toISOString()}
                className={cn(
                  'relative border-r border-border/30 last:border-r-0',
                  t && 'bg-primary/[0.025]',
                )}
                onClick={(e) => handleGridClick(e, d)}
              >
                {hours.map((h) => (
                  <div key={h} data-hour={h} className="border-b border-border/15" style={{ height: HOUR_HEIGHT }} />
                ))}
                {hours.slice(0, -1).map((h) => (
                  <div
                    key={`half-${h}`}
                    className="absolute left-0 right-0 h-px bg-border/10 pointer-events-none"
                    style={{ top: (h - startHour) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                  />
                ))}

                {positioned.map((ev) => {
                  const width =
                    ev.totalColumns > 0
                      ? `calc((100% - 6px) / ${ev.totalColumns})`
                      : 'calc(100% - 6px)';
                  const left =
                    ev.totalColumns > 0
                      ? `calc(3px + (100% - 6px) * ${ev.column} / ${ev.totalColumns})`
                      : '3px';
                  return (
                    <DraggableEvent
                      key={ev.id}
                      event={ev}
                      onClick={(e) => onSelectEvent?.(e)}
                      onComplete={onCompleteEvent}
                      onSkip={onSkipEvent}
                      draggable={ev.data?.source === 'task' && !ev.data?.is_locked}
                      isLocked={ev.data?.is_locked}
                      small
                      onResizeStart={ev.data?.source === 'task' && !ev.data?.is_locked ? (dir, y) => onResizeStart?.(ev.id, dir, y) : undefined}
                      positionStyle={{
                        top: ev.top,
                        height: Math.max(22, ev.height - 2),
                        left,
                        width,
                      }}
                    />
                  );
                })}
              </div>
            );
          })}

          {/* Drag ghost — translucent preview at the target day/time */}
          {dragGhost &&
            (() => {
              const weekStartMidnight = startOfDay(weekStart);
              const ghostStartMidnight = startOfDay(dragGhost.newStart);
              const rawDayIdx = Math.round(
                (ghostStartMidnight.getTime() - weekStartMidnight.getTime()) / (24 * 60 * 60_000),
              );
              // Clamp to visible week (0..6) so the ghost stays on-screen
              // even if the user drags past the edge.
              const dayIdx = Math.max(0, Math.min(6, rawDayIdx));
              const dayDate = addDays(weekStart, dayIdx);
              const visibleStart = setMilliseconds(
                setSeconds(setMinutes(setHours(dayDate, startHour), 0), 0),
                0,
              );
              const minutesFromTop = differenceInMinutes(dragGhost.newStart, visibleStart);
              const durationMin = differenceInMinutes(dragGhost.newEnd, dragGhost.newStart);
              // Top is clamped to the visible window; the ghost extends out
              // of the top/bottom as needed so the user sees "this won't fit".
              const top = Math.max(0, (minutesFromTop / 60) * HOUR_HEIGHT);
              const visibleMaxTop = (endHour - startHour) * HOUR_HEIGHT;
              const height = Math.max(
                22,
                Math.min(visibleMaxTop - top, (durationMin / 60) * HOUR_HEIGHT),
              );
              // Position the ghost inside the target day column, just like DraggableEvent.
              const left = `calc(56px + 3px + (100% - 56px - 6px) * ${dayIdx} / 7)`;
              const width = `calc((100% - 56px - 6px) / 7)`;
              const variantClass =
                dragGhost.variant === 'warning'
                  ? 'bg-warning/20 border-warning text-foreground'
                  : dragGhost.variant === 'destructive'
                  ? 'bg-destructive/20 border-destructive text-foreground'
                  : dragGhost.variant === 'success'
                  ? 'bg-success/20 border-success text-foreground'
                  : dragGhost.variant === 'secondary'
                  ? 'bg-event-task/30 border-event-task-border text-foreground'
                  : dragGhost.variant === 'muted'
                  ? 'bg-muted border-muted-foreground/30 text-foreground'
                  : 'bg-primary/20 border-primary text-foreground';
              // Highlight the target column header
              const targetDay = days[dayIdx];
              const isOffWeek = rawDayIdx !== dayIdx;
              return (
                <>
                  {/* Column header highlight */}
                  <div
                    data-drag-ghost-header="true"
                    className="pointer-events-none absolute z-10 transition-colors"
                    style={{
                      // Header is `64px_repeat(7,1fr)`, height matches header
                      left: `calc(56px + (100% - 56px) * ${dayIdx} / 7)`,
                      width: `calc((100% - 56px) / 7)`,
                      top: -48,
                      height: 48,
                      background: 'oklch(var(--primary) / 0.08)',
                      borderTop: '2px solid oklch(var(--primary))',
                    }}
                    aria-hidden
                  >
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Drop on {format(targetDay, 'EEE d')}
                    </div>
                  </div>
                  {/* Ghost rectangle */}
                  <div
                    data-drag-ghost="true"
                    className={cn(
                      'absolute z-30 rounded-md border-2 border-dashed pointer-events-none flex flex-col px-1.5 py-1 overflow-hidden',
                      variantClass,
                      'shadow-lg',
                    )}
                    style={{ top, height, left, width }}
                    aria-hidden
                  >
                    <div className="flex items-center gap-1">
                      <span className="font-semibold truncate text-[10px]">{dragGhost.title}</span>
                    </div>
                    <div className="text-[9px] opacity-75 num">
                      {format(dragGhost.newStart, timeFormat === '24h' ? 'HH:mm' : 'h:mma')} - {format(dragGhost.newEnd, timeFormat === '24h' ? 'HH:mm' : 'h:mma')}
                    </div>
                  </div>
                  {/* Edge indicator: ghost is clamped (drag went past visible week) */}
                  {isOffWeek && (
                    <div
                      className="absolute z-30 top-1 right-2 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[9px] font-semibold pointer-events-none"
                      aria-hidden
                    >
                      {rawDayIdx < 0 ? '<- past week' : 'past week ->'}
                    </div>
                  )}
                </>
              );
            })()}

          {/* Resize ghost — translucent preview of new size */}
          {resizeGhost &&
            (() => {
              const weekStartMidnight = startOfDay(weekStart);
              const ghostStartMidnight = startOfDay(resizeGhost.newStart);
              const dayIdx = Math.round(
                (ghostStartMidnight.getTime() - weekStartMidnight.getTime()) / (24 * 60 * 60_000),
              );
              if (dayIdx < 0 || dayIdx > 6) return null;
              const dayDate = addDays(weekStart, dayIdx);
              const visibleStart = setMilliseconds(
                setSeconds(setMinutes(setHours(dayDate, startHour), 0), 0),
                0,
              );
              const minutesFromTop = differenceInMinutes(resizeGhost.newStart, visibleStart);
              const durationMin = differenceInMinutes(resizeGhost.newEnd, resizeGhost.newStart);
              const top = Math.max(0, (minutesFromTop / 60) * HOUR_HEIGHT);
              const visibleMaxTop = (endHour - startHour) * HOUR_HEIGHT;
              const height = Math.max(22, Math.min(visibleMaxTop - top, (durationMin / 60) * HOUR_HEIGHT));
              const left = `calc(56px + 3px + (100% - 56px - 6px) * ${dayIdx} / 7)`;
              const width = `calc((100% - 56px - 6px) / 7)`;
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
                  </div>                    <div data-ghost-time className="text-[9px] opacity-75 num">
                      {format(resizeGhost.newStart, timeFormat === '24h' ? 'HH:mm' : 'h:mma')} - {format(resizeGhost.newEnd, timeFormat === '24h' ? 'HH:mm' : 'h:mma')}
                    </div>
                </div>
              );
            })()}

          {/* Now line — Fantastical-style red line with prominent dot */}
          {nowOffset !== null && (              <div
              ref={nowLineRef}
              className="absolute left-[56px] right-0 z-[5] pointer-events-none"
              style={{ top: nowOffset }}
            >
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
        </div>
      </div>
    </div>
  );
}

