# Tempo Calendar — Product Specification

> **Version:** 1.0  
> **Status:** Draft — ready for implementation  
> **Last updated:** 2026-06-10

---

## 1. Overview & Vision

**Tempo Calendar** is a personal AI scheduling assistant that automatically plans your to-do list into open calendar time, continuously rebalances when plans change, and recalculates missed work back into your schedule. It is designed for busy individuals who want automated time blocking without team or enterprise complexity.

**Core philosophy:** The app should feel like a regular calendar, but with intelligent automation always working in the background. Tasks find their own time. You stay in control.

**Differentiation from FlowSavvy:** While FlowSavvy is the primary inspiration, Tempo Calendar will have its own distinct visual identity — a **minimal, Swiss-inspired aesthetic** that is warm, precise, and never empty or basic. It is a personal tool first, not a clone.

**Goal:** Production-ready personal scheduler. May eventually be used by a few trusted users. Monetization is a distant thought — the primary motivation is to avoid paying for other tools.

---

## 2. Target Audience

- **Primary:** The developer (Tomer) — a busy individual juggling multiple calendars and to-do lists
- **Secondary:** A small circle of trusted users who might be invited later
- **Not target:** Enterprise teams, project managers, or users needing heavy collaboration

---

## 3. Tech Stack (Keep or Extend)

| Layer | Current | Decision |
|-------|---------|----------|
| Frontend | React 19 + Vite + TypeScript | **Keep** |
| Styling | Tailwind CSS v4 + custom CSS tokens | **Keep, redesign tokens** |
| UI Components | Radix UI + shadcn/ui | **Keep** |
| Calendar | react-big-calendar | **Keep, extend with drag-and-drop** |
| Backend | Supabase (PostgreSQL + RLS) | **Keep** |
| Auth | None (RLS allows all) | **Add Supabase Auth** |
| Calendar API | Google Calendar API (GIS) | **Keep, polish** |
| Hosting | Vercel | **Keep** |
| Date handling | date-fns | **Keep** |
| Icons | lucide-react | **Keep** |

**Backend changes:** Add Supabase Auth with per-user data isolation. No changes to Supabase hosting, Google OAuth, or Vercel deployment.

---

## 4. Brand Identity

### Name
**Tempo Calendar** — previously "FlowSavvy." The new name emphasizes rhythm, pacing, and the tempo of your day.

### Visual Identity
- **Aesthetic:** Minimal and Swiss-inspired, but warm and alive — not empty or basic
- **Typography:** Clean, precise, readable. Use Inter or a similar geometric sans-serif
- **Color palette:** Warm neutrals with a single signature accent color. Avoid generic SaaS blue. Consider a muted terracotta, deep forest green, or warm charcoal
- **Spacing:** Generous whitespace. Information density should feel intentional, not cramped
- **Shapes:** Rounded corners on interactive elements, sharp corners on containers for contrast
- **Animations:** Subtle, fast, and purposeful. No bouncy or playful animations — the tone is calm and precise

### Logo/Mark
- Simple geometric mark (abstract "T" or clock hands) that works at small sizes
- No illustration or mascot
- Monochrome version for dark mode

---

## 5. Feature Inventory

### 5.1 Core Engine (Must-Have)

| Feature | Status | Priority |
|---------|--------|----------|
| Auto-scheduling algorithm | Exists, needs polish | P0 |
| Priority-based ordering (ASAP, High, Normal, Low) | Exists | P0 |
| Recurring auto-scheduled tasks | Exists, needs UI polish | P0 |
| Drag-and-drop reschedule | **Does not exist** | P0 |
| 2-way calendar sync (tasks → Google) | Partially exists | P0 |
| Smart auto-recalculate on calendar changes | **Does not exist** | P0 |
| Manual recalculate button | Exists | P0 |

### 5.2 Scheduling Rules (Include Both)

| Feature | Status | Priority |
|---------|--------|----------|
| Scheduling profiles (work/personal/morning/evening) | DB exists, no UI | P1 |
| Task dependencies | DB exists, no UI | P1 |
| Due dates and deadlines | Exists | P1 |
| Duration-based placement | Exists | P1 |
| Buffer/before after minutes | Exists | P1 |
| Preferred days | Exists | P1 |
| Preferred time windows | Exists | P1 |
| Auto-schedule toggle per task | Exists | P1 |
| Lock toggle (fixed blocks) | Exists | P1 |
| Can split (chunk across days) | DB exists, no UI | P2 |
| Can balance across days | DB exists, no UI | P2 |
| Ignore if cannot schedule | DB exists, no UI | P2 |

### 5.3 Task Management

| Feature | Status | Priority |
|---------|--------|----------|
| Task lists (unlimited) | DB exists, no UI | P1 |
| Sidebar task list view | Exists, needs redesign | P1 |
| Task creation/editing dialog | Exists, needs redesign | P1 |
| Priority dots/indicators | Exists | P1 |
| Tags | Exists | P1 |
| Task colors | Exists | P1 |
| Overcommitment warnings | **Does not exist** | P1 |
| Unschedulable task suggestions | **Does not exist** | P1 |
| Task completion (mark done) | **Does not exist** | P1 |
| Streak tracking | DB exists, no UI | P2 |

### 5.4 Calendar Integration

| Feature | Status | Priority |
|---------|--------|----------|
| Google Calendar sync (1-way: import events) | Exists | P0 |
| Sync tasks back to Google Calendar | Partially exists | P0 |
| Outlook Calendar | **Not in scope** | P3 |
| iCloud Calendar | **Not in scope** | P3 |
| Multiple calendar accounts | **Does not exist** | P2 |
| Real-time calendar change detection | **Does not exist** | P1 |

### 5.5 Views & Workflow

| Feature | Status | Priority |
|---------|--------|----------|
| Calendar view (week/day/month) | Exists | P0 |
| Task sidebar | Exists | P0 |
| Mobile responsive view | **Does not exist** | P2 |
| Weekly overview widget | Exists | P1 |
| Urgency visual indicators | **Does not exist** | P1 |
| Today focus view | **Does not exist** | P2 |

### 5.6 Authentication & Multi-User

| Feature | Status | Priority |
|---------|--------|----------|
| Supabase Auth (email + OAuth) | **Does not exist** | P1 |
| Per-user data isolation | **Does not exist** | P1 |
| User profile/settings | **Does not exist** | P2 |

---

## 6. Database Schema Changes

### 6.1 Auth Migration
All tables need a `user_id` column referencing `auth.users(id)` with `ON DELETE CASCADE`. RLS policies must be updated to filter by `user_id = auth.uid()`.

### 6.2 Tables to Update
- `tasks` — add `user_id`, update all indexes
- `task_lists` — add `user_id`
- `scheduling_profiles` — add `user_id`, enforce one default per user
- `task_dependencies` — cascade via task FKs

### 6.3 New Tables (if needed)
- `user_settings` — timezone, default scheduling profile, default view, theme preference
- `sync_logs` — track last sync timestamp per calendar provider
- `notifications` — pending recalculation alerts, overcommitment warnings

---

## 7. Scheduling Engine Specification

### 7.1 Inputs
- **Task constraints:** duration, due date, deadline, priority, preferred days, preferred time windows, scheduling profile, buffer time, split/balance settings
- **Calendar constraints:** External events (Google), locked task blocks, busy blocks
- **User preferences:** Scheduling profiles (active hours), default horizon (8 weeks)

### 7.2 Algorithm Behavior
1. **Import external events** as busy blocks
2. **Add locked tasks** as busy blocks
3. **Topological sort** by dependencies
4. **Priority ordering** within dependency levels: ASAP > High > Normal > Low
5. **Find available slots** for each task, respecting scheduling profiles, preferred days, buffers, blocked times
6. **Pick best slot** — prefer earliest for ASAP, prefer time windows for others
7. **Mark as scheduled** and add to busy blocks for subsequent tasks
8. **Detect conflicts** — if a new external event overlaps a scheduled task, trigger recalculation

### 7.3 Recalculation Strategy (Smart Hybrid)
- **Auto-recalculate** on major changes: new external events that overlap scheduled tasks, deleted events, completed tasks
- **Manual recalculate** for minor conflicts or when the user wants to force replanning
- **Badge/notification** when conflicts are detected but not auto-resolved
- **Never move locked tasks** or external events

### 7.4 Drag-and-Drop Reschedule
- When a user drags a scheduled task to a new time:
  1. Update the task's `scheduled_start` and `scheduled_end`
  2. Set `is_locked = true` (or keep it as a preference — to be decided)
  3. Trigger recalculation for remaining flexible tasks
  4. Visual feedback: show the new position immediately, animate other tasks shifting

### 7.5 Unschedulable Task Handling
- Show in unscheduled list with a warning indicator (red dot or border)
- On hover/click, show suggestions:
  - Extend deadline
  - Reduce duration
  - Disable conflicting locked blocks
  - Change scheduling profile
- Overcommitment warning: if total unscheduled task duration exceeds available free time within the horizon, show a banner

---

## 8. UI/UX Design Principles

### 8.1 Layout
- **Desktop-first:** Primary use case is laptop/desktop
- **Three-pane layout:** Sidebar (task lists + navigation) | Main (calendar) | Right panel (task details or mini-week view)
- **Collapsible sidebar:** For focused calendar work
- **Header:** Minimal, sticky, with brand mark, view switcher, and account menu

### 8.2 Color System
- **Background:** Warm off-white or very light warm gray
- **Surface:** Pure white for cards and dialogs
- **Primary accent:** Warm terracotta or deep forest green (not blue)
- **Secondary:** Muted warm gray
- **Success:** Soft green
- **Warning:** Warm amber
- **Destructive:** Muted red
- **Text:** Near-black with warm undertones
- **Borders:** Very light warm gray, almost invisible

### 8.3 Typography
- **Base:** 14px minimum, 1.5 line-height
- **Headings:** 600 weight, tight tracking
- **Body:** 400 weight, relaxed tracking
- **Labels:** 500 weight, 12px, muted color
- **No microscopic text:** 10px is the absolute minimum

### 8.4 Micro-interactions
- **Hover:** Subtle background shift (no scale/transform on text)
- **Active/press:** Slight darkening
- **Loading:** Skeleton screens preferred over spinners
- **Transitions:** 150ms ease-out for all interactive elements
- **Task completion:** Brief strikethrough animation + fade out

### 8.5 Task Dialog Redesign
- **Progressive disclosure:** Title, duration, due date, priority visible by default
- **Advanced section:** Everything else (buffers, split, dependencies, scheduling profile, etc.)
- **Duration presets:** 15m, 30m, 1h, 2h, 4h as pill buttons + custom input
- **Color picker:** 10 curated colors, not a full spectrum
- **Dependencies:** Simple "Blocked by" search/select field

---

## 9. Calendar Integration Specification

### 9.1 Google Calendar
- **Read scope:** Import events as busy blocks
- **Write scope:** Create/update/delete task events back to Google Calendar
- **Sync frequency:** Real-time via polling (every 5 minutes) or on manual refresh
- **Event payload:**
  - Summary: task title
  - Description: task description + notes + link to Tempo Calendar
  - Color: map task color to nearest Google color
  - Recurrence: RRULE for recurring tasks
  - Transparency: opaque (blocks time)

### 9.2 Sync Rules
- Only sync tasks where `sync_to_calendar = true`
- On task unschedule: delete Google event
- On task update: update Google event
- On task completion: delete Google event (or mark as transparent)
- On task deletion: delete Google event

### 9.3 Real-Time Change Detection
- Poll Google Calendar every 5 minutes for changes
- Compare event IDs + updated timestamps
- If a new event overlaps a scheduled task, trigger smart recalculation

---

## 10. Authentication & Authorization

### 10.1 Auth Methods
- **Supabase Auth:** Email/password + Google OAuth
- **Single sign-on:** The same Google account used for calendar can be used for auth
- **Anonymous access:** Optionally allow anonymous users with local storage (for quick try-out)

### 10.2 Data Isolation
- Every row in every table must have `user_id = auth.uid()`
- RLS policies: `SELECT/INSERT/UPDATE/DELETE` only for `user_id = auth.uid()`
- No shared data between users
- No team or organization features

### 10.3 User Settings
- Timezone (default to browser timezone)
- Default scheduling profile
- Default calendar view (week/day/month)
- Theme preference (light/dark/system)
- Notification preferences

---

## 11. Task Completion & Habit Tracking

### 11.1 Task Completion Flow
1. User marks task as complete (checkbox or button)
2. Task status changes to `completed`
3. `completed_at` is set to current timestamp
4. `is_scheduled` becomes false
5. Google Calendar event is deleted
6. If task is a recurring task, generate the next occurrence
7. Trigger recalculation for remaining tasks

### 11.2 Habit Tracking
- Habits (`is_habit = true`) have a `streak_count` and `completion_history`
- On completion: increment streak, add date to history
- On missed scheduled time: reset streak to 0
- Visual: streak flame icon or badge

---

## 12. Edge Cases & Error Handling

### 12.1 Scheduling Failures
- **No slots available:** Task stays unscheduled, show warning + suggestions
- **Circular dependencies:** Detect via DFS, show error, skip tasks in cycle
- **Dependency not completed:** Dependent task stays unscheduled until blocker is done
- **Overcommitted:** Banner warning + suggest reducing workload

### 12.2 Calendar Sync Failures
- **Google API rate limit:** Back off with exponential retry, show user a warning
- **Token expired:** Auto-refresh if possible, otherwise prompt re-auth
- **Event deleted externally:** Detect on next sync, unschedule task locally
- **Conflict on write:** If Google rejects an event (e.g., overlapping with another user's event), log error and keep local schedule

### 12.3 Auth Failures
- **Session expired:** Redirect to login, preserve draft tasks in local storage
- **RLS violation:** Should never happen if frontend is correct, but log and alert

---

## 13. Mobile Strategy

- **Desktop-first:** Primary experience is on laptop/desktop
- **Responsive baseline:** The app should be usable on mobile (no broken layouts)
- **Mobile-specific features:**
  - Quick task capture (add from mobile home screen)
  - View today's schedule
  - Mark tasks complete
- **Not in scope:** Native mobile app (iOS/Android), offline support, push notifications

---

## 14. Monetization Plan

- **Current:** Free for personal use
- **Future:** Very distant thought. If ever monetized:
  - **Free tier:** Basic scheduling, 1 calendar, 3 lists, 2-week horizon
  - **Pro tier:** Unlimited lists, 8-week horizon, dependencies, multiple profiles, 2-way sync
- **For now:** Build as if it's a single-user product with no billing code

---

## 15. Implementation Phases

### Phase 1: Foundation & Auth
- Add Supabase Auth with user isolation
- Migrate all DB queries to filter by `user_id`
- Add user settings table
- Update RLS policies

### Phase 2: Visual Redesign
- Implement new design system (colors, typography, spacing)
- Redesign landing page (rename to Tempo Calendar)
- Redesign header, task sidebar, task dialog
- Redesign calendar view styling

### Phase 3: Core Engine Improvements
- Add real-time calendar change detection
- Implement smart hybrid recalculation
- Add drag-and-drop reschedule
- Improve scheduling algorithm with profiles and dependencies

### Phase 4: Task Management Features
- Add task completion flow
- Add overcommitment warnings
- Add unschedulable task suggestions
- Add task list UI (currently DB only)
- Add scheduling profile UI (currently DB only)
- Add dependency UI (currently DB only)

### Phase 5: Polish & Sync
- Improve 2-way Google sync (recurring events, color mapping)
- Add weekly overview widget
- Add urgency visual indicators
- Add habit tracking UI
- Performance optimization

---

## 16. Open Questions

1. **Drag-and-drop library:** Should we extend react-big-calendar's built-in drag-and-drop or use a custom implementation?
2. **Real-time sync:** Polling every 5 minutes is simple. Should we explore Google Calendar push notifications (webhooks)?
3. **Task completion animation:** What should the visual feedback look like when a task is completed?
4. **Dark mode:** Should we implement a true dark mode or stick to light mode for now?
5. **Keyboard shortcuts:** Should we add keyboard shortcuts (e.g., `N` for new task, `C` for complete, `R` for recalculate)?

---

## 17. Glossary

- **Scheduling profile:** A named set of time windows (e.g., "Work: Mon-Fri 9am-5pm")
- **Auto-schedule:** The algorithm that finds time slots and places tasks
- **Locked task:** A scheduled task that the user has fixed in place; the algorithm will never move it
- **Flexible task:** A scheduled task that the algorithm can move during recalculation
- **Recalculation:** The process of re-running the scheduling algorithm when something changes
- **Overcommitment:** When total task duration exceeds available free time within the horizon
- **2-way sync:** Importing external calendar events AND pushing scheduled tasks back to the calendar

---

*End of specification*
