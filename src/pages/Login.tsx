import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { PageSEO } from "@/components/PageSEO";
import { Button } from "@/components/ui/button";
import { trackClarityEvent, ClarityEvents } from "@/lib/clarityTracking";
import { trackLogRocketEvent, LREvents } from "@/lib/logrocket";

const loginSchema = z.object({
  email: z.string()
    .email("Please enter a valid email address"),
  password: z.string()
    .min(1, "Please enter your password")
});

type LoginForm = z.infer<typeof loginSchema>;

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, user, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);

  const onSubmit = async (data: LoginForm) => {
    setIsSubmitting(true);
    try {
      const { error } = await signIn(data.email, data.password);

      if (error) {
        // Handle specific error cases
        if (error.message.includes('Invalid login credentials')) {
          trackClarityEvent(ClarityEvents.ERROR_LOGIN_INVALID_CREDENTIALS);
          toast({
            title: "Login Failed",
            description: "Wrong email or password. Please check and try again.",
            variant: "destructive"
          });
        } else if (error.message.includes('Email not confirmed')) {
          trackClarityEvent(ClarityEvents.ERROR_LOGIN_EMAIL_NOT_VERIFIED);
          toast({
            title: "Email Not Verified",
            description: "Please check your email and verify your account first.",
            variant: "destructive"
          });
        } else {
          trackClarityEvent(ClarityEvents.ERROR_LOGIN_GENERAL);
          toast({
            title: "Login Failed",
            description: error.message,
            variant: "destructive"
          });
        }
        return;
      }

      // Check if user is banned (CRITICAL SECURITY CHECK)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileRaw, error: profileError } = await supabase.rpc('get_my_profile');
        const profile = profileRaw as { is_banned?: boolean; banned_reason?: string | null } | null;

        if (profileError) {
          console.error('Failed to fetch profile:', profileError);
          trackClarityEvent(ClarityEvents.ERROR_LOGIN_GENERAL);
          await supabase.auth.signOut();
          toast({
            title: "Error",
            description: "Failed to verify account status. Please try again.",
            variant: "destructive"
          });
          return;
        }

        if (profile?.is_banned) {
          trackClarityEvent(ClarityEvents.ERROR_LOGIN_BANNED);
          await supabase.auth.signOut();
          toast({
            title: "Account Suspended",
            description: profile.banned_reason || "Your account has been suspended. Contact support for more information.",
            variant: "destructive"
          });
          return;
        }
      }

      trackClarityEvent(ClarityEvents.LOGIN_SUCCESS);
      trackLogRocketEvent(LREvents.LOGIN_COMPLETED, { email: data.email });

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (error: any) {
      trackClarityEvent(ClarityEvents.ERROR_LOGIN_GENERAL);
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
        title="Login - Access Your Account"
        description="Log in to your Viketa account. Access your wallet, check your earnings, and manage your ad shares. Welcome back!"
        path="/login"
        image="/og-login.png"
      />
      <PublicHeader />

      {/* Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 md:py-12 pb-24 md:pb-12">
        <Card className="w-full max-w-md shadow-medium">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl md:text-3xl font-bold text-center">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-center">
              Log in to access your Viketa account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                            placeholder="Enter your password" 
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

                <div className="text-right">
                  <Link
                    to="/forgot-password"
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>

                <Button
                  type="submit" 
                  className="w-full gradient-primary hover:opacity-90"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging In...
                    </>
                  ) : (
                    "Log In"
                  )}
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <Link to="/signup" className="text-primary hover:underline font-semibold">
                    Sign Up
                  </Link>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;