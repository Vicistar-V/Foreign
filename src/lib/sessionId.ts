/**
 * Session ID management for tracking user journeys.
 * A session represents one continuous browsing session.
 * 
 * - Generated when user first loads the app
 * - Stored in sessionStorage (cleared when browser tab closes)
 * - Same ID used for all activity tracking in one session
 */

const SESSION_ID_KEY = 'viketa_session_id';

/**
 * Generates a unique session ID using timestamp and random string
 */
const generateSessionId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomPart}`;
};

/**
 * Gets the current session ID, creating one if it doesn't exist
 */
export const getSessionId = (): string => {
  // Check if we already have a session ID
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  
  if (!sessionId) {
    // Generate a new session ID for this browsing session
    sessionId = generateSessionId();
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
    console.log('[Session] New session started:', sessionId);
  }
  
  return sessionId;
};

/**
 * Clears the current session ID (useful for testing or forced refresh)
 */
export const clearSessionId = (): void => {
  sessionStorage.removeItem(SESSION_ID_KEY);
  console.log('[Session] Session cleared');
};

/**
 * Checks if this is a new session (first load)
 */
export const isNewSession = (): boolean => {
  return !sessionStorage.getItem(SESSION_ID_KEY);
};
