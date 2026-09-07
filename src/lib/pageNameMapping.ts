/**
 * Maps route paths to friendly, grandma-friendly page names.
 * These names appear in activity logs and admin panels.
 */

const pageNames: Record<string, string> = {
  // Main pages
  '/': 'Home Page',
  '/dashboard': 'Dashboard',
  '/transactions': 'Money History',
  '/invite': 'Referrer',
  '/results': 'Daily Results',
  '/profile': 'My Profile',
  '/help': 'Help Center',
  '/support': 'Get Support',
  '/faq': 'Common Questions',
  '/about': 'About Us',
  '/terms': 'Terms of Use',
  '/privacy': 'Privacy Info',
  
  // Auth pages
  '/login': 'Login Page',
  '/signup': 'Sign Up Page',
  '/forgot-password': 'Forgot Password',
  '/reset-password': 'Reset Password',
  '/verify-email': 'Email Verification',

  // Post-signup onboarding flow (CRITICAL for funnel analysis)
  '/watch-first': 'Watch Explainer Video (before signup)',
  '/create-pin': 'Create PIN',
  '/set-profile-picture': 'Set Profile Picture',
  '/change-pin': 'Change PIN',
  '/change-password': 'Change Password',
  
  // Instant Play related
  '/drop': 'Instant Play',
  '/drop-history': 'My Play History',
  '/winners': 'Recent Winners',
  
  // Wallet actions
  '/deposit': 'Add Money',
  '/withdraw': 'Withdraw Money',
  '/transfer': 'Transfer Money',
  
  // Settings
  '/settings': 'Settings',
  '/settings/security': 'Security Settings',
  '/settings/notifications': 'Notification Settings',
  '/settings/bank-accounts': 'Bank Accounts',
  
  // Admin pages
  '/admin': 'Admin Dashboard',
  '/admin/users': 'Manage Users',
  '/admin/economy': 'Economy Settings',
  '/admin/drops': 'Drop Management',
  '/admin/withdrawals': 'Withdrawal Requests',
  '/admin/support': 'Support Tickets',
  '/admin/alerts': 'System Alerts',
  '/admin/logs': 'Activity Logs',
  '/admin/analytics': 'Analytics',
  '/admin/test-tools': 'Testing Tools',
};

/**
 * Gets a friendly page name from a route path.
 * Handles dynamic routes by stripping IDs.
 */
export const getPageName = (path: string): string => {
  // Direct match first
  if (pageNames[path]) {
    return pageNames[path];
  }
  
  // Handle dynamic routes (e.g., /admin/users/123 -> "User Details")
  if (path.startsWith('/admin/users/') && path.split('/').length > 3) {
    return 'User Details';
  }
  
  if (path.startsWith('/admin/support/') && path.split('/').length > 3) {
    return 'Ticket Details';
  }
  
  if (path.startsWith('/transactions/') && path.split('/').length > 2) {
    return 'Transaction Details';
  }
  
  // Fallback: clean up the path
  const cleanPath = path
    .split('/')
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '))
    .join(' > ');
  
  return cleanPath || 'Unknown Page';
};

/**
 * Gets the base route from a full path (strips dynamic segments)
 */
export const getBasePath = (path: string): string => {
  // Remove query params and hash
  const cleanPath = path.split('?')[0].split('#')[0];
  
  // Remove trailing slash
  return cleanPath.replace(/\/$/, '') || '/';
};
