// Declare the clarity function on window
declare global {
  interface Window {
    clarity?: (command: string, eventName: string, value?: any) => void;
  }
}

// Track custom events with Clarity
export const trackClarityEvent = (eventName: string) => {
  if (typeof window !== 'undefined' && window.clarity) {
    window.clarity('event', eventName);
    console.log(`📊 Clarity event tracked: ${eventName}`);
  }
};

// Funnel timing utilities (store timestamps for conversion analytics)
export const FunnelTimingKeys = {
  FIRST_LANDING_TIME: 'viketa_first_landing_time',
  SIGNUP_START_TIME: 'viketa_signup_start_time',
  SIGNUP_COMPLETE_TIME: 'viketa_signup_complete_time',
  FIRST_DASHBOARD_TIME: 'viketa_first_dashboard_time',
  FIRST_DRAWER_OPEN_TIME: 'viketa_first_drawer_open_time',
  ACTIVATION_COMPLETE_TIME: 'viketa_activation_complete_time',
} as const;

// Store funnel timing event
export const recordFunnelTiming = (key: string) => {
  if (typeof window !== 'undefined') {
    const existing = localStorage.getItem(key);
    if (!existing) {
      localStorage.setItem(key, Date.now().toString());
    }
  }
};

// Get time difference between two funnel events (in seconds)
export const getFunnelTimeDiff = (startKey: string, endKey: string): number | null => {
  if (typeof window === 'undefined') return null;
  const start = localStorage.getItem(startKey);
  const end = localStorage.getItem(endKey);
  if (!start || !end) return null;
  return Math.round((parseInt(end) - parseInt(start)) / 1000);
};

// Pre-defined event names for consistency
export const ClarityEvents = {
  // ==================== LANDING PAGE EVENTS ====================
  LANDING_CTA_CLICKED: 'landing_cta_clicked',
  LANDING_SIGNUP_BUTTON_CLICKED: 'landing_signup_button',
  LANDING_LOGIN_BUTTON_CLICKED: 'landing_login_button',
  LANDING_HOW_IT_WORKS_VIEWED: 'landing_how_it_works_viewed',
  LANDING_FAQ_VIEWED: 'landing_faq_viewed',
  LANDING_SCROLL_50: 'landing_scroll_50',
  LANDING_SCROLL_BOTTOM: 'landing_scroll_bottom',
  LANDING_TIME_30S: 'landing_time_30s',
  
  // ==================== SIGN-UP & LOGIN EVENTS ====================
  SIGNUP_PAGE_VIEWED: 'signup_page_viewed',
  SIGNUP_FORM_FOCUSED: 'signup_form_focused',
  SIGN_UP_STARTED: 'sign_up_started',
  SIGN_UP_SUCCESS: 'sign_up_success',
  SIGNUP_TO_DASHBOARD_REDIRECT: 'signup_to_dashboard_redirect',
  LOGIN_SUCCESS: 'login_success',
  
  // ==================== ACTIVATION FUNNEL EVENTS ====================
  ACTIVATION_CARD_VIEWED: 'activation_card_viewed',
  ACTIVATION_CARD_CLICKED: 'activation_card_clicked',
  ACTIVATION_SOCIAL_PROOF_VIEWED: 'activation_social_proof_viewed',
  ACTIVATION_WINNERS_TICKER_VIEWED: 'activation_winners_ticker_viewed',
  ACTIVATION_GUIDE_EXPANDED: 'activation_guide_expanded',
  ACTIVATION_GUIDE_ITEM_CLICKED: 'activation_guide_item_clicked',
  ACTIVATION_DRAWER_OPENED: 'activation_drawer_opened',
  ACTIVATION_DRAWER_CLOSED_WITHOUT_PAYING: 'activation_drawer_closed_no_pay',
  ACTIVATION_DRAWER_SCROLLED: 'activation_drawer_scrolled',
  ACTIVATION_DRAWER_SCROLLED_TO_BOTTOM: 'activation_drawer_scrolled_bottom',
  ACTIVATION_PAY_BUTTON_CLICKED: 'activation_pay_button_clicked',
  ACTIVATION_BENEFIT_1_VIEWED: 'activation_benefit_1_viewed',
  ACTIVATION_BENEFIT_2_VIEWED: 'activation_benefit_2_viewed',
  ACTIVATION_BENEFIT_3_VIEWED: 'activation_benefit_3_viewed',
  ACTIVATION_FAQ_OPENED: 'activation_faq_opened',
  ACTIVATION_FAQ_ITEM_CLICKED: 'activation_faq_item_clicked',
  ACTIVATION_NAME_CONFIRM_SHOWN: 'activation_name_confirm_shown',
  ACTIVATION_NAME_CONFIRMED: 'activation_name_confirmed',
  ACTIVATION_NAME_CANCELLED: 'activation_name_cancelled',
  
  // ==================== DASHBOARD ENGAGEMENT ====================
  DASHBOARD_FIRST_VISIT: 'dashboard_first_visit',
  DASHBOARD_RETURN_VISIT: 'dashboard_return_visit',
  DASHBOARD_POST_SIGNUP_ARRIVAL: 'dashboard_post_signup_arrival',
  DASHBOARD_SCROLL_TO_BOTTOM: 'dashboard_scroll_to_bottom',
  DASHBOARD_TIME_ON_PAGE_30S: 'dashboard_time_30s',
  DASHBOARD_TIME_ON_PAGE_60S: 'dashboard_time_60s',
  DASHBOARD_TIME_ON_PAGE_120S: 'dashboard_time_120s',
  
  // ==================== CYCLE QUEUE EVENTS ====================
  CYCLE_QUEUE_JOINED: 'cycle_queue_joined',
  CYCLE_QUEUE_VIEWED: 'cycle_queue_viewed',
  CYCLE_PAYOUT_RECEIVED: 'cycle_payout_received',
  CYCLE_SHARE_CLICKED: 'cycle_share_clicked',
  ERROR_CYCLE_JOIN_FAILED: 'error_cycle_join_failed',
  
  // ==================== TRUST ELEMENT INTERACTIONS ====================
  TRUST_WINNERS_PREVIEW_VIEWED: 'trust_winners_preview_viewed',
  TRUST_WINNERS_PREVIEW_CLICKED: 'trust_winners_preview_clicked',
  TRUST_MEMBER_COUNT_VIEWED: 'trust_member_count_viewed',
  TRUST_TESTIMONIAL_VIEWED: 'trust_testimonial_viewed',
  TRUST_BADGE_VIEWED: 'trust_badge_viewed',
  TRUST_REAL_STATS_SHOWN: 'trust_real_stats_shown',
  TRUST_FALLBACK_STATS_SHOWN: 'trust_fallback_stats_shown',
  
  // ==================== WELCOME/ONBOARDING FLOW ====================
  WELCOME_MODAL_SHOWN: 'welcome_modal_shown',
  WELCOME_STEP_1_VIEWED: 'welcome_step_1_viewed',
  WELCOME_STEP_2_VIEWED: 'welcome_step_2_viewed',
  WELCOME_STEP_3_VIEWED: 'welcome_step_3_viewed',
  WELCOME_COMPLETED: 'welcome_completed',
  WELCOME_SKIPPED: 'welcome_skipped',
  WELCOME_CTA_CLICKED: 'welcome_cta_clicked',
  
  // ==================== DEPOSIT EVENTS ====================
  DEPOSIT_INITIATED: 'deposit_initiated',
  DEPOSIT_REDIRECT: 'deposit_redirect',
  
  // ==================== MEMBERSHIP EVENTS ====================
  MEMBERSHIP_PAYMENT_STARTED: 'membership_payment_started',
  MEMBERSHIP_REDIRECT: 'membership_redirect',
  
  // ==================== REFERRAL EVENTS ====================
  REFERRAL_LINK_COPIED: 'referral_link_copied',
  REFERRAL_SHARE_WHATSAPP: 'referral_share_whatsapp',
  REFERRAL_SHARE_TWITTER: 'referral_share_twitter',
  REFERRAL_SHARE_FACEBOOK: 'referral_share_facebook',
  REFERRAL_SHARE_SMS: 'referral_share_sms',
  REFERRAL_SHARE_NATIVE: 'referral_share_native',
  REFERRAL_LINK_CLICKED: 'referral_link_clicked',
  
  // ==================== WIN/RESULT SHARING EVENTS ====================
  WIN_SHARE_WHATSAPP: 'win_share_whatsapp',
  WIN_SHARE_TWITTER: 'win_share_twitter',
  WIN_SHARE_FACEBOOK: 'win_share_facebook',
  WIN_SHARE_COPIED: 'win_share_copied',
  WIN_SHARE_TO_GROUP_CLICKED: 'win_share_to_group_clicked',
  WIN_SHARE_PROMPT_SHOWN: 'win_share_prompt_shown',
  WIN_SHARE_PROMPT_DISMISSED: 'win_share_prompt_dismissed',
  
  // ==================== PAGE VIEW EVENTS ====================
  PAGE_VIEW_DASHBOARD: 'page_view_dashboard',
  PAGE_VIEW_RESULTS: 'page_view_results',
  PAGE_VIEW_INVITE: 'page_view_invite',
  PAGE_VIEW_WALLETS: 'page_view_wallets',
  PAGE_VIEW_TRANSACTIONS: 'page_view_transactions',
  PAGE_VIEW_PROFILE: 'page_view_profile',
  PAGE_VIEW_LANDING: 'page_view_landing',
  PAGE_VIEW_NOTIFICATIONS: 'page_view_notifications',
  PAGE_VIEW_FAQ: 'page_view_faq',
  PAGE_VIEW_HOW_IT_WORKS: 'page_view_how_it_works',
  PAGE_VIEW_PUBLIC_RESULTS: 'page_view_public_results',
  
  // ==================== WITHDRAWAL EVENTS ====================
  WITHDRAWAL_STARTED: 'withdrawal_started',
  WITHDRAWAL_AMOUNT_ENTERED: 'withdrawal_amount_entered',
  WITHDRAWAL_SUCCESS: 'withdrawal_success',
  
  // ==================== TRANSFER EVENTS ====================
  TRANSFER_STARTED: 'transfer_started',
  TRANSFER_DIRECTION_SWAPPED: 'transfer_direction_swapped',
  TRANSFER_SUCCESS: 'transfer_success',
  
  // ==================== BANK ACCOUNT EVENTS ====================
  BANK_ACCOUNT_STARTED: 'bank_account_started',
  BANK_ACCOUNT_SUCCESS: 'bank_account_success',
  
  // ==================== PROFILE EVENTS ====================
  PROFILE_NAME_UPDATED: 'profile_name_updated',
  PROFILE_PHONE_UPDATED: 'profile_phone_updated',
  PROFILE_REFERRAL_COPIED: 'profile_referral_copied',
  PROFILE_AVATAR_CLICKED: 'profile_avatar_clicked',
  
  // ==================== SECURITY EVENTS ====================
  CHANGE_PIN_STARTED: 'change_pin_started',
  CHANGE_PIN_SUCCESS: 'change_pin_success',
  CHANGE_PASSWORD_STARTED: 'change_password_started',
  CHANGE_PASSWORD_SUCCESS: 'change_password_success',
  
  // ==================== NOTIFICATION EVENTS ====================
  NOTIFICATION_CLICKED: 'notification_clicked',
  NOTIFICATIONS_MARK_ALL_READ: 'notifications_mark_all_read',

  // ==================== ERROR TRACKING EVENTS ====================
  ERROR_LOGIN_INVALID_CREDENTIALS: 'error_login_invalid_credentials',
  ERROR_LOGIN_EMAIL_NOT_VERIFIED: 'error_login_email_not_verified',
  ERROR_LOGIN_BANNED: 'error_login_banned',
  ERROR_LOGIN_GENERAL: 'error_login_general',
  ERROR_SIGNUP_EMAIL_EXISTS: 'error_signup_email_exists',
  ERROR_SIGNUP_GENERAL: 'error_signup_general',
  ERROR_PASSWORD_RESET: 'error_password_reset',
  ERROR_DEPOSIT_API: 'error_deposit_api',
  ERROR_DEPOSIT_NO_LINK: 'error_deposit_no_link',
  ERROR_DEPOSIT_GENERAL: 'error_deposit_general',
  ERROR_MEMBERSHIP_PAYMENT: 'error_membership_payment',
  ERROR_WITHDRAWAL_VALIDATION: 'error_withdrawal_validation',
  ERROR_WITHDRAWAL_API: 'error_withdrawal_api',
  ERROR_TRANSFER_VALIDATION: 'error_transfer_validation',
  ERROR_TRANSFER_API: 'error_transfer_api',
  ERROR_BANK_VERIFICATION: 'error_bank_verification',
  ERROR_BANK_ADD: 'error_bank_add',
  ERROR_PROFILE_NAME_UPDATE: 'error_profile_name_update',
  ERROR_PROFILE_PHONE_UPDATE: 'error_profile_phone_update',
  ERROR_CHANGE_PIN: 'error_change_pin',
  ERROR_CHANGE_PASSWORD: 'error_change_password',
  ERROR_LOAD_RESULTS: 'error_load_results',
  ERROR_LOAD_PUBLIC_RESULTS: 'error_load_public_results',
  ERROR_LOAD_DASHBOARD: 'error_load_dashboard',

  // ==================== AUDIO EXPLAINER EVENTS ====================
  AUDIO_EXPLAINER_PLAYED: 'audio_explainer_played',
  AUDIO_EXPLAINER_PAUSED: 'audio_explainer_paused',
  AUDIO_EXPLAINER_COMPLETED: 'audio_explainer_completed',

  // ==================== VIDEO EXPLAINER (POST-SIGNUP) EVENTS ====================
  EXPLAINER_PAGE_VIEWED: 'explainer_page_viewed',
  EXPLAINER_VIDEO_PLAY_CLICKED: 'explainer_video_play_clicked',
  EXPLAINER_WATCHED_CONTINUE_CLICKED: 'explainer_watched_continue_clicked',
  EXPLAINER_SKIPPED_CLICKED: 'explainer_skipped_clicked',
  EXPLAINER_AUTO_SKIPPED_VIA_URL: 'explainer_auto_skipped_via_url',

  // ==================== WHATSAPP GROUP EVENTS ====================
  WHATSAPP_GROUP_PROMO_VIEWED: 'whatsapp_group_promo_viewed',
  WHATSAPP_GROUP_LINK_CLICKED: 'whatsapp_group_link_clicked',

  // ==================== LEGACY MEMBER EVENTS ====================
  LEGACY_MEMBER_VIEWED_UPGRADE: 'legacy_member_viewed_upgrade',
  LEGACY_MEMBER_CLICKED_ACTIVATE: 'legacy_member_clicked_activate',
  LEGACY_MEMBER_CONVERTED: 'legacy_member_converted',
} as const;
