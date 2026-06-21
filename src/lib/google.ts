/// <reference types="vite/client" />

// ============================================================
// Exponential Backoff for Google Calendar API Rate Limits
// ============================================================

/**
 * Retry a Google API call with exponential backoff on 429 (rate limit)
 * and 5xx (server error) responses. Max 3 retries, starting at 1s delay.
 */
async function withBackoff<T>(fn: () => Promise<T>, context: string): Promise<T> {
  let attempt = 0;
  const maxRetries = 3;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt > maxRetries) throw error;

      // Only retry on rate-limit (429) or server errors (5xx)
      if (error instanceof GoogleAuthError) {
        const status = error.statusCode ?? 0;
        if (status === 429 || (status >= 500 && status < 600)) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.warn(`[Google API] ${context}: attempt ${attempt}/${maxRetries} failed (${status}), retrying in ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
      }
      throw error;
    }
  }
}

export interface GoogleEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  colorId?: string;
  status?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  calendar: string;
  source: 'google' | 'task';
  color?: string;
  /** True for all-day Google events (those with `date` but no `dateTime`). */
  allDay?: boolean;
  /** The parent Google Calendar's backgroundColor, used as a fallback color. */
  calendarColor?: string;
}

/** The active Google access token (in-memory only). */
let accessToken: string | null = null;

/**
 * Stable error type for Google API failures. Kept as a class (not just a
 * `new Error(...)`) so consumers can `instanceof` check.
 */
export class GoogleAuthError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'GoogleAuthError';
    this.statusCode = statusCode;
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Set the active access token from an external source (e.g. Supabase's
 * `session.provider_token`, which is the Google access token attached to
 * the Supabase session after a Google OAuth sign-in). The token is held
 * in memory only — Supabase is the source of truth and re-syncs it on
 * every session change.
 *
 * Pass an empty string (or any falsy value) to clear the token.
 */
export function setAccessToken(token: string | null | undefined): void {
  if (!token) {
    if (accessToken !== null) {
      accessToken = null;
    }
    return;
  }
  if (token !== accessToken) {
    accessToken = token;
  }
}

/** Clear the active access token. Used on sign-out and on token errors. */
export function clearAccessToken(): void {
  setAccessToken(null);
}

function getAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

export async function fetchCalendarEvents(
  calendarId: string = 'primary',
  timeMin?: string,
  timeMax?: string
): Promise<GoogleEvent[]> {
  if (!accessToken) {
    throw new GoogleAuthError('Not authenticated');
  }

  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    timeMin: timeMin || new Date().toISOString(),
    timeMax: timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

  return withBackoff(async () => {
    try {
      const response = await fetch(url, { headers: getAuthHeaders() });
      if (!response.ok) {
        const errorText = await response.text();
        throw new GoogleAuthError(`Calendar API error: ${response.status} - ${errorText}`, response.status);
      }
      const data = await response.json();
      return data.items || [];
    } catch (error) {
      if (error instanceof GoogleAuthError) throw error;
      throw new GoogleAuthError(error instanceof Error ? error.message : 'Failed to fetch calendar events');
    }
  }, 'fetchCalendarEvents');
}

export async function createCalendarEvent(event: {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  colorId?: string;
}, calendarId: string = 'primary'): Promise<GoogleEvent> {
  if (!accessToken) {
    throw new GoogleAuthError('Not authenticated');
  }

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

  return withBackoff(async () => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(event),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new GoogleAuthError(`Create event error: ${response.status} - ${errorText}`, response.status);
      }
      return await response.json();
    } catch (error) {
      if (error instanceof GoogleAuthError) throw error;
      throw new GoogleAuthError(error instanceof Error ? error.message : 'Failed to create event');
    }
  }, 'createCalendarEvent');
}

export async function updateCalendarEvent(
  eventId: string,
  event: {
    summary?: string;
    description?: string;
    start?: { dateTime: string; timeZone?: string };
    end?: { dateTime: string; timeZone?: string };
    colorId?: string;
  },
  calendarId: string = 'primary'
): Promise<GoogleEvent> {
  if (!accessToken) {
    throw new GoogleAuthError('Not authenticated');
  }

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`;

  return withBackoff(async () => {
    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(event),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new GoogleAuthError(`Update event error: ${response.status} - ${errorText}`, response.status);
      }
      return await response.json();
    } catch (error) {
      if (error instanceof GoogleAuthError) throw error;
      throw new GoogleAuthError(error instanceof Error ? error.message : 'Failed to update event');
    }
  }, 'updateCalendarEvent');
}

export async function deleteCalendarEvent(eventId: string, calendarId: string = 'primary'): Promise<void> {
  if (!accessToken) {
    throw new GoogleAuthError('Not authenticated');
  }

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`;

  return withBackoff(async () => {
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new GoogleAuthError(`Delete event error: ${response.status} - ${errorText}`, response.status);
      }
    } catch (error) {
      if (error instanceof GoogleAuthError) throw error;
      throw new GoogleAuthError(error instanceof Error ? error.message : 'Failed to delete event');
    }
  }, 'deleteCalendarEvent');
}

// ============================================================
// Calendar List
// ============================================================

export interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  selected?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole?: string;
}

export async function fetchCalendarList(): Promise<GoogleCalendar[]> {
  if (!accessToken) {
    throw new GoogleAuthError('Not authenticated');
  }

  const url = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';

  return withBackoff(async () => {
    try {
      const response = await fetch(url, { headers: getAuthHeaders() });
      if (!response.ok) {
        const errorText = await response.text();
        throw new GoogleAuthError(`Calendar list error: ${response.status} - ${errorText}`, response.status);
      }
      const data = await response.json();
      return (data.items || []) as GoogleCalendar[];
    } catch (error) {
      if (error instanceof GoogleAuthError) throw error;
      throw new GoogleAuthError(error instanceof Error ? error.message : 'Failed to fetch calendar list');
    }
  }, 'fetchCalendarList');
}

