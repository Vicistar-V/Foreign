import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { queryClient } from '@/App';

/**
 * Force logout - BULLETPROOF version that never fails.
 * Clears local session and redirects to login no matter what.
 */
export const forceLogoutNow = async (): Promise<void> => {
  console.warn('[Auth] Force logout triggered - clearing session...');
  
  // Clear ALL React Query cached data first
  try {
    queryClient.clear();
    console.log('[Auth] React Query cache cleared');
  } catch (e) {
    console.warn('[Auth] Failed to clear query cache:', e);
  }
  
  try {
    // Local-only signout - won't fail even if server session is already gone
    await supabase.auth.signOut({ scope: 'local' });
  } catch (e) {
    console.warn('[Auth] signOut threw (expected if session already gone):', e);
  }
  
  // Belt & suspenders: manually clear Supabase auth from localStorage
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (e) {
    console.warn('[Auth] localStorage cleanup failed:', e);
  }
  
  // Hard redirect - replace prevents back button returning to broken page
  window.location.replace('/login');
};

/**
 * Checks if an error is an authentication error.
 * Returns true for 401 errors or auth-related error messages.
 * Handles FunctionsHttpError from supabase.functions.invoke() specially.
 */
export const isAuthError = (error: any): boolean => {
  // Handle FunctionsHttpError (from supabase.functions.invoke)
  // The actual HTTP status is in error.context.status, not error.message
  if (error instanceof FunctionsHttpError) {
    const status = error.context?.status;
    if (status === 401) {
      console.warn('[Auth] FunctionsHttpError with 401 status detected');
      return true;
    }
  }
  
  // Stale session: the auth user was deleted server-side but the client
  // still holds a JWT. Backend surfaces this as P0002 "Profile not found"
  // from get_my_profile, or a 23503 FK violation writing user_activity_log.
  // Treat both as auth errors so we sign the user out locally (never call
  // the server signout — it will fail for the same reason).
  if (error?.code === 'P0002' || error?.code === '23503') {
    return true;
  }

  // Fallback: check error message for auth-related strings
  const errorMessage = (error?.message || '').toLowerCase();
  return (
    error?.status === 401 || 
    errorMessage.includes('not authenticated') ||
    errorMessage.includes('invalid token') ||
    errorMessage.includes('auth session missing') ||
    errorMessage.includes('jwt expired') ||
    errorMessage.includes('session not found') ||
    errorMessage.includes('session_not_found') ||
    errorMessage.includes('profile not found') ||
    errorMessage.includes('user not found')
  );
};

/**
 * Handles 401 authentication errors by signing out and redirecting to login.
 * Returns true if it was an auth error (and handled), false otherwise.
 */
export const handleAuthError = async (error: any): Promise<boolean> => {
  if (isAuthError(error)) {
    await forceLogoutNow();
    return true;
  }
  return false;
};
