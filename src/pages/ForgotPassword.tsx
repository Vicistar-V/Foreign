import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Mail, CheckCircle, ArrowLeft } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { PageSEO } from "@/components/PageSEO";
import { Button } from "@/components/ui/button";
import { trackClarityEvent, ClarityEvents } from "@/lib/clarityTracking";

const forgotPasswordSchema = z.object({
  email: z.string()
    .trim()
    .min(1, "Please enter your email")
    .email("Please enter a valid email address")
    .max(255, "Email is too long")
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

const ForgotPassword = () => {
  const { resetPassword } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: ""
    }
  });

  const onSubmit = async (data: ForgotPasswordForm) => {
    setIsLoading(true);

    try {
      const { error } = await resetPassword(data.email);

      if (error) {
        trackClarityEvent(ClarityEvents.ERROR_PASSWORD_RESET);
        toast({
          title: "Something went wrong",
          description: "Please try again later or contact support.",
          variant: "destructive"
        });
        return;
      }

      // Success - show confirmation (Supabase doesn't reveal if email exists for security)
      setSentEmail(data.email);
      setIsEmailSent(true);
      toast({
        title: "Email sent!",
        description: "Check your inbox for the reset link."
      });
    } catch (err) {
      trackClarityEvent(ClarityEvents.ERROR_PASSWORD_RESET);
      toast({
        title: "Connection error",
        description: "Please check your internet and try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      <PageSEO
        title="Reset Password"
        description="Forgot your Viketa password? No problem! Enter your email and we'll send you a link to create a new password."
        path="/forgot-password"
        noIndex={true}
      />
      <PublicHeader />

      <div className="flex-1 flex items-center justify-center px-4 py-8 md:py-12 pb-24 md:pb-12">
        <Card className="w-full max-w-md shadow-medium">
          {!isEmailSent ? (
            <>
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl md:text-3xl font-bold text-center">
                  Forgot Your Password?
                </CardTitle>
                <CardDescription className="text-center text-base">
                  No worries! Enter your email and we'll send you a link to create a new password.
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
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="email"
                                placeholder="Enter your email"
                                className="pl-10"
                                disabled={isLoading}
                                {...field}
                              />
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
                          Sending...
                        </>
                      ) : (
                        "Send Reset Link"
                      )}
                    </Button>

                    <div className="text-center">
                      <Link
                        to="/login"
                        className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <ArrowLeft className="h-3 w-3" />
                        Back to Log In
                      </Link>
                    </div>
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
                  Check Your Email!
                </CardTitle>
                <CardDescription className="text-center text-base">
                  We sent a password reset link to{" "}
                  <span className="font-medium text-foreground">{sentEmail}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-2">Didn't get the email?</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Check your spam or junk folder</li>
                    <li>Make sure you entered the correct email</li>
                    <li>Wait a few minutes and try again</li>
                  </ul>
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setIsEmailSent(false);
                      form.reset();
                    }}
                  >
                    Try a different email
                  </Button>

                  <Link to="/login" className="w-full">
                    <Button variant="ghost" className="w-full">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Log In
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
