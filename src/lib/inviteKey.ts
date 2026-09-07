/**
 * Invite Key — controls who sees the real site vs the cloaked dummy site.
 *
 * The key lives in platform_config.invite_access_key and is never sent to
 * the browser directly. The browser sends a candidate via the
 * `check_invite_key(_key)` RPC and gets back true/false.
 *
 * Flow:
 *  - URL has ?k=<key>  → validate, persist, strip from URL
 *  - localStorage has saved key → revalidate quietly on load
 *  - Logged-in users always bypass the gate
 */

import { supabase } from '@/integrations/supabase/client';

const KEY_PARAM = 'k';
const STORAGE_KEY = 'viketa_invite_key';

export const getInviteParamName = () => KEY_PARAM;

export const getStoredInviteKey = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

export const saveInviteKey = (key: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    /* noop */
  }
};

export const clearInviteKey = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
};

export const checkInviteKey = async (key: string): Promise<boolean> => {
  if (!key) return false;
  const { data, error } = await supabase.rpc('check_invite_key' as any, { _key: key });
  if (error) {
    console.error('[inviteKey] check failed', error);
    return false;
  }
  return Boolean(data);
};

/**
 * Build an absolute invite URL with the access key attached.
 * Use for ANY referral / share link surfaced in the real platform.
 */
export const buildInviteUrl = (
  path: string,
  extraParams?: Record<string, string | undefined | null>,
): string => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = new URL(path, origin || 'https://viketa.xyz');
  const key = getStoredInviteKey();
  if (key) url.searchParams.set(KEY_PARAM, key);
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  return url.toString();
};
