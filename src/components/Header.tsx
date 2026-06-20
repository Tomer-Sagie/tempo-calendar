import { Calendar, RefreshCw, Play } from 'lucide-react';
import { Button } from './ui/button';

interface HeaderProps {
  isAuthenticated: boolean;
  onRefresh: () => void;
  onScheduleAll: () => void;
  unscheduledCount: number;
  onOpenFocus?: () => void;
}

/**
 * Top action bar. Brand logo, settings, and account menu have been moved
 * to the LeftRail so there is a single, consistent place for those controls.
 * The Header now renders only contextual action buttons (Focus, Schedule All,
 * Refresh) when authenticated.
 */
export function Header({
  isAuthenticated,
  onRefresh, onScheduleAll, unscheduledCount,
  onOpenFocus,
}: HeaderProps) {
  return (
    <header role="banner" className="sticky top-0 z-30 h-11 flex items-center gap-2 px-3 bg-card/90 backdrop-blur-md border-b border-border/50">
      <div className="flex-1" />

      {isAuthenticated && (
        <div className="flex items-center gap-2">
          {onOpenFocus && (
            <Button
              variant="default"
              size="sm"
              onClick={onOpenFocus}
              className="h-8 px-3 text-xs font-medium gap-2"
              title="Start focus mode (F8)"
            >
              <Play className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Focus</span>
              <kbd className="hidden sm:inline-flex items-center h-4 px-1 font-mono text-[9px] font-medium bg-primary-foreground/20 rounded">
                F8
              </kbd>
            </Button>
          )}
          {unscheduledCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onScheduleAll}
              className="h-8 px-3 text-xs font-medium gap-2"
              title="Schedule all unscheduled tasks (S)"
              data-onboarding="schedule-all"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Schedule all</span>
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md text-xs font-semibold">
                {unscheduledCount}
              </span>
              <kbd className="hidden lg:inline-flex items-center h-4 px-1 font-mono text-[9px] font-medium bg-muted text-muted-foreground border border-border rounded">
                S
              </kbd>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            className="h-8 w-8"
            title="Refresh calendar events"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>

        </div>
      )}
    </header>
  );
}