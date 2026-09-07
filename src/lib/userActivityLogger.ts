import { supabase } from '@/integrations/supabase/client';
import { getSessionId } from '@/lib/sessionId';
import { getBasePath, getPageName } from '@/lib/pageNameMapping';

/**
 * Fire-and-forget per-user activity logger.
 *
 * Writes to `user_activity_log` via the `record_user_heartbeat` RPC so the
 * admin user-details page (Recent Activity card) can show *exactly* which
 * button each user tapped, on which page, at which time. This is the
 * ground-truth audit log — separate from Clarity, which is for funnel
 * analytics only and is sampled / domain-gated.
 *
 * Safe to call from any component or hook — it does nothing if the user
 * is not authenticated.
 *
 * @param actionDetail  Event slug, e.g. `enter_line_clicked`,
 *                      `activation_pay_clicked`, `explainer_video_played`.
 * @param actionType    Defaults to `button_click`. Use `page_view`,
 *                      `form_submit`, `dialog_dismiss`, etc. if relevant.
 * @param extraMetadata Optional extra context merged into the metadata
 *                      column (e.g. `{ via: 'enter_line_cta' }`).
 */
export async function logUserActivity(
  actionDetail: string,
  actionType: string = 'button_click',
  extraMetadata?: Record<string, unknown>,
): Promise<void> {
  try {
    // Skip logging entirely while on admin routes — admins doing admin
    // work should not show up in their own activity feed / last-seen.
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
      return;
    }

    // Cheap auth gate — RPC will reject unauthenticated calls anyway, but
    // skipping the network round-trip keeps logs clean for the cloak page.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const path =
      typeof window !== 'undefined'
        ? getBasePath(window.location.pathname)
        : '/';

    const { error } = await supabase.rpc('record_user_heartbeat', {
      p_page_path: path,
      p_page_name: getPageName(path),
      p_action_type: actionType,
      p_action_detail: actionDetail,
      p_session_id: getSessionId(),
      p_metadata: {
        screen_width: typeof window !== 'undefined' ? window.innerWidth : null,
        screen_height: typeof window !== 'undefined' ? window.innerHeight : null,
        ...(extraMetadata ?? {}),
      },
    });

    if (error) {
      console.warn('[userActivityLogger] RPC failed:', error.message);
    }
  } catch (e) {
    console.warn('[userActivityLogger] threw, ignored:', e);
  }
}
