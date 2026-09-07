import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AppLayout } from "@/components/AppLayout";
import { AdminLayout } from "@/components/AdminLayout";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import { BroadcastModalProvider } from "@/components/BroadcastModalProvider";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { useAdminRole } from "@/hooks/useAdminRole";

// Import route configuration (single source of truth)
import { appRoutes } from "@/config/routes";

// Page imports
import Index from "./pages/Index";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";

import Invite from "./pages/Invite";
import Transactions from "./pages/Transactions";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import CreatePin from "./pages/CreatePin";
import SetProfilePicture from "./pages/SetProfilePicture";
import ChangePin from "./pages/ChangePin";
import ChangePassword from "./pages/ChangePassword";
import Admin from "./pages/Admin";
import AdminEconomy from "./pages/AdminEconomy";
import AdminUsers from "./pages/AdminUsers";
import AdminNotifications from "./pages/AdminNotifications";
import AdminBroadcastDetail from "./pages/AdminBroadcastDetail";
import AdminWithdrawals from "./pages/AdminWithdrawals";
import AdminDeposits from "./pages/AdminDeposits";
import AdminLogs from "./pages/AdminLogs";
import AdminReferrals from "./pages/AdminReferrals";
import AdminControls from "./pages/AdminControls";
import AdminMoniepoint from "./pages/AdminMoniepoint";

import AdminPayments from "./pages/AdminPayments";
import Withdraw from "./pages/Withdraw";
import AdminGallery from "./pages/AdminGallery";
import AdminSandbox from "./pages/AdminSandbox";


import AdminUserDetails from "./pages/AdminUserDetails";
import NotFound from "./pages/NotFound";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import { ProtectedAdminRoute } from "./components/ProtectedAdminRoute";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { MemberOnlyRoute } from "./components/MemberOnlyRoute";
import { MembershipDrawerProvider } from "./context/MembershipDrawerContext";
import { TourProvider } from "./context/TourContext";
import { TourSpotlight } from "./components/onboarding/TourSpotlight";
import { InstallAppPrompt } from "./components/InstallAppPrompt";
import { CloakGate } from "./components/CloakGate";
import { ImpersonationBanner } from "./components/ImpersonationBanner";


import Results from "./pages/Results";
import PublicResults from "./pages/PublicResults";
import HowItWorks from "./pages/HowItWorks";
import FAQ from "./pages/FAQ";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Support from "./pages/Support";
import AdminSupport from "./pages/AdminSupport";
import DailyTask from "./pages/DailyTask";
import WatchFirst from "./pages/WatchFirst";
import ActivationSuccess from "./pages/ActivationSuccess";

// Export queryClient so it can be cleared on logout
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes default
      gcTime: 30 * 60 * 1000, // 30 minutes cache
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnReconnect: false, // Don't refetch on reconnect
      retry: 1, // Only retry once
    },
  },
});

const MaintenanceGuard = ({ children }: { children: React.ReactNode }) => {
  const { data: config } = usePlatformConfig();
  const { data: adminRole } = useAdminRole();
  
  if (config?.maintenance_mode && !adminRole) {
    return <MaintenanceScreen />;
  }
  
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <TourProvider>
          <BroadcastModalProvider>
          <ScrollToTop />
          <TourSpotlight />
          <InstallAppPrompt />
          <ImpersonationBanner />
          {/* CloakGate disabled — re-wrap <Routes> with <CloakGate>...</CloakGate> to re-enable */}
          <CloakGate>
            <Routes>

          {/* Public pages */}
          <Route path={appRoutes.home.path} element={<Index />} />
          <Route path={appRoutes.winners.path} element={<PublicResults />} />
          <Route path={appRoutes.howItWorks.path} element={<HowItWorks />} />
          <Route path={appRoutes.faq.path} element={<FAQ />} />
          <Route path={appRoutes.blog.path} element={<Blog />} />
          <Route path={appRoutes.blogPost.path} element={<BlogPost />} />
          <Route path={appRoutes.terms.path} element={<Terms />} />
          <Route path={appRoutes.privacy.path} element={<Privacy />} />
          
          {/* Auth pages */}
          <Route path={appRoutes.signup.path} element={<SignUp />} />
          <Route path={appRoutes.signupWithReferral.path} element={<SignUp />} />
          <Route path={appRoutes.joinWithReferral.path} element={<SignUp />} />
          <Route path={appRoutes.watchFirst.path} element={<WatchFirst />} />
          <Route path={appRoutes.login.path} element={<Login />} />
          <Route path={appRoutes.forgotPassword.path} element={<ForgotPassword />} />
          <Route path={appRoutes.resetPassword.path} element={<ResetPassword />} />
          
          {/* Protected PIN/Password routes */}
          <Route path={appRoutes.activationSuccess.path} element={<ProtectedRoute><MembershipDrawerProvider><ActivationSuccess /></MembershipDrawerProvider></ProtectedRoute>} />
          <Route path={appRoutes.createPin.path} element={<ProtectedRoute><CreatePin /></ProtectedRoute>} />
          <Route path={appRoutes.changePin.path} element={<ProtectedRoute><ChangePin /></ProtectedRoute>} />
          <Route path={appRoutes.changePassword.path} element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
          
          {/* Protected routes with shared layout */}
          <Route element={
            <ProtectedRoute>
              <MaintenanceGuard>
                <AppLayout />
              </MaintenanceGuard>
            </ProtectedRoute>
          }>
            <Route path={appRoutes.dashboard.path} element={<Dashboard />} />
            <Route path="/wallets" element={<Navigate to="/transactions" replace />} />
            <Route path={appRoutes.invite.path} element={
              <MemberOnlyRoute featureName="Referrer">{<Invite />}</MemberOnlyRoute>
            } />
            <Route path={appRoutes.transactions.path} element={
              <MemberOnlyRoute featureName="Transactions">{<Transactions />}</MemberOnlyRoute>
            } />
            <Route path={appRoutes.profile.path} element={
              <MemberOnlyRoute featureName="Profile">{<Profile />}</MemberOnlyRoute>
            } />
            <Route path={appRoutes.notifications.path} element={
              <MemberOnlyRoute featureName="Notifications">{<Notifications />}</MemberOnlyRoute>
            } />
            <Route path={appRoutes.results.path} element={
              <MemberOnlyRoute featureName="Results">{<Results />}</MemberOnlyRoute>
            } />
            <Route path={appRoutes.setProfilePicture.path} element={<SetProfilePicture />} />
            <Route path={appRoutes.support.path} element={<Support />} />
            <Route path={appRoutes.withdraw.path} element={
              <MemberOnlyRoute featureName="Withdraw">{<Withdraw />}</MemberOnlyRoute>
            } />
          </Route>

          {/* Daily Task: full-screen, NOT inside AppLayout (no nav chrome) */}
          <Route path="/task" element={
            <ProtectedRoute>
              <MaintenanceGuard>
                <MembershipDrawerProvider>
                  <DailyTask />
                </MembershipDrawerProvider>
              </MaintenanceGuard>
            </ProtectedRoute>
          } />

          {/* Legacy aliases — keep for one release */}
          <Route path="/calibrate" element={<Navigate to="/task" replace />} />
          <Route path="/daily-task" element={<Navigate to="/task" replace />} />

          {/* Admin routes with dedicated admin layout */}
          <Route element={
            <ProtectedAdminRoute>
              <AdminLayout />
            </ProtectedAdminRoute>
          }>
            <Route path={appRoutes.admin.path} element={<Admin />} />
            <Route path={appRoutes.adminUsers.path} element={<AdminUsers />} />
            <Route path={appRoutes.adminUserDetails.path} element={<AdminUserDetails />} />
            <Route path={appRoutes.adminWithdrawals.path} element={<AdminWithdrawals />} />
            <Route path={appRoutes.adminDeposits.path} element={<AdminDeposits />} />
            <Route path={appRoutes.adminLogs.path} element={<AdminLogs />} />
            <Route path={appRoutes.adminReferrals.path} element={<AdminReferrals />} />
            <Route path={appRoutes.adminNotifications.path} element={<AdminNotifications />} />
            <Route path={appRoutes.adminBroadcastDetail.path} element={<AdminBroadcastDetail />} />
            <Route path={appRoutes.adminEconomy.path} element={<AdminEconomy />} />
            <Route path={appRoutes.adminControls.path} element={<AdminControls />} />
            <Route path="/admin/payments" element={<AdminPayments />} />
            {/* Legacy route: lands on the Payments page with Flutterwave tab pre-selected */}
            <Route path="/admin/flutterwave" element={<AdminPayments defaultProvider="flutterwave" />} />
            <Route path="/admin/deposit-method" element={<ProtectedAdminRoute><AdminMoniepoint /></ProtectedAdminRoute>} />
            {/* Legacy URL kept working */}
            <Route path="/admin/moniepoint" element={<ProtectedAdminRoute><AdminMoniepoint /></ProtectedAdminRoute>} />

            <Route path={appRoutes.adminSupport.path} element={<AdminSupport />} />
            <Route path={appRoutes.adminGallery.path} element={<AdminGallery />} />
            <Route path="/admin/sandbox" element={<AdminSandbox />} />

            
          </Route>
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </CloakGate>
          {/* /CloakGate */}
          </BroadcastModalProvider>
          </TourProvider>
        </BrowserRouter>

        </TooltipProvider>
      </ThemeProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
