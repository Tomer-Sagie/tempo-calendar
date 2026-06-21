import { Calendar, RefreshCw, Play, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import type { GoogleCalendar } from '../lib/google';
import { formatDistanceToNow } from 'date-fns';

export type AppView = 'calendar' | 'tasks' | 'insights' | 'today';

interface HeaderProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
  isAuthenticated: boolean;
  onRefresh: () => void;
  onScheduleAll: () => void;
  unscheduledCount: number;
  onOpenFocus?: () => void;
  onOpenSettings?: () => void;
  /** Google Calendar data for the Reclaim-style calendar dots + sync status. */
  calendars?: GoogleCalendar[];
  selectedCalendarIds?: string[];
  lastSyncAt?: Date | null;
  isSyncing?: boolean;
}

const VIEWS: { view: AppView; label: string }[] = [
  { view: 'calendar', label: 'Calendar' },
  { view: 'today', label: 'Today' },
  { view: 'tasks', label: 'Tasks' },
];

/**
 * Top bar — Reclaim-style minimal. View tabs on the left, actions on the right.
 */
export function Header({
  activeView,
  onViewChange,
  isAuthenticated,
  onRefresh, onScheduleAll, unscheduledCount,
  onOpenFocus,
  onOpenSettings,
  calendars = [],
  selectedCalendarIds = [],
  lastSyncAt = null,
  isSyncing = false,
}: HeaderProps) {
  const selectedSet = new Set(selectedCalendarIds);
  const syncedAgo =
    lastSyncAt
      ? formatDistanceToNow(lastSyncAt, { addSuffix: true })
      : null;
  return (
    <header role="banner" className="sticky top-0 z-30 h-10 flex items-center gap-2 px-3 bg-card/95 border-b border-border/40">
      {/* View tabs */}
      <div className="flex items-center gap-0.5">
        {VIEWS.map(({ view, label }) => (
          <button
            key={view}
            onClick={() => onViewChange(view)}
            className={cn(
              'h-7 px-2.5 rounded text-[11px] font-medium transition-colors',
              activeView === view
                ? 'bg-foreground/8 text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
          >
            {label}
            {view === 'tasks' && unscheduledCount > 0 && (
              <span className="ml-1 bg-primary/15 text-primary px-1 rounded text-[9px] font-semibold">
                {unscheduledCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Calendar dots + sync status — Reclaim-style minimal */}
      {isAuthenticated && calendars.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            {calendars.slice(0, 6).map((cal) => {
              const isSelected = selectedSet.has(cal.id);
              const dotColor = cal.backgroundColor || '#7986cb';
              return (
                <span
                  key={cal.id}
                  className={cn(
                    'w-2 h-2 rounded-sm ring-1 ring-inset ring-black/10 dark:ring-white/10 transition-opacity',
                    !isSelected && 'opacity-30',
                  )}
                  style={{ backgroundColor: dotColor }}
                  title={`${cal.summary}${isSelected ? '' : ' (hidden)'}`}
                />
              );
            })}
            {calendars.length > 6 && (
              <span className="text-[9px] text-muted-foreground/50 ml-0.5">
                +{calendars.length - 6}
              </span>
            )}
          </div>
          {syncedAgo && (
            <span className="text-[10px] text-muted-foreground/50 whitespace-nowrap">
              {isSyncing ? 'Syncing…' : `Synced ${syncedAgo}`}
            </span>
          )}
        </div>
      )}

      {isAuthenticated && calendars.length > 0 && <div className="flex-1" />}

      {isAuthenticated && (
        <div className="flex items-center gap-1.5">
          {onOpenFocus && (
            <button
              onClick={onOpenFocus}
              className="h-7 px-2.5 flex items-center gap-1.5 rounded text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              title="Start focus mode (F8)"
            >
              <Play className="w-3 h-3" />
              <span className="hidden sm:inline">Focus</span>
            </button>
          )}
          {unscheduledCount > 0 && (
            <button
              onClick={onScheduleAll}
              className="h-7 px-2.5 flex items-center gap-1.5 rounded text-[11px] font-medium text-foreground hover:bg-accent transition-colors"
              title="Schedule all unscheduled tasks (S)"
              data-onboarding="schedule-all"
            >
              <Calendar className="w-3 h-3" />
              <span className="hidden sm:inline">Schedule all</span>
            </button>
          )}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onRefresh}
            className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Refresh calendar events"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </header>
  );
}