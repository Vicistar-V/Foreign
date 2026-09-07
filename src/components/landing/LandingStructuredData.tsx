/**
 * LandingStructuredData Component
 *
 * Adds comprehensive JSON-LD Schema.org structured data to the landing page
 * for better Google search appearance with rich snippets.
 */

import { Helmet } from "react-helmet-async";

const SITE_URL = "https://viketa.xyz";
const SITE_NAME = "Viketa";
const SITE_DESCRIPTION = "Companies pay Viketa to know which advert picture people like better. Activate an ad share, pick a picture each day, and collect a payout when your campaign hits 100%.";

interface LandingStructuredDataProps {
  config?: {
    membership_fee?: number;
    drop_entry_fee?: number;
    drop_target_amount?: number;
    referral_cash_bonus?: number;
    minimum_withdrawal?: number;
    withdrawal_fee?: number;
  };
}

const generateStructuredFAQs = (config?: LandingStructuredDataProps['config']) => {
  const membershipFee = config?.membership_fee || 5000;
  const extraShare = config?.drop_entry_fee || 5000;
  const payout = config?.drop_target_amount || 10000;
  const referralBonus = config?.referral_cash_bonus || 1000;
  const minWithdrawal = config?.minimum_withdrawal || 500;

  return [
    {
      question: "How does an ad share work?",
      answer: `Pay ₦${membershipFee.toLocaleString()} once to activate your first ad share. Pick a picture each day — about 15 minutes. When your campaign reaches 100%, you collect ₦${payout.toLocaleString()}, and that share is finished.`
    },
    {
      question: "Is this a Ponzi scheme?",
      answer: `No. Companies pay Viketa to find out which advert picture people like better. You can watch your campaign progress live, and the math is simple: reach 100% and you earn ₦${payout.toLocaleString()}.`
    },
    {
      question: "Do I have to pay every time?",
      answer: `No! You pay ₦${membershipFee.toLocaleString()} once to activate your first ad share. Extra shares cost ₦${extraShare.toLocaleString()} each, whenever you want more.`
    },
    {
      question: "When do I get paid?",
      answer: `You get paid when your campaign reaches 100% — usually about 3–5 days. Your ₦${payout.toLocaleString()} payout goes straight to your wallet, and you can withdraw anytime!`
    },
    {
      question: "How do I withdraw my money?",
      answer: `Go to your Wallet, add your bank account details, and request a withdrawal. Minimum withdrawal is ₦${minWithdrawal.toLocaleString()}.`
    },
    {
      question: "Is my money safe?",
      answer: "Yes! We use Flutterwave and Moniepoint, two of Nigeria's most trusted payment providers. Your card details are never stored on our servers, and all transactions are encrypted."
    },
    {
      question: "How do referrals work?",
      answer: `When someone joins using your invite link, you earn ₦${referralBonus.toLocaleString()} cash the moment they activate — plus a boost to your own campaign's pending balance.`
    },
    {
      question: "Can I have multiple ad shares?",
      answer: `Yes! You can activate additional shares for ₦${extraShare.toLocaleString()} each. Each share runs its own campaign independently.`
    },
    {
      question: "How much can I earn?",
      answer: `Each finished share pays ₦${payout.toLocaleString()}. Activate more shares to earn more — each one runs its own campaign to 100%.`
    }
  ];
};

export const LandingStructuredData = ({ config }: LandingStructuredDataProps) => {
  const membershipFee = config?.membership_fee || 5000;
  const payout = config?.drop_target_amount || 10000;
  const structuredFAQs = generateStructuredFAQs(config);

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": SITE_NAME,
    "alternateName": "Viketa Nigeria",
    "url": SITE_URL,
    "logo": `${SITE_URL}/logo.png`,
    "image": `${SITE_URL}/og-image.jpg`,
    "description": SITE_DESCRIPTION,
    "foundingDate": "2024",
    "slogan": "Pick a picture. Get paid.",
    "areaServed": {
      "@type": "Country",
      "name": "Nigeria"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "email": "support@viketa.xyz",
      "contactType": "customer service",
      "availableLanguage": ["English"]
    },
    "sameAs": [
      "https://facebook.com/viketa",
      "https://twitter.com/viketa",
      "https://instagram.com/viketa"
    ]
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": SITE_NAME,
    "alternateName": "Viketa - Ad Share Campaigns",
    "url": SITE_URL,
    "description": SITE_DESCRIPTION,
    "inLanguage": "en-NG",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${SITE_URL}/blog?search={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": structuredFAQs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Viketa Ad Shares",
    "alternateName": "Viketa Ad Share Campaigns",
    "description": `Activate an ad share for ₦${membershipFee.toLocaleString()}, pick a picture each day, and collect ₦${payout.toLocaleString()} when your campaign reaches 100%.`,
    "serviceType": "Advertising Feedback Service",
    "provider": {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": SITE_URL
    },
    "areaServed": {
      "@type": "Country",
      "name": "Nigeria"
    },
    "availableChannel": {
      "@type": "ServiceChannel",
      "serviceType": "Online Service",
      "serviceUrl": SITE_URL,
      "availableLanguage": {
        "@type": "Language",
        "name": "English"
      }
    },
    "offers": {
      "@type": "Offer",
      "name": "Ad Share Activation",
      "price": String(membershipFee),
      "priceCurrency": "NGN",
      "description": `One-time activation fee of ₦${membershipFee.toLocaleString()} for your first ad share`,
      "availability": "https://schema.org/InStock",
      "validFrom": "2024-01-01"
    },
    "termsOfService": `${SITE_URL}/terms`
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": SITE_URL
      }
    ]
  };

  const webAppSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": SITE_NAME,
    "url": SITE_URL,
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web Browser",
    "description": SITE_DESCRIPTION,
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "NGN",
      "description": "Free to sign up"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "1250",
      "bestRating": "5",
      "worstRating": "1"
    },
    "featureList": [
      "Transparent campaign progress",
      "Rate advert pictures daily",
      "Secure payments via Flutterwave & Moniepoint",
      "Instant withdrawals to Nigerian banks",
      "Referral bonuses per friend invited"
    ]
  };

  const financialServiceSchema = {
    "@context": "https://schema.org",
    "@type": "FinancialService",
    "name": "Viketa Ad Shares",
    "alternateName": "Viketa Campaign Earnings",
    "description": SITE_DESCRIPTION,
    "url": SITE_URL,
    "logo": `${SITE_URL}/logo.png`,
    "image": `${SITE_URL}/og-image.jpg`,
    "priceRange": "₦₦",
    "currenciesAccepted": "NGN",
    "paymentAccepted": ["Debit Card", "Bank Transfer"],
    "areaServed": {
      "@type": "Country",
      "name": "Nigeria",
      "identifier": "NG"
    },
    "hoursAvailable": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday", "Tuesday", "Wednesday",
        "Thursday", "Friday", "Saturday", "Sunday"
      ],
      "opens": "00:00",
      "closes": "23:59"
    },
    "potentialAction": {
      "@type": "JoinAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${SITE_URL}/signup`,
        "actionPlatform": [
          "http://schema.org/DesktopWebPlatform",
          "http://schema.org/MobileWebPlatform"
        ]
      },
      "name": "Activate an ad share"
    },
    "provider": {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": SITE_URL
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "1250",
      "bestRating": "5",
      "worstRating": "1"
    }
  };

  const allSchemas = [
    organizationSchema,
    websiteSchema,
    faqSchema,
    serviceSchema,
    financialServiceSchema,
    breadcrumbSchema,
    webAppSchema
  ];

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(allSchemas)}
      </script>
    </Helmet>
  );
};
