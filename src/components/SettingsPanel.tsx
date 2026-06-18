import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Sun, Moon, Monitor, Bell, LogOut, Unlink, User, Calendar, Info,
  ExternalLink, Check, Plus, Trash2, Palette, Clock, LayoutGrid,
  ListTodo,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { TEMPO_VERSION } from '../lib/version';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { GoogleCalendar } from '../lib/google';
import type { SchedulingProfile, TaskList, SchedulingProfileInput, ScheduleWindow } from '../lib/types';

type CalendarDensity = 'compact' | 'standard' | 'comfortable';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  onSetTheme: (theme: 'light' | 'dark') => void;
  onUseSystemTheme: () => void;
  user: SupabaseUser | null;
  isGoogleConnected: boolean;
  onDisconnectGoogle: () => void;
  onSignOut: () => Promise<void>;
  workingHours: { start: string; end: string };
  onWorkingHoursChange: (hours: { start: string; end: string }) => void;
  lastSyncAt: Date | null;
  syncedEventCount: number;
  syncError: string | null;
  isSyncing: boolean;
  calendars: GoogleCalendar[];
  selectedCalendarIds: string[];
  onToggleCalendar: (calendarId: string) => void;
  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn?: 0 | 1;
  onWeekStartsOnChange?: (v: 0 | 1) => void;
  /** '12h' (default) or '24h'. */
  timeFormat?: '12h' | '24h';
  onTimeFormatChange?: (v: '12h' | '24h') => void;
  /** Calendar density. */
  density?: CalendarDensity;
  onDensityChange?: (v: CalendarDensity) => void;
  /** Scheduling profiles from the hook. */
  schedulingProfiles?: SchedulingProfile[];
  /** Task lists from the hook. */
  taskLists?: TaskList[];
  onCreateList?: (name: string, color: string) => Promise<void>;
  onUpdateList?: (id: string, updates: { name?: string; color?: string }) => Promise<void>;
  onDeleteList?: (id: string) => Promise<void>;
  /** Scheduling profile CRUD. */
  onCreateProfile?: (input: SchedulingProfileInput) => Promise<void>;
  onUpdateProfile?: (id: string, updates: Partial<SchedulingProfileInput>) => Promise<void>;
  onDeleteProfile?: (id: string) => Promise<void>;
}

type Section = 'appearance' | 'schedule' | 'account';

export function SettingsPanel({
  open,
  onClose,
  theme,
  onSetTheme,
  onUseSystemTheme,
  user,
  isGoogleConnected,
  onDisconnectGoogle,
  onSignOut,
  workingHours,
  onWorkingHoursChange,
  lastSyncAt,
  syncedEventCount,
  syncError,
  isSyncing,
  calendars,
  selectedCalendarIds,
  onToggleCalendar,
  weekStartsOn = 1,
  onWeekStartsOnChange,
  timeFormat = '12h',
  onTimeFormatChange,
  density = 'standard',
  onDensityChange,
  schedulingProfiles = [],
  taskLists = [],
  onCreateList,
  onUpdateList,
  onDeleteList,
  onCreateProfile,
  onUpdateProfile,
  onDeleteProfile,
}: SettingsPanelProps) {
  const [section, setSection] = useState<Section>('appearance');

  // Track closing state so exit animations can play before unmount
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleClose = useCallback(() => {
    if (closeTimerRef.current) return; // Already closing
    setClosing(true);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setClosing(false);
      if (openRef.current) onClose();
    }, 300);
  }, [onClose]);

  // Sync the open-ref for the timer callback and clean up on unmount.
  /* eslint-disable react-hooks/refs, react-hooks/immutability -- intentional ref mutation to track prop for timer callback */
  const openRef = useRef(open);
  if (open !== openRef.current) openRef.current = open;
  /* eslint-enable react-hooks/refs, react-hooks/immutability */
  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  // Lock scroll while open or closing (so exit animation doesn't cause scroll jump)
  useEffect(() => {
    if (open || closing) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open, closing]);

  if (!open && !closing) return null;

  const animState = closing ? 'closed' : 'open';

  return (
    <>
      {/* Overlay */}
      <div
        className="panel-overlay"
        data-state={animState}
        onClick={handleClose}
      />

      {/* Panel */}
      <aside
        className={cn(
          'panel-slide w-full sm:w-[480px] lg:w-[520px] bg-card border-l border-border shadow-2xl',
          'flex flex-col',
        )}
        data-state={animState}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Settings</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Make Tempo feel like yours</p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-colors"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Section nav */}
          <nav className="w-[140px] border-r border-border bg-muted/20 py-3 px-2 shrink-0" aria-label="Settings sections">
            {([
              { key: 'appearance', label: 'Appearance', icon: Sun },
              { key: 'schedule', label: 'Schedule', icon: Calendar },
              { key: 'account', label: 'Account', icon: User },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSection(key)}
                aria-current={section === key ? 'page' : undefined}
                className={cn(
                  'w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium rounded-md transition-colors mb-0.5 text-left',
                  section === key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-card/50 hover:text-foreground',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </nav>

          {/* Section content */}
          <div className="flex-1 overflow-y-auto tempo-scrollbar p-5">
            {section === 'appearance' && (
              <AppearanceSection
                theme={theme}
                onSetTheme={onSetTheme}
                onUseSystemTheme={onUseSystemTheme}
                timeFormat={timeFormat}
                onTimeFormatChange={onTimeFormatChange}
                density={density}
                onDensityChange={onDensityChange}
              />
            )}

            {section === 'schedule' && (
              <ScheduleSection
                workingHours={workingHours}
                onWorkingHoursChange={onWorkingHoursChange}
                weekStartsOn={weekStartsOn}
                onWeekStartsOnChange={onWeekStartsOnChange}
                schedulingProfiles={schedulingProfiles}
                taskLists={taskLists}
                onCreateList={onCreateList}
                onUpdateList={onUpdateList}
                onDeleteList={onDeleteList}
                onCreateProfile={onCreateProfile}
                onUpdateProfile={onUpdateProfile}
                onDeleteProfile={onDeleteProfile}
              />
            )}

            {section === 'account' && (
              <AccountSection
                user={user}
                isGoogleConnected={isGoogleConnected}
                onDisconnectGoogle={onDisconnectGoogle}
                onSignOut={onSignOut}
                lastSyncAt={lastSyncAt}
                syncedEventCount={syncedEventCount}
                syncError={syncError}
                isSyncing={isSyncing}
                calendars={calendars}
                selectedCalendarIds={selectedCalendarIds}
                onToggleCalendar={onToggleCalendar}
              />
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

// ============================================================
// Appearance Section
// ============================================================

function AppearanceSection({
  theme,
  onSetTheme,
  onUseSystemTheme,
  timeFormat,
  onTimeFormatChange,
  density,
  onDensityChange,
}: {
  theme: 'light' | 'dark';
  onSetTheme: (theme: 'light' | 'dark') => void;
  onUseSystemTheme: () => void;
  timeFormat: '12h' | '24h';
  onTimeFormatChange?: (v: '12h' | '24h') => void;
  density: 'compact' | 'standard' | 'comfortable';
  onDensityChange?: (v: 'compact' | 'standard' | 'comfortable') => void;
}) {
  return (
    <div className="space-y-6">
      {/* Theme */}
      <section>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
          Theme
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'light', label: 'Light', icon: Sun, isSystem: false },
            { value: 'dark', label: 'Dark', icon: Moon, isSystem: false },
            { value: 'system', label: 'Auto', icon: Monitor, isSystem: true },
          ] as const).map(({ value, label, icon: Icon, isSystem }) => {
            const isActive = isSystem
              ? !localStorage.getItem('tempo-theme')
              : theme === value;
            return (
              <button
                key={value}
                onClick={() => {
                  if (isSystem) {
                    onUseSystemTheme();
                  } else {
                    onSetTheme(value as 'light' | 'dark');
                  }
                }}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-colors',
                  isActive
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border hover:border-muted-foreground/30 text-muted-foreground',
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Time format */}
      <section>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
          <Clock className="w-3 h-3 inline mr-1 -mt-px" />
          Time format
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {(['12h', '24h'] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => onTimeFormatChange?.(fmt)}
              className={cn(
                'flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors',
                timeFormat === fmt
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border hover:border-muted-foreground/30 text-muted-foreground',
              )}
            >
              {fmt === '12h' ? '1:00 PM' : '13:00'}
            </button>
          ))}
        </div>
      </section>

      {/* Calendar density */}
      <section>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
          <LayoutGrid className="w-3 h-3 inline mr-1 -mt-px" />
          Calendar density
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'compact', label: 'Compact' },
            { value: 'standard', label: 'Standard' },
            { value: 'comfortable', label: 'Comfortable' },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onDensityChange?.(value)}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors',
                density === value
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border hover:border-muted-foreground/30 text-muted-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* About */}
      <section>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
          About
        </h3>
        <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">App</span>
            <span className="font-medium text-foreground">Tempo Calendar</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Version</span>
            <span className="font-mono text-foreground">{TEMPO_VERSION}</span>
          </div>
          <a
            href="https://github.com/tomer-s/flowsavvy-personal-scheduler"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between text-xs hover:text-foreground transition-colors pt-1.5 border-t border-border mt-2"
          >
            <span className="text-muted-foreground flex items-center gap-1">
              <Info className="w-3 h-3" />
              Source & docs
            </span>
            <ExternalLink className="w-3 h-3 text-muted-foreground" />
          </a>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// Schedule Section
// ============================================================

function ScheduleSection({
  workingHours,
  onWorkingHoursChange,
  weekStartsOn,
  onWeekStartsOnChange,
  schedulingProfiles,
  taskLists,
  onCreateList,
  onUpdateList,
  onDeleteList,
  onCreateProfile,
  onUpdateProfile,
  onDeleteProfile,
}: {
  workingHours: { start: string; end: string };
  onWorkingHoursChange: (hours: { start: string; end: string }) => void;
  weekStartsOn: 0 | 1;
  onWeekStartsOnChange?: (v: 0 | 1) => void;
  schedulingProfiles: SchedulingProfile[];
  taskLists: TaskList[];
  onCreateList?: (name: string, color: string) => Promise<void>;
  onUpdateList?: (id: string, updates: { name?: string; color?: string }) => Promise<void>;
  onDeleteList?: (id: string) => Promise<void>;
  onCreateProfile?: (input: SchedulingProfileInput) => Promise<void>;
  onUpdateProfile?: (id: string, updates: Partial<SchedulingProfileInput>) => Promise<void>;
  onDeleteProfile?: (id: string) => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      {/* Week start */}
      <section>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
          Week starts on
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 1, label: 'Monday' },
            { value: 0, label: 'Sunday' },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onWeekStartsOnChange?.(value)}
              className={cn(
                'flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors',
                weekStartsOn === value
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border hover:border-muted-foreground/30 text-muted-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Working hours */}
      <section>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
          Working hours
        </h3>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          Tasks are scheduled into open time within these hours. Defaults to 9 - 5.
        </p>
        <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card">
          <input
            type="time"
            value={workingHours.start}
            onChange={(e) => onWorkingHoursChange({ ...workingHours, start: e.target.value })}
            className="px-2 py-1.5 text-sm font-medium bg-muted rounded-md focus:outline-none focus:ring-2 focus:ring-ring tabular-nums"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <input
            type="time"
            value={workingHours.end}
            onChange={(e) => onWorkingHoursChange({ ...workingHours, end: e.target.value })}
            className="px-2 py-1.5 text-sm font-medium bg-muted rounded-md focus:outline-none focus:ring-2 focus:ring-ring tabular-nums"
          />
        </div>
      </section>

      {/* Notifications placeholder */}
      <section>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
          Notifications
        </h3>
        <div className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-card opacity-60">
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <div className="text-left">
              <div className="text-sm font-medium text-foreground">Reminders</div>
              <div className="text-[11px] text-muted-foreground">In development</div>
            </div>
          </div>
        </div>
      </section>

      {/* Task lists */}
      <TaskListsSection
        taskLists={taskLists}
        onCreateList={onCreateList}
        onUpdateList={onUpdateList}
        onDeleteList={onDeleteList}
      />

      {/* Scheduling profiles */}
      <SchedulingProfilesSection
        schedulingProfiles={schedulingProfiles}
        onCreateProfile={onCreateProfile}
        onUpdateProfile={onUpdateProfile}
        onDeleteProfile={onDeleteProfile}
      />
    </div>
  );
}

// ============================================================
// Task Lists Sub-section
// ============================================================

const LIST_COLORS = ['#2563EB', '#0D9488', '#059669', '#7C3AED', '#DB2777', '#B45309', '#DC2626', '#D97706'];

function TaskListsSection({
  taskLists,
  onCreateList,
  onUpdateList,
  onDeleteList,
}: {
  taskLists: TaskList[];
  onCreateList?: (name: string, color: string) => Promise<void>;
  onUpdateList?: (id: string, updates: { name?: string; color?: string }) => Promise<void>;
  onDeleteList?: (id: string) => Promise<void>;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(LIST_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showCreate && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCreate]);

  const handleCreate = async () => {
    if (!newName.trim() || !onCreateList) return;
    setCreating(true);
    try {
      await onCreateList(newName.trim(), newColor);
      setNewName('');
      setNewColor(LIST_COLORS[0]);
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed || !onUpdateList) { setEditingId(null); return; }
    const original = taskLists.find((l) => l.id === id);
    if (original && trimmed === original.name) { setEditingId(null); return; }
    try {
      await onUpdateList(id, { name: trimmed });
      setEditingId(null);
    } catch {
      // Keep editing state on failure so user can retry
      return;
    }
  };

  const handleDelete = async (id: string) => {
    if (!onDeleteList) return;
    try {
      await onDeleteList(id);
    } catch {
      // Keep confirm state on failure so user can retry
      return;
    }
    setConfirmDeleteId(null);
  };

  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
        <ListTodo className="w-3 h-3 inline mr-1 -mt-px" />
        Task lists
      </h3>
      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
        Group tasks into lists for better organization.
      </p>

      {/* List items */}
      <div className="space-y-1" role="list" aria-label="Task lists">
        {taskLists.map((list) => (
          <div
            key={list.id}
            role="listitem"
            className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card group"
          >
            {editingId === list.id ? (
              <>
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: list.color }} />
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(list.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onBlur={() => handleRename(list.id)}
                  className="flex-1 px-2 py-1 text-xs bg-muted rounded focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </>
            ) : confirmDeleteId === list.id ? (
              <>
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: list.color }} />
                <span className="flex-1 text-xs text-foreground truncate">{list.name}</span>
                <button
                  onClick={() => handleDelete(list.id)}
                  className="px-2 py-1 rounded bg-destructive text-[10px] font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-2 py-1 rounded bg-muted text-[10px] font-medium text-foreground hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: list.color }} />
                <button
                  type="button"
                  className="flex-1 text-left text-xs font-medium text-foreground truncate hover:text-primary transition-colors"
                  onClick={() => {
                    setEditingId(list.id);
                    setEditName(list.name);
                  }}
                >
                  {list.name}
                </button>
                {onDeleteList && (
                  <button
                    onClick={() => setConfirmDeleteId(list.id)}
                    className="p-0.5 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                    aria-label={`Delete ${list.name}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Create new list */}
      {showCreate ? (
        <div className="mt-2 p-3 rounded-lg border border-border bg-card space-y-2">
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setShowCreate(false);
            }}
            placeholder="List name"
            className="w-full px-2.5 py-1.5 text-xs bg-muted rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex items-center gap-1.5">
            {LIST_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={cn(
                  'w-5 h-5 rounded-full border-2 transition-colors',
                  newColor === c ? 'border-foreground scale-110' : 'border-transparent',
                )}
                style={{ backgroundColor: c }}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="h-7 px-3 text-[11px]"
            >
              {creating ? 'Creating...' : 'Create'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowCreate(false)}
              className="h-7 px-3 text-[11px]"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add list
        </button>
      )}
    </section>
  );
}

// ============================================================
// Scheduling Profiles Sub-section
// ============================================================

const PROFILE_COLORS = ['#2563EB', '#0D9488', '#059669', '#7C3AED', '#DB2777', '#B45309', '#DC2626', '#D97706'];
const DAY_LABELS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function emptyWindows(): ScheduleWindow[] {
  return [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, start: '09:00', end: '17:00' }));
}

function SchedulingProfilesSection({
  schedulingProfiles,
  onCreateProfile,
  onUpdateProfile,
  onDeleteProfile,
}: {
  schedulingProfiles: SchedulingProfile[];
  onCreateProfile?: (input: SchedulingProfileInput) => Promise<void>;
  onUpdateProfile?: (id: string, updates: Partial<SchedulingProfileInput>) => Promise<void>;
  onDeleteProfile?: (id: string) => Promise<void>;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state for create/edit
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(PROFILE_COLORS[0]);
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formWindows, setFormWindows] = useState<ScheduleWindow[]>(emptyWindows());
  const [enabledDays, setEnabledDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));

  const resetForm = () => {
    setFormName('');
    setFormColor(PROFILE_COLORS[0]);
    setFormIsDefault(false);
    setFormWindows(emptyWindows());
    setEnabledDays(new Set([1, 2, 3, 4, 5]));
  };

  const openEdit = (profile: SchedulingProfile) => {
    setEditingId(profile.id);
    setFormName(profile.name);
    setFormColor(profile.color);
    setFormIsDefault(profile.is_default);
    const days = new Set(profile.windows.map((w) => w.day));
    setEnabledDays(days);
    // Merge profile windows with defaults so every day has a value
    const merged = emptyWindows().map((dw) => {
      const existing = profile.windows.find((w) => w.day === dw.day);
      return existing || { ...dw, start: '', end: '' };
    });
    setFormWindows(merged);
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    const windows = formWindows.filter((w) => enabledDays.has(w.day));
    if (windows.length === 0) return; // Require at least one working day
    setSaving(true);
    try {
      if (editingId && onUpdateProfile) {
        await onUpdateProfile(editingId, {
          name: formName.trim(),
          color: formColor,
          is_default: formIsDefault,
          windows,
        });
      } else if (onCreateProfile) {
        await onCreateProfile({
          name: formName.trim(),
          color: formColor,
          is_default: formIsDefault,
          windows,
        });
      }
      setShowCreate(false);
      setEditingId(null);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!onDeleteProfile) return;
    try {
      await onDeleteProfile(id);
      setConfirmDeleteId(null);
    } catch {
      // Keep confirm state on failure
    }
  };

  const toggleDay = (day: number) => {
    setEnabledDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const updateWindow = (day: number, field: 'start' | 'end', value: string) => {
    setFormWindows((prev) =>
      prev.map((w) => (w.day === day ? { ...w, [field]: value } : w)),
    );
  };

  const isFormOpen = showCreate || editingId !== null;

  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
        <Palette className="w-3 h-3 inline mr-1 -mt-px" />
        Scheduling profiles
      </h3>
      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
        Define per-day time windows for different types of work (e.g. "Work": Mon-Fri 9-17, "Study": evenings).
      </p>

      {/* Profile list */}
      {schedulingProfiles.length === 0 && !isFormOpen ? (
        <div className="p-3 rounded-lg border border-dashed border-border text-xs text-muted-foreground text-center">
          No scheduling profiles yet
        </div>
      ) : (
        <div className="space-y-1.5" role="list" aria-label="Scheduling profiles">
          {schedulingProfiles.map((profile) => (              <div
                key={profile.id}
                role="listitem"
                className="relative flex items-center gap-2.5 p-3 rounded-lg border border-border bg-card group"
              >
              <div
                className="w-3.5 h-3.5 rounded-full shrink-0"
                style={{ backgroundColor: profile.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-foreground truncate">
                  {profile.name}
                  {profile.is_default && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">(default)</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {profile.windows
                    .sort((a, b) => a.day - b.day)
                    .map((w) => DAY_LABELS_SHORT[w.day - 1])
                    .join(' ')}
                  {profile.windows.length > 0 && (
                    <span className="ml-1">
                      {profile.windows[0].start}–{profile.windows[0].end}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(profile)}
                  className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors"
                  aria-label={`Edit ${profile.name}`}
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
                {onDeleteProfile && (
                  <button
                    onClick={() => setConfirmDeleteId(profile.id)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label={`Delete ${profile.name}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              {/* Inline delete confirmation */}
              {confirmDeleteId === profile.id && (
                <div className="absolute right-0 top-full mt-1 z-10 p-2 bg-card border border-border rounded-lg shadow-lg">
                  <p className="text-[11px] text-foreground mb-2">Delete "{profile.name}"?</p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleDelete(profile.id)}
                      className="px-2 py-1 rounded bg-destructive text-[10px] font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1 rounded bg-muted text-[10px] font-medium text-foreground hover:bg-accent transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Profile editor form (create or edit) */}
      {isFormOpen && (
        <div className="mt-3 p-4 rounded-lg border border-border bg-card space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground">
              {editingId ? 'Edit profile' : 'New profile'}
            </h4>
            {onCreateProfile && !editingId && (
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-ring w-3.5 h-3.5"
                />
                Default
              </label>
            )}
            {editingId && onUpdateProfile && (
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-ring w-3.5 h-3.5"
                />
                Default
              </label>
            )}
          </div>

          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Profile name (e.g. Work, Study)"
            className="w-full px-2.5 py-1.5 text-xs bg-muted rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />

          {/* Color picker */}
          <div className="flex items-center gap-1.5">
            {PROFILE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setFormColor(c)}
                className={cn(
                  'w-5 h-5 rounded-full border-2 transition-colors',
                  formColor === c ? 'border-foreground scale-110' : 'border-transparent',
                )}
                style={{ backgroundColor: c }}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>

          {/* Day-of-week toggles + time windows */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Working days & hours
            </label>
            {[1, 2, 3, 4, 5, 6, 7].map((day) => {
              const enabled = enabledDays.has(day);
              const win = formWindows.find((w) => w.day === day);
              return (
                <div
                  key={day}
                  className={cn(
                    'flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors',
                    enabled ? 'bg-primary/5' : 'opacity-50',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={cn(
                      'w-8 text-[11px] font-medium rounded transition-colors text-center',
                      enabled
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {DAY_LABELS_SHORT[day - 1]}
                  </button>
                  {enabled ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="time"
                        value={win?.start || '09:00'}
                        onChange={(e) => updateWindow(day, 'start', e.target.value)}
                        className="flex-1 px-1.5 py-1 text-[11px] bg-muted rounded focus:outline-none focus:ring-1 focus:ring-ring tabular-nums"
                      />
                      <span className="text-[10px] text-muted-foreground">–</span>
                      <input
                        type="time"
                        value={win?.end || '17:00'}
                        onChange={(e) => updateWindow(day, 'end', e.target.value)}
                        className="flex-1 px-1.5 py-1 text-[11px] bg-muted rounded focus:outline-none focus:ring-1 focus:ring-ring tabular-nums"
                      />
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Off</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-1.5 pt-1">              <Button
                size="sm"
                onClick={handleSave}
                disabled={!formName.trim() || saving || enabledDays.size === 0}
                className="h-7 px-3 text-[11px]"
              >
              {saving ? 'Saving...' : editingId ? 'Save' : 'Create'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowCreate(false);
                setEditingId(null);
                resetForm();
              }}
              className="h-7 px-3 text-[11px]"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Add profile button */}
      {!isFormOpen && onCreateProfile && (
        <button
          onClick={openCreate}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add profile
        </button>
      )}
    </section>
  );
}

// ============================================================
// Account Section
// ============================================================

function AccountSection({
  user,
  isGoogleConnected,
  onDisconnectGoogle,
  onSignOut,
  lastSyncAt,
  syncedEventCount,
  syncError,
  isSyncing,
  calendars,
  selectedCalendarIds,
  onToggleCalendar,
}: {
  user: SupabaseUser | null;
  isGoogleConnected: boolean;
  onDisconnectGoogle: () => void;
  onSignOut: () => Promise<void>;
  lastSyncAt: Date | null;
  syncedEventCount: number;
  syncError: string | null;
  isSyncing: boolean;
  calendars: GoogleCalendar[];
  selectedCalendarIds: string[];
  onToggleCalendar: (calendarId: string) => void;
}) {
  return (
    <div className="space-y-6">
      {user && (
        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
            Signed in
          </h3>
          <div className="p-3 rounded-lg border border-border bg-card flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-semibold text-primary">
                {user.email?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{user.email}</div>
              <div className="text-[11px] text-muted-foreground">Tempo account</div>
            </div>
          </div>
        </section>
      )}

      <section>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
          Connections
        </h3>
        <div className="space-y-2">
          <div className="p-3 rounded-lg border border-border bg-card flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-info/10 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-info" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">Google Calendar</div>
              <div className="text-[11px] text-muted-foreground">
                {isGoogleConnected ? 'Connected' : 'Not connected'}
              </div>
            </div>
            {isGoogleConnected && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDisconnectGoogle}
                className="h-8 text-xs gap-1.5"
              >
                <Unlink className="w-3.5 h-3.5" />
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Calendar selection */}
      {isGoogleConnected && calendars.length > 0 && (
        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
            Calendars synced
          </h3>
          <div className="space-y-1">
            {calendars.map((cal) => {
              const isSelected = selectedCalendarIds.includes(cal.id);
              return (
                <button
                  key={cal.id}
                  onClick={() => onToggleCalendar(cal.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors text-left',
                    isSelected
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-border bg-card hover:bg-accent/30',
                  )}
                >
                  <div
                    className="w-4 h-4 rounded-sm shrink-0"
                    style={{ backgroundColor: cal.backgroundColor || '#999' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">
                      {cal.summary}
                      {cal.primary && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">(primary)</span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
            Selected calendars are imported as busy blocks. Tasks will never overlap events from these calendars.
          </p>
        </section>
      )}

      {/* Sync status */}
      <section>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
          Sync status
        </h3>
        <div className="p-3 rounded-lg border border-border bg-card space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Status</span>
            <span className={cn(
              'font-medium',
              syncError ? 'text-destructive' : isSyncing ? 'text-primary' : 'text-success',
            )}>
              {syncError ? 'Error' : isSyncing ? 'Syncing...' : 'Up to date'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Last sync</span>
            <span className="font-medium text-foreground">
              {lastSyncAt ? formatDistanceToNow(lastSyncAt) + ' ago' : 'Never'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Events synced</span>
            <span className="font-medium text-foreground">{syncedEventCount}</span>
          </div>
          {syncError && (
            <div className="mt-2 p-2 rounded-md bg-destructive/5 border border-destructive/20 text-xs text-destructive">
              {syncError}
            </div>
          )}
        </div>
      </section>

      {user && (
        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
            Sign out
          </h3>
          <Button
            variant="ghost"
            onClick={onSignOut}
            className="w-full h-10 justify-center gap-2 text-destructive hover:bg-destructive/5 hover:text-destructive"
          >
            <LogOut className="w-4 h-4" />
            Sign out of Tempo
          </Button>
        </section>
      )}
    </div>
  );
}
