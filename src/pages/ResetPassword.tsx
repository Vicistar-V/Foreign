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
import { Loader2, Eye, EyeOff, CheckCircle, XCircle, Lock, ArrowLeft } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { Button } from "@/components/ui/button";

const resetPasswordSchema = z.object({
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-zA-Z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string()
    .min(1, "Please confirm your password")
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

const ResetPassword = () => {
  const { updatePassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: ""
    }
  });

  const newPassword = form.watch("newPassword");

  // Password strength checks
  const hasMinLength = newPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);

  // Check for valid password recovery session
  useEffect(() => {
    const checkSession = async () => {
      // First check if there's hash params in URL (Supabase adds tokens there)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');

      if (accessToken && type === 'recovery') {
        // Set the session using the recovery token
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: hashParams.get('refresh_token') || ''
        });

        if (error) {
          setIsValidSession(false);
          return;
        }
        
        setIsValidSession(true);
        return;
      }

      // Also listen for PASSWORD_RECOVERY event
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsValidSession(true);
        }
      });

      // Check if there's an existing session (user might have already been redirected)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsValidSession(true);
      } else {
        // Give a moment for the auth state to settle
        setTimeout(() => {
          if (isValidSession === null) {
            setIsValidSession(false);
          }
        }, 2000);
      }

      return () => subscription.unsubscribe();
    };

    checkSession();
  }, []);

  const onSubmit = async (data: ResetPasswordForm) => {
    setIsLoading(true);

    try {
      const { error } = await updatePassword(data.newPassword);

      if (error) {
        toast({
          title: "Failed to update password",
          description: error.message || "Please try again or request a new reset link.",
          variant: "destructive"
        });
        return;
      }

      setIsSuccess(true);
      toast({
        title: "Password updated!",
        description: "You can now log in with your new password."
      });

      // Sign out and redirect to login after a delay
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate("/login");
      }, 3000);
    } catch (err) {
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state while checking session
  if (isValidSession === null) {
    return (
      <div className="min-h-screen gradient-hero flex flex-col">
        <PublicHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Verifying your reset link...</p>
          </div>
        </div>
      </div>
    );
  }

  // Invalid or expired link
  if (isValidSession === false) {
    return (
      <div className="min-h-screen gradient-hero flex flex-col">
        <PublicHeader />
        <div className="flex-1 flex items-center justify-center px-4 py-8 md:py-12 pb-24 md:pb-12">
          <Card className="w-full max-w-md shadow-medium">
            <CardHeader className="space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-center">
                Link Expired or Invalid
              </CardTitle>
              <CardDescription className="text-center text-base">
                This password reset link has expired or is invalid. Please request a new one.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link to="/forgot-password" className="block">
                <Button className="w-full gradient-primary">
                  Request New Reset Link
                </Button>
              </Link>
              <Link to="/login" className="block">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Log In
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      <PublicHeader />

      <div className="flex-1 flex items-center justify-center px-4 py-8 md:py-12 pb-24 md:pb-12">
        <Card className="w-full max-w-md shadow-medium">
          {!isSuccess ? (
            <>
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl md:text-3xl font-bold text-center">
                  Create New Password
                </CardTitle>
                <CardDescription className="text-center text-base">
                  Choose a new password for your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type={showNewPassword ? "text" : "password"}
                                placeholder="Enter new password"
                                className="pl-10 pr-10"
                                disabled={isLoading}
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              >
                                {showNewPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Password Requirements */}
                    <div className="space-y-2 text-sm">
                      <p className="text-muted-foreground font-medium">Password must have:</p>
                      <ul className="space-y-1">
                        <li className={`flex items-center gap-2 ${hasMinLength ? 'text-primary' : 'text-muted-foreground'}`}>
                          {hasMinLength ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border border-muted-foreground" />
                          )}
                          At least 8 characters
                        </li>
                        <li className={`flex items-center gap-2 ${hasLetter ? 'text-primary' : 'text-muted-foreground'}`}>
                          {hasLetter ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border border-muted-foreground" />
                          )}
                          At least one letter
                        </li>
                        <li className={`flex items-center gap-2 ${hasNumber ? 'text-primary' : 'text-muted-foreground'}`}>
                          {hasNumber ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border border-muted-foreground" />
                          )}
                          At least one number
                        </li>
                      </ul>
                    </div>

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Confirm new password"
                                className="pl-10 pr-10"
                                disabled={isLoading}
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              >
                                {showConfirmPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full gradient-primary"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating Password...
                        </>
                      ) : (
                        "Update Password"
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="space-y-4">
                <div className="flex justify-center">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-2xl md:text-3xl font-bold text-center">
                  Password Changed!
                </CardTitle>
                <CardDescription className="text-center text-base">
                  Your password has been updated successfully. You'll be redirected to the login page in a moment.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/login" className="block">
                  <Button className="w-full gradient-primary">
                    Go to Log In Now
                  </Button>
                </Link>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
