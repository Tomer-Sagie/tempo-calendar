import { useState, useMemo } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  isSameDay,
  isToday,
  parseISO,
  startOfDay,
  differenceInMinutes,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardContent } from './ui/card';
import { Button } from './ui/button';
import type { CalendarEvent } from '../lib/google';

interface WeeklyCalendarProps {
  events: CalendarEvent[];
  isLoading?: boolean;
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);
const HOUR_HEIGHT = 48;

export function WeeklyCalendar({ events, isLoading }: WeeklyCalendarProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );

  const weekDays = useMemo(
    () => eachDayOfInterval({ start: currentWeekStart, end: endOfWeek(currentWeekStart, { weekStartsOn: 0 }) }),
    [currentWeekStart]
  );

  const goBack = () => setCurrentWeekStart((prev) => subWeeks(prev, 1));
  const goForward = () => setCurrentWeekStart((prev) => addWeeks(prev, 1));
  const goToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));

  const weekLabel = useMemo(() => {
    const s = currentWeekStart;
    const e = endOfWeek(s, { weekStartsOn: 0 });
    if (s.getMonth() === e.getMonth()) return `${format(s, 'MMM d')} – ${format(e, 'd, yyyy')}`;
    return `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`;
  }, [currentWeekStart]);

  const weekEvents = useMemo(
    () => events.filter((ev) => {
      const d = parseISO(ev.startTime);
      return d >= startOfDay(weekDays[0]) && d <= endOfWeek(weekDays[0], { weekStartsOn: 0 });
    }),
    [events, weekDays]
  );

  const isCurrentWeek = useMemo(
    () => isSameDay(currentWeekStart, startOfWeek(new Date(), { weekStartsOn: 0 })),
    [currentWeekStart]
  );

  return (
    <Card className="overflow-hidden relative hover:shadow-xl hover:border-primary transition-all duration-300">
      {/* Header */}
      <CardHeader className="flex flex-row items-center justify-between px-6 py-5 pb-3">
        <span className="font-medium text-foreground">{weekLabel}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={goToday}
            disabled={isCurrentWeek}
          >
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={goBack} className="h-8 w-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={goForward} className="h-8 w-8">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
      {/* Day Headers */}
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-border">
        <div />
        {weekDays.map((day) => (
          <div key={day.toISOString()} className={`flex flex-col items-center justify-center py-1 ${isToday(day) ? 'bg-accent' : ''}`}>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{format(day, 'EEE')}</span>
            <span className={`text-sm font-medium leading-tight ${isToday(day) ? 'text-foreground' : 'text-muted-foreground'}`}>
              {format(day, 'd')}
            </span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div
        className="grid grid-cols-[48px_repeat(7,1fr)] overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 260px)', minHeight: '420px' }}
      >
        {/* Hour Labels */}
        <div className="border-r border-border">
          {HOURS.map((hour) => (
            <div key={hour} className="relative border-b border-border/50" style={{ height: HOUR_HEIGHT }}>
              <span className="absolute -top-2 right-1.5 text-xs text-muted-foreground font-normal">
                {format(new Date().setHours(hour, 0, 0, 0), 'ha')}
              </span>
            </div>
          ))}
        </div>

        {/* Day Columns */}
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className={`relative border-r border-border last:border-r-0 ${isToday(day) ? 'bg-accent/50' : ''}`}
          >
            {HOURS.map((hour) => (
              <div key={hour} className="border-b border-border/50" style={{ height: HOUR_HEIGHT }} />
            ))}
            {weekEvents
              .filter((ev) => isSameDay(parseISO(ev.startTime), day))
              .map((event) => {
                const start = parseISO(event.startTime);
                const end = parseISO(event.endTime);
                const dayStart = new Date(day); dayStart.setHours(6, 0, 0, 0);
                const startMins = Math.max(differenceInMinutes(start, dayStart), 0);
                const duration = Math.max(differenceInMinutes(end, start), 15);
                const top = (startMins / 60) * HOUR_HEIGHT;
                const height = Math.max((duration / 60) * HOUR_HEIGHT, 20);
                if (startMins > 16 * 60 || startMins + duration < 0) return null;

                const isTask = event.source === 'task';

                return (
                  <div
                    key={event.id}
                    className="absolute left-0.5 right-0.5 z-10 rounded px-1.5 py-1 overflow-hidden cursor-pointer transition-opacity hover:opacity-90"
                    style={{ top: `${top}px`, height: `${height}px`, backgroundColor: event.color || (isTask ? '#D97706' : '#92400E') }}
                    title={`${event.title}\n${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`}
                  >
                    <div className="text-xs font-medium leading-tight text-white truncate">{event.title}</div>
                    {height > 24 && (
                      <div className="text-xs text-white/75 leading-tight mt-0.5 font-normal">{format(start, 'h:mm a')}</div>
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/40 flex items-center justify-center z-10">
          <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && events.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm font-medium">No Events This Week</p>
        </div>
      )}
      </CardContent>
    </Card>
  );
}