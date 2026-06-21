import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Sparkles, Calendar, Zap, Keyboard, Lightbulb } from 'lucide-react';
import { cn } from '../lib/utils';

interface Hint {
  id: string;
  icon: React.ReactNode;
  message: string;
  action?: { label: string; onClick: () => void };
  dismissKey: string;
  priority: 'low' | 'medium' | 'high';
}

interface ContextualHintsProps {
  unscheduledCount: number;
  taskCount: number;
  hasCalendar: boolean;
  onScheduleAll: () => void;
  onOpenKeyboardHelp: () => void;
  onConnectCalendar: () => void;
}

const STORAGE_KEY = 'tempo-dismissed-hints';

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(key: string) {
  try {
    const dismissed = getDismissed();
    dismissed.add(key);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed]));
  } catch { /* ignore */ }
}

export function ContextualHints({
  unscheduledCount,
  taskCount,
  hasCalendar,
  onScheduleAll,
  onOpenKeyboardHelp,
  onConnectCalendar,
}: ContextualHintsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(getDismissed);
  const [entered, setEntered] = useState(false);

  // Compute hints based on scalar state and stable callbacks.
  const hints = useMemo((): Hint[] => {
    const list: Hint[] = [];

    if (!hasCalendar) {
      list.push({
        id: 'connect-calendar',
        icon: <Calendar className="w-3.5 h-3.5" />,
        message: 'Connect your Google Calendar to see meetings and find open time slots.',
        action: { label: 'Connect', onClick: onConnectCalendar },
        dismissKey: 'hint-connect-calendar',
        priority: 'high',
      });
    }

    if (unscheduledCount >= 5) {
      list.push({
        id: 'many-unscheduled',
        icon: <Sparkles className="w-3.5 h-3.5" />,
        message: `You have ${unscheduledCount} unscheduled tasks. Let Tempo place them automatically.`,
        action: { label: 'Schedule all', onClick: onScheduleAll },
        dismissKey: 'hint-many-unscheduled',
        priority: 'high',
      });
    }

    if (taskCount >= 3 && unscheduledCount === 0) {
      list.push({
        id: 'all-scheduled',
        icon: <Zap className="w-3.5 h-3.5" />,
        message: 'All your tasks are scheduled! Try drag-and-drop to rearrange your day.',
        dismissKey: 'hint-all-scheduled',
        priority: 'low',
      });
    }

    if (taskCount >= 1 && taskCount <= 2) {
      list.push({
        id: 'keyboard-shortcuts',
        icon: <Keyboard className="w-3.5 h-3.5" />,
        message: 'Press Q to quick-add, S to schedule all, or ? for all shortcuts.',
        action: { label: 'View shortcuts', onClick: onOpenKeyboardHelp },
        dismissKey: 'hint-keyboard-shortcuts',
        priority: 'medium',
      });
    }

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return list.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [unscheduledCount, taskCount, hasCalendar, onScheduleAll, onOpenKeyboardHelp, onConnectCalendar]);

  const currentHint = useMemo(() => {
    return hints.find((h) => !dismissed.has(h.dismissKey)) ?? null;
  }, [hints, dismissed]);

  // Entrance animation — delay entrance by 100ms for spring feel.
  const currentDismissKey = currentHint?.dismissKey ?? null;
  useEffect(() => {
    if (currentDismissKey) {
      const timer = setTimeout(() => setEntered(true), 100);
      return () => clearTimeout(timer);
    }
    // Only reset entered when no hint is active; skip during transitions
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional animation reset
    if (!currentHint) setEntered(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when hint goes away
  }, [currentDismissKey]);

  const handleDismiss = useCallback((key: string) => {
    saveDismissed(key);
    setDismissed((prev) => new Set(prev).add(key));
    setEntered(false);
  }, []);

  if (!currentHint || !entered) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 border-b transition-all duration-300',
        currentHint.priority === 'high'
          ? 'bg-primary/5 border-primary/20'
          : 'bg-muted/40 border-border/50',
        'animate-slide-down',
      )}
      role="status"
      aria-live="polite"
    >
      <div className={cn(
        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
        currentHint.priority === 'high' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
      )}>
        {currentHint.icon}
      </div>
      <span className="flex-1 min-w-0 text-sm text-foreground">
        {currentHint.message}
      </span>
      {currentHint.action && (
        <button
          onClick={() => {
            currentHint.action!.onClick();
            handleDismiss(currentHint.dismissKey);
          }}
          className={cn(
            'shrink-0 text-xs font-medium px-3 py-1.5 rounded-md transition-colors',
            currentHint.priority === 'high'
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-card border border-border hover:bg-accent',
          )}
        >
          {currentHint.action.label}
        </button>
      )}
      <button
        onClick={() => handleDismiss(currentHint.dismissKey)}
        className="shrink-0 p-1 rounded hover:bg-accent text-muted-foreground transition-colors"
        aria-label="Dismiss hint"
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/**
 * A lightweight tip that appears inline in specific contexts.
 * Smaller and less intrusive than the full ContextualHints banner.
 */
export function InlineTip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start gap-2 text-xs text-muted-foreground animate-fade-in', className)}>
      <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5 text-warning/70" />
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}
