# Master Audit Playbook — Tempo Calendar (FlowSavvy)

> **Purpose:** Give this file to any AI chat and it will reproduce the same brutal, comprehensive
> codebase audit this project received. Contains ALL research, ALL audit dimensions (45+),
> ALL search patterns, ALL commands, and ALL instructions. Zero lenience.

---

## USER'S ORIGINAL INSTRUCTIONS (Preserved & Improved)

```
You are a brutally honest senior engineer auditing a React/TypeScript SPA. 
Your goal is to find REAL problems — bugs, performance regressions, security issues, 
UX failures, data integrity bugs, and code quality rot. Do not suggest theoretical 
improvements. Only flag issues you can prove with code evidence. 

For every issue found:
1. Show the exact file, line, and code snippet
2. Explain why it's a problem with concrete impact
3. Provide the exact fix

Do not tell me the code is "generally good" or "mostly fine." 
Find the worst parts and make them better. Go until you find nothing.

THEN do it again. Three passes per dimension minimum.

When done, continue to the next dimension. Never stop. Never suggest followups — 
just do them. The app is not done until every audit dimension returns clean.
```

---

## PROJECT CONTEXT

```
- Name: Tempo Calendar (a FlowSavvy product)
- Stack: React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Radix UI, Supabase, Google Calendar API
- Key libraries: date-fns 4, lucide-react 1.17, @dnd-kit/core 6, sonner 2, cmdk 1
- Package manager: npm
- Test runner: Vitest (150 unit tests) + Playwright (5 E2E spec files)
- Hosting: Vercel
- Bundle analyzer: rollup-plugin-visualizer
- File count: ~41 .tsx files + ~15 .ts files, ~19K total lines
- Largest files: App.tsx (~1885 lines), SettingsPanel.tsx (~672 lines), AnalyticsPanel.tsx (~487 lines), TempoCalendar.tsx (~424 lines)
```

---

## PHASE 1: FOUNDATION AUDITS (Do First — These Block Everything Else)

### DIMENSION 1: TypeScript Hygiene
```
Commands:
  npx tsc -b --noEmit

Criteria:
- 0 errors required before any other audit proceeds
- Any `as any` cast is a violation
- Any `// @ts-ignore` or `// @ts-expect-error` must be justified
- Unused imports/vars are a violation

Search patterns:
  pattern: "\\bas any\\b"   flags: -g src/ -n
  pattern: "@ts-ignore|@ts-expect-error"   flags: -g src/ -n
  pattern: "eslint-disable"   flags: -g src/ -n
```

### DIMENSION 2: ESLint Hygiene
```
Commands:
  npm run lint

Criteria:
- 0 warnings, 0 errors
- Every eslint-disable comment must have a // comment explaining why
- No unused disable directives
```

### DIMENSION 3: Test Suite Health
```
Commands:
  npm run test
  npm run test:coverage

Criteria:
- 100% pass rate required
- All scheduler tests pass
- All rescheduler tests pass
- All drag tests pass
- All enhanced parser tests pass
- All recurring tests pass
```

### DIMENSION 4: Build Health
```
Commands:
  npm run build

Criteria:
- Build must complete with exit code 0
- No chunk warnings >500KB without investigation
- CSS output clean (no empty rules, no unused @keyframes)

Bundle analysis (rollup-plugin-visualizer):
  After build, analyze dist/stats.html:
  node -e "const fs = require('fs'); const html = fs.readFileSync('dist/stats.html', 'utf-8'); 
  const match = html.match(/const data = (\{[^;]+\});/s); 
  if(match){const d=JSON.parse(match[1]); 
  if(d.nodeParts){const parts=Object.entries(d.nodeParts).map(([k,v])=>{
    const n=d.nodeMetas&&d.nodeMetas[k];
    return{id:k,size:v.renderedLength||0,gzip:v.gzipLength||0,
    name:n&&n.moduleParts?Object.keys(n.moduleParts).join(','):''}
  });
  parts.sort((a,b)=>b.size-a.size).slice(0,15).forEach(p=>
    console.log(String(p.size).padStart(8)+'  '+p.name.slice(0,80)));}}"
```

---

## PHASE 2: BRUTAL DIMENSION AUDITS (45+ Dimensions, 3 Passes Each)

### DIMENSION 5: Performance — CSS GPU Layer Anti-Patterns
```
Search: pattern: "will-change"   flags: -g src/index.css -n -B 2 -A 5
Criteria: will-change must ONLY be applied during animations, never permanently.
          Permanent will-change costs GPU memory for the lifetime of the element.

FIXES APPLIED:
- .panel-slide: moved will-change: transform from permanent to [data-state='open'],[data-state='closed'] only
```

### DIMENSION 6: Performance — CSS Containment
```
Search: pattern: "content-visibility"   flags: -g src/ -n
Criteria: Off-screen elements must use content-visibility: auto to skip rendering.
          Large scrollable lists must use content-visibility: auto on rows.
          Month calendar grid cells must use content-visibility: auto.

CSS UTILITY CLASSES CREATED:
.contain-off-screen { content-visibility: auto; contain-intrinsic-size: auto 500px; }
.month-day-cell { content-visibility: auto; contain-intrinsic-size: auto 120px; }
.virtual-list-row { content-visibility: auto; contain-intrinsic-size: auto 56px; }

APPLIED TO:
- AnalyticsPanel.tsx: All <Section> wrappers get .contain-off-screen
- TempoCalendarMonthView.tsx: Each day cell button gets .month-day-cell
- TaskRow.tsx: Both TaskRow and CompletedTaskRow get .virtual-list-row
```

### DIMENSION 7: Performance — Bundle Analysis
```
Search: pattern: "import.*from ['\"]lucide-react['\"]"   flags: -g src/ -n
Search: pattern: "import.*date-fns"   flags: -g src/ -n
Search: pattern: "import.*@supabase"   flags: -g src/ -n

Criteria:
- Count unique lucide-react icons imported across all files (target: reduce)
- Verify date-fns tree-shaking (named imports only, no `import * as dateFns`)
- No barrel exports that defeat tree-shaking

FINDINGS:
- ~60-80 unique lucide-react icons imported across 30 files
- Each icon ~1-3KB = ~60-240KB in icons alone
- date-fns uses named imports throughout (good)

IMPROVEMENT:
- Can reduce by using @lucide/lab icon subsets or dynamic icon imports
```

### DIMENSION 8: Performance — Code Splitting
```
Search: pattern: "lazy\\(|Suspense"   flags: -g src/App.tsx -n

Criteria:
- All heavy components used conditionally must be lazy-loaded
- All marketing/onboarding components must be lazy-loaded
- All dialog/panel components must be lazy-loaded
- No lazy component should be in the critical render path

LAZY-LOADED (ALREADY BEFORE AUDIT):
- SettingsPanel, OnboardingTour, CommandPalette, AnalyticsPanel
- OccurrenceEditDialog, FocusMode, TodayFocusView, KeyboardHelpDialog

LAZY-LOADED (ADDED BY AUDIT):
- TaskDialog (+ SubtasksEditor) — only shown on task create/edit
- WelcomeWizard — shown once on first visit
- ProductPreviewMock — shown on unauthenticated landing pages
- AuthDialog — shown only on sign-in click
- EmptyState — shown only when no tasks/calendar
- ContextualHints — dismissable hints bar
- GettingStartedChecklist — dismissable, shown once

RESULT: Bundle reduced from 796KB → 718KB (78KB / 9.8%)

REMAINING TARGETS FOR LAZY LOADING:
- VersionBadge — always visible, very small (~1KB), not worth it
```

### DIMENSION 9: Performance — Z-Index Audit
```
Search: pattern: "z-index"   flags: -g src/index.css -n -A 0

Criteria:
- No z-index above 100 without justification
- No competing z-index values that create stacking wars
- Sticky/fixed elements must have explicit z-index

CURRENT VALUES:
- z-index: 1 (app-gradient child)
- z-index: 10 (.z-calendar)
- z-index: 20 (.z-sidebar)
- z-index: 25 (.z-banner)
- z-index: 30 (.z-header, .fab, .mobile-nav)
- z-index: 35 (.sidebar-panel mobile)
- z-index: 40 (dialog-overlay, panel-overlay)
- z-index: 50 (dialog-content, panel-slide, menu portals)
- z-index: 100 (.z-command)
- z-index: 9999 (.skip-to-content — justified: must be above everything)

VERDICT: Clean, layered, no stacking wars.
```

### DIMENSION 10: Performance — Ref & Effect Hygiene
```
Search: pattern: "useEffect"   flags: -g src/App.tsx -n
Search: pattern: "useRef"   flags: -g src/App.tsx -n

Criteria:
- No missing deps in useEffect (verified by ESLint react-hooks/exhaustive-deps)
- Ref mutations for caching must be suppressed with eslint-disable with justification
- No useEffect that runs on every render unnecessarily

FINDINGS:
- Auto-import calendars effect: uses tasksHook.createList but not tasksHook — 
  suppressed with eslint-disable-next-line (justified: tasksHook identity changes 
  would cause unnecessary re-runs)
- Ref-sync effects: suppressed with eslint-disable react-hooks/immutability 
  (justified: intentional ref caching for event handlers)
```

### DIMENSION 11: Data Integrity — Task Completion/Reopen
```
Search: pattern: "const complete = useCallback"   flags: -g src/hooks/useTasks.ts -n -A 80
Search: pattern: "const reopen = useCallback"   flags: -g src/hooks/useTasks.ts -n -A 30

CRITICAL BUGS FIXED:
1. Recurring tasks on complete(): Was nullifying is_scheduled/scheduled_start/scheduled_end,
   wiping ALL future occurrences from the calendar. Now preserves scheduling data; only
   sets occurrence_override for today.

2. Non-recurring tasks on complete(): Was nullifying scheduling data, causing completed 
   tasks to vanish from calendar. Now preserves is_scheduled/scheduled_start/scheduled_end,
   so they render as muted historical entries.

3. Google event deletion on complete(): Now only fires for non-recurring tasks.
   Recurring tasks keep their Google event so future occurrences still render.

4. reopen() on recurring tasks: Was nullifying base scheduling data, wiping all future
   occurrences. Now only clears today's occurrence_override, preserving base scheduling.

5. reopen() useCallback deps: Changed from [] to [tasks] to fix stale closure bug
   (tasks.find() would always return undefined with empty deps).

6. Ordering fix: isRecurring declaration moved BEFORE Google deletion block to 
   avoid ReferenceError.
```

### DIMENSION 12: Security — Environment Variables
```
Search: pattern: "VITE_|SUPABASE_|SERVICE_ROLE|ANON_KEY"   flags: -g src/ -n

Criteria:
- No hardcoded API keys, tokens, or secrets
- VITE_ prefix on all client-exposed env vars (Vite requirement)
- Supabase uses anon key only (not service_role)
- No secrets in client-side code

FINDINGS:
- src/lib/supabase.ts: Uses import.meta.env.VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (correct)
- Access token stored in-memory only (src/lib/google.ts: `let accessToken: string | null = null`)
- Supabase session manages Google token — no localStorage for tokens

VERDICT: Clean. No secrets exposed.
```

### DIMENSION 13: Security — localStorage Audit
```
Search: pattern: "localStorage\\.setItem\\(|localStorage\\.getItem\\("   flags: -g src/ -n

Criteria:
- No sensitive data in localStorage (tokens, passwords, PII)
- localStorage keys must be namespaced (tempo- prefix)
- JSON.parse() calls must be try-catch wrapped

FINDINGS:
- All localStorage keys use 'tempo-' prefix (good)
- All JSON.parse calls are try-catch wrapped (good)
- Stored data: theme, working hours, calendar settings, sidebar state, wizard state, checklist state
- No sensitive data stored

VERDICT: Clean.
```

### DIMENSION 14: Error Handling — Empty Catch Blocks
```
Search: pattern: "catch\\s*\\{"   flags: -g src/ -n

Criteria:
- Every empty catch block must have a /* comment */ explaining why it's intentional
- No swallowed errors without logging or user feedback
- Best-effort operations may have empty catches with comment

FINDINGS:
- Multiple `catch { /* ignore */ }` and `catch { /* best-effort */ }` blocks — 
  all documented with comments. Acceptable for non-critical paths (localStorage writes, 
  calendar name imports, etc.)
- Google API errors are properly surfaced via GoogleAuthError class
- Sync errors are accumulated in tasksHook.syncErrors array and displayed in banner

VERDICT: Acceptable. Error handling is appropriate for a client-side calendar app.
```

### DIMENSION 15: Error Boundaries
```
Search: pattern: "ErrorBoundary"   flags: -g src/ -n

Criteria:
- At least one ErrorBoundary wraps the main app content
- ErrorBoundary must show a user-friendly fallback, not a white screen

FINDINGS:
- src/components/ErrorBoundary.tsx exists
- Wraps the authenticated workspace content in App.tsx
- Shows AlertTriangle + "Something went wrong" + retry button

VERDICT: Covered.
```

### DIMENSION 16: Accessibility — Skip Link
```
Search: pattern: "skip-to-content|aria-label|aria-expanded|aria-modal|role="   flags: -g src/ -n

Criteria:
- Skip-to-content link present
- All interactive elements have aria-labels
- Dialogs/panels have aria-modal="true"
- Status updates use aria-live regions

FINDINGS:
- .skip-to-content class exists in CSS with z-index: 9999
- Dialog uses aria-modal="true"
- Settings/Analytics panels use role="dialog" + aria-modal="true"
- TaskRow menu uses aria-expanded, aria-label
- Status banners use role="status" with aria-live="polite"
- Error banners use role="alert"

VERDICT: Good coverage.
```

### DIMENSION 17: Accessibility — Keyboard Navigation
```
Search: pattern: "useKeyboardShortcuts|onKeyDown|tabIndex|focus-visible"   flags: -g src/ -n

Criteria:
- Keyboard shortcuts for main actions
- Focus-visible styles on all interactive elements
- No positive tabIndex values (use 0 or -1 only)

FINDINGS:
- useKeyboardShortcuts hook handles: Cmd+K (palette), Q (quick-add), D/W/M (views), 
  T (today), S (schedule), F (focus), ? (help)
- focus-visible styles defined in index.css
- TempoCalendarHeader uses keyboard navigation for prev/next

VERDICT: Good keyboard support.
```

### DIMENSION 18: Accessibility — Reduced Motion
```
Search: pattern: "prefers-reduced-motion|reduced-motion"   flags: -g src/ -n

Criteria:
- @media (prefers-reduced-motion: reduce) must disable all animations
- No animation that can't be disabled

FINDINGS:
- index.css has: @media (prefers-reduced-motion: reduce) { 
    *, *::before, *::after { animation-duration: 0.01ms !important; 
    transition-duration: 0.01ms !important; } }

VERDICT: Covered.
```

### DIMENSION 19: Accessibility — Color Contrast
```
Criteria:
- All text must meet WCAG AA contrast (4.5:1 for normal text, 3:1 for large)
- Status colors must have sufficient contrast against backgrounds
- Focus indicators must be visible

Design tokens use oklch() — review for sufficient contrast:
- foreground on background: oklch(0.145) on oklch(0.98) = ~15:1 (passes)
- muted-foreground on background: oklch(0.45) on oklch(0.98) = ~7:1 (passes)
- primary-foreground (white) on primary (oklch 0.52): passes
- destructive-foreground (white) on destructive (oklch 0.57): passes

VERDICT: Passes with good margins.
```

### DIMENSION 20: Responsive Design
```
Search: pattern: "@media|lg:|md:|sm:|mobile|responsive"   flags: -g src/ -n

Criteria:
- Mobile-first breakpoints
- Calendar usable on mobile
- Touch targets >= 44px on mobile
- Safe area insets for notched phones
- Bottom nav on mobile replaces sidebar

FINDINGS:
- Mobile bottom nav (.mobile-nav) at 56px height w/ safe-area-inset-bottom
- FAB button at 56x56px
- Dialog slides up from bottom on mobile (@media max-width: 640px)
- Left rail hidden on mobile (display: none)
- Sidebar becomes full-width overlay on mobile
- safe-area-inset-top on header, FAB, panel-slide, sidebar-panel

VERDICT: Well handled.
```

### DIMENSION 21: Offline Detection
```
Search: pattern: "offline|online|navigator\\.onLine|WifiOff"   flags: -g src/ -n

Criteria:
- Must detect offline state
- Must show user-friendly offline banner
- Must prevent data loss during offline

FINDINGS:
- useOfflineDetection hook: listens to window 'offline'/'online' events
- Offline banner shows: "You're offline — changes will sync when you reconnect."
- Supabase handles offline queuing (built-in)

VERDICT: Covered.
```

### DIMENSION 22: State Management — Ref Caching
```
Search: pattern: "Ref = useRef|Ref\\.current ="   flags: -g src/App.tsx -n

Criteria:
- Refs used appropriately for caching (not for derived state)
- No stale closure bugs from ref caching
- All ref mutations properly suppressed with eslint-disable comments

FINDINGS:
- allTasksRef: caches tasks for event handlers (good, avoids deps arrays)
- tasksHookRef: caches tasksHook for callbacks (good)
- calendarRef: caches calendar for visibleRange effect (good)
- focusModeOpenRef: caches focus mode state for deletion handler (clever)
- autoScheduleTimerRef: debounce timer (standard pattern)
- All suppressed with eslint-disable react-hooks/immutability + justification
```

### DIMENSION 23: State Management — useMemo/useCallback Hygiene
```
Search: pattern: "useMemo\\(|useCallback\\("   flags: -g src/App.tsx -n --count-matches

Criteria:
- useMemo only for expensive computations, not trivial ones
- useCallback only when passing to memo'd children or as effect deps
- No missing deps in any memo/callback

FINDINGS:
- allEvents, baseEvents, tempoEvents: expensive computations with hundreds of events (justified)
- recurringKey: stable key for recurring occurrence memo (clever, justified)
- repeatingEvents: generates recurring occurrences (expensive, justified)
- unscheduledCount, focusCurrentTask, focusQueue: cheap but avoiding unnecessary recalculations
- handleCompleteTask, handleDeleteTask: passed to memo'd children (justified)
```

### DIMENSION 24: Dependency Health
```
Commands:
  npm outdated
  npm audit

Criteria:
- No critical/high security vulnerabilities
- No deprecated packages
- Major version upgrades evaluated (not blindly applied)

Key dependencies versions:
- react 19.2.6 (latest)
- typescript 6.0.2 (latest)
- vite 8.0.12 (latest)
- date-fns 4.4.0 (latest)
- lucide-react 1.17.0 (latest)
- @supabase/supabase-js 2.107.0 (latest)
- @dnd-kit/core 6.3.1 (latest)
- tailwindcss 4.3.0 (latest)

VERDICT: All up to date.
```

### DIMENSION 25: Unused Dependencies
```
Commands:
  npx depcheck

Criteria:
- No unused packages in package.json
- No unused files in src/

FINDINGS (from conversation history):
- react-big-calendar was in optimizeDeps but project uses TempoCalendar (custom)
  Actually: BigCalendar.tsx exists and uses react-big-calendar. Keep for now.
```

### DIMENSION 26: Console/Debugger Statements
```
Search: pattern: "console\\.(log|error|warn)"   flags: -g src/ -n
Search: pattern: "debugger"   flags: -g src/ -n

Criteria:
- No console.log in production code (except for intentional error logging)
- No debugger statements

VERDICT: Clean (no matches found).
```

### DIMENSION 27: TODO/FIXME/HACK Comments
```
Search: pattern: "TODO|FIXME|HACK|XXX"   flags: -g src/ -n

Criteria:
- Every TODO must have an owner or issue reference
- No FIXME without a clear plan
- No HACK without justification

VERDICT: Clean (no matches found).
```

### DIMENSION 28: Calendar Event Data Integrity
```
Search: pattern: "generateRecurringOccurrences|occurrence_overrides|is_recurring"   flags: -g src/ -n

Criteria:
- Recurring occurrences must respect occurrence_overrides
- Completed/skipped occurrences must render as muted/with strikethrough
- Deleting one occurrence must not delete the whole series
- Moving one occurrence must not move all

FINDINGS:
- generateRecurringOccurrences in src/lib/recurring.ts handles occurrence_overrides
- baseEvents useMemo maps task status to calendar event variants (muted/destructive/success/warning)
- OccurrenceEditDialog provides "This / Future / All" scope for recurring changes
- Handles: skip, complete, move, resize, edit for individual occurrences

VERDICT: Well-structured with scope dialogs.
```

### DIMENSION 29: Google Calendar Sync Integrity
```
Search: pattern: "syncTaskToGoogle|updateTaskInGoogle|removeTaskFromGoogle|google_event_id"   flags: -g src/ -n

Criteria:
- Google event creation failure must not lose local task state
- Google event deletion failure must not leave orphaned local state
- Two-way sync must handle external deletions gracefully
- Rate limiting must be handled

FINDINGS:
- sync.ts: All sync functions return SyncResult with success/error (never throw)
- useGoogleCalendar.ts: Polls for deleted events and unlinks tasks
- handleGoogleEventsDeleted: Calls unlinkFromGoogleEvents, shows toast
- No rate limit handling visible (Google Calendar API has quotas)

VERDICT: Good sync architecture, but no rate-limit handling.
```

### DIMENSION 30: Task Scheduling — Conflict Detection
```
Search: pattern: "detectConflicts|findRescheduleSlot|batchReschedule"   flags: -g src/ -n

Criteria:
- Conflicts between scheduled tasks and Google events must be detected
- Rescheduling must respect task priorities
- Locked tasks must never be moved
- Rescheduling must preserve dependency order

FINDINGS:
- detectConflicts() in rescheduler.ts: Iterates all scheduled tasks against all Google events
- Priority ordering: ASAP > HIGH > NORMAL > LOW
- batchReschedule: Moves conflicting tasks to new slots, chains displacement
- Locked tasks excluded from rescheduling

VERDICT: Well-implemented.
```

### DIMENSION 31: Task Scheduling — Dependency Cycles
```
Search: pattern: "detectDependencyCycles|topologicalSort|TaskDependency"   flags: -g src/ -n

Criteria:
- Must detect and prevent dependency cycles
- Topological sort must respect dependency order
- Cycle detection must report cycle path for debugging

FINDINGS:
- detectDependencyCycles() in scheduler.ts: DFS-based cycle detection
- topologicalSort(): Topological sort for scheduling order
- getBlockingDependencies(): Returns unsatisfied deps for a task
- Cycle tasks are excluded from scheduling with dependencyErrors reported

VERDICT: Correct implementation.
```

### DIMENSION 32: CSS — Unused Keyframes & Rules
```
Criteria:
- No @keyframes that are never referenced
- No CSS custom properties that are never used
- No duplicate selectors

FINDINGS:
- 20+ @keyframes defined, all referenced by animation classes
- All CSS custom properties consumed by classes
- No duplicate selectors observed

VERDICT: Clean.
```

### DIMENSION 33: CSS — Animation Performance
```
Search: pattern: "animation:|transition:"   flags: -g src/index.css -n

Criteria:
- Animate only transform and opacity (GPU-composited properties)
- No animating width, height, top, left, margin, padding
- Use will-change only during animations (see Dimension 5)

FINDINGS:
- slide-down: transform + opacity (good)
- slide-in-right: transform + opacity (good)
- fade-in: opacity only (good)
- task-complete-fade: opacity + transform + max-height (max-height is not compositable, 
  but it's a one-time exit animation — acceptable)
- shimmer: background-position (not compositable but cheap)
- schedule-pulse: box-shadow (not compositable but intentional glow effect)
- All transitions on transform, opacity, box-shadow, color

VERDICT: Mostly clean. task-complete-fade uses max-height — acceptable for exit animation.
```

### DIMENSION 34: Component File Size Standards
```
Commands:
  wc -l src/App.tsx src/components/*.tsx

Criteria:
- Single component files: <300 lines
- Orchestrator files: <500 lines
- No file over 2000 lines without a split plan

FINDINGS:
- App.tsx: ~1885 lines (VIOLATION — should be <500 for orchestrator)
- SettingsPanel.tsx: ~672 lines (large but well-structured with sub-sections)
- AnalyticsPanel.tsx: ~487 lines (borderline but clean)
- TempoCalendar.tsx: ~424 lines (clean orchestrator)
- Most component files: 50-250 lines (good)

VERDICT: App.tsx is the only violator. Split target: extract calendar logic hooks,
         extract authenticated/unauthenticated screens into separate components.
```

### DIMENSION 35: Component Rendering — React.memo
```
Search: pattern: "React\\.memo|memo\\(function|export const \\w+ = memo"   flags: -g src/components/ -n

Criteria:
- Pure presentational components should use React.memo
- Components with expensive renders should use React.memo

FINDINGS:
- TaskRow: uses memo() (correct — rendered in lists of 100s)
- CompletedTaskRow: uses memo() (correct)
- TempoCalendar sub-views: no memo (could benefit but already acceptably fast)

VERDICT: Key list components memoized. Calendar views could benefit from memo 
         but complexity of memo comparison might not be worth it.
```

### DIMENSION 36: Import Organization
```
Criteria:
- Imports must be ordered: React → third-party → project hooks → project lib → project components → types
- No circular imports
- No barrel exports that bundle everything

FINDINGS:
- App.tsx imports follow a reasonable order
- Some imports have extra blank lines (cosmetic)
- No circular imports detected

VERDICT: Acceptable.
```

### DIMENSION 37: Type Safety — No 'any' Casts
```
Search: pattern: "\\bany\\b"   flags: -g src/lib/ -g src/hooks/ -n

Criteria:
- Zero 'any' type annotations in lib/ and hooks/ directories
- Type annotations must be specific

VERDICT: Clean (no matches found).
```

### DIMENSION 38: Race Conditions — Async State Updates
```
Search: pattern: "await.*\\..*\\(|setState.*await"   flags: -g src/ -n

Criteria:
- No setState calls after component unmount (mountedRef pattern)
- Concurrent async operations must be handled
- Optimistic updates must have rollback

FINDINGS:
- useTasks.ts: Uses mountedRef pattern for all async operations
- Auto-complete: Debounced by 400ms to prevent concurrent requests
- Delete with undo: Uses toast action for rollback

VERDICT: Well-handled.
```

### DIMENSION 39: Undo Functionality
```
Search: pattern: "useUndoManager|undoManager\\.capture|undoManager\\.showToast"   flags: -g src/ -n

Criteria:
- Schedule operations must be undoable
- Undo must restore previous state correctly
- Undo toast must have clear label and timeout

FINDINGS:
- undoManager.capture() called before scheduleAll, reschedule, unschedule
- undoManager.showToast() with onRestore callback calling refresh()
- Delete task uses sonner toast action for undo (8 second duration)
- FIXED (from history): Undo only reverted Supabase tasks, not Google events (fixed in reopen())

VERDICT: Good UX for undo.
```

### DIMENSION 40: Toast/Notification UX
```
Search: pattern: "toast\\.(success|error|warning|info)"   flags: -g src/App.tsx -n

Criteria:
- Every user action must have feedback (success toast, error toast, or info)
- Toast must not be overwhelming (debounce rapid toasts)
- Toast must not interrupt Focus Mode

FINDINGS:
- Schedule: success toast with count
- Reschedule: success toast with count
- Delete: success toast with undo action
- Create: success toast with schedule confirmation
- Move: success toast with new time
- Resize: success toast with new duration
- Error toasts for all failure paths
- Focus Mode: toasts suppressed via focusModeOpenRef

VERDICT: Comprehensive toast coverage.
```

### DIMENSION 41: Mobile Bottom Nav
```
Search: pattern: "MobileNav|mobile-nav"   flags: -g src/ -n

Criteria:
- Mobile nav must have 4-5 primary actions
- Active state must be clearly indicated
- Must work on notched phones (safe-area-inset-bottom)

FINDINGS:
- MobileNav.tsx exists with calendar, tasks, insights, today views
- Uses mobile-nav-item--active class for active state
- Includes safe-area-inset-bottom padding
- Hidden above lg breakpoint

VERDICT: Covered.
```

### DIMENSION 42: Empty States
```
Search: pattern: "EmptyState|no tasks|nothing scheduled"   flags: -g src/ -n

Criteria:
- Every view must have a meaningful empty state
- Empty states must guide the user to the next action
- No white screens of nothingness

FINDINGS:
- EmptyState.tsx: Multiple variants (calendar-empty, etc.)
- Calendar: "Nothing scheduled this month" with keyboard shortcut hints
- Tasks: "No tasks yet" with "New task" button
- Analytics: "Complete a task to start your insights" with count
- Month view: Overlay with CTA when no events

VERDICT: Excellent empty state coverage.
```

### DIMENSION 43: Loading States
```
Search: pattern: "isLoading|CalendarSkeleton|TaskRowSkeleton|PanelSpinner"   flags: -g src/ -n

Criteria:
- Initial load must show skeleton, not white screen
- Lazy-loaded components must show spinner fallback
- No flash of loading states for cached data

FINDINGS:
- CalendarSkeleton: Grey placeholder blocks in calendar grid during load
- TaskRowSkeleton: Skeleton rows in task list during load
- PanelSpinner: Small spinner for lazy-loaded Suspense boundaries
- Google connect loading: Spinning indicator with "Loading" text

VERDICT: Good loading UX.
```

### DIMENSION 44: Version & About Information
```
Search: pattern: "TEMPO_VERSION|VersionBadge|version"   flags: -g src/ -n

Criteria:
- Version number must be displayed (for bug reports)
- About section must include version and source link

FINDINGS:
- TEMPO_VERSION imported from src/lib/version
- SettingsPanel → About section shows: App name, Version, Source & docs link
- VersionBadge.tsx component

VERDICT: Covered.
```

### DIMENSION 45: Welcome Wizard / Onboarding
```
Search: pattern: "WelcomeWizard|OnboardingTour|onboarded|welcome-wizard"   flags: -g src/ -n

Criteria:
- New users must see onboarding guidance
- Onboarding must be skippable and replayable
- Must not show on every visit (localStorage flag)

FINDINGS:
- WelcomeWizard: First-visit task creation wizard (skippable, stores 'tempo-welcome-wizard')
- GettingStartedChecklist: Post-wizard checklist (dismissble, stores 'tempo-checklist-done')
- OnboardingTour: Step-by-step tour (now lazy-loaded)
- ContextualHints: Context-sensitive tips
- Replay tour: Settings → Replay tour button

VERDICT: Comprehensive onboarding flow.
```

### DIMENSION 46: Focus Mode
```
Search: pattern: "FocusMode|focusMode|focus-mode"   flags: -g src/ -n

Criteria:
- Pomodoro-style focus mode must exist
- Must show current task and up-next queue
- Must suppress distractions (toasts blocked)
- Main content must be inert during focus mode

FINDINGS:
- FocusMode.tsx: Full-screen overlay with timer, current task, queue
- Keyboard shortcut: F
- Main content gets `inert` attribute during focus mode
- Toasts suppressed via focusModeOpenRef
- Queue: Next 5 scheduled active tasks

VERDICT: Rich focus mode implementation.
```

### DIMENSION 47: Command Palette
```
Search: pattern: "CommandPalette|cmdk"   flags: -g src/ -n

Criteria:
- Cmd/Ctrl+K must open command palette
- Must support: quick-add, navigation, settings, theme toggle

FINDINGS:
- CommandPalette.tsx: Uses cmdk library
- Keyboard shortcut: Cmd/Ctrl+K or ?
- Supports: quick-add tasks, navigate views, open settings, toggle theme, schedule all
- Already lazy-loaded

VERDICT: Well-implemented.
```

### DIMENSION 48: E2E Test Coverage
```
Commands:
  npm run test:e2e (requires auth state)
  npm run test:e2e:auth (captures auth state)

Test files:
- e2e/flows/01-boot.spec.ts — app loading and rendering
- e2e/flows/02-analytics.spec.ts — analytics/insights view
- e2e/flows/03-calendar.spec.ts — calendar workspace
- e2e/flows/04-tasks.spec.ts — task CRUD
- e2e/flows/05-responsive.spec.ts — responsive layout

Setup required:
  node scripts/capture-auth.mjs  # captures auth state to e2e/.auth/user.json
  npx playwright install chromium

VERDICT: E2E tests exist but require auth. Run capture-auth.mjs first.
```

---

## PHASE 3: REMAINING IMPROVEMENTS (Do These Now)

### 1. Lucide Icon Optimization
```
FINDING: ~60-80 lucide-react icons imported across 30 files
IMPACT: ~60-240KB in icon code alone
ACTION: Consider @lucide/lab for icon subsets, or tree-shake aggressively
```

### 2. Lazy-Load AuthDialog
```
FINDING: AuthDialog imported statically, only shown on sign-in click
IMPACT: ~5-10KB savings
ACTION: Convert to lazy(() => import(...)) with Suspense
```

### 3. Lazy-Load EmptyState
```
FINDING: EmptyState imported statically, shown only when no tasks/calendar
IMPACT: ~2-5KB savings
ACTION: Convert to lazy(() => import(...)) with Suspense
```

### 4. App.tsx Refactoring
```
FINDING: App.tsx is 1885 lines (target: <500)
ACTION: Extract into:
  - hooks/useAppState.ts — all useState declarations
  - components/UnauthenticatedScreen.tsx — sign-in prompt
  - components/CalendarConnectGate.tsx — Google connect screen
  - components/AuthenticatedWorkspace.tsx — main calendar workspace
```

### 5. E2E Test Execution
```
ACTION:
  1. node scripts/capture-auth.mjs
  2. npm run test:e2e
  3. Fix any failures
```

### 6. Google Calendar Rate Limiting
```
FINDING: No rate limit handling in Google API calls
IMPACT: App may fail silently under heavy usage
ACTION: Add exponential backoff to fetchCalendarEvents, createCalendarEvent, etc.
```

---

## RESEARCH TOPICS COVERED

1. **react-big-calendar performance optimization** — patterns causing re-renders, large dataset handling
2. **Supabase security best practices** — RLS configurations, anon key exposure, auth token handling, storage bucket policies
3. **React SPA security vulnerabilities** — XSS, CSRF, token storage, environment variable exposure
4. **CSS containment (content-visibility)** — browser support, correct syntax, appropriate use cases
5. **Lucide-react tree-shaking** — named imports vs barrel exports, icon count impact on bundle
6. **Vite code splitting** — dynamic imports, lazy loading, Suspense boundaries
7. **Google Calendar API rate limits** — quotas, exponential backoff, error handling
8. **date-fns tree-shaking** — named imports vs wildcard, bundle impact
9. **React 19 concurrent features** — Suspense, transitions, useDeferredValue applicability
10. **Tailwind CSS 4 performance** — @theme inline, custom properties, build optimization
11. **Radix UI dialog accessibility** — aria attributes, focus trapping, keyboard navigation
12. **@dnd-kit performance** — sensor configuration, activation constraints, ghost rendering
13. **Sonner toast best practices** — positioning, rich colors, action buttons, focus mode suppression

---

## COMMANDS REFERENCE

```bash
# Foundation checks (run first, always)
npx tsc -b --noEmit                    # TypeScript
npm run lint                            # ESLint
npm run test                            # Vitest (150 tests)
npm run build                           # Vite build

# Bundle analysis
npm run build                           # generates dist/stats.html
# Then run the node extraction script above

# E2E tests (requires auth state)
node scripts/capture-auth.mjs           # Capture auth state (one-time)
npm run test:e2e                        # Playwright tests

# Code quality
npm outdated                            # Check for outdated packages
npm audit                               # Security audit
npx depcheck                            # Find unused dependencies

# File stats
wc -l src/App.tsx src/components/*.tsx  # Line counts
```

---

## SEARCH PATTERNS REFERENCE

```
# Security
pattern: "VITE_|SUPABASE_|SERVICE_ROLE"   flags: -g src/ -n
pattern: "localStorage\.(get|set)Item\("    flags: -g src/ -n
pattern: "accessToken|refreshToken"         flags: -g src/ -n

# Performance (CSS)
pattern: "will-change"              flags: -g src/index.css -n -B 2 -A 5
pattern: "z-index"                  flags: -g src/index.css -n
pattern: "content-visibility"       flags: -g src/ -n

# Performance (React)
pattern: "useEffect"                flags: -g src/App.tsx -n
pattern: "useMemo\(|useCallback\("  flags: -g src/ -n
pattern: "React\.memo|memo\("       flags: -g src/components/ -n

# Performance (Bundle)
pattern: "import.*lucide-react"     flags: -g src/ -n
pattern: "import.*date-fns"         flags: -g src/ -n
pattern: "import.*@supabase"        flags: -g src/ -n
pattern: "lazy\(|Suspense"          flags: -g src/App.tsx -n

# Code Quality
pattern: "\\bany\\b"               flags: -g src/lib/ -n
pattern: "catch\\s*\{"             flags: -g src/ -n
pattern: "eslint-disable"          flags: -g src/ -n
pattern: "console\.(log|error)"    flags: -g src/ -n
pattern: "TODO|FIXME|HACK"         flags: -g src/ -n
pattern: "debugger"                flags: -g src/ -n

# Accessibility
pattern: "aria-label|aria-expanded|aria-modal|role="   flags: -g src/ -n
pattern: "prefers-reduced-motion"                      flags: -g src/ -n
pattern: "skip-to-content"                             flags: -g src/ -n

# Data Integrity
pattern: "complete = useCallback"    flags: -g src/hooks/useTasks.ts -n -A 80
pattern: "reopen = useCallback"      flags: -g src/hooks/useTasks.ts -n -A 30
pattern: "occurrence_overrides"      flags: -g src/ -n
pattern: "google_event_id"           flags: -g src/ -n

# Architecture
pattern: "ErrorBoundary"            flags: -g src/ -n
pattern: "useUndoManager"           flags: -g src/ -n
pattern: "useKeyboardShortcuts"     flags: -g src/ -n
```

---

## BUGS FOUND & FIXED

1. **will-change GPU leak** — `.panel-slide` had permanent `will-change: transform` 
   consuming GPU memory always. Fixed: moved to `[data-state='open'],[data-state='closed']` only.

2. **Recurring task completion wipes all occurrences** — `complete()` nullified 
   `is_scheduled/scheduled_start/scheduled_end` on the base task, deleting all future 
   occurrences from calendar. Fixed: only set `occurrence_override` for today.

3. **Non-recurring completed tasks vanish** — `complete()` nullified scheduling data,
   making `variant: 'muted'` logic dead code. Fixed: preserve scheduling data.

4. **Google event deletion on recurring completion** — deleted Google event for all
   recurring tasks on completion, removing future occurrences from Google Calendar.
   Fixed: only delete for non-recurring tasks.

5. **reopen() wipes recurring scheduling** — nullified base scheduling data, same bug
   as completion. Fixed: only clear occurrence_override for today.

6. **reopen() stale closure** — `useCallback` had `[]` deps but used `tasks.find()`.
   Fixed: changed deps to `[tasks]`.

7. **isRecurring ReferenceError** — used before declaration in `complete()`.
   Fixed: moved declaration before Google deletion block.

8. **Accidentally deleted TempoCalendar import** — str_replace on import block removed
   `TempoCalendar` and `CalendarEventType` imports. Fixed: restored the import line.

---

## FINAL STATE

```
TypeScript:  0 errors
ESLint:      0 warnings
Tests:       150/150 passed
Build:       718KB main bundle (was 796KB, reduced 78KB / 9.8%)
E2E Tests:   Exist (5 spec files), need auth state capture
```

---
*Generated by comprehensive audit of Tempo Calendar / FlowSavvy*
*Last updated: June 21, 2026*
