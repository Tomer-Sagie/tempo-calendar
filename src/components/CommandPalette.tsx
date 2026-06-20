import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Command } from 'cmdk';
import { Calendar, Plus, Settings, Sun, Moon, Inbox, Sparkles, Zap, Check, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format, isToday, isTomorrow } from 'date-fns';
import { parseEnhancedTask, type ParsedTask } from '../lib/enhancedParser';

interface PaletteAction {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  current?: boolean;
  action: () => void | Promise<void>;
}

type PaletteGroup = {
  group: string;
  items: PaletteAction[];
};

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuickAdd: (input: {
    title: string;
    date?: string;
    time?: string;
    priority?: 'ASAP' | 'HIGH' | 'NORMAL' | 'LOW';
    tags?: string[];
    duration_minutes?: number;
    frequency?: 'daily' | 'weekly';
    recurrence_end?: string;
    preferred_days?: number[];
  }) => Promise<void> | void;
  onNavigate: (view: 'day' | 'week' | 'month') => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onScheduleAll: () => Promise<{ count: number; unscheduled: Array<{ taskId: string; reason: string }> }> | void;
  currentView: 'day' | 'week' | 'month';
  theme: 'light' | 'dark';
}

// Re-export the enhanced parser for backward compatibility
const parseNaturalDate = (input: string): ParsedTask => parseEnhancedTask(input);

export function CommandPalette({
  open,
  onOpenChange,
  onQuickAdd,
  onNavigate,
  onOpenSettings,
  onToggleTheme,
  onScheduleAll,
  currentView,
  theme,
}: CommandPaletteProps) {
  const [value, setValue] = useState('');

  // Derived: parse preview synchronously from value (avoids set-state-in-effect)
  const parsedPreview = useMemo(() => {
    if (!value.trim()) return null;
    const parsed = parseNaturalDate(value);
    // Show preview when any NL metadata is detected
    return parsed.date || parsed.time || parsed.priority || parsed.tags?.length || parsed.duration_minutes
      ? parsed
      : null;
  }, [value]);

  // Reset on close via ref-during-render (canonical external-prop-to-state pattern).
  // The `react-hooks/refs` rule disallows mutating refs during render, but this
  // exact pattern is the documented escape hatch for "derive local state from a
  // prop" (https://react.dev/reference/react/useState#storing-information-from-previous-renders)
  // — it avoids the setState-in-effect anti-pattern. Suppress the lint for the
  // whole block since both the access AND the mutation are intentional.
  /* eslint-disable react-hooks/refs */
  const prevOpenRef = useRef(open);
  if (open !== prevOpenRef.current) {
    prevOpenRef.current = open;
    if (!open && value !== '') {
      setValue('');
    }
  }
  /* eslint-enable react-hooks/refs */

  // Track closing state for exit animation — must be declared before actions useMemo
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleClose = useCallback(() => {
    if (closeTimerRef.current) return; // Already closing — ignore repeat calls
    setClosing(true);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setClosing(false);
      if (openRef.current) onOpenChange(false);
    }, 200);
  }, [onOpenChange]);

  // Sync the open-ref for the timer callback and clean up on unmount.
  /* eslint-disable react-hooks/refs, react-hooks/immutability -- intentional ref mutation to track prop for timer callback */
  const openRef = useRef(open);
  if (open !== openRef.current) openRef.current = open;
  /* eslint-enable react-hooks/refs, react-hooks/immutability */
  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    const parsed = parseNaturalDate(trimmed);
    await onQuickAdd({
      title: parsed.title,
      date: parsed.date,
      time: parsed.time,
      ...(parsed.priority ? { priority: parsed.priority } : {}),
      ...(parsed.tags ? { tags: parsed.tags } : {}),
      ...(parsed.duration_minutes ? { duration_minutes: parsed.duration_minutes } : {}),
      ...(parsed.frequency ? { frequency: parsed.frequency } : {}),
      ...(parsed.recurrence_end ? { recurrence_end: parsed.recurrence_end } : {}),
      ...(parsed.preferred_days ? { preferred_days: parsed.preferred_days } : {}),
    });

    // Friendly toast
    if (parsed.date) {
      const d = new Date(parsed.date);
      const when = isToday(d) ? 'today' : isTomorrow(d) ? 'tomorrow' : format(d, 'EEE, MMM d');
      const at = parsed.time ? ` at ${format(new Date(`2000-01-01T${parsed.time}`), 'h:mm a')}` : '';
      toast.success('Task added', { description: `${when}${at} — we'll find time.` });
    } else {
      toast.success('Task added', { description: 'In your inbox. Auto-schedule when ready.' });
    }

    handleClose();
  };

  const actions = useMemo<PaletteGroup[]>(() => [
    { group: 'Navigate', items: [
      { id: 'view-day', label: 'Day view', icon: Calendar, shortcut: 'D', current: currentView === 'day', action: () => onNavigate('day') },
      { id: 'view-week', label: 'Week view', icon: Calendar, shortcut: 'W', current: currentView === 'week', action: () => onNavigate('week') },
      { id: 'view-month', label: 'Month view', icon: Calendar, shortcut: 'M', current: currentView === 'month', action: () => onNavigate('month') },
    ]},
    { group: 'Actions', items: [
      { id: 'schedule-all', label: 'Schedule everything in inbox', icon: Zap, shortcut: 'S', action: async () => {
        const result = await onScheduleAll();
        if (result && result.count > 0) {
          toast.success('Inbox planned', { description: `${result.count} task${result.count === 1 ? '' : 's'} placed into open slots.` });
        } else if (result && result.unscheduled.length > 0) {
          toast.error('No open slots found', { description: 'Your calendar is full during working hours.' });
        } else {
          toast.info('Nothing to schedule', { description: 'All tasks are already placed on your calendar.' });
        }
      } },
      { id: 'settings', label: 'Open settings', icon: Settings, shortcut: ',', action: () => { onOpenSettings(); handleClose(); } },
    ]},
    { group: 'Appearance', items: [
      { id: 'theme', label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', icon: theme === 'dark' ? Sun : Moon, shortcut: 'T', action: () => { onToggleTheme(); handleClose(); } },
    ]},
  ], [currentView, theme, onNavigate, onScheduleAll, onOpenSettings, onToggleTheme, handleClose]);

  if (!open && !closing) return null;

  const animState = closing ? 'closed' : 'open';

  return (
    <>
      <div
        className="dialog-overlay"
        data-state={animState}
        onClick={handleClose}
        style={{ zIndex: 99 }}
      />
      <div
        className="fixed left-1/2 top-[20vh] z-[100] w-[min(calc(100vw-2rem),580px)] bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        data-state={animState}
        style={{ animation: closing ? 'content-hide 200ms var(--ease-in-out-smooth) forwards' : 'content-show 300ms var(--ease-spring)' }}
      >
        <Command label="Command palette" loop>
          <Command.Input
            value={value}
            onValueChange={setValue}
            placeholder="Type a command, or just type a task..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (value.trim()) {
                  e.preventDefault();
                  handleSubmit();
                }
              }
            }}
          />            {parsedPreview && value.trim() && (
            <div className="px-4 py-2.5 border-b border-border bg-accent/40 flex items-center gap-2.5 text-[12px]">
              <Sparkles className="w-3.5 h-3.5 text-accent-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-foreground font-medium">"{parsedPreview.title}"</span>
                {parsedPreview.date && (
                  <span className="text-muted-foreground">
                    {' — '}
                    {isToday(new Date(parsedPreview.date)) ? 'today' : isTomorrow(new Date(parsedPreview.date)) ? 'tomorrow' : format(new Date(parsedPreview.date), 'EEE, MMM d')}
                  </span>
                )}
                {parsedPreview.time && (
                  <span className="text-muted-foreground"> at {format(new Date(`2000-01-01T${parsedPreview.time}`), 'h:mm a')}</span>
                )}
                {parsedPreview.priority && (
                  <span className={`ml-1.5 font-semibold ${
                    parsedPreview.priority === 'ASAP' ? 'text-destructive' :
                    parsedPreview.priority === 'HIGH' ? 'text-warning' :
                    parsedPreview.priority === 'LOW' ? 'text-muted-foreground' :
                    'text-foreground'
                  }`}>!{parsedPreview.priority.toLowerCase()}</span>
                )}
                {parsedPreview.tags?.map((tag) => (
                  <span key={tag} className="ml-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">#{tag}</span>
                ))}
                {parsedPreview.duration_minutes && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground">~{parsedPreview.duration_minutes}m</span>
                )}
                {parsedPreview.frequency && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-success/10 text-success text-[10px] font-medium">{parsedPreview.frequency}</span>
                )}
                {parsedPreview.preferred_days && parsedPreview.preferred_days.length > 0 && (
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    {parsedPreview.preferred_days.map((d) => ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d]).join(', ')}</span>
                )}
                {parsedPreview.recurrence_end && (
                  <span className="ml-1 text-[10px] text-muted-foreground">until {format(new Date(parsedPreview.recurrence_end), 'MMM d')}</span>
                )}
              </div>
              <kbd className="text-[10px] font-mono text-muted-foreground bg-card px-1.5 py-0.5 rounded border border-border">↵</kbd>
            </div>
          )}

          <Command.List>
            <Command.Empty>
              {value.trim()
                ? <>Press <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">↵</kbd> to add "{value.trim()}" as a task.</>
                : 'Type to search or add a task.'}
            </Command.Empty>

            {value.trim() && (
              <Command.Group heading="Add task">
                <Command.Item
                  value={`add-${value}`}
                  onSelect={handleSubmit}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add "<span className="font-medium">{parsedPreview?.title || value.trim()}</span>"</span>
                  <kbd>↵</kbd>
                </Command.Item>
              </Command.Group>
            )}

            {/* eslint-disable-next-line react-hooks/refs -- actions' callbacks only access refs when invoked in event handlers, not during render */}
            {actions.map((group) => (
              <Command.Group key={group.group} heading={group.group}>
                {group.items.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={item.id}
                    onSelect={() => {
                      item.action();
                      if (item.id !== 'schedule-all') handleClose();
                    }}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                    {item.current && <Check className="w-3 h-3 ml-auto text-primary" />}
                    {item.shortcut && !item.current && <kbd>{item.shortcut}</kbd>}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}

            <Command.Group heading="Tips">
              <Command.Item disabled value="tip-1">
                <span className="text-muted-foreground text-[12px]">Try <span className="font-mono text-foreground">"call dentist tomorrow !high #work ~30m"</span></span>
              </Command.Item>
            </Command.Group>
          </Command.List>

          <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/20 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="font-mono bg-card px-1.5 py-0.5 rounded border border-border text-[10px]">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="font-mono bg-card px-1.5 py-0.5 rounded border border-border text-[10px]">↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="font-mono bg-card px-1.5 py-0.5 rounded border border-border text-[10px]">esc</kbd>
                close
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Inbox className="w-3 h-3" />
              {parsedPreview ? 'Smart add' : 'Quick add'}
            </span>
          </div>
        </Command>
      </div>
    </>
  );
}
