import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageSEO } from '@/components/PageSEO';

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <PageSEO
        title="Terms & Conditions"
        description="Read Viketa's terms and conditions. Simple rules for the ad share campaign system. Fair, transparent, and easy to understand."
        path="/terms"
        keywords="viketa terms, viketa rules, ad share terms, viketa conditions"
      />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Terms & Conditions</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto px-4 py-8 max-w-3xl"
      >
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          
          <section>
            <p className="text-muted-foreground text-sm">Last updated: December 2024</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Welcome to Viketa</h2>
            <p className="text-muted-foreground leading-relaxed">
              By using Viketa, you agree to these terms. Please read them carefully. 
              We've written these in simple language so everyone can understand.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">What is Viketa?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Viketa is an instant money sharing platform where members play and win rewards. 
              It is NOT gambling - it's a fair reward system where about 45% of plays 
              either win extra money or get their credits back.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Membership</h2>
            <ul className="text-muted-foreground space-y-2">
              <li>• You must be 18 years or older to use Viketa</li>
              <li>• You must be a resident of Nigeria</li>
              <li>• One-time membership fee is required to join</li>
              <li>• Membership is permanent - pay once, access forever</li>
              <li>• You must use your real name and information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Your ad share</h2>
            <ul className="text-muted-foreground space-y-2">
              <li>• Every ad share costs the same: ₦5,000 one-time, whether it is your first one or your tenth</li>
              <li>• Each ad share pays you ₦10,000 when your campaign reaches 100%</li>
              <li>• Part of what you pay goes into your campaign, the rest covers platform costs</li>
              <li>• The share is finished after it pays. You can activate a new one any time</li>
              <li>• Platform is available 24/7</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">How Payouts Work</h2>
            <ul className="text-muted-foreground space-y-2">
              <li>• Every 2 entries pay 1 person (1:2 ratio)</li>
              <li>• Payouts happen automatically when conditions are met</li>
              <li>• Part of payout is your profit, part auto re-enters</li>
              <li>• Earnings can be withdrawn to your bank account</li>
              <li>• First campaign referral bonus goes to whoever invited you</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Withdrawals</h2>
            <ul className="text-muted-foreground space-y-2">
              <li>• Minimum withdrawal amount applies</li>
              <li>• A small withdrawal fee is charged per transaction</li>
              <li>• Withdrawals are sent to Nigerian bank accounts only</li>
              <li>• Processing time is typically within 24 hours</li>
              <li>• You must verify your bank account before withdrawing</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Referral Program</h2>
            <ul className="text-muted-foreground space-y-2">
              <li>• Earn cash for each friend who becomes a member</li>
              <li>• Get voucher bonus for each referral</li>
              <li>• No limit on how many people you can refer</li>
              <li>• Referral rewards are paid when your friend pays membership</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Sharing Your Winnings</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              When you win on Viketa, we expect you to share your winning in our official WhatsApp Group. This is important for our community:
            </p>
            <ul className="text-muted-foreground space-y-2">
              <li>• Winners should share their winnings in the Viketa WhatsApp Group</li>
              <li>• This builds trust and shows others that Viketa is real</li>
              <li>• Sharing helps grow our community so everyone benefits</li>
              <li>• Members who consistently refuse to share may face account review</li>
              <li>• We track sharing activity to maintain a healthy community</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              Your device and account may be permanently banned if you repeatedly fail to participate in community sharing, as this hurts our reputation and other members' trust.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">What's Not Allowed</h2>
            <ul className="text-muted-foreground space-y-2">
              <li>• Creating multiple accounts</li>
              <li>• Using fake names or information</li>
              <li>• Attempting to cheat or manipulate the system</li>
              <li>• Chargebacks or payment reversals</li>
              <li>• Refusing to share winnings in community group</li>
              <li>• Any illegal activity</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              Breaking these rules will result in account ban and forfeiture of any balance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Our Rights</h2>
            <ul className="text-muted-foreground space-y-2">
              <li>• We can update these terms at any time</li>
              <li>• We can suspend or terminate accounts that break rules</li>
              <li>• We can modify the platform features and pricing</li>
              <li>• We are not responsible for losses due to your actions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about these terms, please contact us at{' '}
              <a href="mailto:support@viketa.com" className="text-primary hover:underline">
                support@viketa.com
              </a>
            </p>
          </section>

        </div>

        {/* Back Button */}
        <div className="mt-12 pb-8">
          <Button asChild className="w-full">
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </motion.main>
    </div>
  );
};

export default Terms;
