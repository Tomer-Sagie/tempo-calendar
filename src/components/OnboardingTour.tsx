import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar, Zap, Inbox, Sparkles, Check, Lightbulb, Keyboard, Wand2, Target } from 'lucide-react';
import { cn } from '../lib/utils';

interface OnboardingStep {
  id: string;
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
  target: string; // CSS selector for spotlight, or 'body' for center modal
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Tempo',
    body: 'Your calendar and tasks, working together. Tempo reads your schedule, finds open time, and places your work where it belongs.',
    icon: Sparkles,
    target: 'body',
    position: 'center',
  },
  {
    id: 'quick-add',
    title: 'Add tasks in seconds',
    body: 'Type a task and press Enter. Tempo will find the best time for it. You can also click the sparkle for more options.',
    icon: Inbox,
    target: '[data-onboarding="quick-add"]',
    position: 'bottom',
  },
  {
    id: 'calendar',
    title: 'Your week at a glance',
    body: 'Click any empty slot to create a task at that time. Drag existing tasks to reschedule. Your meetings from Google Calendar appear here too.',
    icon: Calendar,
    target: '[data-onboarding="calendar"]',
    position: 'right',
  },
  {
    id: 'left-rail',
    title: 'Navigate anywhere',
    body: 'Switch between Calendar, Tasks, Today, and Insights. The badge shows how many tasks are waiting to be scheduled.',
    icon: Target,
    target: '[data-onboarding="left-rail"]',
    position: 'right',
  },
  {
    id: 'schedule-all',
    title: 'One-click planning',
    body: 'Press S or click "Schedule All" to automatically place every unscheduled task into open time slots. Tempo respects your working hours and priorities.',
    icon: Wand2,
    target: '[data-onboarding="schedule-all"]',
    position: 'bottom',
  },
  {
    id: 'conflicts',
    title: 'We catch conflicts',
    body: 'When a meeting moves or a task overlaps something, Tempo flags it. One click rebuilds a clean, conflict-free plan.',
    icon: Zap,
    target: '[data-onboarding="conflict-banner"]',
    position: 'bottom',
  },
  {
    id: 'shortcuts',
    title: 'Work at the speed of thought',
    body: 'Q for quick add, S to schedule, F8 for focus mode, and ? for all shortcuts. The more you use them, the faster you get.',
    icon: Keyboard,
    target: 'body',
    position: 'center',
  },
  {
    id: 'done',
    title: 'You\'re ready',
    body: 'That\'s the basics. Create your first task and let Tempo handle the scheduling. You can replay this tour anytime from Settings.',
    icon: Check,
    target: 'body',
    position: 'center',
  },
];

const STORAGE_KEY = 'tempo-onboarded-v2';

interface OnboardingTourProps {
  forceOpen?: boolean;
  onComplete: () => void;
}

export function OnboardingTour({ forceOpen, onComplete }: OnboardingTourProps) {
  const [open, setOpen] = useState(() => {
    if (forceOpen) return true;
    try {
      return !localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlightBox, setSpotlightBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Sync open state when forceOpen changes after mount
  const prevForceOpenRef = useRef(forceOpen);
  useEffect(() => {
    if (forceOpen !== prevForceOpenRef.current) {
      prevForceOpenRef.current = forceOpen;
      if (forceOpen) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional state reset on forceOpen change
        setOpen(true);
        setStepIndex(0);
      }
    }
  }, [forceOpen]);

  const finish = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* ignore */ }
    setOpen(false);
    onComplete();
  }, [onComplete]);

  const next = useCallback(() => {
    if (stepIndex < STEPS.length - 1) setStepIndex((i) => i + 1);
    else finish();
  }, [stepIndex, finish]);

  const back = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const goToStep = useCallback((index: number) => {
    setStepIndex(Math.max(0, Math.min(STEPS.length - 1, index)));
  }, []);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const isFirst = stepIndex === 0;
  const hasSpotlight = step.target !== 'body';

  // Measure spotlight and compute tooltip position
  useEffect(() => {
    if (!open) return;

    const update = () => {
      if (step.target === 'body') {
        setSpotlightBox(null);
        setTooltipPos(null);
        return;
      }

      const el = document.querySelector(step.target);
      if (!el) {
        // Element not found — fall back to center
        setSpotlightBox(null);
        setTooltipPos(null);
        return;
      }

      const rect = el.getBoundingClientRect();
      const pad = 8;
      const box = {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      };
      setSpotlightBox(box);

      // Compute tooltip position after a small delay to let the tooltip render
      requestAnimationFrame(() => {
        const tooltipEl = tooltipRef.current;
        const tooltipW = tooltipEl?.offsetWidth ?? 340;
        const tooltipH = tooltipEl?.offsetHeight ?? 200;
        const GAP = 16;
        const EDGE = 16;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let top: number;
        let left: number;

        switch (step.position) {
          case 'bottom':
            top = box.top + box.height + GAP;
            left = box.left + box.width / 2 - tooltipW / 2;
            break;
          case 'top':
            top = box.top - tooltipH - GAP;
            left = box.left + box.width / 2 - tooltipW / 2;
            break;
          case 'left':
            top = box.top + box.height / 2 - tooltipH / 2;
            left = box.left - tooltipW - GAP;
            break;
          case 'right':
            top = box.top + box.height / 2 - tooltipH / 2;
            left = box.left + box.width + GAP;
            break;
          default:
            top = box.top + box.height + GAP;
            left = box.left + box.width / 2 - tooltipW / 2;
        }

        // Clamp to viewport
        left = Math.max(EDGE, Math.min(vw - tooltipW - EDGE, left));
        top = Math.max(EDGE, Math.min(vh - tooltipH - EDGE, top));

        setTooltipPos({ top, left });
      });
    };

    update();

    const el = document.querySelector(step.target);
    let observer: ResizeObserver | null = null;
    if (el) {
      observer = new ResizeObserver(update);
      observer.observe(el);
    }
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, step, stepIndex]);

  if (!open) return null;

  return (
    <>
      {/* Dim layer with spotlight cutout */}
      <div className="fixed inset-0 z-[60] pointer-events-none">
        <div className="absolute inset-0 bg-foreground/35 backdrop-blur-[1px] animate-fade-in" />
        {hasSpotlight && spotlightBox && (
          <div
            className="absolute pointer-events-auto rounded-xl ring-2 ring-primary/50 ring-offset-2 ring-offset-transparent transition-all duration-300"
            style={{
              top: spotlightBox.top,
              left: spotlightBox.left,
              width: spotlightBox.width,
              height: spotlightBox.height,
              boxShadow: '0 0 0 9999px oklch(0 0 0 / 0.35)',
            }}
          />
        )}
      </div>

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className={cn(
          'fixed z-[70] bg-card border border-border rounded-2xl shadow-2xl',
          'p-6 w-[min(calc(100vw-2rem),380px)] animate-scale-in',
          !hasSpotlight && 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
        )}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        style={hasSpotlight && tooltipPos ? { top: tooltipPos.top, left: tooltipPos.left } : undefined}
      >
        <button
          onClick={finish}
          className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-colors"
          aria-label="Close tour"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <step.icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground tracking-tight">{step.title}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{step.body}</p>
          </div>
        </div>

        {/* Step indicators — clickable */}
        <div className="mt-5 flex items-center gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goToStep(i)}
              className={cn(
                'h-1.5 rounded-full transition-all cursor-pointer',
                i === stepIndex ? 'w-6 bg-primary' : 'w-1.5 bg-muted hover:bg-muted-foreground/30',
              )}
              aria-label={`Go to step ${i + 1}: ${s.title}`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {stepIndex + 1} / {STEPS.length}
          </span>
          <div className="flex items-center gap-1.5">
            {!isFirst && (
              <button
                onClick={back}
                className="h-9 px-3 text-xs font-medium rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={finish}
                className="h-9 px-4 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5"
              >
                Get started
                <Check className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={next}
                className="h-9 px-4 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function ReplayTourButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors',
        className,
      )}
    >
      <Lightbulb className="w-3.5 h-3.5" />
      Replay tour
    </button>
  );
}
