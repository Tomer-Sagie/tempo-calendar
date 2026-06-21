import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useGoogleCalendar } from './hooks/useGoogleCalendar';
import { useTasks } from './hooks/useTasks';
import { useAuth } from './hooks/useAuth';
import { useSubtasks } from './hooks/useSubtasks';
import { useSubtasksBatch } from './hooks/useSubtasksBatch';
import { BentoSidebar } from './components/BentoSidebar';
import { Header } from './components/Header';
import { TempoCalendar, type CalendarEventType } from './components/TempoCalendar';
import { TaskList } from './components/TaskList';


import { VersionBadge } from './components/VersionBadge';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Button } from './components/ui/button';
import { MobileNav } from './components/MobileNav';

import { AlertCircle, Link2, LogIn, Settings2, Calendar, Sparkles, ArrowRight, BarChart3, Layers, WifiOff, Plus } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { format } from 'date-fns';
import { detectConflicts } from './lib/rescheduler';
import { isSupabaseReady } from './lib/supabase';
import { isAllDayTimeString } from './lib/utils';
import { generateRecurringOccurrences } from './lib/recurring';
import { parseEnhancedTask } from './lib/enhancedParser';
import type { Task } from './lib/types';
import type { TaskInput } from './lib/tasks';
import type { OccurrenceEditScope } from './components/OccurrenceEditDialog';
import { useUndoManager } from './hooks/useUndoManager';
import { useTheme } from './hooks/useTheme';
import { useWorkingHours } from './hooks/useWorkingHours';
import { useCalendarSettings } from './hooks/useCalendarSettings';
import { useOfflineDetection } from './hooks/useOfflineDetection';
import { PanelSpinner } from './components/PanelSpinner';

// Lazy-loaded heavy components (code splitting)
const SettingsPanel = lazy(() => import('./components/SettingsPanel').then((m) => ({ default: m.SettingsPanel })));
const OnboardingTour = lazy(() => import('./components/OnboardingTour').then((m) => ({ default: m.OnboardingTour })));
const CommandPalette = lazy(() => import('./components/CommandPalette').then((m) => ({ default: m.CommandPalette })));
const AnalyticsPanel = lazy(() => import('./components/AnalyticsPanel').then((m) => ({ default: m.AnalyticsPanel })));
const OccurrenceEditDialog = lazy(() => import('./components/OccurrenceEditDialog').then((m) => ({ default: m.OccurrenceEditDialog })));
const FocusMode = lazy(() => import('./components/FocusMode').then((m) => ({ default: m.FocusMode })));
const TodayFocusView = lazy(() => import('./components/TodayFocusView').then((m) => ({ default: m.TodayFocusView })));
const KeyboardHelpDialog = lazy(() => import('./components/KeyboardHelpDialog').then((m) => ({ default: m.KeyboardHelpDialog })));
const TaskDialog = lazy(() => import('./components/TaskDialog').then((m) => ({ default: m.TaskDialog })));
const WelcomeWizard = lazy(() => import('./components/WelcomeWizard').then((m) => ({ default: m.WelcomeWizard })));
const ProductPreviewMock = lazy(() => import('./components/ProductPreviewMock').then((m) => ({ default: m.ProductPreviewMock })));
const AuthDialog = lazy(() => import('./components/AuthDialog').then((m) => ({ default: m.AuthDialog })));
const EmptyState = lazy(() => import('./components/EmptyState').then((m) => ({ default: m.EmptyState })));
const ContextualHints = lazy(() => import('./components/ContextualHints').then((m) => ({ default: m.ContextualHints })));
const GettingStartedChecklist = lazy(() => import('./components/GettingStartedChecklist').then((m) => ({ default: m.GettingStartedChecklist })));

function App() {
  const auth = useAuth();
  const tasksHook = useTasks();

  // Ref for the focus-mode-open state, read inside the deletion handler
  // before `focusMode` is declared further down. Avoids putting `focusMode`
  // in the handler's useCallback deps (which would rebuild it on every
  // open/close and re-arm the calendar hook's onEventsDeleted callback).
  const focusModeOpenRef = useRef(false);

  // Two-way Google sync: when the calendar hook's polling detects that
  // one or more Google events have disappeared (the user deleted them
  // in Google Calendar), unlink the local tasks that were synced to
  // those events and toast the user. The task itself is preserved (we
  // just clear the link to the now-gone Google event).
  //
  // Focus Mode is an immersive Pomodoro surface — Sonner renders toasts
  // into a document-level portal so they would pop up on top of the
  // full-screen overlay and break the work session. We suppress the
  // toast while focus mode is open; the unlink still happens silently.
  const handleGoogleEventsDeleted = useCallback(async (deletedIds: string[]) => {
    if (deletedIds.length === 0) return;
    if (focusModeOpenRef.current) return; // Don't disturb Focus Mode
    try {
      const { count, titles } = await tasksHook.unlinkFromGoogleEvents(deletedIds);
      if (count > 0) {
        const description = titles.length <= 2
          ? titles.join(', ')
          : `${titles.slice(0, 2).join(', ')} and ${titles.length - 2} more`;
        toast.warning(
          count === 1 ? 'Task unlinked from Google' : `${count} tasks unlinked from Google`,
          { description: `Deleted in Google: ${description}` }
        );
      }
    } catch {
      // Failed to unlink deleted Google events — error surfaced via state
    }
  }, [tasksHook]);

  // `useGoogleCalendar` now consumes the Google access token from the
  // Supabase session directly (no GIS popups). The token is null until
  // the user signs in via Supabase Google OAuth, at which point the
  // hook auto-fetches events.
  const calendar = useGoogleCalendar({
    accessToken: auth.googleAccessToken,
    onEventsDeleted: handleGoogleEventsDeleted,
  });
  const { theme, toggleTheme, setTheme, useSystemTheme } = useTheme();
  // (useSystemTheme is passed to SettingsPanel below)
  const [workingHours, setWorkingHours] = useWorkingHours();
  const calendarSettings = useCalendarSettings();
  const isOffline = useOfflineDetection();
  const undoManager = useUndoManager();

  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [occurrenceEdit, setOccurrenceEdit] = useState<{
    open: boolean;
    taskId: string;
    occurrenceDate: Date;
    changeType: 'move' | 'resize' | 'complete' | 'skip' | 'edit';
    pendingUpdate: { scheduled_start?: string; scheduled_end?: string; duration_minutes?: number } | null;
  }>({ open: false, taskId: '', occurrenceDate: new Date(), changeType: 'move', pendingUpdate: null });
  const [activeView, setActiveView] = useState<'calendar' | 'tasks' | 'insights' | 'today'>('calendar');
  const [commandOpen, setCommandOpen] = useState(false);
  const [tempoView, setTempoView] = useState<'day' | 'week' | 'month'>('week');
  const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date }>(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const threeMonthsAhead = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    return { start: oneWeekAgo, end: threeMonthsAhead };
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('tempo-sidebar-collapsed') === 'true'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('tempo-sidebar-collapsed', String(sidebarCollapsed)); } catch { /* */ }
  }, [sidebarCollapsed]);
  const [focusMode, setFocusMode] = useState<{ open: boolean; taskId: string | null }>({ open: false, taskId: null });
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [navigateToDate, setNavigateToDate] = useState<Date>(new Date());
  const [showWelcomeWizard, setShowWelcomeWizard] = useState(() => {
    try {
      // Show wizard if user is new (no onboarding completed) and has no tasks
      const hasOnboarded = localStorage.getItem('tempo-onboarded-v2');
      const hasSeenWizard = localStorage.getItem('tempo-welcome-wizard');
      return !hasOnboarded && !hasSeenWizard;
    } catch { return false; }
  });
  const [replayTour, setReplayTour] = useState(false);
  const [showChecklist, setShowChecklist] = useState(() => {
    try {
      const wizardSeen = localStorage.getItem('tempo-welcome-wizard');
      const checklistDone = localStorage.getItem('tempo-checklist-done');
      return (wizardSeen === 'done' || wizardSeen === 'skipped') && !checklistDone;
    } catch { return false; }
  });
  const [skipCalendarGate, setSkipCalendarGate] = useState<boolean>(() => {
    try { return localStorage.getItem('tempo-skip-calendar-gate') === 'true'; } catch { return false; }
  });
  useEffect(() => {
    if (skipCalendarGate) { try { localStorage.setItem('tempo-skip-calendar-gate', 'true'); } catch { /* */ } }
  }, [skipCalendarGate]);
  // Clear the skip flag once Google Calendar is connected so the gate
  // reappears if the user disconnects and signs in fresh later.
  const prevCalAuthRef = useRef(calendar.isAuthenticated);
  useEffect(() => {
    if (calendar.isAuthenticated && !prevCalAuthRef.current && skipCalendarGate) {
      setSkipCalendarGate(false);
      try { localStorage.removeItem('tempo-skip-calendar-gate'); } catch { /* */ }
    }
    prevCalAuthRef.current = calendar.isAuthenticated;
  }, [calendar.isAuthenticated, skipCalendarGate]);
  // Keep the ref in sync so the deletion handler can read it without
  // being rebuilt on every focus-mode open/close.
  useEffect(() => {
    focusModeOpenRef.current = focusMode.open;
  }, [focusMode.open]);
  const didAuthTransitionRef = useRef(auth.isAuthenticated);

  const { tasks: allTasks, refresh } = tasksHook;

  // Subtasks: batch loader for the list view (chip), single-task hook
  // for the in-dialog editor. The dialog wrappers below also call
  // `subtasksBatch.refresh()` so the list chip stays in sync.
  const taskIds = useMemo(() => allTasks.map((t) => t.id), [allTasks]);
  const subtasksBatch = useSubtasksBatch(taskIds);
  const editingTaskSubtasks = useSubtasks(editingTask?.id ?? null);

  // Focus Mode: the task being focused on (may be null while loading or
  // if it was deleted) and the next 5 active, scheduled tasks for the
  // up-next queue.
  const focusCurrentTask = useMemo(() => {
    if (!focusMode.taskId) return null;
    return allTasks.find((t) => t.id === focusMode.taskId) || null;
  }, [focusMode.taskId, allTasks]);

  const focusQueue = useMemo(() => {
    return allTasks
      .filter((t) => t.status === 'active' && t.id !== focusMode.taskId && t.is_scheduled)
      .sort((a, b) => (a.scheduled_start || '').localeCompare(b.scheduled_start || ''))
      .slice(0, 5);
  }, [focusMode.taskId, allTasks]);

  const unscheduledCount = useMemo(
    () => allTasks.filter((t) => t.status === 'active' && !t.is_scheduled).length,
    [allTasks]
  );

  const allEvents = useMemo(() => {
    const googleEvents = calendar.events || [];
    // Only include non-repeating tasks here; repeating tasks generate
    // their own occurrences via generateRecurringOccurrences so the base
    // event is not duplicated.
    const taskEvents = allTasks
      .filter((t) => t.is_scheduled && t.scheduled_start && t.scheduled_end && t.frequency === 'once')
      .map((t) => ({
        id: `task-${t.id}`,
        title: t.title,
        description: t.description || '',
        startTime: t.scheduled_start!,
        endTime: t.scheduled_end!,
        calendar: 'tasks',
        source: 'task' as const,
        color: t.color,
        allDay: isAllDayTimeString(t.scheduled_start!, t.scheduled_end!),
      }));
    return [...googleEvents, ...taskEvents];
  }, [calendar.events, allTasks]);

  const baseEvents = useMemo<CalendarEventType[]>(() => {
    const now = new Date();

    // Base events from allEvents — filter out events with missing/invalid dates
    const baseEvents = allEvents
      .filter((ev) => ev.startTime && ev.endTime)
      .map((ev) => {
      const originalTask = ev.source === 'task'
        ? allTasks.find((t) => `task-${t.id}` === ev.id)
        : null;
      const isMissed = Boolean(
        originalTask?.status === 'missed' ||
        (originalTask?.is_scheduled &&
          originalTask?.scheduled_end &&
          new Date(originalTask.scheduled_end) < now)
      );
      const isCompleted = originalTask?.status === 'completed';
      const isSkipped = originalTask?.status === 'skipped';
      const isLocked = originalTask?.is_locked === true;
      const isBusyBlock = originalTask?.is_busy_block === true;
      const isRecurring = originalTask?.frequency !== 'once';
      const variant: CalendarEventType['variant'] = isSkipped
        ? 'muted'
        : isCompleted
          ? 'muted'
          : isMissed
            ? 'destructive'
            : isLocked
              ? 'success'
              : isBusyBlock
                ? 'primary'
                : isRecurring
                  ? 'warning'
                  : ev.source === 'google'
                    ? 'muted'
                    : 'secondary';

      return {
        id: ev.id,
        title: ev.title,
        start: new Date(ev.startTime),
        end: new Date(ev.endTime),
        variant,
        allDay: ev.allDay || false,
        data: {
          description: ev.description,
          source: ev.source,
          color: ev.color,
          is_locked: isLocked,
          is_missed: isMissed,
          is_completed: isCompleted,
          is_skipped: isSkipped,
          is_busy_block: isBusyBlock,
          is_recurring: isRecurring,
        },
      };
    });

    return baseEvents;
  }, [allEvents, allTasks]);

  // Recurring occurrences: cached separately so non-repeating task changes
  // (title edit, completion, etc.) don't regenerate all 365 occurrences.
  // A stable key derived from only repeating tasks' scheduling fields ensures
  // the memo only recomputes when something relevant actually changes.
  const repeatingKey = useMemo(() =>
    allTasks
      .filter((t) => t.frequency !== 'once' && t.is_scheduled)
      .map((t) => `${t.id}:${t.scheduled_start}:${t.scheduled_end}:${t.frequency}:${JSON.stringify(t.occurrence_overrides)}`)
      .join('|'),
    [allTasks],
  );
  const recurringEvents = useMemo<CalendarEventType[]>(() => {
    const from = new Date(visibleRange.start.getTime() - 7 * 24 * 60 * 60 * 1000);
    const horizon = new Date(visibleRange.end.getTime() + 7 * 24 * 60 * 60 * 1000);
    const events: CalendarEventType[] = [];
    for (const task of allTasks) {
      if (task.frequency !== 'once' && task.is_scheduled && task.scheduled_start && task.scheduled_end) {
        events.push(...generateRecurringOccurrences(task, from, horizon));
      }
    }
    return events;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- repeatingKey captures allTasks' repeating fields
  }, [repeatingKey, visibleRange]);

  const tempoEvents = useMemo<CalendarEventType[]>(() => {
    return [...baseEvents, ...recurringEvents];
  }, [baseEvents, recurringEvents]);

  const handleSaveTask = async (input: TaskInput) => {
    if (editingTask) {
      await tasksHook.update(editingTask.id, input);
      // If this was a recurring task edit from a calendar occurrence,
      // show the scope dialog AFTER saving so the user can choose
      // whether changes apply to this occurrence, future, or all.
      if (
        occurrenceEdit.changeType === 'edit' &&
        occurrenceEdit.taskId === editingTask.id &&
        editingTask.frequency !== 'once'
      ) {
        // Close the task editor first, then open scope dialog
        setShowTaskDialog(false);
        setEditingTask(null);
        setOccurrenceEdit((p) => ({ ...p, open: true, changeType: 'edit' }));
      } else {
        setShowTaskDialog(false);
        setEditingTask(null);
      }
    } else {
      const task = await tasksHook.create(input);
      // Auto-schedule on creation if task is flexible and auto_schedule is enabled
      if (task.auto_schedule !== false && !task.is_scheduled && task.status === 'active' && calendar.isAuthenticated) {
        const slot = await tasksHook.scheduleOne(task, calendar.events);
        if (slot) {
          toast.success('Scheduled', { description: `${task.title} placed into an open slot.` });
        }
      }
    }
  };

  const handleQuickAdd = async (input: string | {
    title: string;
    date?: string;
    time?: string;
    priority?: 'ASAP' | 'HIGH' | 'NORMAL' | 'LOW';
    tags?: string[];
    duration_minutes?: number;
    frequency?: 'daily' | 'weekly';
    recurrence_end?: string;
    preferred_days?: number[];
  }) => {
    // If input is a raw string (from BentoSidebar), run enhanced parser
    const parsed = typeof input === 'string' ? parseEnhancedTask(input) : input;

    await tasksHook.create({
      title: parsed.title,
      duration_minutes: parsed.duration_minutes || 30,
      priority: parsed.priority || 'NORMAL',
      ...('date' in parsed && parsed.date ? { due_date: parsed.date } : {}),
      ...('time' in parsed && parsed.time ? { due_time: parsed.time } : {}),
      ...(parsed.tags ? { tags: parsed.tags } : {}),
      ...(parsed.frequency ? { frequency: parsed.frequency, is_recurring: true } : {}),
      ...(parsed.recurrence_end ? { recurrence_end: parsed.recurrence_end } : {}),
      ...(parsed.preferred_days ? { preferred_days: parsed.preferred_days } : {}),
    });
  };

  // Open Focus Mode on the most relevant active task: prefer a task
  // scheduled for now or in the near future, then by priority + due date.
  const handleOpenFocus = useCallback(() => {
    const priorityRank: Record<string, number> = { ASAP: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
    const active = allTasks.filter((t) => t.status === 'active');
    if (active.length === 0) {
      toast.error('No active tasks to focus on');
      return;
    }
    const sorted = [...active].sort((a, b) => {
      if (a.scheduled_start && !b.scheduled_start) return -1;
      if (!a.scheduled_start && b.scheduled_start) return 1;
      if (a.scheduled_start && b.scheduled_start) return a.scheduled_start.localeCompare(b.scheduled_start);
      const pa = priorityRank[a.priority] ?? 9;
      const pb = priorityRank[b.priority] ?? 9;
      if (pa !== pb) return pa - pb;
      return (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31');
    });
    setFocusMode({ open: true, taskId: sorted[0].id });
  }, [allTasks]);

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task);
    setShowTaskDialog(true);
  }, []);

  const handleScheduleAll = async () => {
    // Capture snapshot for undo before scheduling
    undoManager.capture(tasksHook.tasks, 'Scheduling tasks…');
    const result = await tasksHook.scheduleAll(calendar.events);
    if (result.count > 0) {
      undoManager.showToast({ onRestore: refresh, label: `${result.count} task${result.count === 1 ? '' : 's'} scheduled` });
    } else if (result.unscheduled.length > 0) {
      undoManager.clear();
      // Group reasons for a clearer message
      const noSlotCount = result.unscheduled.filter((u) => u.reason.includes('No available time slot')).length;
      const depCount = result.unscheduled.filter((u) => u.reason.includes('dependency')).length;
      if (noSlotCount === result.unscheduled.length) {
        toast.error('No open slots found', {
          description: 'Your calendar is full during working hours. Free up some time or adjust working hours in Settings.',
        });
      } else if (depCount > 0) {
        toast.warning('Some tasks blocked', {
          description: `${depCount} task${depCount === 1 ? '' : 's'} waiting on dependencies.`,
        });
      } else {
        const reasonCounts = result.unscheduled.reduce<Map<string, number>>((map, u) => {
          map.set(u.reason, (map.get(u.reason) || 0) + 1);
          return map;
        }, new Map());
        const desc = Array.from(reasonCounts.entries())
          .map(([reason, count]) => `${count} task${count === 1 ? '' : 's'}: ${reason}`)
          .join('; ');
        toast.info('Could not schedule tasks', { description: desc });
      }
    } else {
      undoManager.clear();
      toast.info('Nothing to schedule', { description: 'All tasks are already placed on your calendar.' });
    }
    return result;
  };

  const handleUnschedule = async (id: string) => {
    // Capture snapshot for undo before unscheduling
    const task = tasksHook.tasks.find((t) => t.id === id);
    undoManager.capture(tasksHook.tasks, 'Task unscheduled');
    await tasksHook.unschedule(id);
    undoManager.showToast({ onRestore: refresh, label: `${task?.title ?? 'Task'} unscheduled` });
  };

  // Delete task with undo toast — shared by TaskList and TaskDialog
  const handleDeleteTask = useCallback(async (id: string) => {
    const deletedTask = allTasksRef.current.find((t) => t.id === id);
    await tasksHookRef.current.remove(id);
    if (deletedTask) {
      toast.success(`"${deletedTask.title}" deleted`, {
        description: 'Click Undo to restore.',
        action: {
          label: 'Undo',
          onClick: async () => {
            await tasksHookRef.current.create({
              title: deletedTask.title,
              description: deletedTask.description || undefined,
              duration_minutes: deletedTask.duration_minutes,
              priority: deletedTask.priority,
              frequency: deletedTask.frequency,
              due_date: deletedTask.due_date || undefined,
              due_time: deletedTask.due_time || undefined,
              color: deletedTask.color,
              tags: deletedTask.tags || undefined,
              preferred_days: deletedTask.preferred_days || undefined,
              preferred_time_windows: deletedTask.preferred_time_windows || undefined,
              notes: deletedTask.notes || undefined,
              deadline: deletedTask.deadline || undefined,
              is_locked: deletedTask.is_locked,
              auto_schedule: deletedTask.auto_schedule,
              is_habit: deletedTask.is_habit,
              can_split: deletedTask.can_split,
              is_busy_block: deletedTask.is_busy_block,
              scheduling_cutoff_weeks: deletedTask.scheduling_cutoff_weeks,
              list_id: deletedTask.list_id || undefined,
              scheduling_profile_id: deletedTask.scheduling_profile_id || undefined,
              scheduled_start: deletedTask.scheduled_start || undefined,
              scheduled_end: deletedTask.scheduled_end || undefined,
              is_scheduled: deletedTask.is_scheduled,
            });
            toast.success('Task restored');
            await refresh();
          },
        },
        duration: 8000,
      });
    }
  }, [refresh]);

  // Debounced auto-schedule: batches rapid task completions into a single
  // scheduleAll call so we don't fire the scheduler N times in quick succession.
  const autoScheduleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (autoScheduleTimerRef.current) clearTimeout(autoScheduleTimerRef.current); }, []);
  const triggerAutoSchedule = useCallback(() => {
    if (autoScheduleTimerRef.current) clearTimeout(autoScheduleTimerRef.current);
    autoScheduleTimerRef.current = setTimeout(async () => {
      if (calendarRef.current.isAuthenticated) {
        const result = await tasksHookRef.current.scheduleAll(calendarRef.current.events);
        if (result.count > 0) {
          toast.success('Rescheduled', { description: `${result.count} task${result.count === 1 ? '' : 's'} placed into open slots.` });
        }
      }
    }, 500);
  }, []);

  // Auto-schedule on task completion: fill the vacated slot
  const handleCompleteTask = useCallback(async (id: string) => {
    await tasksHookRef.current.complete(id);
    triggerAutoSchedule();
  }, [triggerAutoSchedule]);

  // Auto-import calendar names as task lists on first calendar connect.
  // Uses a localStorage flag so it only runs once per calendar set.
  useEffect(() => {
    if (!calendar.isAuthenticated || calendar.calendars.length === 0) return;
    try {
      const stored = localStorage.getItem('tempo-cal-lists-synced');
      const syncedIds: string[] = stored ? JSON.parse(stored) : [];
      const syncedSet = new Set(syncedIds);
      const writable = calendar.calendars.filter(
        (c) => !syncedSet.has(c.id) && c.accessRole !== 'reader' && c.accessRole !== 'freeBusyReader',
      );
      if (writable.length === 0) return;
      (async () => {
        const succeeded: string[] = [];
        for (const cal of writable) {
          try {
            await tasksHook.createList(cal.summary || cal.id, cal.backgroundColor || '#6366f1');
            succeeded.push(cal.id);
          } catch { /* ignore duplicates or RLS errors — will retry next time */ }
        }
        if (succeeded.length > 0) {
          const allSynced = [...syncedIds, ...succeeded];
          try { localStorage.setItem('tempo-cal-lists-synced', JSON.stringify(allSynced)); } catch { /* */ }
        }
      })();
    } catch { /* best-effort */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tasksHook.createList is the actual dependency; tasksHook identity would cause unnecessary re-runs
  }, [calendar.isAuthenticated, calendar.calendars, tasksHook.createList]);

  // Auto-schedule on calendar changes: detect new Google events and reschedule
  const prevCalendarEventsRef = useRef<typeof calendar.events>([]);
  // Mirror frequently-changing values into refs so callbacks and effects
  // can read the latest without listing them in dependency arrays.
  const allTasksRef = useRef(tasksHook.tasks);
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => { allTasksRef.current = tasksHook.tasks; }, [tasksHook.tasks]);
  const tasksHookRef = useRef(tasksHook);
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => { tasksHookRef.current = tasksHook; }, [tasksHook]);
  useEffect(() => {
    if (!calendar.isAuthenticated) return;
    const prev = prevCalendarEventsRef.current;
    const curr = calendar.events;
    prevCalendarEventsRef.current = curr;
    // Skip first render
    if (prev.length === 0 && curr.length > 0) return;
    // Detect if Google events changed (count differs or IDs differ)
    const prevGoogleIds = new Set(prev.filter((e) => e.source === 'google').map((e) => e.id));
    const currGoogleIds = new Set(curr.filter((e) => e.source === 'google').map((e) => e.id));
    const changed = prevGoogleIds.size !== currGoogleIds.size ||
      [...currGoogleIds].some((id) => !prevGoogleIds.has(id));
    if (changed) {
      const currentTasks = allTasksRef.current;
      if (currentTasks.some((t) => t.is_scheduled)) {
        const conflicts = detectConflicts(
          currentTasks.filter((t) => t.is_scheduled),
          curr,
        );
        if (conflicts.length > 0) {
          // Auto-resolve conflicts silently
          void (async () => {
            try {
              await tasksHookRef.current.reschedule(curr);
            } catch { /* best-effort */ }
          })();
        }
      }
    }
  }, [calendar.events, calendar.isAuthenticated]);

  // Auto-complete the parent task when all its subtasks are done.
  // Triggers only when the batch's subtask map or the editing task id
  // changes. Reads the current task from `tasksHook.tasks` via a ref so
  // the toast doesn't re-fire if the user toggles another subtask after
  // auto-completion.
  //
  // Debounced by 400ms: if a user is rapidly toggling the last remaining
  // subtask on/off, we wait for a stable "all done" state before firing
  // the auto-complete. This avoids two concurrent requests racing to
  // flip the parent's status.

  useEffect(() => {
    if (!editingTask) return;
    const subs = subtasksBatch.byTaskId.get(editingTask.id) || [];
    if (subs.length === 0) return;
    if (!subs.every((s) => s.completed)) return;
    const timer = setTimeout(() => {
      // Re-read the latest state via the ref so the timer closure always
      // sees the current tasks array without adding it to the deps.
      const current = tasksHookRef.current.tasks.find((t) => t.id === editingTask.id);
      if (current && current.status === 'active') {
        tasksHookRef.current.complete(editingTask.id);
        toast.success('All subtasks done — task auto-completed!');
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [subtasksBatch.byTaskId, editingTask]);

  // Dynamic page title (Prompt 56)
  useEffect(() => {
    const viewLabels: Record<string, string> = {
      calendar: 'Calendar',
      tasks: 'Tasks',
      insights: 'Insights',
      today: 'Today',
    };
    const viewLabel = viewLabels[activeView] || 'Calendar';
    document.title = viewLabel === 'Calendar' ? 'Tempo Calendar' : `${viewLabel} — Tempo Calendar`;
  }, [activeView]);

  useEffect(() => {
    if (auth.isAuthenticated && !didAuthTransitionRef.current) refresh();
    didAuthTransitionRef.current = auth.isAuthenticated;
  }, [auth.isAuthenticated, refresh]);

  // Re-fetch Google events when the visible calendar range changes so
  // the user always sees imported events for the window they are looking at.
  // Mirror `calendar` into a ref so the effect can call `refreshEvents`
  // without listing the whole `calendar` object in its deps.
  const calendarRef = useRef(calendar);
  // eslint-disable-next-line react-hooks/immutability -- holding a cached ref to avoid effect deps on calendar object
  useEffect(() => { calendarRef.current = calendar; }, [calendar]);

  useEffect(() => {
    if (calendarRef.current.isAuthenticated) {
      void calendarRef.current.refreshEvents(visibleRange);
    }
  }, [visibleRange]);

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    onOpenPalette: () => setCommandOpen((v) => !v),
    onQuickAdd: () => setCommandOpen(true),
    onNavigateDay: () => setTempoView('day'),
    onNavigateWeek: () => setTempoView('week'),
    onNavigateMonth: () => setTempoView('month'),
    onToday: () => setNavigateToDate(new Date()),
    onScheduleAll: handleScheduleAll,
    onOpenFocus: handleOpenFocus,
    onShowHelp: () => setShowKeyboardHelp(true),
  });

  const handleCreateFirstTask = useCallback(async (title: string, duration: number) => {
    const task = await tasksHookRef.current.create({ title, duration_minutes: duration, priority: 'NORMAL' });
    if (calendarRef.current.isAuthenticated && !task.is_scheduled) {
      await tasksHookRef.current.scheduleOne(task, calendarRef.current.events);
    }
    try { localStorage.setItem('tempo-welcome-wizard', 'done'); } catch { /* */ }
  }, []);

  /**
   * Trigger a Supabase Google OAuth re-auth with Calendar scopes. The
   * page will redirect to Google; on return, the session will include
   * a `provider_token` that flows into `auth.googleAccessToken` and
   * the calendar auto-connects.
   */
  const handleConnectCalendar = async () => {
    try {
      await auth.connectGoogleCalendar();
    } catch (err) {
      toast.error('Could not connect Google Calendar', {
        description: err instanceof Error ? err.message : 'Please try again later.',
      });
    }
  };

  const handleSelectSlot = useCallback(() => {
    setEditingTask(null);
    setShowTaskDialog(true);
  }, []);

  const handleEventDrop = async (eventId: string, newStart: Date, newEnd: Date) => {
    if (!eventId.startsWith('task-')) {
      toast.error('Google events are read-only here');
      return;
    }
    // Defensive: guard against undefined dates from drag computation
    if (!newStart || !newEnd || isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) return;
    const m = eventId.match(/^task-(.+?)(?:-occ-.+)?$/);
    const taskId = m?.[1] ?? '';
    if (!taskId) return;
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    // Recurring occurrences: show scope dialog
    if (eventId.includes('-occ-')) {
      const occDate = newStart;
      setOccurrenceEdit({
        open: true,
        taskId,
        occurrenceDate: occDate,
        changeType: 'move',
        pendingUpdate: {
          scheduled_start: newStart.toISOString(),
          scheduled_end: newEnd.toISOString(),
        },
      });
      return;
    }

    try {
      await tasksHook.update(taskId, {
        is_scheduled: true,
        scheduled_start: newStart.toISOString(),
        scheduled_end: newEnd.toISOString(),
      });
      toast.success('Moved', { description: `Rescheduled to ${format(newStart, 'EEE h:mm a')}` });
    } catch (err) {
      toast.error('Could not reschedule', { description: err instanceof Error ? err.message : 'Unknown error' });
    }
  };

  const handleEventResize = async (eventId: string, newStart: Date, newEnd: Date) => {
    if (!eventId.startsWith('task-')) {
      toast.error('Google events are read-only here');
      return;
    }
    if (!newStart || !newEnd || isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) return;
    const m = eventId.match(/^task-(.+?)(?:-occ-.+)?$/);
    const taskId = m?.[1] ?? '';
    if (!taskId) return;
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    // Recurring occurrences: show scope dialog
    if (eventId.includes('-occ-')) {
      const occDate = newStart;
      const durationMin = Math.round((newEnd.getTime() - newStart.getTime()) / (60 * 1000));
      setOccurrenceEdit({
        open: true,
        taskId,
        occurrenceDate: occDate,
        changeType: 'resize',
        pendingUpdate: {
          scheduled_start: newStart.toISOString(),
          scheduled_end: newEnd.toISOString(),
          duration_minutes: durationMin,
        },
      });
      return;
    }

    const durationMin = Math.round((newEnd.getTime() - newStart.getTime()) / (60 * 1000));
    if (durationMin < 5) {
      toast.error('Too short', { description: 'Events must be at least 5 minutes long' });
      return;
    }
    try {
      await tasksHook.update(taskId, {
        is_scheduled: true,
        scheduled_start: newStart.toISOString(),
        scheduled_end: newEnd.toISOString(),
        duration_minutes: durationMin,
      });
      toast.success('Resized', { description: `${format(newStart, 'h:mma')} – ${format(newEnd, 'h:mma')}` });
    } catch (err) {
      toast.error('Could not resize', { description: err instanceof Error ? err.message : 'Unknown error' });
    }
  };

  const handleSelectEvent = useCallback((event: CalendarEventType) => {
    if (!event.id.startsWith('task-')) return;
    const m = event.id.match(/^task-(.+?)(?:-occ-.+)?$/);
    const taskId = m?.[1] ?? '';
    const task = allTasksRef.current.find((t) => t.id === taskId);
    if (!task) return;

    if (event.id.includes('-occ-')) {
      setOccurrenceEdit({
        open: false,
        taskId,
        occurrenceDate: event.start,
        changeType: 'edit',
        pendingUpdate: null,
      });
    }

    setEditingTask(task);
    setShowTaskDialog(true);
  }, []);

  // Supabase not configured: configuration error screen
  if (!isSupabaseReady()) {
    return (
      <div className="min-h-[100dvh] flex flex-col app-gradient">
        <Header
          activeView="calendar"
          onViewChange={() => {}}
          isAuthenticated={false}
          onRefresh={() => {}}
          onScheduleAll={() => {}}
          unscheduledCount={0}
        />
        <main id="main-content" className="flex-1 grid place-items-center px-6 py-12">
          <div className="w-full max-w-[460px] rounded-2xl bg-card p-8 shadow-md border border-border">
            <div className="w-11 h-11 rounded-xl bg-destructive/10 flex items-center justify-center mb-5">
              <Settings2 className="w-5 h-5 text-destructive" />
            </div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">Configuration Required</h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Tempo needs Supabase environment variables to function. Add these to your Vercel project settings:
            </p>
            <div className="mt-4 p-3.5 bg-muted/50 rounded-xl text-[12px] font-mono text-muted-foreground space-y-1.5 border border-border">
              <div>VITE_SUPABASE_URL=https://your-project.supabase.co</div>
              <div>VITE_SUPABASE_ANON_KEY=your-anon-key</div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
              Find these in your{' '}
              <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline underline-offset-2 hover:text-primary/80">
                Supabase dashboard
              </a>
              {' '}→ Project Settings → API.
            </p>
          </div>
        </main>
      <VersionBadge />
    </div>
  );
}

  // Not signed in to Tempo: sign-in prompt
  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-[100dvh] flex flex-col app-gradient">
        <Header
          activeView="calendar"
          onViewChange={() => {}}
          isAuthenticated={false}
          onRefresh={calendar.refreshEvents}
          onScheduleAll={handleScheduleAll}
          unscheduledCount={unscheduledCount}
        />
        <main id="main-content" className="flex-1 grid lg:grid-cols-[1.1fr_1fr] gap-8 items-center px-6 lg:px-16 py-10 max-w-[1280px] mx-auto w-full">
          {/* Left: copy + CTA */}
          <div className="max-w-[520px]">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              Calendar + tasks, finally
            </div>
            <h1 className="mt-5 text-4xl lg:text-5xl font-bold text-foreground leading-[1.1] tracking-tight">
              Tasks find their own time.
            </h1>
            <p className="mt-5 text-base lg:text-lg text-muted-foreground leading-relaxed">
              Tempo reads your calendar, finds open slots, and places your work where it belongs. You describe the task. We handle the schedule.
            </p>

            {/* Value props */}
            <ul className="mt-7 space-y-3">
              {[
                { icon: Calendar, title: 'Auto-schedule', body: 'Type a task, pick a time, done. Tempo places it into open space on your Google Calendar.' },
                { icon: Layers, title: 'Smart reschedule', body: 'When something shifts, one click rebuilds a conflict-free plan for the rest of the day.' },
                { icon: BarChart3, title: 'Streaks + insights', body: 'Track what you actually ship. Daily streak, completion rate, and overdue counts at a glance.' },
              ].map((p) => (
                <li key={p.title} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <p.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{p.title}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">{p.body}</div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex items-center gap-3 flex-wrap">
              <Button
                onClick={() => setShowAuthDialog(true)}
                size="lg"
                className="h-12 px-6 gap-2 text-sm font-semibold shadow-sm"
              >
                <LogIn className="w-4 h-4" />
                Sign in to get started
                <ArrowRight className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                Free during beta. No credit card.
              </span>
            </div>
          </div>

          {/* Right: product preview (desktop only) */}
          <div className="hidden lg:block">
            <Suspense fallback={<PanelSpinner />}>
            <ProductPreviewMock />
            </Suspense>
          </div>
          </main>
        <Suspense fallback={null}>
        <AuthDialog open={showAuthDialog} onClose={() => setShowAuthDialog(false)} />
        </Suspense>
      <Suspense fallback={<PanelSpinner />}>
      <SettingsPanel
        open={showSettings}
        onClose={() => setShowSettings(false)}
        theme={theme}
        onSetTheme={setTheme}
        onUseSystemTheme={useSystemTheme}
        user={auth.user}
        isGoogleConnected={calendar.isAuthenticated}
        onDisconnectGoogle={calendar.disconnect}
        onSignOut={auth.signOut}
        workingHours={workingHours}
        onWorkingHoursChange={setWorkingHours}
        lastSyncAt={calendar.lastSyncAt}
        syncedEventCount={calendar.events.length}
        syncError={calendar.error?.message ?? null}
        isSyncing={calendar.isLoading}
        calendars={calendar.calendars}
        selectedCalendarIds={calendar.selectedCalendarIds}
        onToggleCalendar={calendar.toggleCalendarSelection}
        weekStartsOn={calendarSettings.weekStartsOn}
        onWeekStartsOnChange={calendarSettings.setWeekStartsOn}
        timeFormat={calendarSettings.timeFormat}
        onTimeFormatChange={calendarSettings.setTimeFormat}
        density={calendarSettings.density}
        onDensityChange={calendarSettings.setDensity}
        schedulingProfiles={tasksHook.schedulingProfiles}
        taskLists={tasksHook.taskLists}
        onCreateList={async (name, color) => { try { await tasksHook.createList(name, color); toast.success('List created'); } catch (err) { toast.error('Could not create list', { description: err instanceof Error ? err.message : 'Unknown error' }); } }}
        onUpdateList={async (id, updates) => { try { await tasksHook.updateList(id, updates); } catch (err) { toast.error('Could not update list', { description: err instanceof Error ? err.message : 'Unknown error' }); } }}
        onDeleteList={async (id) => { try { await tasksHook.deleteList(id); toast.success('List deleted'); } catch (err) { toast.error('Could not delete list', { description: err instanceof Error ? err.message : 'Unknown error' }); } }}
        onCreateProfile={async (input) => { try { await tasksHook.createProfile(input); toast.success('Profile created'); } catch (err) { toast.error('Could not create profile', { description: err instanceof Error ? err.message : 'Unknown error' }); } }}
        onUpdateProfile={async (id, updates) => { try { await tasksHook.updateProfile(id, updates); } catch (err) { toast.error('Could not update profile', { description: err instanceof Error ? err.message : 'Unknown error' }); } }}
        onDeleteProfile={async (id) => { try { await tasksHook.deleteProfile(id); toast.success('Profile deleted'); } catch (err) { toast.error('Could not delete profile', { description: err instanceof Error ? err.message : 'Unknown error' }); } }}
      />
      </Suspense>
      </div>
    );
  }

  // Not authenticated with Google: connect calendar screen (skip-able)
  if (!calendar.isAuthenticated && !skipCalendarGate) {
    if (!calendar.isLoaded || calendar.isLoading) {
      return (
        <div className="min-h-[100dvh] flex items-center justify-center app-gradient">
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
            <span className="text-sm font-medium">Loading</span>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-[100dvh] flex flex-col app-gradient">
        <Header
          activeView="calendar"
          onViewChange={() => {}}
          isAuthenticated={false}
          onRefresh={calendar.refreshEvents}
          onScheduleAll={handleScheduleAll}
          unscheduledCount={unscheduledCount}
        />
        <main id="main-content" className="flex-1 grid lg:grid-cols-[1.1fr_1fr] gap-8 items-center px-6 lg:px-16 py-10 max-w-[1280px] mx-auto w-full overflow-y-auto tempo-scrollbar">
            {/* Left: copy + CTA */}
            <div className="max-w-[520px]">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                One last step
              </div>
            <h1 className="mt-5 text-4xl lg:text-5xl font-bold text-foreground leading-[1.1] tracking-tight">
              Connect your calendar.
            </h1>
              <p className="mt-5 text-base lg:text-lg text-muted-foreground leading-relaxed">
                Tempo reads your Google Calendar to find open time. We&rsquo;ll place your tasks where they actually fit.
              </p>

              {/* Value props */}
              <ul className="mt-7 space-y-3">
                {[
                  { icon: Calendar, title: 'Import events', body: 'Existing meetings show up instantly as busy blocks. Tasks will never overlap them.' },
                  { icon: Layers, title: 'Find space', body: 'Tempo scans your week for open slots that match your working hours and preferences.' },
                  { icon: BarChart3, title: 'Sync tasks', body: 'Scheduled tasks push back to Google Calendar. One source of truth, always.' },
                ].map((p) => (
                  <li key={p.title} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <p.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{p.title}</div>
                      <div className="text-xs text-muted-foreground leading-relaxed">{p.body}</div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex items-center gap-3 flex-wrap">
                <Button
                  onClick={handleConnectCalendar}
                  disabled={calendar.isLoading}
                  size="lg"
                  className="h-12 px-6 gap-2 text-sm font-semibold shadow-sm"
                >
                  <Link2 className="w-4 h-4" />
                  {calendar.isLoading ? 'Connecting…' : 'Connect Google Calendar'}
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  You&rsquo;ll be redirected to Google to grant read access. You can disconnect anytime.
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSkipCalendarGate(true)}
                className="mt-3 text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                Skip for now
              </button>

              {calendar.error && (
                <div className="mt-5 p-4 bg-destructive/5 border border-destructive/20 rounded-lg space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-sm text-destructive text-left leading-relaxed">{calendar.error.message}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right: product preview (desktop only) */}
            <div className="hidden lg:block">
              <Suspense fallback={<PanelSpinner />}>
              <ProductPreviewMock />
              </Suspense>
            </div>
          </main>
      <Suspense fallback={<PanelSpinner />}>
      <SettingsPanel
        open={showSettings}
        onClose={() => setShowSettings(false)}
        theme={theme}
        onSetTheme={setTheme}
        onUseSystemTheme={useSystemTheme}
        user={auth.user}
        isGoogleConnected={false}
        onDisconnectGoogle={() => {}}
        onSignOut={auth.signOut}
        workingHours={workingHours}
        onWorkingHoursChange={setWorkingHours}
        lastSyncAt={calendar.lastSyncAt}
        syncedEventCount={0}
        syncError={calendar.error?.message ?? null}
        isSyncing={calendar.isLoading}
        calendars={[]}
        selectedCalendarIds={[]}
        onToggleCalendar={() => {}}
        weekStartsOn={calendarSettings.weekStartsOn}
        onWeekStartsOnChange={calendarSettings.setWeekStartsOn}
        timeFormat={calendarSettings.timeFormat}
        onTimeFormatChange={calendarSettings.setTimeFormat}
        density={calendarSettings.density}
        onDensityChange={calendarSettings.setDensity}
        schedulingProfiles={tasksHook.schedulingProfiles}
        taskLists={tasksHook.taskLists}
        onCreateList={async (name, color) => { try { await tasksHook.createList(name, color); toast.success('List created'); } catch (err) { toast.error('Could not create list', { description: err instanceof Error ? err.message : 'Unknown error' }); } }}
        onUpdateList={async (id, updates) => { try { await tasksHook.updateList(id, updates); } catch (err) { toast.error('Could not update list', { description: err instanceof Error ? err.message : 'Unknown error' }); } }}
        onDeleteList={async (id) => { try { await tasksHook.deleteList(id); toast.success('List deleted'); } catch (err) { toast.error('Could not delete list', { description: err instanceof Error ? err.message : 'Unknown error' }); } }}
        onCreateProfile={async (input) => { try { await tasksHook.createProfile(input); toast.success('Profile created'); } catch (err) { toast.error('Could not create profile', { description: err instanceof Error ? err.message : 'Unknown error' }); } }}
        onUpdateProfile={async (id, updates) => { try { await tasksHook.updateProfile(id, updates); } catch (err) { toast.error('Could not update profile', { description: err instanceof Error ? err.message : 'Unknown error' }); } }}
        onDeleteProfile={async (id) => { try { await tasksHook.deleteProfile(id); toast.success('Profile deleted'); } catch (err) { toast.error('Could not delete profile', { description: err instanceof Error ? err.message : 'Unknown error' }); } }}
      />
      </Suspense>
      </div>
    );
  }

  // Authenticated: full workspace
  return (
    <div className="h-[100dvh] flex flex-col app-gradient">
      <ErrorBoundary>
      <div
        className="flex-1 flex flex-col min-w-0"
        inert={focusMode.open && calendar.isAuthenticated ? true : undefined}
      >
      <Header
        activeView={activeView}
        onViewChange={setActiveView}
        isAuthenticated={calendar.isAuthenticated}
        onRefresh={calendar.refreshEvents}
        onScheduleAll={handleScheduleAll}
        unscheduledCount={unscheduledCount}
        onOpenFocus={handleOpenFocus}
        onOpenSettings={() => setShowSettings(true)}
        calendars={calendar.calendars}
        selectedCalendarIds={calendar.selectedCalendarIds}
        lastSyncAt={calendar.lastSyncAt}
        isSyncing={calendar.isLoading}
      />

      <Suspense fallback={null}>
      <ContextualHints
        unscheduledCount={unscheduledCount}
        taskCount={allTasks.length}
        hasCalendar={calendar.isAuthenticated}
        onScheduleAll={handleScheduleAll}
        onOpenKeyboardHelp={() => setShowKeyboardHelp(true)}
        onConnectCalendar={handleConnectCalendar}
      />
      </Suspense>

      {/* Getting-started checklist — shows after WelcomeWizard */}
      {showChecklist && calendar.isAuthenticated && (allTasks.length < 3 || unscheduledCount > 0) && (
        <Suspense fallback={null}>
        <GettingStartedChecklist
          taskCount={allTasks.length}
          unscheduledCount={unscheduledCount}
          isOnCalendarView={activeView === 'calendar'}
          onAddTask={() => { setEditingTask(null); setShowTaskDialog(true); }}
          onScheduleAll={handleScheduleAll}
          onViewCalendar={() => setActiveView('calendar')}
          onDismiss={() => {
            setShowChecklist(false);
            try { localStorage.setItem('tempo-checklist-done', 'true'); } catch { /* */ }
          }}
        />
        </Suspense>
      )}

      {/* Offline banner */}
      {isOffline && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 px-4 py-2 bg-warning/5 border-b border-warning/20 text-sm text-warning"
        >
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>You&rsquo;re offline — changes will sync when you reconnect.</span>
        </div>
      )}

      {/* Error banners */}
      {calendar.error && (
        <div role="alert" className="flex items-center gap-2 px-4 py-2 bg-destructive/5 border-b border-destructive/20 text-sm text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {calendar.error.message}
        </div>
      )}

      {tasksHook.error && (
        <div role="alert" className="flex items-center gap-2 px-4 py-2 bg-destructive/5 border-b border-destructive/20 text-sm text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {tasksHook.error}
        </div>
      )}

      {tasksHook.syncErrors.length > 0 && (
        <div
          role="alert"
          className="flex items-center gap-3 px-4 py-2.5 bg-destructive/5 border-b border-destructive/20 text-sm text-destructive cursor-pointer"
          onClick={tasksHook.clearSyncErrors}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 min-w-0">
            {tasksHook.syncErrors.length === 1
              ? tasksHook.syncErrors[0]
              : `${tasksHook.syncErrors.length} sync errors`}
          </span>
          <span className="text-[10px] font-medium opacity-70">Click to dismiss</span>
        </div>
      )}

      {/* Main workspace — skip-to-content target */}
      <div id="main-content" className="flex-1 flex overflow-hidden [overflow-clip-margin:0px]">
        {/* Calendar workspace */}
        <div
          data-onboarding="calendar"
          className={`flex-1 flex flex-col min-w-0 p-3 gap-3 ${activeView === 'calendar' || activeView === 'today' ? '' : activeView === 'insights' ? 'hidden' : 'hidden lg:flex'}`}
        >
          {activeView === 'calendar' && allTasks.length === 0 && calendar.events.length === 0 && !tasksHook.isLoading && (
            <Suspense fallback={null}>
            <EmptyState
              variant="calendar-empty"
              onAction={() => { setEditingTask(null); setShowTaskDialog(true); }}
              className="flex-1"
            />
            </Suspense>
          )}
          {activeView === 'today' ? (
              <Suspense fallback={<PanelSpinner />}>
              <TodayFocusView
                tasks={allTasks}
                onSelectTask={handleEditTask}
                onAddTask={() => { setEditingTask(null); setShowTaskDialog(true); }}
                onClose={() => setActiveView('calendar')}
                startHour={parseInt(workingHours.start.split(':')[0], 10)}
                endHour={parseInt(workingHours.end.split(':')[0], 10) + 2}
                timeFormat={calendarSettings.timeFormat}
              />
              </Suspense>
            ) : (
            <TempoCalendar
            events={tempoEvents}
            defaultView={tempoView}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            onViewRangeChange={setVisibleRange}
            navigateToDate={navigateToDate}
            startHour={0}
            endHour={24}
            weekStartsOn={calendarSettings.weekStartsOn}
            timeFormat={calendarSettings.timeFormat}
            calendars={calendar.calendars}
            selectedCalendarIds={calendar.selectedCalendarIds}
            onToggleCalendar={calendar.toggleCalendarSelection}
            className="min-h-0"
          />
            )}
        </div>

        {/* Sidebar — Bento on calendar view, full TaskList on tasks view, hidden on insights */}
        {/* Sidebar collapse/expand toggle — always visible when on calendar view */}
        {activeView === 'calendar' && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="self-start mt-3 z-10 w-5 h-8 rounded-l border border-r-0 border-border/40 bg-card hover:bg-accent text-muted-foreground flex items-center justify-center transition-colors shrink-0"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <polyline points={sidebarCollapsed ? '3 2 7 5 3 8' : '7 2 3 5 7 8'} />
            </svg>
          </button>
        )}
        <div
          data-onboarding="quick-add"
          className={`${sidebarCollapsed ? '-mr-80 lg:-mr-[340px] opacity-0 pointer-events-none' : 'mr-0 opacity-100 border-l border-border/40'} w-80 lg:w-[340px] flex flex-col shrink-0 bg-card/50 transition-[margin-right,opacity] duration-200 ease-out ${activeView === 'calendar' ? '' : 'hidden lg:flex'} ${activeView === 'insights' ? 'lg:hidden' : ''}`}
        >
          {activeView === 'calendar' ? (
            <BentoSidebar
              tasks={allTasks}
              isLoading={tasksHook.isLoading}
              onQuickAdd={handleQuickAdd}
              onAddTask={() => { setEditingTask(null); setShowTaskDialog(true); }}
              onSelectTask={handleEditTask}
              onViewAllTasks={() => setActiveView('tasks')}
            />
          ) : activeView === 'tasks' ? (
            <TaskList
              tasks={tasksHook.tasks}
              isLoading={tasksHook.isLoading}
              onAddTask={() => { setEditingTask(null); setShowTaskDialog(true); }}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
              onScheduleAll={handleScheduleAll}
              onUnschedule={handleUnschedule}
              onCompleteTask={handleCompleteTask}
              onReopenTask={tasksHook.reopen}
              taskLists={tasksHook.taskLists}
              onBackToCalendar={() => setActiveView('calendar')}
              subtasksByTaskId={subtasksBatch.byTaskId}
              onCreateList={async (name, color) => { try { await tasksHook.createList(name, color); toast.success('List created'); } catch (err) { toast.error('Could not create list', { description: err instanceof Error ? err.message : 'Unknown error' }); } }}
              onUpdateList={async (id, updates) => { try { await tasksHook.updateList(id, updates); } catch (err) { toast.error('Could not update list', { description: err instanceof Error ? err.message : 'Unknown error' }); } }}
              onDeleteList={async (id) => { try { await tasksHook.deleteList(id); toast.success('List deleted'); } catch (err) { toast.error('Could not delete list', { description: err instanceof Error ? err.message : 'Unknown error' }); } }}
              onSkipNext={(taskId) => {
                const task = allTasks.find((t) => t.id === taskId);
                if (!task) return;
                setOccurrenceEdit({
                  open: true,
                  taskId,
                  occurrenceDate: new Date(),
                  changeType: 'skip',
                  pendingUpdate: null,
                });
              }}
            />
          ) : null}
        </div>

        {/* Insights view — full-screen analytics panel */}
        {activeView === 'insights' && (
          <Suspense fallback={<PanelSpinner />}>
          <AnalyticsPanel
            tasks={tasksHook.tasks}
            onClose={() => setActiveView('calendar')}
          />
          </Suspense>
        )}
      </div>

      {/* Dialogs */}
      <Suspense fallback={null}>
      <AuthDialog open={showAuthDialog} onClose={() => setShowAuthDialog(false)} />
      </Suspense>

      <Suspense fallback={<PanelSpinner />}>
      <SettingsPanel
        open={showSettings}
        onClose={() => setShowSettings(false)}
        theme={theme}
        onSetTheme={setTheme}
        onUseSystemTheme={useSystemTheme}
        user={auth.user}
        isGoogleConnected={calendar.isAuthenticated}
        onDisconnectGoogle={calendar.disconnect}
        onSignOut={auth.signOut}
        workingHours={workingHours}
        onWorkingHoursChange={setWorkingHours}
        lastSyncAt={calendar.lastSyncAt}
        syncedEventCount={calendar.events.length}
        syncError={calendar.error?.message ?? null}
        isSyncing={calendar.isLoading}
        calendars={calendar.calendars}
        selectedCalendarIds={calendar.selectedCalendarIds}
        onToggleCalendar={calendar.toggleCalendarSelection}
        weekStartsOn={calendarSettings.weekStartsOn}
        onWeekStartsOnChange={calendarSettings.setWeekStartsOn}
        timeFormat={calendarSettings.timeFormat}
        onTimeFormatChange={calendarSettings.setTimeFormat}
        density={calendarSettings.density}
        onDensityChange={calendarSettings.setDensity}
        schedulingProfiles={tasksHook.schedulingProfiles}
        taskLists={tasksHook.taskLists}
        onCreateList={async (name, color) => { try { await tasksHook.createList(name, color); toast.success('List created'); } catch (err) { toast.error('Could not create list', { description: err instanceof Error ? err.message : 'Unknown error' }); } }}
        onUpdateList={async (id, updates) => { try { await tasksHook.updateList(id, updates); } catch (err) { toast.error('Could not update list', { description: err instanceof Error ? err.message : 'Unknown error' }); } }}
        onDeleteList={async (id) => { try { await tasksHook.deleteList(id); toast.success('List deleted'); } catch (err) { toast.error('Could not delete list', { description: err instanceof Error ? err.message : 'Unknown error' }); } }}
        onCreateProfile={async (input) => { try { await tasksHook.createProfile(input); toast.success('Profile created'); } catch (err) { toast.error('Could not create profile', { description: err instanceof Error ? err.message : 'Unknown error' }); } }}
        onUpdateProfile={async (id, updates) => { try { await tasksHook.updateProfile(id, updates); } catch (err) { toast.error('Could not update profile', { description: err instanceof Error ? err.message : 'Unknown error' }); } }}
        onDeleteProfile={async (id) => { try { await tasksHook.deleteProfile(id); toast.success('Profile deleted'); } catch (err) { toast.error('Could not delete profile', { description: err instanceof Error ? err.message : 'Unknown error' }); } }}
      />
      </Suspense>

      <Suspense fallback={null}>
      <OnboardingTour forceOpen={replayTour} onComplete={() => { setReplayTour(false); }} />
      </Suspense>

      {/* Welcome wizard for first-time users */}
      {showWelcomeWizard && calendar.isAuthenticated && allTasks.length === 0 && (
        <Suspense fallback={<PanelSpinner />}>
        <WelcomeWizard
          onCreateFirstTask={async (title, duration) => {
            await handleCreateFirstTask(title, duration);
            setShowChecklist(true);
          }}
          onDismiss={() => {
            setShowWelcomeWizard(false);
            setShowChecklist(true);
            try { localStorage.setItem('tempo-welcome-wizard', 'skipped'); } catch { /* */ }
          }}
        />
        </Suspense>
      )}

      {occurrenceEdit.open && (
        <Suspense fallback={null}>
        <OccurrenceEditDialog
          key={`${occurrenceEdit.taskId}-${occurrenceEdit.changeType}-${occurrenceEdit.occurrenceDate?.toISOString() ?? 'none'}`}
          open={occurrenceEdit.open}
          onClose={() => setOccurrenceEdit((p) => ({ ...p, open: false }))}
          onConfirm={async (scope: OccurrenceEditScope) => {
            const { taskId, occurrenceDate, changeType, pendingUpdate } = occurrenceEdit;
            const task = allTasks.find((t) => t.id === taskId);
            if (!task) return;
            const dateKey = format(occurrenceDate, 'yyyy-MM-dd');

            try {
              if (scope === 'this') {
                // Create an occurrence override for this specific date
                const overrides = task.occurrence_overrides || {};
                if (changeType === 'skip' || changeType === 'complete') {
                  await tasksHook.update(taskId, {
                    occurrence_overrides: {
                      ...overrides,
                      [dateKey]: {
                        status: changeType === 'skip' ? 'skipped' : 'completed',
                        scheduled_start: task.scheduled_start ?? undefined,
                        scheduled_end: task.scheduled_end ?? undefined,
                      },
                    },
                  });
                  toast.success(changeType === 'skip' ? 'Skipped' : 'Completed', {
                    description: `${format(occurrenceDate, 'MMM d')}`,
                  });
                } else if (changeType === 'edit') {
                  // Changes already saved to base task; override this occurrence to keep the original values.
                  // For "this only", the base task was already updated — nothing more to do.
                  // (The base task update already applied to all occurrences.)
                } else if (pendingUpdate) {
                  await tasksHook.update(taskId, {
                    occurrence_overrides: {
                      ...overrides,
                      [dateKey]: {
                        scheduled_start: pendingUpdate.scheduled_start,
                        scheduled_end: pendingUpdate.scheduled_end,
                      },
                    },
                  });
                  toast.success('Updated', { description: `${format(occurrenceDate, 'MMM d')}` });
                }
              } else if (scope === 'all') {
                // Update the base task
                if (changeType === 'skip' || changeType === 'complete') {
                  await tasksHook.update(taskId, {
                    status: changeType === 'skip' ? 'skipped' : 'completed',
                  });
                } else if (changeType === 'edit') {
                  // Changes already saved to base task — applies to all occurrences. Done.
                  toast.success('All occurrences updated');
                } else if (pendingUpdate) {
                  await tasksHook.update(taskId, {
                    scheduled_start: pendingUpdate.scheduled_start,
                    scheduled_end: pendingUpdate.scheduled_end,
                    ...(pendingUpdate.duration_minutes ? { duration_minutes: pendingUpdate.duration_minutes } : {}),
                  });
                }
                toast.success('All occurrences updated');
              } else if (scope === 'future') {
                // Change recurrence_end to stop at the occurrence date, then create a new task
                if (changeType === 'skip') {
                  // End the series before this occurrence: all future occurrences are skipped
                  const prevDate = new Date(occurrenceDate.getTime() - 24 * 60 * 60 * 1000);
                  const newRecurrenceEnd = format(prevDate, 'yyyy-MM-dd');
                  await tasksHook.update(taskId, {
                    recurrence_end: newRecurrenceEnd,
                  });
                  toast.success('Series ended', { description: `From ${format(occurrenceDate, 'MMM d')} onwards` });
                } else if (changeType === 'complete') {
                  // Split the series: end old task, create new completed task from this occurrence
                  const prevDate = new Date(occurrenceDate.getTime() - 24 * 60 * 60 * 1000);
                  const newRecurrenceEnd = format(prevDate, 'yyyy-MM-dd');
                  await tasksHook.update(taskId, {
                    recurrence_end: newRecurrenceEnd,
                  });
                  const baseStart = new Date(task.scheduled_start!);
                  const baseEnd = new Date(task.scheduled_end!);
                  const durationMs = baseEnd.getTime() - baseStart.getTime();
                  // Ensure the new task's preferred_days includes the occurrence day so the
                  // first generated occurrence falls on the exact occurrence date.
                  // Only do this for weekly tasks; daily tasks should keep all days.
                  const isoDay = occurrenceDate.getDay() === 0 ? 7 : occurrenceDate.getDay();
                  const preferredDays = new Set(task.preferred_days ?? []);
                  if (task.frequency === 'weekly') {
                    preferredDays.add(isoDay);
                  }
                  // For open-ended completed series, cap the new task at the occurrence date
                  // so it doesn't generate muted occurrences forever.
                  const newRecurrenceEndCap = task.recurrence_end || format(occurrenceDate, 'yyyy-MM-dd');
                  await tasksHook.create({
                    title: task.title,
                    description: task.description || undefined,
                    duration_minutes: task.duration_minutes,
                    priority: task.priority,
                    frequency: task.frequency,
                    due_date: task.due_date || undefined,
                    color: task.color,
                    tags: task.tags || undefined,
                    preferred_days: task.frequency === 'daily'
                      ? task.preferred_days || undefined
                      : Array.from(preferredDays),
                    is_habit: task.is_habit,
                    can_split: task.can_split,
                    is_busy_block: task.is_busy_block,
                    ignore_if_cannot_schedule: task.ignore_if_cannot_schedule,
                    can_balance_across_days: task.can_balance_across_days,
                    buffer_before_minutes: task.buffer_before_minutes || undefined,
                    buffer_after_minutes: task.buffer_after_minutes || undefined,
                    notes: task.notes || undefined,
                    is_locked: task.is_locked,
                    auto_schedule: task.auto_schedule,
                    scheduling_cutoff_weeks: task.scheduling_cutoff_weeks,
                    preferred_time_windows: task.preferred_time_windows || undefined,
                    list_id: task.list_id || undefined,
                    scheduling_profile_id: task.scheduling_profile_id || undefined,
                    is_recurring: true,
                    recurrence_end: newRecurrenceEndCap,
                    scheduled_start: occurrenceDate.toISOString(),
                    scheduled_end: new Date(occurrenceDate.getTime() + durationMs).toISOString(),
                    is_scheduled: true,
                    status: 'completed',
                  });
                  toast.success('Series completed', { description: `From ${format(occurrenceDate, 'MMM d')} onwards` });
                } else if (changeType === 'edit') {
                  // For "future", split the series so past occurrences keep old values.
                  // The base task was already updated; set recurrence_end to yesterday.
                  const prevDate = new Date(occurrenceDate.getTime() - 24 * 60 * 60 * 1000);
                  const newRecurrenceEnd = format(prevDate, 'yyyy-MM-dd');
                  await tasksHook.update(taskId, { recurrence_end: newRecurrenceEnd });
                  // Create a new task starting from this occurrence with the updated values
                  await tasksHook.create({
                    title: task.title,
                    description: task.description || undefined,
                    duration_minutes: task.duration_minutes,
                    priority: task.priority,
                    frequency: task.frequency,
                    due_date: task.due_date || undefined,
                    color: task.color,
                    tags: task.tags || undefined,
                    preferred_days: task.preferred_days || undefined,
                    is_habit: task.is_habit,
                    can_split: task.can_split,
                    is_busy_block: task.is_busy_block,
                    ignore_if_cannot_schedule: task.ignore_if_cannot_schedule,
                    can_balance_across_days: task.can_balance_across_days,
                    buffer_before_minutes: task.buffer_before_minutes || undefined,
                    buffer_after_minutes: task.buffer_after_minutes || undefined,
                    notes: task.notes || undefined,
                    is_locked: task.is_locked,
                    auto_schedule: task.auto_schedule,
                    scheduling_cutoff_weeks: task.scheduling_cutoff_weeks,
                    preferred_time_windows: task.preferred_time_windows || undefined,
                    list_id: task.list_id || undefined,
                    scheduling_profile_id: task.scheduling_profile_id || undefined,
                    is_recurring: true,
                    recurrence_end: task.recurrence_end || undefined,
                    scheduled_start: task.scheduled_start || undefined,
                    scheduled_end: task.scheduled_end || undefined,
                    is_scheduled: task.is_scheduled || false,
                  });
                  toast.success('Future occurrences updated');
                } else if (pendingUpdate) {
                  // Split the series: set recurrence_end to the day before this occurrence
                  const prevDate = new Date(occurrenceDate.getTime() - 24 * 60 * 60 * 1000);
                  const newRecurrenceEnd = format(prevDate, 'yyyy-MM-dd');
                  await tasksHook.update(taskId, {
                    recurrence_end: newRecurrenceEnd,
                  });
                  // Create a new task with the updated schedule starting from this occurrence
                  await tasksHook.create({
                    title: task.title,
                    description: task.description || undefined,
                    duration_minutes: pendingUpdate.duration_minutes || task.duration_minutes,
                    priority: task.priority,
                    frequency: task.frequency,
                    due_date: task.due_date || undefined,
                    color: task.color,
                    tags: task.tags || undefined,
                    preferred_days: task.preferred_days || undefined,
                    is_habit: task.is_habit,
                    can_split: task.can_split,
                    is_busy_block: task.is_busy_block,
                    ignore_if_cannot_schedule: task.ignore_if_cannot_schedule,
                    can_balance_across_days: task.can_balance_across_days,
                    buffer_before_minutes: task.buffer_before_minutes || undefined,
                    buffer_after_minutes: task.buffer_after_minutes || undefined,
                    notes: task.notes || undefined,
                    is_locked: task.is_locked,
                    auto_schedule: task.auto_schedule,
                    scheduling_cutoff_weeks: task.scheduling_cutoff_weeks,
                    preferred_time_windows: task.preferred_time_windows || undefined,
                    list_id: task.list_id || undefined,
                    scheduling_profile_id: task.scheduling_profile_id || undefined,
                    is_recurring: true,
                    recurrence_end: task.recurrence_end || undefined,
                    scheduled_start: pendingUpdate.scheduled_start,
                    scheduled_end: pendingUpdate.scheduled_end,
                    is_scheduled: true,
                  });
                  toast.success('Series split', { description: 'Future occurrences use the new schedule' });
                }
              }
            } catch (err) {
              toast.error('Could not update', { description: err instanceof Error ? err.message : 'Unknown error' });
            } finally {
              setOccurrenceEdit((p) => ({ ...p, open: false }));
            }
          }}
          taskTitle={allTasks.find((t) => t.id === occurrenceEdit.taskId)?.title ?? ''}
          occurrenceDate={occurrenceEdit.occurrenceDate}
          changeType={occurrenceEdit.changeType}
        />
        </Suspense>
      )}

      {showTaskDialog && (
        <Suspense fallback={<PanelSpinner />}>
        <TaskDialog
          open={showTaskDialog}
          onClose={() => { setShowTaskDialog(false); setEditingTask(null); }}
          onSave={handleSaveTask}
          initial={editingTask ? {
            title: editingTask.title,
            description: editingTask.description || undefined,
            duration_minutes: editingTask.duration_minutes,
            priority: editingTask.priority,
            frequency: editingTask.frequency,
            due_date: editingTask.due_date || undefined,
            due_time: editingTask.due_time || undefined,
            color: editingTask.color,
            tags: editingTask.tags || undefined,
            preferred_days: editingTask.preferred_days || undefined,
            is_habit: editingTask.is_habit,
            can_split: editingTask.can_split,
            is_busy_block: editingTask.is_busy_block,
            ignore_if_cannot_schedule: editingTask.ignore_if_cannot_schedule,
            can_balance_across_days: editingTask.can_balance_across_days,
            buffer_before_minutes: editingTask.buffer_before_minutes || undefined,
            buffer_after_minutes: editingTask.buffer_after_minutes || undefined,
            notes: editingTask.notes || undefined,
            deadline: editingTask.deadline || undefined,
            is_locked: editingTask.is_locked,
            auto_schedule: editingTask.auto_schedule,
            scheduling_cutoff_weeks: editingTask.scheduling_cutoff_weeks,
            preferred_time_windows: editingTask.preferred_time_windows || undefined,
            list_id: editingTask.list_id || undefined,
            scheduling_profile_id: editingTask.scheduling_profile_id || undefined,
          } : undefined}
          title={editingTask ? 'Edit task' : 'New task'}
          onDelete={editingTask ? (id) => { handleDeleteTask(id); setShowTaskDialog(false); setEditingTask(null); } : undefined}
          taskLists={tasksHook.taskLists}
          schedulingProfiles={tasksHook.schedulingProfiles}
          taskId={editingTask?.id}
          subtasksProps={editingTask ? {
            subtasks: editingTaskSubtasks.subtasks,
            onAdd: async (input) => {
              const r = await editingTaskSubtasks.add(input);
              await subtasksBatch.refresh();
              return r;
            },
            onUpdate: async (id, updates) => {
              const r = await editingTaskSubtasks.update(id, updates);
              await subtasksBatch.refresh();
              return r;
            },
            onRemove: async (id) => {
              await editingTaskSubtasks.remove(id);
              await subtasksBatch.refresh();
            },
            onReorder: async (orderedIds) => {
              await editingTaskSubtasks.reorder(orderedIds);
              await subtasksBatch.refresh();
            },
          } : undefined}
        />
        </Suspense>
      )}

      <Suspense fallback={null}>
      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onQuickAdd={handleQuickAdd}
        onNavigate={setTempoView}
        onOpenSettings={() => setShowSettings(true)}
        onToggleTheme={toggleTheme}
        onScheduleAll={handleScheduleAll}
        currentView={tempoView}
        theme={theme}
      />
      </Suspense>

      <Suspense fallback={null}>
      <KeyboardHelpDialog
        open={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />
      </Suspense>

      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: '!rounded-xl !border !border-border !bg-card !text-foreground !shadow-lg !text-sm',
            description: '!text-muted-foreground !text-xs',
          },
        }}
        richColors
        closeButton
      />

      {/* Mobile bottom nav — replaces LeftRail on small screens */}
      <MobileNav
        activeView={activeView}
        onViewChange={setActiveView}
        unscheduledCount={unscheduledCount}
      />

      {/* Mobile FAB — quick-add button visible on small screens */}
      <button
        type="button"
        onClick={() => { setEditingTask(null); setShowTaskDialog(true); }}
        className="fab lg:hidden"
        aria-label="Add task"
      >
        <Plus className="w-6 h-6" />
      </button>

      <VersionBadge />

      </div>
      </ErrorBoundary>

      {focusMode.open && calendar.isAuthenticated && (
        <Suspense fallback={null}>
        <FocusMode
          open={focusMode.open}
          currentTask={focusCurrentTask}
          queue={focusQueue}
          onClose={() => setFocusMode({ open: false, taskId: null })}
          onCompleteTask={async (id) => {
            await handleCompleteTask(id);
            const next = focusQueue[0];
            if (next) setFocusMode({ open: true, taskId: next.id });
            else setFocusMode({ open: false, taskId: null });
          }}
          onSwitchTask={(taskId) => setFocusMode({ open: true, taskId })}
        />
        </Suspense>
      )}
    </div>
  );
}

export default App;

