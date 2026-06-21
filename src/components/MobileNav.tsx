import { Calendar, CheckSquare, Sun, BarChart3 } from 'lucide-react';
import { cn } from '../lib/utils';
import type { AppView } from './Header';

type MobileNavView = AppView;

interface MobileNavProps {
  activeView: MobileNavView;
  onViewChange: (view: MobileNavView) => void;
  unscheduledCount: number;
}

const NAV_ITEMS: { view: MobileNavView; label: string; icon: typeof Calendar }[] = [
  { view: 'today', label: 'Today', icon: Sun },
  { view: 'calendar', label: 'Calendar', icon: Calendar },
  { view: 'tasks', label: 'Tasks', icon: CheckSquare },
  { view: 'insights', label: 'Insights', icon: BarChart3 },
];

/**
 * Fixed bottom navigation bar visible on mobile (< 1024px).
 * Replaces the LeftRail sidebar navigation on small screens.
 * Uses the same view state as LeftRail for seamless switching.
 */
export function MobileNav({ activeView, onViewChange, unscheduledCount }: MobileNavProps) {
  return (
    <nav
      className="mobile-nav"
      role="navigation"
      aria-label="Main navigation"
    >
      {NAV_ITEMS.map(({ view, label, icon: Icon }) => {
        const active = activeView === view;
        return (
          <button
            key={view}
            type="button"
            onClick={() => onViewChange(view)}
            className={cn(
              'mobile-nav-item',
              active && 'mobile-nav-item--active',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {view === 'tasks' && unscheduledCount > 0 && (
                <span className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-primary text-primary-foreground text-[8px] font-semibold flex items-center justify-center tabular-nums">
                  {unscheduledCount > 9 ? '9+' : unscheduledCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium mt-0.5">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
