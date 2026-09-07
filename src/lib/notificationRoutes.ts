/**
 * Maps notification types to their appropriate navigation routes.
 * Used to navigate users to the relevant page when they click on a notification.
 */

interface NotificationRouteData {
  event_type: string;
  event_data?: Record<string, any>;
}

/**
 * Get the route path for a notification based on its type.
 * Returns the path that should be navigated to when the notification is clicked.
 */
export function getNotificationRoute(notification: NotificationRouteData): string {
  const { event_type, event_data } = notification;

  // If notification has a custom link, use it
  if (event_data?.link) {
    return event_data.link;
  }

  switch (event_type) {
    // Money won - go to results page
    case 'winner_alert':
    case 'cycle_complete':
      return '/results';

    // Entry protected - go to results page
    case 'refund_notice':
      return '/results';

    // Withdrawal completed or failed - go to wallets
    case 'withdrawal_complete':
    case 'withdrawal_failed':
      return '/transactions';

    // Debt warning - go to wallets
    case 'debt_warning':
      return '/transactions';

    // Deposit received - go to wallets
    case 'deposit':
    case 'cycle_joined':
      return '/transactions';

    // Payment issues - go to wallets
    case 'chargeback_alert':
    case 'chargeback_detected':
      return '/transactions';

    // Bonus received - go to wallets
    case 'membership_bonus':
      return '/transactions';

    // Account banned or unbanned - go to profile
    case 'account_banned':
    case 'account_unbanned':
      return '/profile';

    // Welcome message - go to dashboard
    case 'welcome':
      return '/dashboard';

    // Admin messages - go to notifications page
    case 'admin_message':
      return '/notifications';

    // System errors - go to notifications
    case 'distribution_failed':
    case 'system_critical_error':
      return '/notifications';

    // New user signup (admin notification)
    case 'new_user_signup':
    case 'member_activated':
      return '/admin/users';

    // Support ticket notifications (user) - go to support
    case 'ticket_created':
    case 'ticket_reply':
    case 'ticket_resolved':
      return '/support';

    // Admin support ticket notifications - go to admin support
    case 'new_ticket':
    case 'user_reply_on_ticket':
      return '/admin/support';

    // Harvest mechanic — drive user to do tasks
    case 'missed_harvest':
    case 'turn_approaching':
      return '/task';

    // Retirement / big payout — deep-link into the Restore flow so a user
    // opening the app from a push notification lands directly on the
    // "send my spot back to work" drawer, not a cold dashboard.
    case 'spot_retired':
    case 'drop_profit_final':
    case 'payout_retired':
      return '/dashboard?restore=1';

    // Ordinary mid-cycle payout — send to transactions where the win shows.
    case 'drop_profit':
      return '/transactions';

    // Default - go to notifications page
    default:
      return '/notifications';
  }
}


/**
 * Check if a notification type should be clickable/navigable
 */
export function isNotificationClickable(eventType: string): boolean {
  return true;
}
