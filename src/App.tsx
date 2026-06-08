import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";

/* ── Lazy-loaded route chunks ─────────────────────────────────────────────── */
const Index              = lazy(() => import("./pages/Index"));
const NotFound           = lazy(() => import("./pages/NotFound"));
const CustomerDashboard  = lazy(() => import("./pages/customer/Dashboard"));
const CustomerClaims     = lazy(() => import("./pages/customer/Claims"));
const CustomerPayments   = lazy(() => import("./pages/customer/Payments"));
const CustomerProfile    = lazy(() => import("./pages/customer/Profile"));
const CustomerSettings   = lazy(() => import("./pages/customer/Settings"));
const CustomerPolicies   = lazy(() => import("./pages/customer/Policies"));
const AdminPortal        = lazy(() => import("./pages/admin/Portal"));
const ManagerDashboard   = lazy(() => import("./pages/admin/ManagerDashboard"));
const ManagerClaims      = lazy(() => import("./pages/admin/ManagerClaims"));
const ManagerAnalytics   = lazy(() => import("./pages/admin/ManagerAnalytics"));
const ManagerSettings    = lazy(() => import("./pages/admin/ManagerSettings"));
const OfficerDashboard   = lazy(() => import("./pages/admin/OfficerDashboard"));
const OfficerClaims      = lazy(() => import("./pages/admin/OfficerClaims"));
const OfficerPayments    = lazy(() => import("./pages/admin/OfficerPayments"));
const OfficerSettings    = lazy(() => import("./pages/admin/OfficerSettings"));
const AdminProfile       = lazy(() => import("./pages/admin/AdminProfile"));

/* ── Minimal route-transition skeleton ───────────────────────────────────── */
const PageSkeleton = () => (
  <div className="min-h-screen flex items-center justify-center bg-muted/20">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  </div>
);

/* ── QueryClient with sensible cache defaults ─────────────────────────────── */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // data stays fresh for 30 s → no re-fetch on tab switch
      gcTime: 5 * 60_000,       // unused cache kept for 5 min
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/" element={<Index />} />

              {/* Customer Routes */}
              <Route path="/dashboard" element={<CustomerDashboard />} />
              <Route path="/claims"    element={<CustomerClaims />} />
              <Route path="/payments"  element={<CustomerPayments />} />
              <Route path="/profile"   element={<CustomerProfile />} />
              <Route path="/settings"  element={<CustomerSettings />} />
              <Route path="/policies"  element={<CustomerPolicies />} />

              {/* Admin Portal Routes */}
              <Route path="/novaportal"                    element={<AdminPortal />} />
              <Route path="/novaportal/manager"            element={<ManagerDashboard />} />
              <Route path="/novaportal/manager/claims"     element={<ManagerClaims />} />
              <Route path="/novaportal/manager/analytics"  element={<ManagerAnalytics />} />
              <Route path="/novaportal/manager/settings"   element={<ManagerSettings />} />
              <Route path="/novaportal/officer"            element={<OfficerDashboard />} />
              <Route path="/novaportal/officer/claims"     element={<OfficerClaims />} />
              <Route path="/novaportal/officer/payments"   element={<OfficerPayments />} />
              <Route path="/novaportal/officer/settings"   element={<OfficerSettings />} />
              <Route path="/novaportal/officer/profile"    element={<AdminProfile role="officer" />} />
              <Route path="/novaportal/manager/profile"    element={<AdminProfile role="manager" />} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
