import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CloakGate } from "./components/CloakGate";
import { MoniepointDrawerHost } from "./components/MoniepointDrawerHost";

// Only import what this funnel actually uses
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Global cache config
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <ThemeProvider>
        <TooltipProvider>
          {/* Toast notifications for "Copied Account Number" */}
          <Toaster />
          <Sonner />

          <BrowserRouter>
            {/* Global Moniepoint Drawer: Listens to the 'Get Access' button */}
            <MoniepointDrawerHost />

            {/* Cloak Gate handles displaying your stripped CloakLanding page */}
            <CloakGate>
              <Routes>
                {/* Main entry point */}
                <Route path="/" element={<Index />} />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </CloakGate>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
