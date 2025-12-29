import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import CustomerDashboard from "./pages/customer/Dashboard";
import CustomerClaims from "./pages/customer/Claims";
import CustomerPayments from "./pages/customer/Payments";
import AdminPortal from "./pages/admin/Portal";
import ManagerDashboard from "./pages/admin/ManagerDashboard";
import ManagerClaims from "./pages/admin/ManagerClaims";
import ManagerAnalytics from "./pages/admin/ManagerAnalytics";
import ManagerSettings from "./pages/admin/ManagerSettings";
import OfficerDashboard from "./pages/admin/OfficerDashboard";
import OfficerClaims from "./pages/admin/OfficerClaims";
import OfficerPayments from "./pages/admin/OfficerPayments";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />

            {/* Customer Routes */}
            <Route path="/dashboard" element={<CustomerDashboard />} />
            <Route path="/claims" element={<CustomerClaims />} />
            <Route path="/payments" element={<CustomerPayments />} />

            {/* Admin Portal Routes */}
            <Route path="/novaportal" element={<AdminPortal />} />
            <Route path="/novaportal/manager" element={<ManagerDashboard />} />
            <Route path="/novaportal/manager/claims" element={<ManagerClaims />} />
            <Route path="/novaportal/manager/analytics" element={<ManagerAnalytics />} />
            <Route path="/novaportal/manager/settings" element={<ManagerSettings />} />
            <Route path="/novaportal/officer" element={<OfficerDashboard />} />
            <Route path="/novaportal/officer/claims" element={<OfficerClaims />} />
            <Route path="/novaportal/officer/payments" element={<OfficerPayments />} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
