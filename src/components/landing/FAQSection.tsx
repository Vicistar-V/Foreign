import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { HelpCircle, Search, MessageCircle, X, Coins, Shield, Users, Wallet } from 'lucide-react';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';

type FAQCategory = 'all' | 'money' | 'joining' | 'earning' | 'safety' | 'trust';

interface FAQ { question: string; answer: string; category: FAQCategory; }

const generateFaqs = (
  membershipFee: number,
  extraSpot: number,
  payout: number,
  bonus: number,
  pendingBonus: number,
  minWithdrawal: number,
  dailyPerSpot: number,
  isUnlimited: boolean,
): FAQ[] => [
  {
    question: 'Is this a Ponzi scheme?',
    answer: `No. Companies pay Viketa to find out which advert picture people like better. You activate an ad share for ₦${membershipFee.toLocaleString()} (or ₦${extraSpot.toLocaleString()} for extra shares), pick a picture each day, and when your campaign reaches 100%, you collect ₦${payout.toLocaleString()} — then that share is finished. It's real work for real companies, not magic or endless new joiners.`,
    category: 'trust',
  },
  {
    question: 'How does an ad share work?',
    answer: `Simple: pay ₦${membershipFee.toLocaleString()} to activate your first ad share. Every day, open the app and pick which picture you like better${isUnlimited ? ' — no daily limit, do as many as you want' : ` (up to about ₦${dailyPerSpot.toLocaleString()} per share per day)`}. It takes about 15 minutes a day. When your campaign reaches 100%, you collect ₦${payout.toLocaleString()} straight to your bank. That share is then finished — activate another for ₦${extraSpot.toLocaleString()} to keep earning.`,
    category: 'earning',
  },
  {
    question: 'What happens after my share pays out?',
    answer: `Your share is finished — its job is done. To keep earning, activate a new share for ₦${extraSpot.toLocaleString()}. You can run as many shares as you want at the same time. More shares = more ₦${payout.toLocaleString()} payouts.`,
    category: 'earning',
  },
  {
    question: 'Do I have to pay every month?',
    answer: `No. The ₦${membershipFee.toLocaleString()} is a one-time payment to activate your first ad share. After that, activating more shares is completely optional — do it only when you want more payouts.`,
    category: 'money',
  },
  {
    question: 'When do I get paid?',
    answer: `You get paid when your campaign reaches 100% — usually about 3–5 days. The ₦${payout.toLocaleString()} goes into your withdrawable wallet immediately — cash out to any Nigerian bank from ₦${minWithdrawal.toLocaleString()}.`,
    category: 'money',
  },
  {
    question: 'How much do I earn for inviting a friend?',
    answer: `Every friend who activates instantly adds ₦${pendingBonus.toLocaleString()} to your pending balance so your campaign moves closer to its ₦${payout.toLocaleString()} payout right away — PLUS ₦${bonus.toLocaleString()} cash straight to your withdrawable wallet. Invite 10 friends and that's ₦${(10 * pendingBonus).toLocaleString()} pending + ₦${(10 * bonus).toLocaleString()} instant cash.`,
    category: 'money',
  },
  {
    question: 'How do I withdraw my money?',
    answer: `Go to your Wallet, add your bank account, and request a withdrawal. Minimum ₦${minWithdrawal.toLocaleString()}. Withdrawals are processed fast to your Nigerian bank account.`,
    category: 'money',
  },
  {
    question: 'Is my money safe?',
    answer: 'Yes. Payments go through Flutterwave and Moniepoint — two of Nigeria\'s most trusted providers. Card details are never stored on our servers, and every transaction is encrypted.',
    category: 'safety',
  },
  {
    question: 'Where does the payout money come from?',
    answer: `Companies pay Viketa to know which advert picture people like better — that's the real money behind every campaign. Each share has a fixed payout (₦${payout.toLocaleString()}) — when your campaign reaches 100%, your share pays and is finished. There is a clear, published fee split, no invisible middle layer.`,
    category: 'trust',
  },
  {
    question: 'What is the minimum to start?',
    answer: `₦${membershipFee.toLocaleString()} — one-time — activates your account plus your first ad share. That's it.`,
    category: 'joining',
  },
  {
    question: 'Can I have multiple ad shares at once?',
    answer: `Yes. Activate as many extra shares as you want for ₦${extraSpot.toLocaleString()} each. Each share earns independently — 3 shares means 3 chances at a ₦${payout.toLocaleString()} payout.`,
    category: 'earning',
  },
  {
    question: 'How long until my share pays out?',
    answer: 'Your campaign usually reaches 100% in about 3–5 days. You can watch your campaign\'s progress live on your dashboard.',
    category: 'earning',
  },
  {
    question: 'What is "pending balance" and how does it become real cash?',
    answer: `Every picture you pick adds money to your pending balance — a "waiting wallet". When your campaign reaches 100%, up to ₦${payout.toLocaleString()} of that pending balance is unlocked as real, withdrawable cash. No active share = pending stays stuck.`,
    category: 'earning',
  },
  {
    question: 'Why should I pick a picture every day?',
    answer: 'Picking a picture every day grows your pending balance so that when your campaign hits 100%, more real cash unlocks. Skip too many days and the payout you eventually unlock will be smaller. Small daily habit, real money.',
    category: 'earning',
  },
];

const categoryConfig: Record<FAQCategory, { label: string; icon: React.ReactNode }> = {
  all: { label: 'All', icon: <HelpCircle className="h-3 w-3" /> },
  trust: { label: 'Trust', icon: <Shield className="h-3 w-3" /> },
  money: { label: 'Money', icon: <Coins className="h-3 w-3" /> },
  joining: { label: 'Joining', icon: <Users className="h-3 w-3" /> },
  earning: { label: 'Earning', icon: <Wallet className="h-3 w-3" /> },
  safety: { label: 'Safety', icon: <Shield className="h-3 w-3" /> },
};

export const FAQSection = () => {
  const { data: config } = usePlatformConfig();
  const membershipFee = Number(config?.membership_fee ?? 5000);
  const extraSpot = Number(config?.drop_entry_fee ?? 5000);
  const payout = Number(config?.drop_target_amount ?? 10000);
  const bonus = Number(config?.referral_cash_bonus ?? 1000);
  const minWithdrawal = Number(config?.minimum_withdrawal ?? 500);
  const nairaPerBatch = Number(config?.task_naira_per_batch ?? 180);
  const batchesPerDay = Number(config?.task_batches_per_day ?? 0);
  const isUnlimited = batchesPerDay === 0;
  const dailyPerSpot = isUnlimited ? payout : nairaPerBatch * batchesPerDay;
  const pendingBonus = Number(config?.referral_pending_bonus ?? 3000);

  const faqs = generateFaqs(membershipFee, extraSpot, payout, bonus, pendingBonus, minWithdrawal, dailyPerSpot, isUnlimited);

  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FAQCategory>('all');

  const filteredFaqs = faqs.filter((faq) => {
    const matchesSearch = searchQuery === '' ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <section ref={ref} className="py-12 lg:py-20 px-4">
      <div className="max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
        <motion.div
          className="text-center mb-6 lg:mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-primary text-sm font-medium mb-3">
            <HelpCircle className="h-4 w-4" />
            Questions
          </div>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2">Common questions</h2>
          <p className="text-muted-foreground lg:text-lg">Everything you need to know</p>
        </motion.div>

        <motion.div
          className="relative mb-4 max-w-xl mx-auto"
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1 }}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 lg:h-12 lg:text-base"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </motion.div>

        <motion.div
          className="flex flex-wrap justify-center gap-2 mb-4 lg:mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.15 }}
        >
          {(Object.keys(categoryConfig) as FAQCategory[]).map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 lg:px-4 lg:py-2 rounded-full text-xs lg:text-sm font-medium transition-all ${
                activeCategory === category
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {categoryConfig[category].icon}
              {categoryConfig[category].label}
            </button>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
        >
          <AnimatePresence mode="wait">
            {filteredFaqs.length > 0 ? (
              <Accordion type="single" collapsible className="space-y-2">
                {filteredFaqs.map((faq, index) => (
                  <motion.div
                    key={faq.question}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <AccordionItem
                      value={`item-${index}`}
                      className="bg-card border border-border rounded-xl px-4 data-[state=open]:border-primary/30"
                    >
                      <AccordionTrigger className="text-left text-sm lg:text-base font-medium hover:no-underline py-4">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm lg:text-base text-muted-foreground pb-4">
                        {faq.answer}
                        <div className="mt-2">
                          <Badge variant="outline" className="text-xs">
                            {categoryConfig[faq.category].icon}
                            <span className="ml-1">{categoryConfig[faq.category].label}</span>
                          </Badge>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </motion.div>
                ))}
              </Accordion>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8 text-muted-foreground"
              >
                <HelpCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No questions found matching "{searchQuery}"</p>
                <button
                  onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
                  className="text-primary text-sm mt-2 hover:underline"
                >
                  Clear filters
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div
          className="mt-6 lg:mt-10 p-4 lg:p-6 bg-muted/50 rounded-xl text-center max-w-lg mx-auto"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.4 }}
        >
          <p className="text-sm lg:text-base text-muted-foreground mb-3">
            Still have questions? We're here to help!
          </p>
          <Button variant="outline" size="lg" asChild>
            <a href="mailto:support@viketa.xyz" className="inline-flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Chat with support
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};
