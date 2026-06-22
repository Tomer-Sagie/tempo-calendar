# Tempo Calendar — CLAUDE.md

<!-- ============================================================
     Structure follows Fable 5 architectural patterns:
     Capabilities → Constraints → Negative examples → Work packets → Identity
     Tools & rules consume the most token budget. Persona is the footer.
     ============================================================ -->

<project_overview>
Tempo Calendar is a smart scheduling app. Users connect Google Calendar, capture tasks, and Tempo auto-schedules them into open time slots. The app handles recurring tasks, conflict detection, drag-and-drop rescheduling, subtasks, focus mode, and two-way Google Calendar sync.

**Stack:** React 19 + TypeScript 6 + Vite 8 + Tailwind CSS 4 + Supabase (Postgres/Auth) + shadcn/ui + Google Calendar API
**Deployed on:** Vercel (`npm run deploy` or `npm run deploy:prod`)
**Db:** Supabase (schema in `supabase/migrations/`)

### Required environment variables

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous API key |

Without these, `supabase` is `null`, `isSupabaseReady()` returns `false`, and the app displays a configuration screen with setup instructions. Find values in Supabase Dashboard → Project Settings → API.
</project_overview>

<auth_flow>
## Authentication and Google Calendar connection

1. User signs in via Supabase Google OAuth (`useAuth.connectGoogleCalendar()`)
2. Supabase session includes a `provider_token` (Google access token)
3. `auth.googleAccessToken` prop flows into `useGoogleCalendar`
4. `useGoogleCalendar` syncs the token into the `google.ts` module via `setAccessToken()`
5. Calendar events are auto-fetched on token change
6. Polling (default 60s) detects external changes in Google Calendar
7. `connect()` on the calendar hook is a legacy no-op — use `auth.connectGoogleCalendar()` instead
</auth_flow>

<capability_specs>
## Available commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server on port 5173 |
| `npm run dev:clean` | Kill stale port then start dev server |
| `npm run build` | Type-check (`tsc -b`) then build (`vite build`) |
| `npm run lint` | ESLint across the project |
| `npm run test` | Run Vitest (unit tests, 182 tests) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with coverage |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run deploy` | Deploy to Vercel preview |
| `npm run deploy:prod` | Deploy to Vercel production |

## Key libraries

- **`@dnd-kit/core`** — drag and drop (calendar events, task reordering)
- **`@radix-ui/react-dialog`** — accessible dialog/modals (TaskDialog uses this)
- **`@supabase/supabase-js`** — database, auth, realtime
- **`date-fns`** — all date math/formatting (NEVER use moment.js or raw Date math beyond simple cases)
- **`lucide-react`** — icon library
- **`sonner`** — toast notifications
- **`tailwind-merge` + `clsx`** — via `cn()` utility in `src/lib/utils.ts`
- **`chrono-node`** — natural language date parsing for quick-add

## Project file structure

```
src/
  App.tsx                  — main app shell, auth gates, state wiring
  main.tsx                 — entry point
  index.css                — Tailwind imports, CSS variables, custom scrollbars, calendar layout classes
  components/
    TempoCalendar.tsx       — calendar shell (toolbar + view router)
    TempoCalendarWeekView.tsx — 7-day week grid with sticky header
    TempoCalendarDayView.tsx  — single-day grid
    TempoCalendarMonthView.tsx — month grid
    TempoCalendarHelpers.tsx  — shared layout logic (event positioning, DnD ghosts)
    BentoSidebar.tsx        — quick-add + today panel
    TaskList.tsx            — full task list with sorting, menus, delete confirm
    TaskDialog.tsx          — create/edit task dialog (Radix Dialog)
    Header.tsx              — top nav bar
    FocusMode.tsx           — Pomodoro-style focus timer
    SettingsPanel.tsx       — settings drawer
    ... (30+ components)
  hooks/
    useAuth.ts             — Supabase auth (Google OAuth, sessions)
    useTasks.ts            — task CRUD, scheduling, Google sync
    useGoogleCalendar.ts   — Google Calendar API, event polling
    useSubtasks.ts         — subtask CRUD per task
    ... (10+ hooks)
  lib/
    types.ts               — all TypeScript interfaces (Task, SchedulingProfile, CalendarEvent, etc.)
    tasks.ts               — Supabase CRUD for tasks, lists, profiles, dependencies
    scheduler.ts           — core scheduling engine (slot finding, conflict detection, topological sort)
    rescheduler.ts         — conflict detection and batch rescheduling
    google.ts              — Google Calendar API calls (events, calendars, OAuth tokens)
    sync.ts                — bidirectional task-Google event sync
    recurring.ts           — recurring task occurrence generation
    utils.ts               — cn() helper, isAllDayTimeString(), platform detection
    supabase.ts            — Supabase client singleton
  ui/                      — shadcn/ui primitives (button, card, dialog, etc.)
supabase/
  migrations/              — SQL migration files
e2e/                       — Playwright E2E test specs
```
</capability_specs>

<build_constraints>
## TypeScript

- Project uses TypeScript ~6.0.2 with **strict mode**
- Path alias: `@/` maps to `src/`
- NEVER use `as any` type casts — they hide real type errors. Use proper type narrowing.
- `as Task` and `as Task[]` casts after Supabase queries are acceptable (Supabase returns untyped data, but the table schema guarantees the shape).
- Prefer explicit return types on exported functions
- Use `interface` for object shapes, `type` for unions/intersections

## React conventions

- All components are functional components with hooks
- Use `useCallback` for event handlers passed as props
- Use `useMemo` for expensive computations (event mapping, task filtering)
- Use `useRef` + mirror effects for values that callbacks need but shouldn't trigger rebuilds
- Lazy-load heavy components with `React.lazy()` + `Suspense`
- Dialog/modal components MUST use `@radix-ui/react-dialog` (NOT raw div overlays)

## Styling conventions

- Tailwind CSS v4 utility classes
- CSS variables in `index.css` for theming (light/dark via `.dark` class)
- Custom scrollbar styles via `tempo-scrollbar` class
- Component variants use `class-variance-authority` or inline `cn()` calls
- NEVER use inline `<style>` tags or CSS-in-JS — all styles go through Tailwind or index.css

## Data flow

- Supabase is the single source of truth for tasks
- Google Calendar events are fetched client-side and held in React state
- Two-way sync: task changes push to Google, Google polling detects external deletes
- NEVER mutate state directly — always use setState callbacks
- `useRef` mirrors for values consumed in effects/callbacks to avoid stale closures

## Supabase patterns

- All DB operations go through `src/lib/tasks.ts` (NOT raw Supabase calls in components)
- `supabase` client is null when env vars are missing — check with `isSupabaseReady()`
- Auth sessions carry a Google `provider_token` that flows into `useGoogleCalendar`
- RLS is enabled on all tables — queries run as the authenticated user

## Testing

- Unit tests: `src/**/*.test.ts` and `src/**/*.test.tsx` — run with `npm run test`
- E2E tests: `e2e/` — run with `npm run test:e2e`
- Test environment uses UTC timezone (configured in `vite.config.ts`)
- Mock Supabase calls; NEVER hit real APIs in unit tests
- Coverage targets: `scheduler.ts`, `rescheduler.ts`, `drag.ts`
## Key architectural patterns

### Two-way Google Calendar sync
- `useGoogleCalendar` polls Google every 60s for external changes
- When events disappear from Google (deleted externally), `onEventsDeleted` fires → `handleGoogleEventsDeleted` unlinks tasks, shows toast
- When Google events change (new meetings, cancellations), a `useEffect` in App.tsx auto-detects conflicts via `detectConflicts()` and silently calls `reschedule()`
- Task changes (create, update, complete, unschedule) push to Google via `sync.ts`

### Recurring task system
- Recurring tasks have `frequency: 'daily' | 'weekly'`, `preferred_days`, and `recurrence_end`
- `generateRecurringOccurrences()` in `src/lib/recurring.ts` expands a base task into individual occurrence events for calendar display
- Occurrence overrides (`occurrence_overrides` JSONB field) store per-date status/schedule changes without mutating the base task
- The `OccurrenceEditDialog` lets users choose scope: "this occurrence", "all", or "future"
- Editing a recurring task's base timeline, then choosing "future" in scope dialog → splits the series (old task ends, new task starts)

### Drag and drop
- `@dnd-kit/core` powers event dragging and resizing
- `TempoCalendarHelpers.ts` computes drag ghosts, column widths, event positioning
- Drop changes trigger occurrence scope dialog for recurring tasks
- Resize validates minimum 5-minute duration

### Calendar CSS classes (in `src/index.css`)
These are critical for the sticky header layout:

| Class | Purpose |
|-------|---------|
| `calendar-view-clip` | `overflow: clip` — does NOT create a scroll container (unlike `overflow: hidden`). Use on the outer calendar view wrapper. |
| `calendar-scroll-host` | `position: relative`, `will-change: scroll-position` — the scroll container that hosts the sticky header |
| `calendar-sticky-header` | `position: sticky !important; top: 0; width: 100%; left: 0;` — pins day headers + all-day strip. Uses `!important` to prevent Tailwind overrides. |

**IMPORTANT:** Never use `overflow: hidden` on a parent of a sticky element — it becomes the scroll container and breaks sticky. Use `overflow: clip` or the `calendar-view-clip` class.
</build_constraints>

<negative_examples>
## What to NEVER do

### NEVER use `overflow: hidden` on a parent that contains a sticky-positioned child
`overflow: hidden` creates a scroll container per CSS spec, which becomes the nearest scrolling ancestor and silently breaks `position: sticky`. Use `overflow: clip` or the `calendar-view-clip` class.

### NEVER use `h-full` on flex children
`height: 100%` resolves unreliably in flex children across browsers (especially Safari). Use `flex-1 min-h-0` instead. Maintain an unbroken chain of `flex-1 min-h-0 flex flex-col` from the top layout down to the scrollable container.

### NEVER forget `min-h-0` on flex children that should scroll
Flex children default to `min-height: auto`, which overrides `flex-1`'s `flex-basis: 0%` — the container grows to fit content and never scrolls.

### NEVER install packages globally
Use `npm install` (or the project's package manager). No `-g` flag unless explicitly asked.

### NEVER import libraries not already in package.json
Verify library usage by checking imports in existing files or package.json before using a new library.

### NEVER edit package.json directly to add dependencies
Use `npm install <package>` so the lockfile and version resolution stay consistent.

### NEVER create raw div-based modals
Use `@radix-ui/react-dialog` for dialogs/modals.

### NEVER call Supabase directly from components
All DB access goes through functions in `src/lib/tasks.ts`.

### NEVER mutate React state directly
Always use the setter function returned by `useState`.

### NEVER use `moment.js` or mix date libraries
`date-fns` is the project's date library. Don't import or use other date manipulation libraries.

### NEVER edit TypeScript types without checking all consumers
If you modify `src/lib/types.ts`, spawn a code-searcher to find all references and update them.

### NEVER leave `console.log` in production code
Use `console.warn` sparingly for expected issues, `console.error` in ErrorBoundary only.

### NEVER touch Supabase migrations without extreme caution
Migrations are versioned. Always create a NEW migration file; never edit an existing one that's been applied.
</negative_examples>

<work_packet_structure>
## When the user asks for a complex change

Package the task as a work packet:

1. **Goal**: what should exist at the end (one sentence)
2. **Context & files**: which files to read first, which to modify
3. **Constraints**: don't break `X`, keep `Y` convention, use `Z` pattern
4. **Acceptance criteria**: typechecks pass, `npm run test` passes, `npm run lint` clean
5. **Verification steps**:
   - `npx tsc -b --noEmit` — typecheck
   - `npm run test` — unit tests
   - `npm run lint` — ESLint
   - `npm run build` — full build (optional for small changes)
6. **Deliverables**: changed files, commit message
7. **Checkpoints**: after reading context, confirm approach before editing; after editing, review before committing

## Change size guidelines

- **< 10 lines, trivial** → edit directly, no review needed
- **10-50 lines** → edit, typecheck, test, review
- **50-200 lines** → read context first, plan, edit in steps, validate after each step
- **200+ lines or architectural** → ask the user for confirmation on the approach first
</work_packet_structure>

<tone_and_formatting>
## Output style

- Be **concise and direct** — this is a CLI/chat environment, not a blog post
- Use **bullet points** for lists of changes, **prose** for explanations
- Keep final summaries to a few words per change
- Don't ask "would you like me to...?" — either do it or state what you need
- When asking for clarification, provide concrete options the user can pick from
- One question per response max

## Code change summaries

After making changes, summarize with a short bullet list:
- "Fixed X by doing Y"
- "Added X to support Y"
- "Removed X because Y"

Don't narrate the journey. Just the result.
</tone_and_formatting>

<responding_to_mistakes>
## When something doesn't work

1. **Don't try the same fix again.** If sticky headers failed with `position: sticky`, try a completely different approach (CSS Grid fixed row, absolutely positioned clone, etc.)
2. **Read the actual rendered output.** Use `browser-use` agent to inspect computed CSS, not just the source.
3. **Come up with multiple fixes at once.** If the user says "it still doesn't work," propose and apply 5-10 different approaches simultaneously instead of iterating one at a time.
4. **Check the browser.** CSS issues are often invisible in code — `position: sticky` is notorious for failing silently due to ancestor overflow/height issues.
5. **Own the mistake.** "That didn't work. Here's why, and here's a different approach."
</responding_to_mistakes>

<evenhandedness>
## Design and architecture decisions

- When the user asks "what's the best way to..." — present the tradeoffs, not a single answer. List approaches with pros/cons.
- When asked to add a library, check if an existing dependency already solves the problem. Don't add new packages without verifying necessity.
- Simple solutions preferred over clever ones. The codebase already has 30+ components — don't add abstraction without clear need.
</evenhandedness>

<identity>
Tempo Calendar v1.2.0 — React + TypeScript + Supabase auto-scheduling calendar app.
</identity>
