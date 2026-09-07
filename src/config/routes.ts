/**
 * Central Route Configuration
 * 
 * This is the SINGLE SOURCE OF TRUTH for all application routes.
 * Both App.tsx and the sitemap generator use this file.
 * 
 * HOW TO ADD A NEW PAGE:
 * 1. Add a new route entry below with path and SEO settings
 * 2. Set isPublic: true if you want it in the sitemap
 * 3. That's it! The sitemap will include it automatically on next build.
 */

export type ChangeFrequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

export interface RouteConfig {
  path: string;
  isPublic: boolean; // If true, included in sitemap
  priority?: number; // 0.0 to 1.0, higher = more important
  changefreq?: ChangeFrequency; // How often the page changes
}

/**
 * All application routes
 * 
 * isPublic = true → Included in sitemap (for Google)
 * isPublic = false → Hidden from sitemap (private pages)
 */
export const appRoutes = {
  // ============================================
  // PUBLIC PAGES (Shown in sitemap)
  // ============================================
  
  // Homepage - Most important page
  home: {
    path: '/',
    isPublic: true,
    priority: 1.0,
    changefreq: 'daily' as ChangeFrequency,
  },
  
  // Public Results/Winners page
  winners: {
    path: '/winners',
    isPublic: true,
    priority: 0.9,
    changefreq: 'daily' as ChangeFrequency,
  },
  
  // How It Works - Educational page
  howItWorks: {
    path: '/how-it-works',
    isPublic: true,
    priority: 0.8,
    changefreq: 'weekly' as ChangeFrequency,
  },
  
  // FAQ page
  faq: {
    path: '/faq',
    isPublic: true,
    priority: 0.7,
    changefreq: 'weekly' as ChangeFrequency,
  },
  
  // Blog listing page
  blog: {
    path: '/blog',
    isPublic: true,
    priority: 0.9,
    changefreq: 'daily' as ChangeFrequency,
  },
  
  // Blog post page (dynamic - handled separately by sitemap generator)
  blogPost: {
    path: '/blog/:slug',
    isPublic: false, // Individual posts handled by blog content system
    priority: 0.7,
    changefreq: 'monthly' as ChangeFrequency,
  },
  
  // Legal pages
  terms: {
    path: '/terms',
    isPublic: true,
    priority: 0.3,
    changefreq: 'yearly' as ChangeFrequency,
  },
  
  privacy: {
    path: '/privacy',
    isPublic: true,
    priority: 0.3,
    changefreq: 'yearly' as ChangeFrequency,
  },
  
  // Auth pages (public but lower priority)
  signup: {
    path: '/signup',
    isPublic: true,
    priority: 0.6,
    changefreq: 'monthly' as ChangeFrequency,
  },
  
  signupWithReferral: {
    path: '/signup/:referralCode',
    isPublic: false, // Dynamic route - not in sitemap
  },
  
  joinWithReferral: {
    path: '/join/:referralCode',
    isPublic: false, // Dynamic route - not in sitemap
  },
  
  login: {
    path: '/login',
    isPublic: true,
    priority: 0.5,
    changefreq: 'monthly' as ChangeFrequency,
  },
  
  forgotPassword: {
    path: '/forgot-password',
    isPublic: true,
    priority: 0.4,
    changefreq: 'yearly' as ChangeFrequency,
  },
  
  resetPassword: {
    path: '/reset-password',
    isPublic: false, // Token-based, not for sitemap
  },

  // ============================================
  // PROTECTED USER PAGES (Hidden from sitemap)
  // ============================================
  
  watchFirst: {
    path: '/watch-first',
    isPublic: false, // Pre-signup gate, not for sitemap
  },


  activationSuccess: {
    path: '/activation-success',
    isPublic: false,
  },

  createPin: {
    path: '/create-pin',
    isPublic: false,
  },
  
  changePin: {
    path: '/change-pin',
    isPublic: false,
  },
  
  changePassword: {
    path: '/change-password',
    isPublic: false,
  },
  
  dashboard: {
    path: '/dashboard',
    isPublic: false,
  },
  
  invite: {
    path: '/invite',
    isPublic: false,
  },
  
  transactions: {
    path: '/transactions',
    isPublic: false,
  },
  
  profile: {
    path: '/profile',
    isPublic: false,
  },
  
  notifications: {
    path: '/notifications',
    isPublic: false,
  },
  
  results: {
    path: '/results',
    isPublic: false,
  },
  
  setProfilePicture: {
    path: '/set-profile-picture',
    isPublic: false,
  },
  
  support: {
    path: '/support',
    isPublic: false,
  },

  withdraw: {
    path: '/withdraw',
    isPublic: false,
  },

  // ============================================
  // ADMIN PAGES (Hidden from sitemap)
  // ============================================
  
  admin: {
    path: '/admin',
    isPublic: false,
  },
  
  adminUsers: {
    path: '/admin/users',
    isPublic: false,
  },
  
  adminUserDetails: {
    path: '/admin/users/:userId',
    isPublic: false,
  },
  
  adminWithdrawals: {
    path: '/admin/withdrawals',
    isPublic: false,
  },
  
  adminDeposits: {
    path: '/admin/deposits',
    isPublic: false,
  },
  
  adminLogs: {
    path: '/admin/logs',
    isPublic: false,
  },
  
  adminReferrals: {
    path: '/admin/referrals',
    isPublic: false,
  },
  
  adminNotifications: {
    path: '/admin/notifications',
    isPublic: false,
  },

  adminBroadcastDetail: {
    path: '/admin/notifications/:broadcastId',
    isPublic: false,
  },
  
  adminEconomy: {
    path: '/admin/economy',
    isPublic: false,
  },
  
  adminControls: {
    path: '/admin/controls',
    isPublic: false,
  },
  
  
  adminSupport: {
    path: '/admin/support',
    isPublic: false,
  },
  
  adminGallery: {
    path: '/admin/gallery',
    isPublic: false,
  },
} as const;

/**
 * Get all public routes (for sitemap)
 */
export const getPublicRoutes = (): RouteConfig[] => {
  return Object.values(appRoutes).filter(route => route.isPublic);
};

/**
 * Get route by name
 */
export const getRoute = (name: keyof typeof appRoutes): RouteConfig => {
  return appRoutes[name];
};
