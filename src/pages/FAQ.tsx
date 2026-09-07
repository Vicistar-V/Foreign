import { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { PageSEO } from '@/components/PageSEO';
import { FAQPageStructuredData } from '@/components/FAQPageStructuredData';
import { PublicHeader } from '@/components/PublicHeader';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { cn } from '@/lib/utils';
import { 
  Search, 
  Rocket, 
  TrendingUp, 
  Wallet, 
  Users, 
  Shield, 
  Wrench, 
  CheckCircle,
  MessageCircle,
  Mail,
  ChevronDown,
  Star,
  Clock,
  ExternalLink,
  FileText,
  Lock,
  HelpCircle,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

// FAQ Category Types
type FAQCategory = 
  | 'getting-started' 
  | 'ad-shares' 
  | 'money-payments' 
  | 'referrals' 
  | 'account-security' 
  | 'troubleshooting' 
  | 'trust-safety';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: FAQCategory;
  isPopular?: boolean;
}

interface CategoryConfig {
  id: FAQCategory;
  label: string;
  icon: React.ReactNode;
  description: string;
}

// Category configuration
const categories: CategoryConfig[] = [
  { id: 'getting-started', label: 'Getting Started', icon: <Rocket className="h-4 w-4" />, description: 'New to Viketa? Start here' },
  { id: 'ad-shares', label: 'Ad Shares', icon: <TrendingUp className="h-4 w-4" />, description: 'How your campaign works' },
  { id: 'money-payments', label: 'Money & Payments', icon: <Wallet className="h-4 w-4" />, description: 'Adding and withdrawing money' },
  { id: 'referrals', label: 'Referrals', icon: <Users className="h-4 w-4" />, description: 'Earn by inviting friends' },
  { id: 'account-security', label: 'Account & Security', icon: <Shield className="h-4 w-4" />, description: 'Keep your account safe' },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: <Wrench className="h-4 w-4" />, description: 'Fix common issues' },
  { id: 'trust-safety', label: 'Trust & Safety', icon: <CheckCircle className="h-4 w-4" />, description: 'Is Viketa safe?' },
];

// Generate FAQs with dynamic values
const generateFAQs = (config: any): FAQ[] => {
  // FLAT PRICING: first share and every extra share cost the same.
  const firstShareFee = config?.membership_fee ?? 5000;
  const extraShareFee = config?.drop_entry_fee ?? firstShareFee;
  const sharePayout = config?.drop_profit_amount ?? 10000;
  const withdrawalFee = config?.withdrawal_fee ?? 50;
  const minimumWithdrawal = config?.minimum_withdrawal ?? 1000;
  const referralPerCycle = config?.drop_referral_per_cycle ?? 20;

  return [
    // ========== GETTING STARTED ==========
    {
      id: 'gs-1',
      question: 'What is Viketa?',
      answer: `Companies pay Viketa to find out which advert picture people like better. You help them by picking a picture each day. To join in, you activate an ad share for ₦${firstShareFee.toLocaleString()}. As your campaign fills up to 100%, that share pays you ₦${sharePayout.toLocaleString()}, and then it is finished.`,
      category: 'getting-started',
      isPopular: true,
    },
    {
      id: 'gs-2',
      question: 'How do I sign up?',
      answer: `Signing up is easy! Just tap "Sign Up", enter your name, email, and create a password. You'll get a confirmation email, and then you're in! The whole process takes about 2 minutes.`,
      category: 'getting-started',
    },
    {
      id: 'gs-3',
      question: 'What do I need to join?',
      answer: `You need: (1) A valid email address, (2) A Nigerian bank account for withdrawals, (3) ₦${firstShareFee.toLocaleString()} to activate your first ad share. That's it! No documents or verification needed to start.`,
      category: 'getting-started',
    },
    {
      id: 'gs-4',
      question: `How much does it cost to start?`,
      answer: `It costs ₦${firstShareFee.toLocaleString()} to activate your first ad share. Every day you pick a picture for the companies, and your campaign moves closer to 100%. When it gets there, that share pays you ₦${sharePayout.toLocaleString()}.`,
      category: 'getting-started',
      isPopular: true,
    },
    {
      id: 'gs-5',
      question: 'What happens after I sign up?',
      answer: `After signing up: (1) Activate your first ad share for ₦${firstShareFee.toLocaleString()}, (2) Pick a picture every day (about 15 minutes), (3) Watch your campaign move towards 100%, (4) When it hits 100%, that share pays you ₦${sharePayout.toLocaleString()} and is finished. It's that simple!`,
      category: 'getting-started',
    },
    {
      id: 'gs-6',
      question: 'Do I need a bank account?',
      answer: `You need a Nigerian bank account to withdraw your earnings. We support all major banks in Nigeria. You can add your bank details anytime from your profile settings.`,
      category: 'getting-started',
    },
    {
      id: 'gs-7',
      question: 'Can I join from outside Nigeria?',
      answer: `Currently, Viketa is only available for people in Nigeria with Nigerian bank accounts. We're working on expanding to other countries soon!`,
      category: 'getting-started',
    },
    {
      id: 'gs-8',
      question: 'Can I delete my account?',
      answer: `Yes, you can delete your account from your profile settings. Before deleting, make sure to withdraw any earnings in your wallet. Once deleted, you'll need to sign up again with a new ad share.`,
      category: 'getting-started',
    },

    // ========== AD SHARES ==========
    {
      id: 'as1-1',
      question: 'What is an ad share?',
      answer: `An ad share is your ticket to help a company find out which advert picture people like better. You activate a share, pick a picture each day, and your campaign fills up towards 100%. When it reaches 100%, that share pays ₦${sharePayout.toLocaleString()} and is finished.`,
      category: 'ad-shares',
      isPopular: true,
    },
    {
      id: 'as1-2',
      question: 'What do I actually do every day?',
      answer: `Every day you open the app and pick which advert picture you like better - Picture A or Picture B. It takes about 15 minutes. This helps the company know what people prefer, and it moves your campaign closer to 100%.`,
      category: 'ad-shares',
      isPopular: true,
    },
    {
      id: 'as1-3',
      question: 'How long until my campaign reaches 100%?',
      answer: `Most campaigns reach 100% in about 3 to 5 days. It depends on how quickly the campaign fills up. You can always check your progress on your dashboard.`,
      category: 'ad-shares',
    },
    {
      id: 'as1-4',
      question: 'What happens when my campaign reaches 100%?',
      answer: `When your campaign hits 100%, that ad share pays you ₦${sharePayout.toLocaleString()} straight into your Earnings wallet, and the share is finished. You can then activate another share to keep earning.`,
      category: 'ad-shares',
    },
    {
      id: 'as1-5',
      question: 'Can I activate more than one ad share?',
      answer: `Yes! Your first share costs ₦${firstShareFee.toLocaleString()}. Every extra share after that costs ₦${extraShareFee.toLocaleString()}. Each share runs its own campaign and pays ₦${sharePayout.toLocaleString()} on its own when it reaches 100%.`,
      category: 'ad-shares',
    },
    {
      id: 'as1-6',
      question: 'Why do companies pay for this?',
      answer: `Companies want to know which advert picture people like better before they spend money on a big campaign. They pay Viketa, and Viketa shares that money with people like you who help by picking pictures every day.`,
      category: 'ad-shares',
    },
    {
      id: 'as1-7',
      question: 'What if I miss a day?',
      answer: `No problem. Your campaign is still filling up. Just come back and pick a picture when you can. Picking every day just helps your campaign move faster.`,
      category: 'ad-shares',
    },
    {
      id: 'as1-8',
      question: 'Can I check how my campaign is doing?',
      answer: `Yes! Your dashboard shows exactly how close each of your ad shares is to 100%. You'll always know how far along your campaign is.`,
      category: 'ad-shares',
      isPopular: true,
    },

    // ========== MONEY & PAYMENTS ==========
    {
      id: 'mp-1',
      question: 'How do I add money to my account?',
      answer: `Tap "Add Money" on your dashboard, enter the amount, and pay with your card or bank transfer. The money appears in your Deposit wallet instantly! We use Flutterwave for secure payments.`,
      category: 'money-payments',
    },
    {
      id: 'mp-2',
      question: 'What payment methods are accepted?',
      answer: `We accept: (1) Debit/Credit cards (Visa, Mastercard, Verve), (2) Bank transfers, (3) USSD banking. All payments are processed securely through Flutterwave.`,
      category: 'money-payments',
    },
    {
      id: 'mp-3',
      question: 'How do I withdraw my earnings?',
      answer: `Go to your Earnings wallet, tap "Withdraw", enter the amount, and confirm with your PIN. The money is sent to your linked bank account within 24 hours (usually much faster!).`,
      category: 'money-payments',
      isPopular: true,
    },
    {
      id: 'mp-4',
      question: `What is the minimum withdrawal?`,
      answer: `The minimum withdrawal amount is ₦${minimumWithdrawal.toLocaleString()}. You can withdraw any amount above this from your Earnings wallet.`,
      category: 'money-payments',
    },
    {
      id: 'mp-5',
      question: `How much is the withdrawal fee?`,
      answer: `The withdrawal fee is ₦${withdrawalFee.toLocaleString()} per withdrawal, regardless of how much you withdraw. This covers bank transfer costs.`,
      category: 'money-payments',
    },
    {
      id: 'mp-6',
      question: 'How long do withdrawals take?',
      answer: `Most withdrawals arrive within 1-2 hours! In rare cases, it might take up to 24 hours depending on your bank. You'll get a notification when it's complete.`,
      category: 'money-payments',
    },
    {
      id: 'mp-7',
      question: 'What are the two wallets?',
      answer: `You have 2 wallets: (1) Deposit Wallet - where you add money to activate an ad share, (2) Earnings Wallet - where your share payouts go (you can withdraw from here). Your share money works for you until the campaign reaches 100%.`,
      category: 'money-payments',
    },
    {
      id: 'mp-8',
      question: 'Is my card information safe?',
      answer: `100% safe! We NEVER see or store your card details. All payments go through Flutterwave, a PCI-DSS compliant payment processor trusted by millions.`,
      category: 'money-payments',
    },

    // ========== REFERRALS ==========
    {
      id: 'rf-1',
      question: 'How do referrals work?',
      answer: `Share your unique referral link with friends. When they join Viketa and activate an ad share, you earn ₦${referralPerCycle} every time their share pays out. This continues for as long as they keep earning!`,
      category: 'referrals',
      isPopular: true,
    },
    {
      id: 'rf-2',
      question: `How much do I earn per referral?`,
      answer: `You earn ₦${referralPerCycle} every time a referred friend's ad share pays out. If they finish 30 shares over time, you earn ₦${(referralPerCycle * 30).toLocaleString()} from just that one friend. No limit!`,
      category: 'referrals',
    },
    {
      id: 'rf-3',
      question: 'Where do I find my referral link?',
      answer: `Go to the "Invite" tab in your dashboard. You'll see your unique link there. You can copy it, share via WhatsApp, or show the QR code!`,
      category: 'referrals',
    },
    {
      id: 'rf-4',
      question: 'When do I get paid for referrals?',
      answer: `You get paid automatically every time your referred friend's ad share pays out. The ₦${referralPerCycle} goes straight to your Earnings wallet.`,
      category: 'referrals',
    },
    {
      id: 'rf-5',
      question: 'Is there a limit on referrals?',
      answer: `No limit! Refer as many friends as you want. 10 friends finishing 10 shares each = ₦${(referralPerCycle * 10 * 10).toLocaleString()} passive income. The more friends, the more you earn!`,
      category: 'referrals',
    },
    {
      id: 'rf-6',
      question: 'Do I earn forever from referrals?',
      answer: `Yes! As long as your referred friends keep activating ad shares, you earn ₦${referralPerCycle} every time one of their shares pays out. It's truly passive income.`,
      category: 'referrals',
    },

    // ========== ACCOUNT & SECURITY ==========
    {
      id: 'as-1',
      question: 'How do I change my password?',
      answer: `Go to Profile > Settings > Change Password. Enter your current password, then your new password twice. Make sure to use a strong password!`,
      category: 'account-security',
    },
    {
      id: 'as-2',
      question: 'How do I create/change my PIN?',
      answer: `Your 4-digit PIN is set during signup. To change it, go to Profile > Settings > Change PIN. You'll need to verify your identity first.`,
      category: 'account-security',
    },
    {
      id: 'as-3',
      question: 'What if I forget my password?',
      answer: `On the login page, tap "Forgot Password". Enter your email and we'll send you a reset link. Check your spam folder if you don't see it!`,
      category: 'account-security',
    },
    {
      id: 'as-4',
      question: 'Can I change my name?',
      answer: `You can update your name once from your Profile settings. After that, it's locked for security reasons. Make sure to use your real name!`,
      category: 'account-security',
    },
    {
      id: 'as-5',
      question: 'Can I have multiple accounts?',
      answer: `No! Each person can only have ONE account. Multiple accounts will be banned and funds may be forfeited. This keeps things fair for everyone.`,
      category: 'account-security',
    },

    // ========== TROUBLESHOOTING ==========
    {
      id: 'ts-1',
      question: 'The app is not loading',
      answer: `Try: (1) Check your internet connection, (2) Clear your browser cache, (3) Try a different browser, (4) Restart your phone. If still not working, contact support.`,
      category: 'troubleshooting',
    },
    {
      id: 'ts-2',
      question: 'My payment failed',
      answer: `Common fixes: (1) Check your card has enough money, (2) Make sure your card is enabled for online payments, (3) Try a different payment method, (4) Contact your bank if blocked.`,
      category: 'troubleshooting',
    },
    {
      id: 'ts-3',
      question: 'I didn\'t receive my earnings',
      answer: `Share payouts appear instantly in your Earnings wallet when your campaign reaches 100%. Check your Earnings wallet, not Deposit. If still missing after a few minutes, contact support with your username.`,
      category: 'troubleshooting',
    },
    {
      id: 'ts-4',
      question: 'My withdrawal is taking too long',
      answer: `Most withdrawals complete in 1-2 hours. If it's been over 24 hours: (1) Check your bank account again, (2) Verify your bank details are correct, (3) Contact support with your transaction ID.`,
      category: 'troubleshooting',
    },
    {
      id: 'ts-5',
      question: 'My balance looks wrong',
      answer: `Check your transaction history to see all movements. Remember: Earnings and Deposit are separate wallets. Your ad share money works for you until the campaign finishes. If numbers don't add up, contact support.`,
      category: 'troubleshooting',
    },

    // ========== TRUST & SAFETY ==========
    {
      id: 'tf-1',
      question: 'Is Viketa gambling?',
      answer: `NO! Viketa is NOT gambling. There's no betting, no odds, no luck involved. Real companies pay to know which advert picture people like better, and your campaign moves towards 100% every day you take part.`,
      category: 'trust-safety',
      isPopular: true,
    },
    {
      id: 'tf-2',
      question: 'Is Viketa legal?',
      answer: `Yes! Viketa operates as a membership-based community platform in Nigeria. We're not a betting or gambling site. All operations are transparent and compliant.`,
      category: 'trust-safety',
    },
    {
      id: 'tf-3',
      question: 'Is Viketa a pyramid/Ponzi scheme?',
      answer: `Absolutely NOT! Real companies pay Viketa to find out which advert picture people like better. That money is shared with the people who take part. There's a real product behind every ad share.`,
      category: 'trust-safety',
    },
    {
      id: 'tf-4',
      question: 'How do I know this is real?',
      answer: `Check your dashboard - you can see your campaign moving towards 100% in real-time. Every transaction is logged. Activate one ad share first and see how it works!`,
      category: 'trust-safety',
    },
    {
      id: 'tf-5',
      question: 'What happens if Viketa shuts down?',
      answer: `Your earnings in your wallet are always yours and can be withdrawn anytime. We're building for the long term and operate transparently.`,
      category: 'trust-safety',
    },
    {
      id: 'tf-6',
      question: 'Who runs Viketa?',
      answer: `Viketa is built by a team of Nigerian tech entrepreneurs passionate about creating fair financial opportunities. We're real people building something meaningful!`,
      category: 'trust-safety',
    },
    {
      id: 'tf-7',
      question: 'How can I report a problem?',
      answer: `Contact us via WhatsApp (fastest), email support@viketa.xyz, or use the in-app feedback. We take all reports seriously and respond within hours.`,
      category: 'trust-safety',
    },
  ];
};

// FAQ Accordion Item Component
const FAQItem = ({ faq, isOpen, onToggle }: { faq: FAQ; isOpen: boolean; onToggle: () => void }) => {
  return (
    <motion.div
      className="border-b border-border last:border-0"
      initial={false}
    >
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full py-4 text-left gap-4"
      >
        <span className="font-medium text-sm text-foreground pr-2">{faq.question}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-4 text-sm text-muted-foreground leading-relaxed">
              {faq.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Category Section Component
const CategorySection = ({ 
  category, 
  faqs, 
  openFaqId, 
  setOpenFaqId 
}: { 
  category: CategoryConfig; 
  faqs: FAQ[]; 
  openFaqId: string | null;
  setOpenFaqId: (id: string | null) => void;
}) => {
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });

  return (
    <motion.section
      ref={ref}
      id={category.id}
      className="scroll-mt-20"
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden">
        <div className="p-4 bg-muted/50 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {category.icon}
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{category.label}</h2>
              <p className="text-xs text-muted-foreground">{category.description}</p>
            </div>
          </div>
        </div>
        <CardContent className="p-4">
          {faqs.map((faq) => (
            <FAQItem
              key={faq.id}
              faq={faq}
              isOpen={openFaqId === faq.id}
              onToggle={() => setOpenFaqId(openFaqId === faq.id ? null : faq.id)}
            />
          ))}
        </CardContent>
      </Card>
    </motion.section>
  );
};

// Popular Questions Section
const PopularQuestionsSection = ({ 
  faqs, 
  openFaqId, 
  setOpenFaqId 
}: { 
  faqs: FAQ[]; 
  openFaqId: string | null;
  setOpenFaqId: (id: string | null) => void;
}) => {
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });
  const popularFaqs = faqs.filter(faq => faq.isPopular);

  if (popularFaqs.length === 0) return null;

  return (
    <motion.section
      ref={ref}
      className="mb-8"
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Star className="h-5 w-5 text-caution fill-caution" />
        <h2 className="font-bold text-lg">Most Asked Questions</h2>
      </div>
      <Card>
        <CardContent className="p-4">
          {popularFaqs.map((faq) => (
            <FAQItem
              key={faq.id}
              faq={faq}
              isOpen={openFaqId === faq.id}
              onToggle={() => setOpenFaqId(openFaqId === faq.id ? null : faq.id)}
            />
          ))}
        </CardContent>
      </Card>
    </motion.section>
  );
};

// Search Results Section
const SearchResultsSection = ({ 
  results, 
  searchQuery,
  openFaqId, 
  setOpenFaqId 
}: { 
  results: FAQ[]; 
  searchQuery: string;
  openFaqId: string | null;
  setOpenFaqId: (id: string | null) => void;
}) => {
  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold text-lg mb-2">No results found</h3>
        <p className="text-muted-foreground text-sm mb-4">
          Try different keywords or browse categories below
        </p>
      </div>
    );
  }

  return (
    <motion.section
      className="mb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Search className="h-5 w-5 text-primary" />
        <h2 className="font-bold text-lg">
          {results.length} result{results.length !== 1 ? 's' : ''} for "{searchQuery}"
        </h2>
      </div>
      <Card>
        <CardContent className="p-4">
          {results.map((faq) => (
            <FAQItem
              key={faq.id}
              faq={faq}
              isOpen={openFaqId === faq.id}
              onToggle={() => setOpenFaqId(openFaqId === faq.id ? null : faq.id)}
            />
          ))}
        </CardContent>
      </Card>
    </motion.section>
  );
};

// Contact Support Section
const ContactSupportSection = () => {
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });

  return (
    <motion.section
      ref={ref}
      className="mt-12 mb-8"
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-6 text-center">
          <MessageCircle className="h-10 w-10 text-primary mx-auto mb-3" />
          <h2 className="font-bold text-lg mb-2">Still have questions?</h2>
          <p className="text-muted-foreground text-sm mb-4">
            Our support team is ready to help you
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild variant="default" className="gap-2">
              <a href="https://wa.me/2349161631227" target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <a href="mailto:support@viketa.xyz">
                <Mail className="h-4 w-4" />
                Email Us
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
};

// Main FAQ Page Component
const FAQ = () => {
  const { data: config } = usePlatformConfig();
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<FAQCategory | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Generate FAQs with config values
  const faqs = useMemo(() => generateFAQs(config), [config]);

  // Filter FAQs based on search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return faqs.filter(
      faq => 
        faq.question.toLowerCase().includes(query) || 
        faq.answer.toLowerCase().includes(query)
    );
  }, [faqs, searchQuery]);

  // Group FAQs by category
  const faqsByCategory = useMemo(() => {
    return categories.reduce((acc, category) => {
      acc[category.id] = faqs.filter(faq => faq.category === category.id);
      return acc;
    }, {} as Record<FAQCategory, FAQ[]>);
  }, [faqs]);

  // Track page view
  useEffect(() => {
    trackClarityEvent(ClarityEvents.PAGE_VIEW_FAQ);
  }, []);

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="min-h-screen bg-background">
      <PageSEO
        title="FAQ - Frequently Asked Questions"
        description="Find answers to common questions about Viketa. Learn how ad shares work, how to earn, withdraw money, invite friends, and more."
        path="/faq"
        keywords="viketa faq, viketa help, viketa questions, how viketa works"
      />
      <FAQPageStructuredData config={config} />
      <PublicHeader />

      <main className="container max-w-2xl mx-auto px-4 py-8 pb-24">
        {/* Header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Badge variant="outline" className="mb-3 px-3 py-1">
            <HelpCircle className="h-3.5 w-3.5 mr-1.5" />
            Help Center
          </Badge>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            How can we help you?
          </h1>
          <p className="text-muted-foreground">
            Find answers to common questions about Viketa
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>
        </motion.div>

        {/* Category Pills */}
        {!isSearching && (
          <motion.div
            className="flex flex-wrap gap-2 mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  const element = document.getElementById(category.id);
                  element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                  "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                )}
              >
                {category.icon}
                <span className="hidden sm:inline">{category.label}</span>
              </button>
            ))}
          </motion.div>
        )}

        {/* Search Results */}
        {isSearching ? (
          <SearchResultsSection
            results={searchResults}
            searchQuery={searchQuery}
            openFaqId={openFaqId}
            setOpenFaqId={setOpenFaqId}
          />
        ) : (
          <>
            {/* Popular Questions */}
            <PopularQuestionsSection
              faqs={faqs}
              openFaqId={openFaqId}
              setOpenFaqId={setOpenFaqId}
            />

            {/* Categories */}
            <div className="space-y-6">
              {categories.map((category) => (
                <CategorySection
                  key={category.id}
                  category={category}
                  faqs={faqsByCategory[category.id]}
                  openFaqId={openFaqId}
                  setOpenFaqId={setOpenFaqId}
                />
              ))}
            </div>
          </>
        )}

        {/* Contact Support */}
        <ContactSupportSection />

        {/* Quick Links */}
        <motion.div
          className="grid grid-cols-2 gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Link to="/how-it-works">
            <Card className="p-4 hover:border-primary/50 transition-colors h-full">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">How It Works</p>
                  <p className="text-xs text-muted-foreground">Learn the basics</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link to="/terms">
            <Card className="p-4 hover:border-primary/50 transition-colors h-full">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">Terms</p>
                  <p className="text-xs text-muted-foreground">Read the rules</p>
                </div>
              </div>
            </Card>
          </Link>
        </motion.div>
      </main>

      <LandingFooter />
    </div>
  );
};

export default FAQ;