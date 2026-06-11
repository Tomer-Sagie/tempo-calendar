import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Check for existing session
    supabase.auth.getSession().then(({ data, error: err }) => {
      if (!mountedRef.current) return;
      if (err) {
        console.error('[Auth] getSession error:', err);
      } else {
        setSession(data.session);
        setUser(data.session?.user ?? null);
      }
      setIsLoading(false);
    });

    // Subscribe to auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mountedRef.current) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    return () => {
      mountedRef.current = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (mountedRef.current) setIsLoading(false);
    if (err) {
      if (mountedRef.current) setError(err.message);
      throw err;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    const { error: err } = await supabase.auth.signUp({ email, password });
    if (mountedRef.current) setIsLoading(false);
    if (err) {
      if (mountedRef.current) setError(err.message);
      throw err;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    // Note: Calendar scopes are handled by the separate Google Calendar GIS integration.
    // Supabase Google OAuth is used here only for identity/authentication.
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (err) {
      if (mountedRef.current) setError(err.message);
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    await supabase.auth.signOut();
    if (mountedRef.current) {
      setUser(null);
      setSession(null);
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value: AuthContextValue = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    error,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
