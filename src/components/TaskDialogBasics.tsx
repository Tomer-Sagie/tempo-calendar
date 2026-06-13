import type { TaskPriority, TaskFrequency, TaskList, SchedulingProfile } from '../lib/types';

export interface TaskFormState {
  title: string;
  description: string;
  duration_minutes: number;
  priority: TaskPriority;
  frequency: TaskFrequency;
  due_date: string;
  color: string;
  tags: string;
  preferred_days: number[];
  is_habit: boolean;
  can_split: boolean;
  is_busy_block: boolean;
  ignore_if_cannot_schedule: boolean;
  can_balance_across_days: boolean;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  notes: string;
  deadline: string;
  is_locked: boolean;
  auto_schedule: boolean;
  scheduling_cutoff_weeks: number;
  preferred_time_start: string;
  preferred_time_end: string;
  list_id: string;
  scheduling_profile_id: string;
}

export type TaskFormSetter = (
  updater: (prev: TaskFormState) => TaskFormState
) => void;

interface TaskDialogBasicsProps {
  form: TaskFormState;
  setForm: TaskFormSetter;
  taskLists: TaskList[];
  schedulingProfiles: SchedulingProfile[];
}

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'ASAP', label: 'ASAP' },
  { value: 'HIGH', label: 'High' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LOW', label: 'Low' },
];

const FREQUENCIES: { value: TaskFrequency; label: string }[] = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom' },
];

const DURATION_PRESETS = [
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '1h', value: 60 },
  { label: '2h', value: 120 },
  { label: '4h', value: 240 },
];

/**
 * Step 1 of the TaskDialog progressive-disclosure layout. Captures the
 * minimum fields required to plan a task: what it is, how long it takes,
 * when it's due, how important it is, and which list/profile it belongs to.
 */
export function TaskDialogBasics({ form, setForm, taskLists, schedulingProfiles }: TaskDialogBasicsProps) {
  return (
    <section className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">What do you need to do?</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          placeholder="Write proposal, call dentist, review PRs..."
          className="w-full px-3 py-2.5 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder-muted-foreground bg-background"
          autoFocus
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">How long will it take?</label>
        <div className="flex gap-2">
          {DURATION_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setForm((p) => ({ ...p, duration_minutes: preset.value }))}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                form.duration_minutes === preset.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <div className="flex items-center gap-1.5 bg-muted rounded-lg px-2 h-10">
            <input
              type="number"
              value={form.duration_minutes}
              onChange={(e) => setForm((p) => ({ ...p, duration_minutes: Math.max(5, parseInt(e.target.value) || 5) }))}
              className="w-14 bg-transparent text-sm text-center focus:outline-none"
              min={5}
              step={5}
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Due date</label>
          <input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Repeat</label>
          <select
            value={form.frequency}
            onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value as TaskFrequency }))}
            className="w-full px-3 py-2 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background"
          >
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Priority</label>
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, priority: p.value }))}
              className={`flex-1 px-2 py-2 text-xs font-medium rounded-md transition-colors ${
                form.priority === p.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">List</label>
          <select
            value={form.list_id}
            onChange={(e) => setForm((p) => ({ ...p, list_id: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background"
          >
            <option value="">No list</option>
            {taskLists.map((list) => (
              <option key={list.id} value={list.id}>{list.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Schedule profile</label>
          <select
            value={form.scheduling_profile_id}
            onChange={(e) => setForm((p) => ({ ...p, scheduling_profile_id: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background"
          >
            <option value="">Default</option>
            {schedulingProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.name}</option>
            ))}
          </select>
        </div>
      </div>

    </section>
  );
}
