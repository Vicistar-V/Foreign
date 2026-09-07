import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, AlertCircle, Check, UserCircle, Eye, EyeOff } from "lucide-react";
import { saveReferralCode, getReferralCode, clearReferralCode } from "@/lib/referralStorage";
import { hasStoredExplainerSkip, getSkipExplainerParamName, captureExplainerSkipFromUrl, hasWatchedBeforeSignup } from "@/lib/explainerSkip";
import { PublicHeader } from "@/components/PublicHeader";
import { PageSEO } from "@/components/PageSEO";
import { trackClarityEvent, ClarityEvents, recordFunnelTiming, FunnelTimingKeys } from "@/lib/clarityTracking";
import { trackFBLead, trackFBCompleteRegistration } from "@/lib/facebookPixel";
import { identifyLogRocketUser, trackLogRocketEvent, LREvents } from "@/lib/logrocket";
import { supabase } from "@/integrations/supabase/client";
import { BankVerifiedNameInput } from "@/components/signup/BankVerifiedNameInput";
import { YearOfBirthPicker } from "@/components/signup/YearOfBirthPicker";
import { MonthOfBirthPicker } from "@/components/signup/MonthOfBirthPicker";
import { StateOfResidencePicker } from "@/components/signup/StateOfResidencePicker";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const signUpSchema = z.object({
  fullName: z.string()
    .min(2, "Please enter your full name (at least 2 letters)")
    .max(100, "Name is too long"),
  phoneNumber: z.string()
    .min(10, "Please enter a valid phone number")
    .max(15, "Phone number is too long")
    .regex(/^(\+?234|0)?[789][01]\d{8}$/, "Please enter a valid Nigerian phone number (e.g. 08012345678)"),
  email: z.string()
    .email("Please enter a valid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters long"),
  referralCode: z.string().optional(),
  agreeToTerms: z.boolean()
    .refine((val) => val === true, "You must agree to the terms to continue")
});

type SignUpForm = z.infer<typeof signUpSchema>;

type SignUpStep = 'birth-year' | 'birth-month' | 'state' | 'bank-verify' | 'manual-name' | 'details';

const SignUp = () => {
  const { referralCode: urlReferralCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { signUp, user, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const hasTrackedLead = useRef(false);

  // Multi-step state — start with year of birth, then month, then name, then details
  const [currentStep, setCurrentStep] = useState<SignUpStep>('birth-year');
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [birthMonth, setBirthMonth] = useState<number | null>(null);
  const [stateOfResidence, setStateOfResidence] = useState<string | null>(null);
  const [verifiedBankData, setVerifiedBankData] = useState<{
    name: string;
    bankCode: string;
    accountNumber: string;
    bankName: string;
  } | null>(null);

  const form = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: "",
      phoneNumber: "",
      email: "",
      password: "",
      referralCode: "",
      agreeToTerms: false
    }
  });

// Gate: Checks URL parameter directly first, saves to localStorage, 
  // and only sends unverified users to /watch-first once auth is loaded.
  useEffect(() => {
    // 1. Wait for Supabase auth check to complete (avoids slow network race conditions)
    if (authLoading) return;

    // 2. Directly check URL query params for `?xse=1` or bypass flags
    const searchParams = new URLSearchParams(location.search);
    const skipParamName = getSkipExplainerParamName(); // 'xse'
    const rawSkipValue = searchParams.get(skipParamName);
    const hasSkipInUrl = rawSkipValue && rawSkipValue !== '0' && rawSkipValue.toLowerCase() !== 'false';

    // If skip flag exists in URL, capture it to localStorage immediately and stay on sign-up
    if (hasSkipInUrl) {
      captureExplainerSkipFromUrl();
      return;
    }

    // 4. Also check if captureExplainerSkipFromUrl or storage already has the flag
    if (captureExplainerSkipFromUrl() || hasStoredExplainerSkip() || hasWatchedBeforeSignup()) {
      return;
    }

    // 5. No flag in URL and no flag in storage -> redirect to /watch-first
    const back = location.pathname + location.search;
    navigate(`/watch-first?next=${encodeURIComponent(back)}`, { replace: true });
  }, [authLoading, user, location.pathname, location.search, navigate]);

  // Handle referral code from URL or localStorage
  useEffect(() => {
    if (urlReferralCode) {
      trackClarityEvent(ClarityEvents.REFERRAL_LINK_CLICKED);
      saveReferralCode(urlReferralCode);
      form.setValue('referralCode', urlReferralCode);
    } else {
      const storedCode = getReferralCode();
      if (storedCode) {
        form.setValue('referralCode', storedCode);
      }
    }
  }, [urlReferralCode, form]);

  // Track Lead event and page view when user visits signup page
  useEffect(() => {
    if (!hasTrackedLead.current && !authLoading && !user) {
      trackClarityEvent(ClarityEvents.SIGNUP_PAGE_VIEWED);
      recordFunnelTiming(FunnelTimingKeys.SIGNUP_START_TIME);
      trackFBLead();
      hasTrackedLead.current = true;
      console.log('📘 FB Pixel: Lead event fired on signup page visit');
    }
  }, [authLoading, user]);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);

  const handleBankVerified = (name: string, bankCode: string, accountNumber: string, bankName: string) => {
    setVerifiedBankData({ name, bankCode, accountNumber, bankName });
    form.setValue('fullName', name);
    setCurrentStep('details');
  };

  const handleSkipToManual = () => {
    setCurrentStep('manual-name');
  };

  const handleManualNameContinue = () => {
    const name = form.getValues('fullName');
    if (name && name.length >= 2) {
      setCurrentStep('details');
    }
  };

  const handleBackToBankVerify = () => {
    // Bank verification is temporarily disabled — go back to manual name entry instead
    setCurrentStep('manual-name');
    setVerifiedBankData(null);
    form.setValue('fullName', '');
  };

  const onSubmit = async (data: SignUpForm) => {
    setIsSubmitting(true);
    trackClarityEvent(ClarityEvents.SIGN_UP_STARTED);
    trackLogRocketEvent(LREvents.SIGNUP_STARTED, { email: data.email });
    try {
      const { data: signUpData, error } = await signUp(
        data.email,
        data.password,
        data.fullName,
        data.phoneNumber,
        data.referralCode,
        birthYear,
        birthMonth,
        stateOfResidence,
      );

      if (error) {
        if (error.message.includes('already registered')) {
          trackClarityEvent(ClarityEvents.ERROR_SIGNUP_EMAIL_EXISTS);
          toast({
            title: "Email Already Used",
            description: "This email is already registered. Please log in instead.",
            variant: "destructive"
          });
        } else {
          trackClarityEvent(ClarityEvents.ERROR_SIGNUP_GENERAL);
          toast({
            title: "Sign Up Failed",
            description: error.message,
            variant: "destructive"
          });
        }
        return;
      }

      if (signUpData?.user) {
        clearReferralCode();
        trackClarityEvent(ClarityEvents.SIGN_UP_SUCCESS);
        trackClarityEvent(ClarityEvents.SIGNUP_TO_DASHBOARD_REDIRECT);
        recordFunnelTiming(FunnelTimingKeys.SIGNUP_COMPLETE_TIME);
        trackFBCompleteRegistration();
        // Identify the brand-new user in LogRocket immediately so the
        // pre-activation session is tied to their email/name from second one.
        identifyLogRocketUser(signUpData.user.id, {
          email: data.email,
          name: data.fullName,
          phone: data.phoneNumber,
          isMember: false,
        });
        trackLogRocketEvent(LREvents.SIGNUP_COMPLETED, {
          userId: signUpData.user.id,
          email: data.email,
        });
        console.log('📘 FB Pixel: CompleteRegistration event fired on successful signup');

        // Fire-and-forget: notify admin Telegram about the new signup.
        // Not awaited so signup UX is never blocked by the alert.
        supabase.functions.invoke('notify-signup').catch((err) => {
          console.warn('[SignUp] notify-signup failed (non-blocking):', err);
        });

        navigate('/dashboard');
      }
    } catch (error: any) {
      trackClarityEvent(ClarityEvents.ERROR_SIGNUP_GENERAL);
      toast({
        title: "Something Went Wrong",
        description: error.message || "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      <PageSEO
        title="Sign Up - Create Your Free Account"
        description="Create your free Viketa account, activate an ad share, and join a campaign. Quick signup, no hassle."
        path="/signup"
        keywords="Viketa signup, create account, join Viketa, register free"
        image="/og-signup.png"
      />
      <PublicHeader />

      <div className="flex-1 flex items-center justify-center px-4 py-8 md:py-12 pb-24 md:pb-12">
        <Card className="w-full max-w-md shadow-medium overflow-hidden">
          {/* Progress indicator */}
          <div className="h-1 bg-muted">
            <motion.div 
              className="h-full bg-primary"
              initial={{ width: '0%' }}
              animate={{
                width:
                  currentStep === 'birth-year' ? '16%' :
                  currentStep === 'birth-month' ? '32%' :
                  currentStep === 'state' ? '50%' :
                  currentStep === 'bank-verify' || currentStep === 'manual-name' ? '75%' :
                  '100%'
              }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl md:text-3xl font-bold text-center">
              {currentStep === 'birth-year' && "First, your birth year"}
              {currentStep === 'birth-month' && "And your birth month"}
              {currentStep === 'state' && "Where do you live?"}
              {currentStep === 'bank-verify' && "Let's Get Your Name"}
              {currentStep === 'manual-name' && "Enter Your Name"}
              {currentStep === 'details' && "Almost Done!"}
            </CardTitle>
            <CardDescription className="text-center">
              {currentStep === 'birth-year' && "We use this to keep your account safe"}
              {currentStep === 'birth-month' && "Last bit about you, then we move on"}
              {currentStep === 'state' && "Helps us serve people in your area better"}
              {currentStep === 'bank-verify' && "We'll pull your name directly from your bank"}
              {currentStep === 'manual-name' && "Type your full name as it appears on your bank account"}
              {currentStep === 'details' && "Just a few more details and you're in!"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...form}>
            <AnimatePresence mode="wait">
                {/* STEP 0a: Year of Birth */}
                {currentStep === 'birth-year' && (
                  <motion.div
                    key="birth-year-step"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <YearOfBirthPicker
                      value={birthYear}
                      onChange={setBirthYear}
                      onContinue={() => setCurrentStep('birth-month')}
                    />
                    <div className="text-center text-sm text-muted-foreground pt-6 mt-4 border-t border-border">
                      Already have an account?{" "}
                      <Link to="/login" className="text-primary hover:underline font-semibold">
                        Log In
                      </Link>
                    </div>
                  </motion.div>
                )}

                {/* STEP 0b: Month of Birth */}
                {currentStep === 'birth-month' && (
                  <motion.div
                    key="birth-month-step"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <MonthOfBirthPicker
                      value={birthMonth}
                      onChange={setBirthMonth}
                      onContinue={() => setCurrentStep('state')}
                      onBack={() => setCurrentStep('birth-year')}
                    />
                  </motion.div>
                )}

                {/* STEP 0c: State of Residence */}
                {currentStep === 'state' && (
                  <motion.div
                    key="state-step"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <StateOfResidencePicker
                      value={stateOfResidence}
                      onChange={setStateOfResidence}
                      onContinue={() => setCurrentStep('manual-name')}
                      onBack={() => setCurrentStep('birth-month')}
                    />
                  </motion.div>
                )}

                {/* STEP 1: Bank Verify Flow (Default) */}
                {currentStep === 'bank-verify' && (
                  <motion.div
                    key="bank-step"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <BankVerifiedNameInput
                      onNameVerified={handleBankVerified}
                      onSkip={handleSkipToManual}
                    />
                    
                    <div className="text-center text-sm text-muted-foreground pt-6 mt-4 border-t border-border">
                      Already have an account?{" "}
                      <Link to="/login" className="text-primary hover:underline font-semibold">
                        Log In
                      </Link>
                    </div>
                  </motion.div>
                )}

                {/* STEP 2: Manual Name Entry */}
                {currentStep === 'manual-name' && (
                  <motion.div
                    key="manual-step"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <Alert className="bg-caution-muted border-caution text-caution-foreground">
                      <AlertCircle className="h-4 w-4 text-caution" />
                      <AlertDescription className="text-sm text-caution-foreground">
                        <strong>Use Your Real Name</strong>
                        <br />
                        This name will be locked permanently. It must match your bank account exactly for withdrawals.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name (as on bank account)</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="e.g. JOHN ADEBAYO OKONKWO" 
                                {...field}
                                className="text-lg"
                                autoFocus
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCurrentStep('state')}
                        className="flex-1 h-12"
                      >
                        Back
                      </Button>
                      <Button
                        type="button"
                        onClick={handleManualNameContinue}
                        disabled={!form.watch('fullName') || form.watch('fullName').length < 2}
                        className="flex-1 h-12"
                      >
                        Continue
                      </Button>
                    </div>


                    <div className="text-center text-sm text-muted-foreground pt-4 mt-2 border-t border-border">
                      Already have an account?{" "}
                      <Link to="/login" className="text-primary hover:underline font-semibold">
                        Log In
                      </Link>
                    </div>
                  </motion.div>
                )}


                {/* STEP 3: Complete Details */}
                {currentStep === 'details' && (
                  <motion.div
                    key="details-step"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Verified Name Badge */}
                    {verifiedBankData && (
                      <div className="mb-4 p-3 rounded-lg bg-success/10 border border-success/20">
                        <div className="flex items-center gap-2">
                          <Check className="w-5 h-5 text-success shrink-0" />
                          <div>
                            <p className="font-medium text-sm">{verifiedBankData.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Verified from {verifiedBankData.bankName}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Manual Name Display */}
                    {!verifiedBankData && (
                      <div className="mb-4 p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{form.watch('fullName')}</p>
                            <p className="text-xs text-muted-foreground">Your name</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleBackToBankVerify}
                            className="text-xs h-7"
                          >
                            Change
                          </Button>
                        </div>
                      </div>
                    )}

                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="phoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input 
                                type="tel"
                                placeholder="e.g. 08012345678" 
                                {...field}
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Your Nigerian phone number
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input 
                                type="email"
                                placeholder="your@email.com" 
                                {...field}
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  type={showPassword ? "text" : "password"}
                                  placeholder="At least 8 characters" 
                                  {...field}
                                  disabled={isSubmitting}
                                  className="pr-10"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword((v) => !v)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                                  tabIndex={-1}
                                  aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="referralCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Referral Code (Optional)</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter referral code if you have one" 
                                {...field}
                                disabled={isSubmitting || !!urlReferralCode}
                                readOnly={!!urlReferralCode}
                              />
                            </FormControl>
                            {urlReferralCode && (
                              <p className="text-xs text-muted-foreground">
                                You were invited! This code is locked.
                              </p>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="agreeToTerms"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm font-normal">
                                I agree to the{" "}
                                <Link to="/terms" className="text-primary hover:underline">
                                  Terms and Conditions
                                </Link>
                              </FormLabel>
                              <FormMessage />
                            </div>
                          </FormItem>
                        )}
                      />

                      <div className="flex gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleBackToBankVerify}
                          disabled={isSubmitting}
                          className="flex-1"
                        >
                          Back
                        </Button>
                        <Button 
                          type="submit" 
                          className="flex-1 gradient-primary hover:opacity-90"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            "Create Account"
                          )}
                        </Button>
                      </div>

                      <div className="text-center text-sm text-muted-foreground">
                        Already have an account?{" "}
                        <Link to="/login" className="text-primary hover:underline font-semibold">
                          Log In
                        </Link>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SignUp;
