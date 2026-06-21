import { Calendar, RefreshCw, Play } from 'lucide-react';

interface HeaderProps {
  isAuthenticated: boolean;
  onRefresh: () => void;
  onScheduleAll: () => void;
  unscheduledCount: number;
  onOpenFocus?: () => void;
}

/**
 * Top action bar — minimal Reclaim-style. Brand, focus button, schedule-all,
 * and refresh. No heavy chrome, just essential actions.
 */
export function Header({
  isAuthenticated,
  onRefresh, onScheduleAll, unscheduledCount,
  onOpenFocus,
}: HeaderProps) {
  return (
    <header role="banner" className="sticky top-0 z-30 h-10 flex items-center gap-2 px-3 bg-card/95 border-b border-border/40">
      <div className="flex-1" />

      {isAuthenticated && (
        <div className="flex items-center gap-1.5">
          {onOpenFocus && (
            <button
              onClick={onOpenFocus}
              className="h-7.5 px-2.5 flex items-center gap-1.5 rounded text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              title="Start focus mode (F8)"
            >
              <Play className="w-3 h-3" />
              <span className="hidden sm:inline">Focus</span>
            </button>
          )}
          {unscheduledCount > 0 && (
            <button
              onClick={onScheduleAll}
              className="h-7.5 px-2.5 flex items-center gap-1.5 rounded text-[11px] font-medium text-foreground hover:bg-accent transition-colors"
              title="Schedule all unscheduled tasks (S)"
              data-onboarding="schedule-all"
            >
              <Calendar className="w-3 h-3" />
              <span className="hidden sm:inline">Schedule all</span>
              <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-semibold">
                {unscheduledCount}
              </span>
            </button>
          )}
          <button
            onClick={onRefresh}
            className="h-7.5 w-7.5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Refresh calendar events"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </header>
  );
}