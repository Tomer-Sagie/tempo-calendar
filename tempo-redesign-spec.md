# Tempo Calendar — UI/UX Redesign Spec

## 1. Overview & Goals

**App**: Tempo Calendar (formerly FlowSavvy) — a personal AI scheduler that auto-schedules tasks into open Google Calendar slots.

**User**: Solo developer using this as a personal productivity tool. Desktop-first, mouse-driven workflow.

**Core goal**: Rebuild the entire frontend UX to feel like a professional, premium productivity tool — not an AI-generated prototype. The backend (scheduling engine, Supabase, Google sync, auth) is solid and preserved.

**North stars**: Fantastical (visual polish, day/week navigation, premium typography) + Motion/Reclaim.ai (auto-scheduling, time-blocking views, priority queuing).

---

## 2. Current State Analysis — What's Broken

### 2.1 Calendar Component (react-big-calendar)
- **Events render incorrectly**: Colors, borders, and spacing don't create a clear visual hierarchy between Google events and scheduled tasks
- **Drag-and-drop broken**: Dragging a task on the calendar doesn't trigger rescheduling — the interaction is wired but doesn't function
- **Navigation clunky**: View switching (day/week/month/agenda) uses default react-big-calendar toolbar that looks dated
- **Information density poor**: Can't read task details at a glance on the calendar
- **Visual quality low**: Default react-big-calendar styling foundation looks unpolished despite CSS overrides
- **No time indicator**: Missing the "current time" red line that premium calendars have

### 2.2 Overall UX
- **"AI-generated" aesthetic**: Generic spacing, default shadcn styling, no personality or craft
- **Buttons unintuitive**: Schedule All / Refresh / Connect Google buttons lack clear affordance and context
- **Task sidebar disconnected**: Feels like a separate app grafted onto the calendar — no visual connection or shared context
- **No progressive disclosure**: 25+ fields in TaskDialog, all visible at once
- **Error states raw**: Supabase/Google errors shown as technical strings, not user-friendly messages
- **Dark mode exists in design tokens but untested/unpolished**

### 2.3 Auto-Scheduling
- **Requires manual trigger**: "Schedule All" button must be clicked manually
- **No auto-reaction**: Completing a task or adding a new Google event doesn't trigger rescheduling
- **Recalculate banner is good but buried**: Conflict detection works, but the banner is subtle and easily missed

### 2.4 Design System
- **Warm terracotta palette**: Good direction but execution is flat — shadows, spacing, and hierarchy aren't refined
- **Typography**: "Outfit" font set but inconsistent text sizes and weights across components
- **Animations**: Only basic fade/slide — no micro-interactions for state changes (completion, scheduling, etc.)
- **Scrollbar styling**: Custom but jarring against the premium goal

---

## 3. Design Direction

### 3.1 Aesthetic Principle
**"Dense + Premium"** — Information-rich enough for a power user, but with the visual polish of a pro tool like Fantastical or Linear.

- **Typography-forward**: Use typographic hierarchy (weight, size, color) as the primary means of creating structure, not boxes and borders
- **Intentional whitespace**: Tight where data density matters (calendar, task list), generous where focus matters (empty states, dialogs)
- **Glass/translucency sparingly**: The current `bg-card/95 backdrop-blur-sm` header is a good direction — extend this tastefully
- **Subtle shadows**: Use layered shadow tokens (sm/md/lg) to create depth without feeling heavy

### 3.2 Color Strategy
- **Light mode**: Refine the warm terracotta palette. The warm off-white background (`oklch(0.97 0.005 85)`) is good — keep it. Ensure text contrast is AAA for body text.
- **Dark mode**: Ship concurrently. Use deep warm greys (not pure black) with the terracotta accent. Refer to Linear's dark mode for reference.
- **Calendar events**: Sharper distinction between Google events (neutral, subdued), your scheduled tasks (brand-colored, prominent), locked tasks (subtle green border), missed tasks (warm red border), completed tasks (dashed, low opacity).

### 3.3 Motion Principles
- **Micro-interactions on state changes**: Task completion (checkmark animation), scheduling (slot highlight pulse), conflict detection (banner slides in)
- **View transitions**: Smooth animated transitions when switching day/week/month views
- **Loading states**: Skeleton screens, not spinners where possible
- **Drag feedback**: Visual feedback during drag — ghost element, drop zone highlighting
- **No gratuitous animation**: Every animation should serve a purpose (feedback, continuity, hierarchy)

---

## 4. Layout Architecture

### 4.1 Entry Point
**Land on the calendar week view.** No dashboard, no onboarding screen after first auth.

### 4.2 Proposed Layout (Desktop)
```
┌─────────────────────────────────────────────────────────┐
│ Header (48px)                                           │
│ [Brand] [Today|Week|Month toggles] [spacer] [Quick-add] │
├──────────────────────────────────────────────┬──────────┤
│                                              │ Summary  │
│                                              │ cards    │
│              Calendar                        │──────────│
│           (Full-width)                       │ Priority │
│                                              │ queue    │
│                                              │──────────│
│                                              │ Active   │
│                                              │ tasks    │
│                                              │ list     │
├──────────────────────────────────────────────┴──────────┤
│ Status bar (auto-hiding)                                │
└─────────────────────────────────────────────────────────┘
```

**Rationale**: Calendar-first with a narrow sidebar (280-320px). The sidebar shows:
1. **Summary cards** (today's stats, upcoming count, week fill %)
2. **Priority queue** (top 3-5 highest priority unscheduled tasks)
3. **Full task list** (scrollable, grouped by list or priority)

The sidebar should be collapsible to give the calendar full width.

**Mobile**: Stack vertically — calendar on top (compact day view), task list below in a sheet/drawer pattern.

### 4.3 Key Layout Decisions
- **No double sidebar**: The current layout has Header bar (nav) + Status bar (counts) + 320px sidebar — too many horizontal layers. Consolidate navigation into the header, collapse the status bar into sidebar summary cards.
- **Calendar is the hero**: It takes 70-75% of horizontal space. It's the primary interaction surface.
- **Sidebar as context, not parallel app**: The sidebar shows information *about* what's on the calendar — it's secondary, supplementary.
- **Status bar**: Auto-hiding, only visible when there are conflicts or when scheduling is in progress. Not a permanent fixture.

---

## 5. Feature Specifications

### 5.1 Calendar

#### 5.1.1 View Navigation
- **Header tabs**: Today | Week | Month — styled as segmented control (like Linear's view switcher), not generic buttons
- **Date navigation**: `<` `>` arrows with the current date range label (e.g., "Jun 9 – 15, 2026"). Clicking the label opens a date picker.
- **Today button**: Always visible, returns to current date/week/month
- **Smooth transitions**: Animated shift between day/week/month views

#### 5.1.2 Event Rendering
- **Google Calendar events**: Subtle, muted. Neutral grey/champagne background with thin left border. Standard weight text. These are "external constraints" — they should feel fixed, not interactive.
- **Scheduled task events**: Prominent. Use the task's assigned color as left border accent with a tinted background (current approach is good — keep the `color + '22'` hex opacity pattern). Bold title. Show duration.
- **Locked tasks**: Green tinted background, padlock icon or subtle "locked" indicator.
- **Flexible tasks**: Dashed left border (already implemented — keep).
- **Completed tasks**: Dashed border, line-through title, 50% opacity (already implemented — keep).
- **Missed/overdue tasks**: Warm red/terracotta tint, alert icon.
- **Current time indicator**: Red line with a dot/circle at the left edge (Fantastical-style).

#### 5.1.3 Drag and Drop
- **Critical fix**: Dragging a task event must trigger `tasksHook.update()` with new `scheduled_start` and `scheduled_end`, then sync to Google Calendar.
- **Visual feedback**: Ghost element follows cursor, original slot shows a dashed outline placeholder.
- **Constraint validation**: Don't allow dropping onto Google Calendar events (they're fixed). Snap to 15-minute grid.
- **Drop zones**: Highlight valid time slots on hover/drag — show available gaps in a subtle green.

#### 5.1.4 Click Behavior
- **Google event click**: Show a minimal tooltip/popover with event title, time, description. Don't open a dialog — these are read-only.
- **Task event click**: Open the task edit dialog.
- **Empty slot click**: Open quick-add task dialog pre-filled with that time slot.

### 5.2 Auto-Scheduling Engine

#### 5.2.1 Triggers (Full Auto-Pilot)
The scheduler should run automatically on:
1. **Task created** — immediately find and schedule a slot
2. **Task completed** — free up its slot, recalculate for remaining unscheduled tasks
3. **Google Calendar events changed** — refresh events, detect new conflicts, reschedule displaced tasks
4. **Task edited** — if duration/priority/due date changed, reschedule

#### 5.2.2 User Override
- **Lock toggle**: Any task can be locked (existing feature). Locked tasks are NEVER moved by the auto-scheduler.
- **Manual reschedule**: Drag a task to a new time → it becomes "locked" at that new time by default (prevents the scheduler from immediately moving it back).
- **Undo**: After auto-scheduling, show a toast: "3 tasks rescheduled. [Undo]"

#### 5.2.3 Conflict Handling
- **Detect conflicts on every calendar refresh** (existing logic works — keep)
- **Prominent banner**: Slide-in banner from the top of the calendar when conflicts detected. Shows conflict count and affected tasks.
- **One-click resolve**: "Resolve conflicts" button in the banner triggers `batchReschedule()`

### 5.3 Task Management

#### 5.3.1 Task Dialog (Rebuilt)
**Progressive disclosure pattern**:
- **Step 1 (always visible)**: Title, duration presets (15m/30m/1h/2h/4h), due date, priority (segmented control), list selector
- **Step 2 (expand)**: Description, tags, color, preferred days (Mon-Sun toggles)
- **Step 3 (advanced)**: Buffers, splitting, scheduling horizon, preferred time window, deadline, notes, all checkboxes

**New features**:
- Natural language duration: Type "2h" or "90m" in the duration field
- Quick color: 10 color dots in a row (current) — keep but make larger and add a "custom" option
- Priority visual: Each priority level has a distinct color treatment in the segmented control
- List selector: Dropdown showing list name + color dot

#### 5.3.2 Quick-Add (New)
- **Calendar slot click**: Opens a minimal inline form at the clicked time
- **Global shortcut**: Cmd+K or button in header opens a command-palette-style quick-add bar
- **Quick-add fields**: Title + duration + priority. Everything else defaults.
- **Submit**: Creates task AND immediately schedules it into the nearest open slot

#### 5.3.3 Task List Sidebar
- **Header**: "Tasks" with count badge + quick-add (+) button
- **Filter pills**: Horizontal scrollable pills for lists (matching current implementation — keep and polish)
- **Sections**: Unscheduled (sorted by priority → due date), Scheduled (sorted by time), Completed (collapsed by default)
- **Task rows**: Completion checkbox, priority dot, title, time/duration, urgency badge. Click to edit.
- **Context menu**: Edit, Schedule Now, Lock/Unlock, Delete (confirmation step)

#### 5.3.4 Task Completion
- **Checkbox animation**: Checkmark draws in with a spring animation. Task row fades down and moves to completed section.
- **Auto-reschedule trigger**: Completing a task triggers the scheduler to fill its vacated slot.
- **Reopen**: Completed tasks have "Reopen" in their context menu.

### 5.4 Summary/Dashboard Cards (Sidebar Top)
- **Today card**: Number of scheduled tasks today + total hours planned
- **This week card**: Week fill percentage with a subtle progress bar (already computed — just visualize it better)
- **Unscheduled card**: Count of unscheduled tasks, color-coded by priority breakdown
- **Overcommitment warning**: If week > 85% filled, show a warning card with the percentage

### 5.5 Empty States
- **No tasks**: "No tasks yet — click anywhere on the calendar to create one" with a subtle illustration
- **No Google Calendar connected**: Current auth prompt is decent — refine the typography and add a preview image
- **All tasks scheduled**: "Everything's planned. Add a new task to fill your open time."
- **No conflicts**: Don't show anything — clean state

### 5.6 Error Handling
- **Auth errors**: Map Supabase error codes to user-friendly messages. "Google sign-in not configured" instead of raw JSON.
- **Google Calendar errors**: Show a concise banner with a retry button. Don't show stack traces.
- **Sync errors**: Collect in a dismissible notification area, not raw console.error prints.
- **Network errors**: Detect offline state. Show "You're offline. Changes will sync when you reconnect."

### 5.7 Dark Mode
- **System preference detection**: Default to system preference on first load
- **Manual toggle**: In the settings page, with a quick-toggle in the header/account menu
- **Complete coverage**: Every component, every calendar event style, every dialog must work in dark mode
- **Dark palette**: Deep warm greys (not blue-tinted), terracotta accent pops, softened borders

### 5.8 Recurring Tasks & Habits (Essential)
The user relies on recurring tasks daily. This needs first-class UX.

#### 5.8.1 Creating a Recurring Task
- **Frequency selector in TaskDialog Step 1**: Once / Daily / Weekly / Custom
- **Custom recurrence**: Every X days/weeks. On specific days (Mon, Wed, Fri).
- **Habit toggle**: "This is a habit" checkbox. Habits track streaks.
- **Visual indicator**: Recurring tasks show a loop/sync icon in the task list and calendar.

#### 5.8.2 Auto-Scheduling Recurring Tasks
- On completion, the next instance is auto-created and auto-scheduled.
- If the task is daily: next instance = tomorrow. Weekly: next week. Custom: next occurrence.
- The completed instance moves to Completed section with a "next: tomorrow" indicator.
- Locked recurring tasks stay at the same time each day/week.

#### 5.8.3 Habit Streaks
- **Streak tracking**: Show streak count on habit tasks (e.g., "🔥 12 day streak").
- **Missed day**: If a habit isn't completed by end of day, streak resets to 0.
- **Streak card in sidebar**: Show current streak and longest streak for motivation.

#### 5.8.4 Managing Recurring Tasks
- **"Skip today"**: Skip one instance without breaking the streak (for rest days, etc.).
- **Edit series**: Edit the recurring template (affects future instances).
- **Delete series**: Delete all future instances of a recurring task.
- **Completed habit history**: Calendar shows a subtle dot on days where the habit was completed.

### 5.9 Scheduling Profile Management (New)
The user wants full management UI for scheduling profiles.

#### 5.9.1 Profile Editor
- **Access from**: Settings page or from a "Manage profiles" link in the TaskDialog profile dropdown.
- **Profile fields**: Name, color, timezone, default toggle, day-of-week working hours windows.
- **Window editor**: For each day (Mon-Sun), set start/end time. Visual timeline preview.
- **Default profile**: Mark one profile as default. Applied to tasks without an explicit profile.

#### 5.9.2 Profile CRUD
- Create, update, delete profiles.
- Deleting a profile: tasks with that profile revert to default. Confirm dialog.
- Reordering: Profiles are listed by name. Default always on top.

### 5.10 Task List Management (New)
The user wants full management UI for task lists.

#### 5.10.1 List Editor
- **Access from**: Sidebar "+ New list" button, or from TaskDialog list dropdown "Manage lists" link.
- **List fields**: Name, color, sort order.
- **Inline editing**: Click a list name in the sidebar filter pills to rename it inline.
- **Delete list**: Confirm dialog. Tasks in that list become "No list".

#### 5.10.2 List CRUD
- Create, rename, delete, reorder lists.
- Drag to reorder list filter pills in the sidebar.
- List colors: Same 10-color palette as task colors.

### 5.11 Task Splitting Behavior
Tasks can be split across multiple time slots (codebase already supports this via `can_split`, `can_balance_across_days`, `min_chunk_duration`, `max_chunks`).

#### 5.11.1 Manual Splitting
- **User sets preferences**: In TaskDialog advanced section, check "Can split" and optionally set min chunk size and max chunks.
- **Scheduler respects**: When finding slots, if a 4-hour task can't fit, try 2x2h or 4x1h based on user prefs.
- **Calendar display**: Split task chunks show a visual connector (like a bracket or similar color) linking the pieces.
- **No auto-split**: The scheduler never splits without the user explicitly enabling it per-task.

### 5.12 Missed Task Handling
Tasks that pass their scheduled end time without completion are "missed".

#### 5.12.1 Detection
- Automatically mark as missed when `scheduled_end < now` and status is still 'active'.
- Show missed tasks with red border + missed icon on the calendar and in the task list.

#### 5.12.2 Auto-Scheduler Behavior
- **Missed tasks are re-scheduled**: On next auto-schedule run, missed tasks are treated as unscheduled and get new slots.
- **Unless locked**: Locked missed tasks stay at their original time (user manually handles them).
- **Priority bump**: Missed ASAP tasks remain at the front of the queue.

#### 5.12.3 User Actions
- **Complete late**: Mark as completed even though they're past due.
- **Dismiss**: Acknowledge the miss without rescheduling. Status becomes 'missed' permanently.
- **Reschedule now**: Manually trigger finding a new slot for the missed task.

### 5.13 Search & Filter
- **Global search**: Cmd+K opens a command palette. Type to search tasks by title, tag, list.
- **Quick actions**: "Schedule [task name]" in the command palette triggers scheduleOne.
- **Calendar search**: Search bar in calendar header to find events by keyword.
- **Task list filter**: Existing list pills + a text filter input for title search.

### 5.14 Settings & Preferences (New)
Access from account menu in header → "Settings" opens a settings dialog.

#### 5.14.1 General
- **Working hours**: Default start (9 AM) and end (5 PM). Stored in localStorage or user_settings table.
- **Week start day**: Monday or Sunday. Affects calendar week view.
- **Time format**: 12-hour or 24-hour. Affects all time displays.
- **Language/Locale**: Future consideration (not Phase 1).

#### 5.14.2 Appearance
- **Theme**: System / Light / Dark. Stored in localStorage, applied immediately.
- **Calendar density**: Compact / Standard / Comfortable. Affects event row height and text size.

#### 5.14.3 Calendar
- **Connected calendars**: Select which Google Calendars to import from. Checkbox list.
- **Refresh interval**: How often to auto-refresh events (default: 5 minutes).
- **Default view**: Day / Week / Month (default: Week).

#### 5.14.4 Scheduling Profiles
- List all profiles. Edit, delete, create new. Set default.

#### 5.14.5 Task Lists
- List all lists. Edit, delete, create new. Drag to reorder.

### 5.15 Loading States
Every component needs a loading state. No raw spinners — use skeletons where possible.

| Component | Loading State |
|-----------|--------------|
| Calendar | Skeleton grid matching the current view (day/week/month). Grey placeholder blocks for events. |
| Task sidebar | Skeleton rows: 5-7 placeholder rows with grey bars. |
| Summary cards | Skeleton cards: grey boxes with pulsing animation. |
| Task dialog | Full dialog is available immediately. Save button shows spinner during save. |
| Auth dialog | Google button shows spinner during OAuth redirect. Email form shows spinner during login. |
| Settings dialog | Available immediately. Loading states for async data (profile list, calendar list). |

### 5.16 Mobile Experience (Desktop-First, Mobile Functional)
- **Calendar**: Compact day view by default. Swipe left/right to navigate days.
- **Task access**: Bottom sheet / drawer pattern. Swipe up from bottom to reveal task list.
- **Quick-add**: Floating action button (FAB) in bottom-right corner.
- **Task dialog**: Full-screen sheet on mobile (not centered modal).
- **Settings**: Full-screen page on mobile.
- **Sidebar**: Hidden by default on mobile. Accessible via hamburger or swipe.

### 5.17 Onboarding Flow
After first sign-in + Google Calendar connect:
1. **Welcome toast**: "Welcome to Tempo Calendar. Create your first task or we'll find time for what matters."
2. **Guided first task**: Optional "Create your first task" card that walks through the quick-add flow.
3. **Auto-schedule on first task**: After creating the first task, auto-schedule it immediately to demonstrate the core value.
4. **No forced tour**: Don't block the user. The guided hints are dismissible.

---

## 6. Design Resources & Component Libraries

The redesign should leverage premium copy-paste component libraries alongside shadcn/ui (already in use). None of these libraries provide a calendar component, so the calendar remains react-big-calendar or custom-built.

### 6.1 npm Packages Installed
| Package | Version | Purpose |
|---------|---------|---------|
| `framer-motion` | latest | Animation engine for premium micro-interactions, views transitions, drag feedback, skeleton pulse effects |
| `@radix-ui/react-dialog` | existing | Accessible dialog primitives (TaskDialog, AuthDialog, Settings) |
| `react-big-calendar` | existing | Calendar grid (potentially replaced or deeply re-styled in Phase 2) |
| `date-fns` | existing | Date formatting and math |
| `lucide-react` | existing | Icon library |
| `tailwind-merge` + `clsx` | existing | Utility for merging Tailwind classes |

### 6.2 Copy-Paste Component Libraries (Visual Polish)

These libraries are NOT installed via npm — individual components are copied into the project as needed.

| Library | Best Used For | Design Style | Dark Mode |
|---------|--------------|-------------|-----------|
| **Aceternity UI** | Glass/translucent cards, animated backgrounds, glowing effects, high-end empty states, animated loaders | Dark-focused, "magical," gradients, glassmorphism | ✅ Native |
| **Magic UI** | Bento grid layouts, animated cards, theme toggler, shimmer effects, hover interactions | Modern, motion-forward, playful | ✅ Native |
| **Componentry** | Magnetic interactions, dither gradients, scroll effects, premium micro-interactions | Premium, interactive, cutting-edge | ✅ Native |
| **shadcn/ui** (already using) | Functional primitives: buttons, dialogs, inputs, selects, segmented controls | Clean, accessible, minimal | ✅ Native |

### 6.3 How Each Library Applies to Tempo Calendar

**Aceternity UI — use for:**
- Glass-card summary panels in the sidebar (translucent, subtle border, backdrop blur)
- Animated empty state illustrations
- Skeleton loader effects for calendar and task list
- Background gradient effects for the app shell
- Hover glow effects on calendar events

**Magic UI — use for:**
- Bento grid layout for summary cards (Today / This Week / Streaks)
- Animated theme toggle (light ↔ dark transition)
- Shimmer effects on the current time indicator
- Animated checkmark for task completion
- Marquee or scroll effects for horizontal list filter pills

**Componentry — use for:**
- Magnetic hover effects on calendar events (subtle scale on hover)
- Dither gradient backgrounds for the header
- Premium drag-and-drop feedback (ghost element, drop zone pulse)
- Scroll velocity effects in the task list sidebar

**shadcn/ui — use for (continue using):**
- All form controls (inputs, selects, checkboxes, buttons)
- Dialog primitives (TaskDialog, AuthDialog, SettingsDialog)
- Toast notifications (Sonner-based)
- Command palette (cmdk-based, Cmd+K)
- Segmented controls (ToggleGroup)

### 6.4 Design Inspiration Platforms
| Platform | Use For |
|----------|---------|
| **Refero.design** | Browse screenshots of real calendar apps, task managers, and productivity tools to find UI patterns to emulate |
| **Mobbin** | Similar — browse production app screenshots organized by flow |
| **Dribbble** | Search "calendar app," "task manager," "time blocking" for visual design inspiration |

### 6.5 Key Design Patterns to Borrow
1. **Glass sidebar** (Aceternity): Translucent backdrop-blur cards for summary stats
2. **Bento grid summary** (Magic UI): 2x2 or 2x1 card grid showing Today / Week Fill / Streaks / Unscheduled
3. **Magnetic calendar events** (Componentry): Events subtly scale up on hover, creating a tactile feel
4. **Animated theme toggle** (Magic UI): Smooth day/night transition animation
5. **Spring-animated checkmark** (Framer Motion directly): Task completion checkbox draws in with a spring
6. **Pulse skeleton loaders** (Aceternity): Calendar skeleton grid and task list skeleton rows during loading
7. **Glow conflict banner** (Aceternity): Conflict detection banner with a subtle amber/warning glow
8. **Magnetic drag ghost** (Componentry + Framer Motion): Ghost element follows cursor with spring physics during drag

---

## 7. Component Architecture

### 6.1 Components to Rebuild
| Component | Current State | Target |
|-----------|--------------|--------|
| `App.tsx` | 300+ lines, 3 gating states, too much layout logic | Split into `AuthenticatedApp` and `UnauthenticatedApp`. Move layout to a `Shell` component. |
| `BigCalendar.tsx` | react-big-calendar with heavy CSS overrides | Rewrite as `CalendarView.tsx` with either deeply re-styled RBC or a custom calendar component |
| `TaskDialog.tsx` | 25-field form, Radix Dialog | Rebuild with 3-step progressive disclosure. Add natural language duration input. |
| `TaskList.tsx` | 400+ lines, mixed concerns | Split into `TaskSidebar.tsx` (container), `TaskRow.tsx`, `CompletedTaskRow.tsx`, `TaskMenu.tsx` |
| `Header.tsx` | 14 props, 3 auth states | Simplify props via context. Rebuild as `ShellHeader.tsx` with view toggles, quick-add, and account menu. |
| `AuthDialog.tsx` | Email + Google auth | Polish: better typography, better Google button, better error states |

### 7.2 New Components to Create
| Component | Purpose |
|-----------|---------|
| `Shell.tsx` | App shell: header + main area + sidebar layout |
| `Sidebar.tsx` | Right sidebar: summary cards + task list. Collapsible. |
| `SummaryCards.tsx` | Today/week/unscheduled streak stat cards |
| `QuickAdd.tsx` | Command-palette (Cmd+K) + inline calendar quick-add form |
| `CalendarView.tsx` | Calendar component (either custom or RBC wrapper) |
| `EventPopover.tsx` | Tooltip/popover for Google Calendar events (read-only) |
| `ConflictBanner.tsx` | Slide-in conflict resolution banner |
| `Toast.tsx` | Toast notification system for auto-schedule actions |
| `EmptyState.tsx` | Reusable empty state component |
| `SettingsDialog.tsx` | Settings page/dialog: general, appearance, calendar, profiles, lists |
| `ProfileEditor.tsx` | Create/edit scheduling profiles with day-of-week window editor |
| `ListEditor.tsx` | Inline list rename + create/delete dialog for task lists |
| `CommandPalette.tsx` | Cmd+K global search: find tasks, quick actions |
| `RecurringTaskRow.tsx` | Special task row for recurring tasks: show next instance, streak count |
| `StreakCard.tsx` | Sidebar card showing current and longest habit streaks |

### 7.3 Data Flow (Preserved)
The current hooks and lib structure works and should be preserved:
- `useAuth()` → Supabase auth state
- `useGoogleCalendar()` → Google Calendar API state
- `useTasks()` → Task CRUD + scheduling + completion
- `lib/scheduler.ts` → Slot finding, scheduling algorithm
- `lib/rescheduler.ts` → Conflict detection, batch reschedule
- `lib/sync.ts` → Google Calendar event sync
- `lib/tasks.ts` → Supabase task CRUD
- `lib/supabase.ts` → Supabase client

**New requirement**: `useTasks` needs an `autoSchedule` mode that watches for changes (new task, completed task, calendar events changed) and automatically triggers `scheduleAll()`.

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1-2)
1. **Dark mode polish**: Ensure every existing component works in dark mode. This forces a design token audit.
2. **Design system refinement**: Tune the OKLCH tokens — spacing scale, shadow tokens, border radius consistency, typography scale.
3. **Component audit**: Remove unused components (WeeklyCalendar.tsx is likely unused). Clean up CSS.
4. **Fix drag-and-drop**: Make calendar event dragging actually update the task schedule.
5. **TypeScript strict mode**: Fix all remaining type issues, remove all `any` casts.

### Phase 2: Calendar Rebuild (Week 2-3)
1. **Rebuild `CalendarView.tsx`**: Either deeply restyle react-big-calendar or evaluate a custom build. Key deliverable: premium-looking calendar with working drag-and-drop.
2. **Event rendering polish**: Google events vs task events visual hierarchy. Time indicator. Event popover.
3. **View navigation**: Smooth transitions between day/week/month. Segmented control in header.
4. **Calendar click behavior**: Slot click → quick-add. Event click → edit or popover.

### Phase 3: Sidebar + Task Management (Week 3-4)
1. **Rebuild sidebar layout**: Summary cards + streak card + task list. Collapsible.
2. **Rebuild TaskDialog**: Progressive disclosure (3 steps), natural language duration, polished form.
3. **Quick-add**: Command palette (Cmd+K) + inline calendar quick-add.
4. **Task list polish**: Completion animations, urgency badges, context menu refinements.
5. **List filtering + management**: Scrollable pills. Inline rename. Create/delete lists.
6. **Recurring task rows**: Special rendering for recurring tasks: next instance, streak count, skip button.

### Phase 4: Auto-Scheduling + Recurring Tasks (Week 4-5)
1. **Auto-schedule triggers**: Watch for task creation, completion, and calendar changes. Auto-trigger scheduling.
2. **Toast notifications**: "3 tasks scheduled. [Undo]"
3. **Conflict banner refinement**: Prominent, actionable, smooth animation.
4. **Lock-on-drag**: Dragging a task locks it at the new time.
5. **Undo system**: Store previous state before auto-scheduling for undo capability.
6. **Recurring task auto-generation**: On completion of a recurring task, auto-create the next instance + auto-schedule it.
7. **Habit streaks**: Track and display streaks. Reset on missed day. Show streak card in sidebar.

### Phase 5: Settings + Polish (Week 5-6)
1. **Settings dialog**: General (working hours, week start, time format), Appearance (theme, density), Calendar (connected calendars, refresh interval, default view), Scheduling Profiles (management), Task Lists (management).
2. **Scheduling profile editor**: Create/edit profiles with day-of-week window editor.
3. **Micro-interactions**: Completion animation, scheduling pulse, conflict banner slide-in, drag feedback.
4. **Empty states**: Beautiful empty states for all scenarios.
5. **Error handling**: User-friendly error messages, retry buttons, offline detection.
6. **Responsive audit**: Mobile layout — bottom sheet for tasks, FAB for quick-add, compact day view.
7. **Performance**: Check for unnecessary re-renders. Virtualize if >500 events. Debounce scheduling.
8. **Accessibility**: Focus management, aria labels, keyboard navigation.
9. **Onboarding flow**: Welcome toast, optional guided first task, auto-schedule demonstration.

---

## 8. Success Criteria

### 8.1 Visual Quality
- [ ] App no longer looks "AI-generated" — has distinct personality, consistent spacing, refined typography
- [ ] Dark mode is beautiful and complete
- [ ] Calendar events have clear visual hierarchy (Google vs tasks vs locked vs missed vs completed)
- [ ] Transitions and micro-interactions feel intentional, not tacked on

### 8.2 Functional Quality
- [ ] Drag-and-drop on calendar actually works (updates task schedule + syncs to Google)
- [ ] Auto-scheduling triggers on: task created, task completed, Google events changed
- [ ] Conflicts detected and resolved with one click
- [ ] Task dialog uses progressive disclosure (no 25-field wall)
- [ ] Quick-add works from calendar click and keyboard shortcut

### 8.3 Technical Quality
- [ ] Zero TypeScript errors in strict mode
- [ ] Zero ESLint errors
- [ ] No `catch (err: any)` anywhere
- [ ] No unused components or dead code
- [ ] Components under 300 lines (current TaskList and App are bloated)
- [ ] Hooks only re-render when their dependencies actually change

### 8.4 User Satisfaction
- [ ] Calendar feels premium and responsive
- [ ] Task management feels integrated, not bolted on
- [ ] Auto-scheduling reduces manual work to near-zero
- [ ] Dark mode is a first-class experience, not an afterthought

---

## 9. Risks & Dependencies

### 9.1 Technical Risks
- **react-big-calendar limitations**: May not support the level of customization needed for premium event rendering or smooth drag-and-drop. Mitigation: Evaluate early. If RBC can't deliver, build a custom week/day calendar view (the month view can remain RBC-based).
- **Auto-scheduling performance**: Running the scheduler on every task creation/completion could be expensive with many tasks. Mitigation: Debounce scheduling triggers by 500ms. Batch changes.
- **Google Calendar API rate limits**: Auto-scheduling creates many Google event updates. Mitigation: Batch updates where possible. Show rate limit errors gracefully.
- **Recurring task generation**: Auto-creating next instances of recurring tasks requires careful timestamp management. Mitigation: Generate next instance at completion time. Store recurrence rule on the original task.
- **Calendar event count**: If the user imports many Google Calendars, event count could cause RBC performance issues. Mitigation: Virtualize event rendering if >500 events. Provide calendar selection to reduce noise.

### 9.2 UX Risks
- **Auto-pilot anxiety**: Users may feel loss of control when tasks move automatically. Mitigation: Lock toggle for critical tasks. Undo button. Clear visual indication of what was moved.
- **Density overwhelm**: "Dense + premium" is hard to pull off — too much information looks cluttered. Mitigation: Progressive disclosure, careful typographic hierarchy, collapsible sections.
- **Dark mode completeness**: Easy to miss states (empty states, error states, loading states). Mitigation: Test every component in both modes during development.
- **Recurring task noise**: Daily habits could flood the calendar and task list. Mitigation: Show recurring tasks subtly (smaller, lighter). Option to hide future instances from the task list.
- **Settings complexity**: A full settings page with 5+ sections could feel overwhelming. Mitigation: Organize into clear tabs/sections. Keep common settings (theme, working hours) at the top.

### 9.3 Dependencies
- **react-big-calendar**: Current v1.x. If upgrading to v2 or replacing, plan for migration.
- **@radix-ui/react-dialog**: Currently used for TaskDialog and AuthDialog. Keep — it's good.
- **date-fns**: Already used extensively. Keep.
- **lucide-react**: Already used for icons. Keep — it's comprehensive.
- **Supabase**: Relied upon for auth + data. No changes needed.
- **Google Calendar API (GIS)**: Relied upon for calendar events. No changes needed.

---

## 10. Resolved Questions (from interview)

1. **Custom calendar or RBC?** → Start with react-big-calendar and deep CSS customization. If RBC can't deliver Fantastical-level visual polish (week/day views), build a custom week/day view in Phase 2. Month view stays RBC-based regardless.
2. **Undo system scope** → Last auto-schedule action only. Simple undo stack (depth: 1). "3 tasks rescheduled. [Undo]" reverts to previous state.
3. **Notifications** → No browser notifications. In-app only: conflict banners, auto-schedule toasts.
4. **Multiple calendars** → Yes. Settings page allows selecting which Google Calendars to import from. Default: primary calendar.
5. **Analytics** → Not needed. Personal tool, no product metrics required.
6. **Recurring tasks** → Essential. First-class UX with auto-creation of next instance, habit streaks, and skip/completion tracking.
7. **Task dependencies** → Keep backend support. Don't build dependency UI. Preserve `task_dependencies` table and scheduler logic.
8. **Scheduling profiles** → Full management UI in settings. Create, edit, delete, set default.
9. **Task lists** → Full management UI. Inline rename, drag to reorder, create/delete.
10. **Busy blocks** → Keep backend. Don't invest in busy block UX.
11. **Task splitting** → Manual only. User explicitly enables splitting per-task. No auto-split.
12. **Settings page** → Full settings with working hours, theme, calendar selection, time format, profile management, list management.
13. **Search** → Global command palette (Cmd+K) + inline task list search.
14. **Mobile** → Functional but secondary. Bottom sheet for tasks, FAB for quick-add, compact day view for calendar.

---

## 11. What NOT to Change
- **Scheduling engine** (`lib/scheduler.ts`): The algorithm works. Don't touch it.
- **Rescheduler** (`lib/rescheduler.ts`): Conflict detection and batch reschedule logic works. Keep.
- **Supabase schema**: The current migrations are solid. No schema changes needed.
- **Auth flow**: Supabase Auth + Google OAuth + email/password all work. Don't break them.
- **Google Calendar sync** (`lib/sync.ts`): Two-way sync is working. Keep the logic.
- **Task types and interfaces** (`lib/types.ts`): The current type definitions are comprehensive. Keep.

---

*Spec version 2.0 — generated from 6 interview rounds + full codebase analysis + gap review. All open questions resolved. Ready for phase 1 implementation.*
