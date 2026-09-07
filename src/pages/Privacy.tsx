import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageSEO } from '@/components/PageSEO';

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <PageSEO
        title="Privacy Policy"
        description="How Viketa protects your data. Your information stays safe. Read our simple privacy policy written in plain language."
        path="/privacy"
        keywords="viketa privacy, data protection, viketa security, ad share privacy"
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
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Privacy Policy</h1>
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
            <h2 className="text-xl font-bold text-foreground">Your Privacy Matters</h2>
            <p className="text-muted-foreground leading-relaxed">
              At Viketa, we take your privacy seriously. This policy explains what information 
              we collect, how we use it, and how we keep it safe. We've written this in simple 
              language so everyone can understand.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">What We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Account Information</h3>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Your full name</li>
                  <li>• Email address</li>
                  <li>• Phone number (optional)</li>
                  <li>• Profile picture (optional)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Payment Information</h3>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Bank account details for withdrawals</li>
                  <li>• Transaction history</li>
                  <li>• We do NOT store your card details</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Usage Information</h3>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Your activity on Viketa</li>
                  <li>• Your referral activity</li>
                  <li>• App usage patterns</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">How We Use Your Information</h2>
            <ul className="text-muted-foreground space-y-2">
              <li>• <strong>To run the platform:</strong> Process entries, distribute winnings, handle withdrawals</li>
              <li>• <strong>To show results:</strong> Display winner names publicly (this builds trust)</li>
              <li>• <strong>To contact you:</strong> Send important notifications about your account</li>
              <li>• <strong>To improve Viketa:</strong> Understand how people use the platform</li>
              <li>• <strong>To prevent fraud:</strong> Detect and stop cheating or abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Earnings Are Visible</h2>
            <p className="text-muted-foreground leading-relaxed">
              When you finish campaigns and earn on Viketa, your name and profile picture may be shown publicly. 
              This is important for building trust in our community - people can see that real 
              people are earning real money. By using Viketa, you agree to this.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Payment Security</h2>
            <ul className="text-muted-foreground space-y-2">
              <li>• We use <strong>Flutterwave</strong> to process all payments</li>
              <li>• Your card details go directly to Flutterwave - we never see them</li>
              <li>• Flutterwave is a trusted, licensed payment provider in Nigeria</li>
              <li>• All transactions are encrypted and secure</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Data Storage</h2>
            <ul className="text-muted-foreground space-y-2">
              <li>• Your data is stored securely on protected servers</li>
              <li>• We use industry-standard security measures</li>
              <li>• Only authorized team members can access your information</li>
              <li>• We keep your data as long as your account is active</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Sharing Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              We do NOT sell your personal information. We only share it in these cases:
            </p>
            <ul className="text-muted-foreground space-y-2">
              <li>• <strong>Payment processing:</strong> With Flutterwave to handle transactions</li>
              <li>• <strong>Legal requirements:</strong> If required by Nigerian law</li>
              <li>• <strong>Public winners:</strong> Winner names shown on the platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Your Rights</h2>
            <ul className="text-muted-foreground space-y-2">
              <li>• <strong>Access:</strong> You can see all your information in your profile</li>
              <li>• <strong>Update:</strong> You can change your name, phone, and picture</li>
              <li>• <strong>Delete:</strong> Contact us to delete your account and data</li>
              <li>• <strong>Questions:</strong> Contact us anytime about your privacy</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use cookies to keep you logged in and remember your preferences. 
              These are necessary for the platform to work properly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Children</h2>
            <p className="text-muted-foreground leading-relaxed">
              Viketa is only for people 18 years and older. We do not knowingly collect 
              information from anyone under 18.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this privacy policy from time to time. We will notify you of 
              any important changes through the app or email.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about your privacy, please contact us at{' '}
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

export default Privacy;
