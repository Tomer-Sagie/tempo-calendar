import { useState, useMemo } from 'react';
import { setHours, setMinutes, addDays } from 'date-fns';
import { Plus, Eye, EyeOff, Monitor, Smartphone } from 'lucide-react';
import { TodayFocusView } from './TodayFocusView';
import { TempoCalendar } from './TempoCalendar';
import type { CalendarEventType } from './TempoCalendar';
import type { Task } from '../lib/types';

// ============================================================
// Mock data
// ============================================================

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

function makeTask(overrides: Partial<Task>): Task {
  const base: Task = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    title: 'Untitled',
    description: null,
    duration_minutes: 30,
    due_date: null,
    due_time: null,
    deadline: null,
    recurrence_end: null,
    priority: 'NORMAL',
    frequency: 'once',
    preferred_days: null,
    preferred_time_windows: null,
    is_busy_block: false,
    can_split: false,
    ignore_if_cannot_schedule: false,
    is_habit: false,
    is_recurring: false,
    can_balance_across_days: false,
    min_chunk_duration: null,
    max_chunks: null,
    scheduling_cutoff_weeks: 4,
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
    blocked_days: null,
    blocked_times: null,
    scheduling_hours_override: null,
    tags: null,
    color: '#2563EB',
    notes: null,
    skip_days: null,
    streak_count: 0,
    completion_history: null,
    google_event_id: null,
    google_calendar_id: null,
    is_scheduled: false,
    scheduled_start: null,
    scheduled_end: null,
    auto_schedule: true,
    is_locked: false,
    completed_at: null,
    status: 'active',
    list_id: null,
    scheduling_profile_id: null,
    sync_to_calendar: true,
    last_scheduled_at: null,
    last_missed_at: null,
    occurrence_overrides: null,
  };
  return { ...base, ...overrides };
}

const MOCK_TASKS: Task[] = [
  makeTask({
    id: 't1',
    title: 'Morning standup',
    duration_minutes: 15,
    is_scheduled: true,
    scheduled_start: setMinutes(setHours(today, 9), 0).toISOString(),
    scheduled_end: setMinutes(setHours(today, 9), 15).toISOString(),
    color: '#0D9488',
  }),
  makeTask({
    id: 't2',
    title: 'Write proposal for Q3 roadmap',
    duration_minutes: 90,
    is_scheduled: true,
    scheduled_start: setMinutes(setHours(today, 10), 0).toISOString(),
    scheduled_end: setMinutes(setHours(today, 11), 30).toISOString(),
    color: '#2563EB',
    priority: 'HIGH',
  }),
  makeTask({
    id: 't3',
    title: 'Lunch break',
    duration_minutes: 60,
    is_scheduled: true,
    scheduled_start: setMinutes(setHours(today, 12), 0).toISOString(),
    scheduled_end: setMinutes(setHours(today, 13), 0).toISOString(),
    color: '#7C3AED',
    is_busy_block: true,
  }),
  makeTask({
    id: 't4',
    title: 'Review pull requests',
    duration_minutes: 45,
    is_scheduled: true,
    scheduled_start: setMinutes(setHours(today, 14), 0).toISOString(),
    scheduled_end: setMinutes(setHours(today, 14), 45).toISOString(),
    color: '#059669',
    status: 'completed',
    completed_at: new Date().toISOString(),
  }),
  makeTask({
    id: 't5',
    title: 'Design sync meeting',
    duration_minutes: 30,
    is_scheduled: true,
    scheduled_start: setMinutes(setHours(today, 15), 30).toISOString(),
    scheduled_end: setMinutes(setHours(today, 16), 0).toISOString(),
    color: '#B45309',
  }),
  makeTask({
    id: 't6',
    title: 'Update documentation',
    duration_minutes: 60,
    is_scheduled: false,
    priority: 'LOW',
  }),
];

function makeCalendarEvent(overrides: Partial<CalendarEventType>): CalendarEventType {
  return {
    id: crypto.randomUUID(),
    title: 'Untitled Event',
    start: new Date(),
    end: new Date(),
    variant: 'secondary',
    ...overrides,
  };
}

const MOCK_CALENDAR_EVENTS: CalendarEventType[] = [
  makeCalendarEvent({
    id: 'cal-1',
    title: 'Morning standup',
    start: setMinutes(setHours(today, 9), 0),
    end: setMinutes(setHours(today, 9), 15),
    variant: 'success',
    data: { source: 'task', is_locked: true, color: '#0D9488' },
  }),
  makeCalendarEvent({
    id: 'cal-2',
    title: 'Write proposal',
    start: setMinutes(setHours(today, 10), 0),
    end: setMinutes(setHours(today, 11), 30),
    variant: 'secondary',
    data: { source: 'task', color: '#2563EB' },
  }),
  makeCalendarEvent({
    id: 'cal-3',
    title: 'Lunch break',
    start: setMinutes(setHours(today, 12), 0),
    end: setMinutes(setHours(today, 13), 0),
    variant: 'primary',
    data: { source: 'task', is_busy_block: true, color: '#7C3AED' },
  }),
  makeCalendarEvent({
    id: 'cal-4',
    title: 'Team standup (Google)',
    start: setMinutes(setHours(today, 16), 0),
    end: setMinutes(setHours(today, 16), 30),
    variant: 'muted',
    data: { source: 'google', description: 'Weekly team sync' },
  }),
  makeCalendarEvent({
    id: 'cal-5',
    title: 'Split task — chunk 1',
    start: setMinutes(setHours(today, 14), 0),
    end: setMinutes(setHours(today, 14), 30),
    variant: 'warning',
    data: { source: 'task', is_split_chunk: true, split_position: 'first', color: '#EA580C' },
  }),
  makeCalendarEvent({
    id: 'cal-6',
    title: 'Split task — chunk 2',
    start: addDays(setMinutes(setHours(today, 14), 0), 1),
    end: addDays(setMinutes(setHours(today, 14), 30), 1),
    variant: 'warning',
    data: { source: 'task', is_split_chunk: true, split_position: 'last', color: '#EA580C' },
  }),
];



// ============================================================
// Visual Test Page
// ============================================================

type DeviceMode = 'desktop' | 'mobile';

export function VisualTestPage() {
  const [tasks] = useState(MOCK_TASKS);
  const [loadingSkeleton, setLoadingSkeleton] = useState(false);
  const [device, setDevice] = useState<DeviceMode>('desktop');

  const completionRate = useMemo(() => {
    const done = tasks.filter((t) => t.status === 'completed').length;
    return tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
  }, [tasks]);

  const isMobile = device === 'mobile';

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Test Harness Header ── */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Visual Test Harness</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Testing TodayFocusView · CalendarSkeleton · Mobile FAB
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Device toggle */}
            <div className="flex items-center rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setDevice('desktop')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  device === 'desktop' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                <Monitor className="w-3 h-3" />
                Desktop
              </button>
              <button
                onClick={() => setDevice('mobile')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  device === 'mobile' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                <Smartphone className="w-3 h-3" />
                Mobile
              </button>
            </div>

            {/* Skeleton toggle */}
            <button
              onClick={() => setLoadingSkeleton((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                loadingSkeleton
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {loadingSkeleton ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              Skeleton: {loadingSkeleton ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </header>

      {/* ── Test Sections ── */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">

        {/* Section 1: TodayFocusView */}
        <section>
          <SectionLabel number={1} title="TodayFocusView" description="Focused timeline for today's scheduled tasks with now-line and completion tracking." />
          <div className={`${isMobile ? 'max-w-[375px]' : 'w-full'} h-[520px] rounded-xl border border-border overflow-hidden shadow-sm`}>
            <TodayFocusView
              tasks={tasks}
              onSelectTask={() => {}}
              onAddTask={() => {}}
              onClose={() => {}}
              startHour={6}
              endHour={22}
              timeFormat="12h"
            />
          </div>
        </section>

        {/* Section 2: CalendarSkeleton */}
        <section>
          <SectionLabel number={2} title="CalendarSkeleton" description="Loading skeleton for the calendar grid. Uses density-aware hour heights and shimmer animation." />
          <div className={`${isMobile ? 'max-w-[375px]' : 'w-full'} h-[480px] rounded-xl border border-border overflow-hidden shadow-sm`}>
            <TempoCalendar
              events={loadingSkeleton ? [] : MOCK_CALENDAR_EVENTS}
              isLoading={loadingSkeleton}
              startHour={6}
              endHour={22}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Toggle "Skeleton: ON" in the header to see the skeleton. When OFF, the calendar renders with mock events (including a split task with connectors).
          </p>
        </section>

        {/* Section 3: Mobile FAB */}
        <section>
          <SectionLabel number={3} title="Mobile FAB" description="Floating action button for quick-add, visible only on small viewports (< 1024px)." />
          <div className="relative max-w-[375px] h-[200px] rounded-xl border border-border overflow-hidden shadow-sm bg-card">
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <p className="text-sm font-medium text-foreground mb-1">FAB Preview</p>
              <p className="text-xs text-muted-foreground">
                The <code className="mono text-[11px] bg-muted px-1 py-0.5 rounded">.fab</code> button appears in the
                bottom-right corner. Switch to "Mobile" mode to see it live on the actual app, or check the demo below.
              </p>
            </div>
            {/* Inline FAB demo */}
            <button
              type="button"
              className="fab"
              aria-label="Add task (demo)"
              onClick={() => alert('FAB clicked! This would open the TaskDialog.')}
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            The FAB is only rendered inside the authenticated workspace on viewports &lt; 1024px. It uses the <code className="mono text-[11px] bg-muted px-1 py-0.5 rounded">.fab</code> CSS class with a fixed position, z-index, and spring hover animation.
          </p>
        </section>

        {/* Section 4: Completion Stats */}
        <section>
          <SectionLabel number={4} title="Completion Summary" description="Quick stats for the mock data to verify the TodayFocusView header calculations." />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total tasks" value={String(tasks.length)} />
            <StatCard label="Completed" value={String(tasks.filter((t) => t.status === 'completed').length)} />
            <StatCard label="Completion rate" value={`${completionRate}%`} />
            <StatCard label="Unscheduled" value={String(tasks.filter((t) => !t.is_scheduled).length)} />
          </div>
        </section>

        {/* Section 5: CSS class reference */}
        <section>
          <SectionLabel number={5} title="CSS Classes Added" description="Reference for the new CSS classes introduced in this batch." />
          <div className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 pr-4 font-semibold text-foreground">Class</th>
                  <th className="text-left py-1.5 pr-4 font-semibold text-foreground">Purpose</th>
                  <th className="text-left py-1.5 font-semibold text-foreground">Where</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {[
                  ['.animate-checkmark-draw', 'Spring SVG draw-in for checkmark circle + polyline', 'TaskRow.tsx'],
                  ['.animate-task-complete-fade', 'Row fade-out after task completion', 'index.css'],
                  ['.animate-conflict-glow', 'Amber pulsing on conflict banner', 'App.tsx'],
                  ['.split-connector-left', 'Dashed bracket connector (left edge)', 'CalendarEvent.tsx'],
                  ['.split-connector-right', 'Dashed bracket connector (right edge)', 'CalendarEvent.tsx'],
                  ['.week-fill-bar', 'Progress bar for weekly capacity', 'BentoSidebar.tsx'],
                  ['.fab', 'Fixed-position floating action button', 'App.tsx'],
                  ['.skeleton', 'Shimmer animation for loading placeholders', 'TempoCalendar.tsx'],
                  ['.density-compact / .density-standard / .density-comfortable', 'Hour height density classes', 'index.css'],
                ].map(([cls, purpose, where]) => (
                  <tr key={cls} className="border-b border-border/50 last:border-0">
                    <td className="py-1.5 pr-4"><code className="mono text-[11px] bg-muted px-1 py-0.5 rounded">{cls}</code></td>
                    <td className="py-1.5 pr-4">{purpose}</td>
                    <td className="py-1.5">{where}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

// ============================================================
// Helper components
// ============================================================

function SectionLabel({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
          {number}
        </span>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      </div>
      <p className="text-xs text-muted-foreground mt-1 ml-8">{description}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-lg font-semibold text-foreground mt-1">{value}</div>
    </div>
  );
}
