// Blog Content Index
// This file collects all blog posts from their individual files
// 
// HOW TO ADD A NEW BLOG POST:
// 1. Create a new file in this folder (src/content/blog/)
//    Example: "my-new-article.ts"
// 
// 2. Copy the structure from any existing post file
// 
// 3. Write your article content
// 
// 4. Import and add it to the list below
// 
// That's it! Your new post will appear on the blog automatically.

import type { BlogPost } from "@/types/blog";
import { calculateReadingTime } from "@/lib/blogUtils";

// Import each blog post from its own file
import { isViketaLegitPost } from "./is-viketa-legit";
import { howToWinMoneyDailyPost } from "./how-to-win-money-daily";
import { bestReferralTipsPost } from "./best-referral-tips";
import { ponziVsViketaPost } from "./ponzi-vs-viketa";
import { makeMoneyDailyNigeriaPost } from "./make-money-daily-nigeria";
// Batch 1 articles
import { studentMoneyGuidePost } from "./student-money-guide";
import { viketaReviews50Post } from "./viketa-reviews-50";
import { withdrawalGuidePost } from "./withdrawal-guide";
import { earn10000WeeklyPost } from "./earn-10000-weekly";
import { redFlagsFakePlatformsPost } from "./red-flags-fake-platforms";
// Batch 2 articles
import { housewifeIncomeIdeasPost } from "./housewife-income-ideas";
import { salaryBoosterSideHustlesPost } from "./salary-booster-side-hustles";
import { youthEmpowermentMoneyPost } from "./youth-empowerment-money";
import { smallCapitalBusinessPost } from "./small-capital-business";
import { weekendWarriorIncomePost } from "./weekend-warrior-income";
// Batch 3 articles
import { phoneMoneyAppsPost } from "./phone-money-apps";
import { whatsappMoneyPost } from "./whatsapp-money";
import { referralMasteryPost } from "./referral-mastery";
import { monthlyIncomeCalendarPost } from "./monthly-income-calendar";
// Batch 4 articles (Trust & Safety)
import { platformComparisonPost } from "./platform-comparison";
import { moneySafetyGuidePost } from "./money-safety-guide";
import { paymentGatewayGuidePost } from "./payment-gateway-guide";
import { legalCompliancePost } from "./legal-compliance";
import { mathematicsBehindViketaPost } from "./mathematics-behind-viketa";
// Batch 5 articles (Guides)
import { addMoneyGuide } from "./add-money-guide";
import { walletSystemExplained } from "./wallet-system-explained";
import { bankAccountSetup } from "./bank-account-setup";
import { viketaForCouples } from "./viketa-for-couples";
// Batch 6 articles (News & Updates)
import { financeTrends2025Post } from "./finance-trends-2025";
import { communityPlatformsPost } from "./community-platforms";
import { viketaUpdate2025Post } from "./viketa-update-2025";
import { topMoneyApps2025Post } from "./top-money-apps-2025";
import { economicOutlookPost } from "./economic-outlook";
// Batch 7 articles (Success Stories)
import { viketaWinnerStories } from "./viketa-winner-stories";
import { topReferrerInterview } from "./top-referrer-interview";
import { monthlyWinnersSpotlight } from "./monthly-winners-spotlight";
// Batch 8 articles (Final Batch)
import { passiveIncomeNigeria } from "./passive-income-nigeria";
import { whatsappStatusMarketing } from "./whatsapp-status-marketing";
import { profileOptimization } from "./profile-optimization";
import { viketaAppGuide } from "./viketa-app-guide";
import { successStoryBeginnerJourney } from "./success-story-beginner-journey";
import { familySuccessStory } from "./family-success-story";
import { regionalChampions } from "./regional-champions";

/**
 * Helper to add reading time to a post
 */
const withReadingTime = (post: Omit<BlogPost, "readingTime">): BlogPost => ({
  ...post,
  readingTime: calculateReadingTime(post.content),
});

/**
 * All blog posts - collected from individual files
 */
export const blogPosts: BlogPost[] = [
  withReadingTime(isViketaLegitPost),
  withReadingTime(howToWinMoneyDailyPost),
  withReadingTime(bestReferralTipsPost),
  withReadingTime(ponziVsViketaPost),
  withReadingTime(makeMoneyDailyNigeriaPost),
  // Batch 1
  withReadingTime(studentMoneyGuidePost),
  withReadingTime(viketaReviews50Post),
  withReadingTime(withdrawalGuidePost),
  withReadingTime(earn10000WeeklyPost),
  withReadingTime(redFlagsFakePlatformsPost),
  // Batch 2
  withReadingTime(housewifeIncomeIdeasPost),
  withReadingTime(salaryBoosterSideHustlesPost),
  withReadingTime(youthEmpowermentMoneyPost),
  withReadingTime(smallCapitalBusinessPost),
  withReadingTime(weekendWarriorIncomePost),
  // Batch 3
  withReadingTime(phoneMoneyAppsPost),
  withReadingTime(whatsappMoneyPost),
  withReadingTime(referralMasteryPost),
  withReadingTime(monthlyIncomeCalendarPost),
  // Batch 4 (Trust & Safety)
  withReadingTime(platformComparisonPost),
  withReadingTime(moneySafetyGuidePost),
  withReadingTime(paymentGatewayGuidePost),
  withReadingTime(legalCompliancePost),
  withReadingTime(mathematicsBehindViketaPost),
  // Batch 5 (Guides)
  withReadingTime(addMoneyGuide),
  withReadingTime(walletSystemExplained),
  withReadingTime(bankAccountSetup),
  withReadingTime(viketaForCouples),
  // Batch 6 (News & Updates)
  withReadingTime(financeTrends2025Post),
  withReadingTime(communityPlatformsPost),
  withReadingTime(viketaUpdate2025Post),
  withReadingTime(topMoneyApps2025Post),
  withReadingTime(economicOutlookPost),
  // Batch 7 (Success Stories)
  withReadingTime(viketaWinnerStories),
  withReadingTime(topReferrerInterview),
  withReadingTime(monthlyWinnersSpotlight),
  // Batch 8 (Final Batch)
  withReadingTime(passiveIncomeNigeria),
  withReadingTime(whatsappStatusMarketing),
  withReadingTime(profileOptimization),
  withReadingTime(viketaAppGuide),
  withReadingTime(successStoryBeginnerJourney),
  withReadingTime(familySuccessStory),
  withReadingTime(regionalChampions),
];

/**
 * Get all blog posts (sorted by date, newest first)
 */
export const getAllBlogPosts = (): BlogPost[] => {
  return [...blogPosts].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
};

/**
 * Get a single blog post by its URL slug
 */
export const getBlogPostBySlug = (slug: string): BlogPost | undefined => {
  return blogPosts.find((post) => post.slug === slug);
};

/**
 * Get total number of blog posts
 */
export const getBlogPostCount = (): number => {
  return blogPosts.length;
};

/**
 * Get featured blog posts only
 */
export const getFeaturedPosts = (): BlogPost[] => {
  return blogPosts.filter((post) => post.featured);
};

/**
 * Get posts by tag
 */
export const getPostsByTag = (tag: string): BlogPost[] => {
  return blogPosts.filter((post) => post.tags.includes(tag));
};
