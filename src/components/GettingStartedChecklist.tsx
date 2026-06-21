import { memo, useState, useEffect, useRef } from 'react';
import { Check, Plus, Calendar, LayoutList, X, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface GettingStartedChecklistProps {
  taskCount: number;
  unscheduledCount: number;
  isOnCalendarView: boolean;
  onAddTask: () => void;
  onScheduleAll: () => void;
  onViewCalendar: () => void;
  onDismiss: () => void;
}

interface Step {
  key: string;
  label: string;
  icon: typeof Check;
  isComplete: boolean;
  action?: () => void;
  actionLabel?: string;
}

/**
 * Inline checklist banner that guides new users through three
 * essential actions. Appears after the WelcomeWizard is dismissed.
 * Dismissed permanently via localStorage key.
 */
export const GettingStartedChecklist = memo(function GettingStartedChecklist({
  taskCount,
  unscheduledCount,
  isOnCalendarView,
  onAddTask,
  onScheduleAll,
  onViewCalendar,
  onDismiss,
}: GettingStartedChecklistProps) {
  const [closing, setClosing] = useState(false);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; }, [onDismiss]);

  const steps: Step[] = [
    {
      key: 'create',
      label: `Create tasks${taskCount > 0 ? ` (${taskCount}/3)` : ''}`,
      icon: Plus,
      isComplete: taskCount >= 3,
      action: onAddTask,
      actionLabel: 'Add task',
    },
    {
      key: 'schedule',
      label: `Schedule them on your calendar`,
      icon: Calendar,
      isComplete: unscheduledCount === 0 && taskCount > 0,
      action: unscheduledCount > 0 ? onScheduleAll : undefined,
      actionLabel: unscheduledCount > 0 ? 'Schedule all' : undefined,
    },
    {
      key: 'check',
      label: 'Check your calendar',
      icon: LayoutList,
      isComplete: isOnCalendarView && unscheduledCount === 0 && taskCount > 0,
      action: !isOnCalendarView ? onViewCalendar : undefined,
      actionLabel: !isOnCalendarView ? 'View calendar' : undefined,
    },
  ];

  const completedCount = steps.filter((s) => s.isComplete).length;
  const allDone = completedCount === steps.length;

  // Auto-dismiss 2 seconds after all steps complete
  useEffect(() => {
    if (!allDone) return;
    const timer = setTimeout(() => {
      setClosing(true);
      setTimeout(() => onDismissRef.current(), 300);
    }, 2000);
    return () => clearTimeout(timer);
  }, [allDone]);

  const handleDismiss = () => {
    setClosing(true);
    setTimeout(onDismiss, 200);
  };

  return (
    <div
      className={cn(
        'border-b border-border bg-card px-4 py-3 transition-all duration-300',
        closing ? 'opacity-0 max-h-0 py-0 border-none overflow-hidden' : 'opacity-100',
        allDone && 'bg-success/[0.03] border-success/20',
      )}
    >
      <div className="flex items-start gap-4 max-w-[900px] mx-auto">
        {/* Header */}
        <div className="shrink-0 pt-0.5">
          {allDone ? (
            <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
              <Check className="w-4 h-4 text-success" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-primary" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-foreground">
              {allDone ? "You're ready to go!" : 'Getting started'}
            </h3>
            {!allDone && (
              <span className="text-xs text-muted-foreground">
                {completedCount}/{steps.length} complete
              </span>
            )}
          </div>

          {/* Steps */}
          <div className="flex flex-wrap gap-2">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.key}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all',
                    step.isComplete
                      ? 'border-success/30 bg-success/[0.04] text-foreground'
                      : 'border-border bg-muted/40 text-muted-foreground',
                  )}
                >
                  {step.isComplete ? (
                    <Check className="w-3.5 h-3.5 text-success shrink-0" />
                  ) : (
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="font-medium whitespace-nowrap">{step.label}</span>
                  {!step.isComplete && step.action && (
                    <button
                      type="button"
                      onClick={step.action}
                      className="ml-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
                    >
                      {step.actionLabel}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {allDone && (
            <p className="mt-2 text-xs text-success/80">
              All set! You can always add more tasks and schedule them anytime.
            </p>
          )}
        </div>

        {/* Dismiss */}
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Dismiss checklist"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});
