import { Helmet } from 'react-helmet-async';

interface HowItWorksStructuredDataProps {
  membershipFee?: number;
  entryFee?: number;
}

const HowItWorksStructuredData = ({
  membershipFee = 5000,
  entryFee = 10000,
}: HowItWorksStructuredDataProps) => {
  const baseUrl = 'https://viketa.xyz';

  // HowTo Schema - Step by step guide to using Viketa
  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to Earn With Viketa Ad Shares",
    "description": "A complete guide to earning with Viketa. Companies pay to know which advert picture people like better, and you earn by taking part.",
    "image": `${baseUrl}/og-how-it-works.png`,
    "totalTime": "P5D",
    "estimatedCost": {
      "@type": "MonetaryAmount",
      "currency": "NGN",
      "value": membershipFee
    },
    "supply": [],
    "tool": [
      {
        "@type": "HowToTool",
        "name": "Smartphone or computer with internet"
      },
      {
        "@type": "HowToTool",
        "name": "Nigerian bank account for withdrawals"
      }
    ],
    "step": [
      {
        "@type": "HowToStep",
        "position": 1,
        "name": "Sign Up and Activate Your First Ad Share",
        "text": `Create your Viketa account and activate your first ad share for ₦${membershipFee.toLocaleString()}. This gets your first campaign started.`,
        "url": `${baseUrl}/signup`,
        "image": `${baseUrl}/og-signup.png`
      },
      {
        "@type": "HowToStep",
        "position": 2,
        "name": "Pick A Picture Every Day",
        "text": "Every day, tap in and pick which advert picture you like better - Picture A or Picture B. It takes about 15 minutes and helps companies know what people prefer.",
        "url": `${baseUrl}/how-it-works`
      },
      {
        "@type": "HowToStep",
        "position": 3,
        "name": "Watch Your Campaign Fill Up",
        "text": "Your campaign moves towards 100% each day you take part. Most campaigns reach 100% in about 3 to 5 days.",
        "url": `${baseUrl}/results`
      },
      {
        "@type": "HowToStep",
        "position": 4,
        "name": "Get Paid When Your Campaign Reaches 100%",
        "text": `When your campaign reaches 100%, that ad share pays ₦${entryFee.toLocaleString()} straight to your Earnings wallet, and the share is finished. You can then activate another share to keep earning.`,
        "url": `${baseUrl}/how-it-works`
      },
      {
        "@type": "HowToStep",
        "position": 5,
        "name": "Invite Friends to Earn More",
        "text": "Share your referral link with friends. When they join and activate an ad share, you earn a cash bonus. The more friends you invite, the more you earn!",
        "url": `${baseUrl}/how-it-works`
      }
    ]
  };

  // WebPage Schema
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "How Viketa Works - Complete Guide",
    "description": "Learn how Viketa ad shares work. Activate a share, pick a picture every day, and earn when your campaign reaches 100%.",
    "url": `${baseUrl}/how-it-works`,
    "image": `${baseUrl}/og-how-it-works.png`,
    "mainEntity": howToSchema,
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": baseUrl
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "How It Works",
          "item": `${baseUrl}/how-it-works`
        }
      ]
    }
  };

  // FAQ Schema for common questions on this page
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "How much does it cost to join Viketa?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Your first ad share costs ₦${membershipFee.toLocaleString()}. Extra shares after that cost less. Each share pays ₦${entryFee.toLocaleString()} when its campaign reaches 100%.`
        }
      },
      {
        "@type": "Question",
        "name": "What do I do every day on Viketa?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "You pick which advert picture you like better - Picture A or Picture B. It takes about 15 minutes and helps companies know what people prefer."
        }
      },
      {
        "@type": "Question",
        "name": "How long until my campaign reaches 100%?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Most campaigns reach 100% in about 3 to 5 days. You can check your progress anytime on your dashboard."
        }
      },
      {
        "@type": "Question",
        "name": "How do I withdraw my earnings?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Earnings go to your Viketa wallet automatically. You can withdraw to any Nigerian bank account anytime from your dashboard."
        }
      },
      {
        "@type": "Question",
        "name": "Can I earn money by inviting friends?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! You earn a cash bonus when your friends sign up and activate an ad share using your referral link. The more friends you invite, the more you earn."
        }
      }
    ]
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(howToSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(webPageSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(faqSchema)}
      </script>
    </Helmet>
  );
};

export default HowItWorksStructuredData;
