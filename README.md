# Tempo Calendar

A personal scheduling app that auto-schedules tasks into open time slots. Built with React, Vite, TypeScript, Tailwind CSS v4, and Supabase.

## Features

- **Google Calendar integration** — Connect your Google Calendar to import events and sync scheduled tasks
- **Task management** — Create, edit, delete tasks with duration, priority, due dates, and preferences
- **Smart scheduling** — Auto-schedules tasks into available time slots, respecting busy blocks, buffers, and working hours
- **Conflict detection** — Detects conflicts between scheduled tasks and Google Calendar events
- **Batch rescheduling** — Moves conflicting tasks to open slots automatically
- **Calendar views** — Week, day, month, and agenda views via react-big-calendar

## Tech Stack

- **Frontend**: React 19, Vite 8, TypeScript 6
- **Styling**: Tailwind CSS v4 + shadcn-style primitives
- **Backend**: Supabase (PostgreSQL)
- **Calendar**: react-big-calendar + date-fns v4
- **Auth**: Google Identity Services (GIS) OAuth2
- **Components**: Radix UI primitives (Dialog, Sheet, NavigationMenu, Slot)

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A Supabase project
- A Google Cloud Console project with Calendar API enabled

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Fill in your environment variables:
   - `VITE_SUPABASE_URL` — Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — Your Supabase anonymous key
   - `VITE_GOOGLE_CLIENT_ID` — Your Google OAuth client ID
5. Run the Supabase migration:
   - Open your Supabase project SQL editor
   - Run `supabase/migrations/001_create_tasks.sql`
6. Start the dev server:
   ```bash
   npm run dev
   ```
7. Open http://localhost:5173

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project or select existing
3. Enable the Google Calendar API
4. Create OAuth 2.0 credentials (Web application type)
5. Add `http://localhost:5173` to Authorized JavaScript origins
6. Copy the Client ID to your `.env` as `VITE_GOOGLE_CLIENT_ID`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |

## Project Structure

```
src/
  components/       # React components
    ui/             # shadcn-style primitives (Button, Sheet, Card, etc.)
    BigCalendar.tsx # Main calendar view (react-big-calendar)
    Header.tsx      # App header with navigation
    TaskList.tsx    # Task list view
    TaskDialog.tsx  # Task create/edit dialog
    WeeklyCalendar.tsx # Mini sidebar calendar
    GoogleConnect.tsx  # Google Calendar connect/disconnect
  hooks/
    useTasks.ts     # Task state management
    useGoogleCalendar.ts  # Google Calendar events
  lib/
    tasks.ts        # Supabase task CRUD
    scheduler.ts    # Scheduling algorithm
    rescheduler.ts  # Conflict detection + batch rescheduling
    sync.ts         # Google Calendar sync
    google.ts       # Google API utilities
    types.ts        # TypeScript type definitions
    supabase.ts     # Supabase client
    utils.ts        # cn() helper (clsx + tailwind-merge)
  index.css         # Global styles, CSS variables, calendar theme
```

## Known Limitations

- Drag-and-drop event resizing is not currently implemented (react-big-calendar DnD addon has Vite ESM compatibility issues)
- Google Calendar fetch window is limited to 7 days
- Recurring tasks are scheduled as individual instances rather than recurring Google Calendar events

## License

MIT