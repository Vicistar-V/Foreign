/**
 * FAQPageStructuredData Component
 * 
 * Adds comprehensive JSON-LD Schema.org structured data to the dedicated FAQ page
 * for better Google search appearance with expandable FAQ rich snippets.
 * 
 * Includes:
 * - FAQPage schema (All FAQs for maximum visibility)
 * - BreadcrumbList schema (Home > FAQ)
 * - WebPage schema (FAQ page metadata)
 */

import { Helmet } from "react-helmet-async";

const SITE_URL = "https://viketa.xyz";
const SITE_NAME = "Viketa";

// Complete FAQ data for structured data - updated for The Viketa Line queue system
const createStructuredFAQs = (config?: {
  membershipFee?: number;
  dropEntryFee?: number;
  dropProfitAmount?: number;
  dropTargetAmount?: number;
  withdrawalFee?: number;
  minimumWithdrawal?: number;
  referralCashBonus?: number;
}) => {
  const firstShareFee = config?.dropEntryFee ?? 5000;
  const extraShareFee = config?.membershipFee ?? 5000;
  const sharePayout = config?.dropProfitAmount ?? 10000;
  const withdrawalFee = config?.withdrawalFee ?? 100;
  const minimumWithdrawal = config?.minimumWithdrawal ?? 1000;
  const referralBonus = config?.referralCashBonus ?? 1000;

  return [
    // ========== GETTING STARTED ==========
    { question: "What is Viketa?", answer: `Companies pay Viketa to find out which advert picture people like better. You activate an ad share for ₦${firstShareFee.toLocaleString()}, pick a picture every day, and when your campaign reaches 100%, that share pays you ₦${sharePayout.toLocaleString()}.` },
    { question: "What is an ad share?", answer: `An ad share is your ticket to help a company find out which advert picture people like better. You pick a picture each day, your campaign fills up towards 100%, and then that share pays ₦${sharePayout.toLocaleString()} and is finished.` },
    { question: "How do I sign up?", answer: "Signing up is easy! Just tap 'Sign Up', enter your name, email, and create a password. You'll get a confirmation email, and then you're in! The whole process takes about 2 minutes." },
    { question: "What do I need to join?", answer: `You need: (1) A valid email address, (2) A Nigerian bank account for withdrawals, (3) ₦${firstShareFee.toLocaleString()} to activate your first ad share. That's it! No documents or verification needed to start.` },
    { question: "How much does it cost to join?", answer: `Activating your first ad share costs ₦${firstShareFee.toLocaleString()}. Every extra share after that costs ₦${extraShareFee.toLocaleString()}. Each share pays ₦${sharePayout.toLocaleString()} when its campaign reaches 100%.` },
    { question: "Do I need a bank account?", answer: "You need a Nigerian bank account to withdraw your earnings. We support all major banks in Nigeria. You can add your bank details anytime from your profile settings." },
    { question: "Can I join from outside Nigeria?", answer: "Currently, Viketa is only available for people in Nigeria with Nigerian bank accounts. We're working on expanding to other countries soon!" },
    { question: "How do I verify my account?", answer: "Just verify your email address by clicking the link we send you after signing up. That's all the verification needed! Your bank account gets verified automatically when you add it." },
    { question: "What happens after I sign up?", answer: `After signing up: (1) Activate an ad share for ₦${firstShareFee.toLocaleString()}, (2) Pick a picture every day (about 15 minutes), (3) Watch your campaign move towards 100%, (4) That share pays ₦${sharePayout.toLocaleString()} when it's done.` },
    { question: "Can I delete my account?", answer: "Yes, you can delete your account from your profile settings. Before deleting, make sure to withdraw any money in your wallet. Once deleted, you'll need to sign up again." },
    
    // ========== AD SHARES ==========
    { question: "How does an ad share work?", answer: `It's simple: (1) Activate a share for ₦${firstShareFee.toLocaleString()}, (2) Pick a picture every day, about 15 minutes, (3) Your campaign fills up towards 100%, usually in 3 to 5 days, (4) When it reaches 100%, that share pays you ₦${sharePayout.toLocaleString()} and is finished. Activate another share any time to keep earning.` },
    { question: "What do I do every day?", answer: "Every day you pick which advert picture you like better - Picture A or Picture B. It takes about 15 minutes and helps companies know what people prefer." },
    { question: "Can I have multiple ad shares?", answer: `Yes! Your first share costs ₦${firstShareFee.toLocaleString()}, and every extra share costs ₦${extraShareFee.toLocaleString()}. Each share runs its own campaign and pays out on its own.` },
    { question: "How long until my campaign reaches 100%?", answer: "It usually takes about 3 to 5 days. You can always check your progress on your dashboard." },
    { question: "What happens when my campaign reaches 100%?", answer: `When your campaign reaches 100%, that ad share pays you ₦${sharePayout.toLocaleString()} and is finished. You can activate another share to keep earning.` },
    { question: "Do I need to be online all day?", answer: "No! Just pick your picture once a day, about 15 minutes. Your campaign keeps filling up in the background." },
    { question: "What does my campaign progress mean?", answer: "Your campaign progress shows how close you are to 100%. Every day you take part, it moves forward until that ad share pays out." },
    { question: "Can I check how my campaign is doing?", answer: "Yes! Your dashboard shows exactly how close each of your ad shares is to 100%, and how much it will pay when it's done." },
    
    // ========== MONEY & PAYMENTS ==========
    { question: "How do I add money to my account?", answer: "Tap 'Add Money' on your dashboard, enter the amount, and pay with your card or bank transfer. The money appears in your wallet instantly! We use Flutterwave for secure payments." },
    { question: "What payment methods are accepted?", answer: "We accept: (1) Debit/Credit cards (Visa, Mastercard, Verve), (2) Bank transfers, (3) USSD banking. All payments are processed securely through Flutterwave." },
    { question: "How do I withdraw my earnings?", answer: "Go to your Earnings wallet, tap 'Withdraw', enter the amount, and confirm with your PIN. The money is sent to your linked bank account within 24 hours (usually much faster!)." },
    { question: "What is the minimum withdrawal?", answer: `The minimum withdrawal amount is ₦${minimumWithdrawal.toLocaleString()}. You can withdraw any amount above this from your earnings wallet.` },
    { question: "How much is the withdrawal fee?", answer: `The withdrawal fee is ₦${withdrawalFee.toLocaleString()} per withdrawal, regardless of how much you withdraw. This covers bank transfer costs.` },
    { question: "How long do withdrawals take?", answer: "Most withdrawals arrive within 1-2 hours! In rare cases, it might take up to 24 hours depending on your bank. You'll get a notification when it's complete." },
    { question: "What banks are supported?", answer: "We support ALL Nigerian banks! This includes GTBank, First Bank, Access Bank, UBA, Zenith, Kuda, OPay, PalmPay, and every other licensed bank in Nigeria." },
    { question: "Can I send money to someone else?", answer: "No, you can only withdraw to bank accounts in your own name. This is for security - it protects your money from unauthorized transfers." },
    { question: "What are the two wallets?", answer: `You have 2 wallets: (1) Deposit Wallet - where you add money to activate an ad share, (2) Earnings Wallet - where your ₦${sharePayout.toLocaleString()} share payouts go. You can withdraw from Earnings anytime!` },
    { question: "Where does my ad share fee go?", answer: `Your ad share fee funds your campaign. When your campaign reaches 100%, that share pays a ₦${sharePayout.toLocaleString()} payout and is finished.` },
    { question: "Is my card information safe?", answer: "100% safe! We NEVER see or store your card details. All payments go through Flutterwave, a PCI-DSS compliant payment processor trusted by millions." },
    
    // ========== EARNINGS & MATH ==========
    { question: "How much do I earn per ad share?", answer: `Each ad share pays ₦${sharePayout.toLocaleString()} when its campaign reaches 100%. That amount goes straight to your Earnings wallet.` },
    { question: "What is my return on an ad share?", answer: `You activate a share for ₦${firstShareFee.toLocaleString()} (or ₦${extraShareFee.toLocaleString()} for extra shares) and it pays ₦${sharePayout.toLocaleString()} when the campaign reaches 100%. The more shares you activate, the more you can earn.` },
    { question: "Is there a limit to how much I can earn?", answer: "No limit! Each ad share pays out once when its campaign reaches 100%. Activate as many shares as you like to keep earning." },
    { question: "When do I get my earnings?", answer: `Your ₦${sharePayout.toLocaleString()} payout appears in your Earnings wallet immediately when your campaign reaches 100%. You can withdraw anytime!` },
    { question: "Can I lose my ad share fee?", answer: "No! Your ad share fee funds your campaign, and that campaign pays out when it reaches 100%. It's never lost." },
    { question: "What if my campaign is slow to reach 100%?", answer: "Your campaign is still filling up. Most campaigns reach 100% in about 3 to 5 days. Keep picking a picture each day and it will get there." },
    
    // ========== REFERRALS ==========
    { question: "How do referrals work?", answer: `Share your unique referral link. When someone joins Viketa through your link, you earn ₦${referralBonus.toLocaleString()} cash bonus! It's a one-time reward per friend.` },
    { question: "How much do I earn per referral?", answer: `You earn ₦${referralBonus.toLocaleString()} cash for each friend who joins Viketa through your link. This goes straight to your Earnings wallet - withdrawable immediately!` },
    { question: "Where do I find my referral link?", answer: "Go to the 'Invite' tab in your dashboard. You'll see your unique link there. You can copy it, share via WhatsApp, or show the QR code!" },
    { question: "When do I get paid for referrals?", answer: `You get paid when your friend joins Viketa! The ₦${referralBonus.toLocaleString()} appears in your Earnings wallet right away.` },
    { question: "Is there a limit on referrals?", answer: `No limit! Refer as many friends as you want and earn ₦${referralBonus.toLocaleString()} for EACH one. Some members earn thousands just from referrals!` },
    { question: "Do I earn from my referral's ongoing ad shares?", answer: "The referral bonus is a one-time reward when they first join. You don't earn from their ongoing ad shares - everyone earns independently." },
    { question: "Can I share my referral link anywhere?", answer: "Yes! Share on WhatsApp, Facebook, Instagram, Twitter, TikTok - anywhere! Just don't spam. Real recommendations work best." },
    { question: "How do I track my referrals?", answer: "The 'Invite' tab shows all your referrals - who joined and how much you've earned. Everything is tracked automatically!" },
    
    // ========== ACCOUNT & SECURITY ==========
    { question: "How do I change my password?", answer: "Go to Profile > Settings > Change Password. Enter your current password, then your new password twice. Make sure to use a strong password!" },
    { question: "How do I create/change my PIN?", answer: "Your 4-digit PIN is set during signup. To change it, go to Profile > Settings > Change PIN. You'll need to verify your identity first." },
    { question: "What if I forget my password?", answer: "On the login page, tap 'Forgot Password'. Enter your email and we'll send you a reset link. Check your spam folder if you don't see it!" },
    { question: "What if I forget my PIN?", answer: "Contact support via WhatsApp or email. We'll verify your identity and help you reset your PIN. This usually takes a few hours." },
    { question: "Can I change my name?", answer: "You can update your name once from your Profile settings. After that, it's locked for security reasons. Make sure to use your real name!" },
    { question: "Can I change my email?", answer: "Currently, you cannot change your email address. If you need a different email, you'll need to create a new account." },
    { question: "How do I update my profile picture?", answer: "Go to Profile > Edit Profile Picture. Upload a clear photo of yourself. Our team reviews photos to keep the community safe." },
    { question: "Can I have multiple accounts?", answer: "No! Each person can only have ONE account. Multiple accounts will be banned and funds may be forfeited. This keeps things fair for everyone." },
    
    // ========== TROUBLESHOOTING ==========
    { question: "The app is not loading", answer: "Try: (1) Check your internet connection, (2) Clear your browser cache, (3) Try a different browser, (4) Restart your phone. If still not working, contact support." },
    { question: "My payment failed", answer: "Common fixes: (1) Check your card has enough money, (2) Make sure your card is enabled for online payments, (3) Try a different payment method, (4) Contact your bank if blocked." },
    { question: "I didn't receive my earnings", answer: "Payouts appear instantly in your Earnings wallet when your campaign reaches 100%. Check your Earnings wallet. If still missing after a few minutes, contact support with your username." },
    { question: "My withdrawal is taking too long", answer: "Most withdrawals complete in 1-2 hours. If it's been over 24 hours: (1) Check your bank account again, (2) Verify your bank details are correct, (3) Contact support with your transaction ID." },
    { question: "I can't log in to my account", answer: "Try: (1) Double-check your email spelling, (2) Reset your password if forgotten, (3) Clear browser cookies, (4) Try incognito mode. Contact support if still locked out." },
    { question: "My balance looks wrong", answer: "Check your transaction history to see all movements. Remember: Earnings and Deposit are separate wallets. If numbers don't add up, contact support." },
    { question: "I'm not receiving notifications", answer: "Check: (1) Your phone's notification settings, (2) Email spam folder for our messages, (3) In-app notification settings. Enable all notifications to stay updated!" },
    { question: "My campaign isn't moving", answer: "Your campaign is still filling up. Keep picking a picture every day - most campaigns reach 100% in about 3 to 5 days." },
    
    // ========== TRUST & SAFETY ==========
    { question: "Is Viketa gambling?", answer: "NO! Viketa is NOT gambling. There's no betting, no luck, no random outcomes. Real companies pay to know which advert picture people like better, and your ad share pays out when your campaign reaches 100%." },
    { question: "Is Viketa legal?", answer: "Yes! Viketa operates as a community earnings platform in Nigeria. It's not betting or gambling - real companies pay for real advert feedback. All operations are compliant." },
    { question: "Is Viketa a pyramid/Ponzi scheme?", answer: "Absolutely NOT! Real companies pay Viketa to find out which advert picture people like better. That money funds the payouts. There's a real product behind every ad share." },
    { question: "How do I know this is real?", answer: `Activate an ad share and watch your campaign progress. When it hits 100%, you'll see ₦${sharePayout.toLocaleString()} appear in your Earnings wallet. Withdraw to your bank to verify it's real!` },
    { question: "What happens if Viketa shuts down?", answer: "Your money in your wallets is always yours. We operate with full transparency, and you can withdraw anytime. Your funds are never locked." },
    { question: "How is Viketa different from betting?", answer: "Betting: Random outcomes, house always wins. Viketa: Companies pay for real advert feedback, and your ad share pays out when your campaign reaches 100%. No luck involved!" },
    { question: "Who runs Viketa?", answer: "Viketa is built by a team of Nigerian tech entrepreneurs passionate about creating fair financial opportunities. We're real people building something meaningful!" },
    { question: "How can I report a problem?", answer: "Contact us via WhatsApp (fastest), email support@viketa.xyz, or use the in-app feedback. We take all reports seriously and respond within hours." },
  ];
};

interface FAQPageStructuredDataProps {
  config?: {
    membership_fee?: number;
    drop_entry_fee?: number;
    drop_profit_amount?: number;
    drop_target_amount?: number;
    withdrawal_fee?: number;
    minimum_withdrawal?: number;
    referral_cash_bonus?: number;
  };
}

export const FAQPageStructuredData = ({ config }: FAQPageStructuredDataProps) => {
  const faqs = createStructuredFAQs({
    membershipFee: config?.membership_fee,
    dropEntryFee: config?.drop_entry_fee,
    dropProfitAmount: config?.drop_profit_amount,
    dropTargetAmount: config?.drop_target_amount,
    withdrawalFee: config?.withdrawal_fee,
    minimumWithdrawal: config?.minimum_withdrawal,
    referralCashBonus: config?.referral_cash_bonus,
  });

  // Schema 1: FAQPage - Shows expandable FAQs in Google search
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "name": "Viketa FAQ - Frequently Asked Questions",
    "description": "Complete answers to all your questions about Viketa and ad shares - the platform where companies pay to know which advert picture people like better.",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  // Schema 2: WebPage - FAQ page metadata
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Viketa FAQ - Frequently Asked Questions",
    "description": "Complete answers to all your questions about Viketa and ad shares - the platform where companies pay to know which advert picture people like better.",
    "url": `${SITE_URL}/faq`,
    "isPartOf": {
      "@type": "WebSite",
      "name": SITE_NAME,
      "url": SITE_URL
    },
    "about": {
      "@type": "Service",
      "name": "Viketa Ad Shares",
      "description": "An ad share system where companies pay to know which advert picture people like better, and members earn by picking pictures each day"
    },
    "inLanguage": "en-NG",
    "dateModified": new Date().toISOString().split('T')[0],
    "speakable": {
      "@type": "SpeakableSpecification",
      "cssSelector": [".faq-question", ".faq-answer"]
    }
  };

  // Schema 3: BreadcrumbList - Navigation path
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": SITE_URL
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "FAQ",
        "item": `${SITE_URL}/faq`
      }
    ]
  };

  const allSchemas = [faqSchema, webPageSchema, breadcrumbSchema];

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(allSchemas)}
      </script>
    </Helmet>
  );
};

export default FAQPageStructuredData;
