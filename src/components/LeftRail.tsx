import { memo } from 'react';
import { Calendar, ListTodo, BarChart3, Settings as SettingsIcon, LogOut, User, Unlink, Sun, Moon, RefreshCw, Link2, AlertCircle, Lightbulb } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { cn } from '../lib/utils';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export type LeftRailView = 'calendar' | 'tasks' | 'insights' | 'today';

interface LeftRailProps {
  activeView: LeftRailView;
  onViewChange: (view: LeftRailView) => void;
  isAuthenticated: boolean;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  lastSyncAt: Date | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  unscheduledCount: number;
  user: SupabaseUser | null;
  onSignIn: () => void;
  onSignOut: () => Promise<void>;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onReplayTour?: () => void;
}

/**
 * Left sidebar — Reclaim-inspired wider panel with calendar list,
 * navigation, and account. 220px wide, full height.
 */
export function LeftRail({
  activeView,
  onViewChange,
  isAuthenticated,
  isLoaded,
  isLoading,
  error,
  onConnect,
  onDisconnect,
  onRefresh,
  unscheduledCount,
  lastSyncAt,
  user,
  onSignIn,
  onSignOut,
  theme,
  onToggleTheme,
  onOpenSettings,
  onReplayTour,
}: LeftRailProps) {
  const [showAccount, setShowAccount] = useState(false);

  return (
    <aside
      className="w-[220px] shrink-0 h-full bg-card border-r border-border/60 flex flex-col z-20 overflow-y-auto"
      aria-label="Primary navigation"
    >
      {/* Brand header */}
      <div className="px-4 py-3.5 flex items-center gap-2.5 border-b border-border/40">
        <div
          className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shrink-0"
          title="Tempo Calendar"
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-4 h-4 text-primary-foreground"
            aria-hidden
          >
            <rect x="4" y="14" width="3" height="8" rx="0.6" />
            <rect x="10.5" y="7" width="3" height="15" rx="0.6" />
            <rect x="17" y="11" width="3" height="11" rx="0.6" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-foreground tracking-tight">Tempo</span>
      </div>

      {/* Nav section */}
      <div className="px-3 py-3 space-y-0.5">
        <SidebarItem
          icon={Calendar}
          label="Calendar"
          active={activeView === 'calendar'}
          onClick={() => onViewChange('calendar')}
        />
        <SidebarItem
          icon={Sun}
          label="Today"
          active={activeView === 'today'}
          onClick={() => onViewChange('today')}
        />
        <SidebarItem
          icon={ListTodo}
          label="Tasks"
          active={activeView === 'tasks'}
          onClick={() => onViewChange('tasks')}
          badge={unscheduledCount > 0 ? unscheduledCount : undefined}
        />
        <SidebarItem
          icon={BarChart3}
          label="Insights"
          active={activeView === 'insights'}
          onClick={() => onViewChange('insights')}
        />
      </div>

      {/* Separator */}
      <div className="h-px bg-border/40 mx-3" />

      {/* Connected calendars section (Reclaim-style) */}
      {isAuthenticated && (
        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Calendars</span>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh calendars"
            >
              <RefreshCw className={cn('w-3 h-3', isLoading && 'animate-spin')} />
            </button>
          </div>
          {error && (
            <div className="flex items-center gap-1.5 text-[10px] text-destructive mb-1.5">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span className="truncate">Sync error</span>
            </div>
          )}
          {lastSyncAt && (
            <div className="text-[9px] text-muted-foreground mb-2">
              Updated {formatDistanceToNow(lastSyncAt)} ago
            </div>
          )}
        </div>
      )}

      {/* Unauthenticated: connect CTA */}
      {!isAuthenticated && (
        <div className="px-3 py-3">
          {error && (
            <div className="flex items-center gap-1.5 mb-2 text-[10px] text-destructive">
              <AlertCircle className="w-3 h-3" />
              <span className="truncate">{error}</span>
            </div>
          )}
          {!isLoaded ? (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Loading...
            </div>
          ) : (
            <button
              onClick={onConnect}
              disabled={isLoading}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Link2 className="w-3.5 h-3.5" />
              Connect calendar
            </button>
          )}
        </div>
      )}

      <div className="flex-1" />

      {/* Bottom: settings + account */}
      <div className="px-3 py-2 border-t border-border/40 space-y-0.5">
        <SidebarItem
          icon={SettingsIcon}
          label="Settings"
          active={false}
          onClick={onOpenSettings}
          compact
        />

        {/* Account */}
        <div className="relative">
          {user ? (
            <>
              <button
                onClick={() => setShowAccount(!showAccount)}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-foreground hover:bg-accent transition-colors"
                aria-label="Account menu"
                aria-expanded={showAccount}
              >
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
                  {user.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="truncate text-[11px]">{user.email}</span>
              </button>
              {showAccount && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowAccount(false)}
                    aria-hidden
                  />
                  <div
                    className="absolute left-2 bottom-full mb-1 w-52 bg-popover border border-border/60 rounded-md shadow-lg z-50 py-0.5 animate-slide-in-up"
                    role="menu"
                  >
                    <button
                      onClick={() => { onToggleTheme(); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-foreground hover:bg-accent transition-colors"
                      role="menuitem"
                    >
                      {theme === 'dark' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                    </button>
                    {onReplayTour && (
                      <button
                        onClick={() => { onReplayTour(); setShowAccount(false); }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-foreground hover:bg-accent transition-colors"
                        role="menuitem"
                      >
                        <Lightbulb className="w-3 h-3" />
                        Replay tour
                      </button>
                    )}
                    {isAuthenticated && (
                      <button
                        onClick={() => { onDisconnect(); setShowAccount(false); }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-foreground hover:bg-accent transition-colors"
                        role="menuitem"
                      >
                        <Unlink className="w-3 h-3" />
                        Disconnect calendar
                      </button>
                    )}
                    <div className="border-t border-border/40 my-0.5" />
                    <button
                      onClick={() => { onSignOut(); setShowAccount(false); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-destructive hover:bg-destructive/5 transition-colors"
                      role="menuitem"
                    >
                      <LogOut className="w-3 h-3" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <button
              onClick={onSignIn}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:bg-accent transition-colors"
            >
              <User className="w-4 h-4" />
              Sign in
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

interface SidebarItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  disabled?: boolean;
  badge?: number;
  compact?: boolean;
  onClick: () => void;
}

const SidebarItem = memo(function SidebarItem({
  icon: Icon,
  label,
  active,
  disabled,
  badge,
  compact,
  onClick,
}: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-2.5 rounded-md transition-colors text-left',
        compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-1.5 text-[12px]',
        active && 'bg-primary/8 text-primary font-medium',
        !active && !disabled && 'text-foreground hover:bg-accent',
        disabled && 'text-muted-foreground/40 cursor-not-allowed',
      )}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className={cn('shrink-0', compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center tabular-nums shrink-0">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
});
