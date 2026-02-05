import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Calendar from "./pages/Calendar";
import Booking from "./pages/Booking";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Subscription from "./pages/Subscription";
import Clients from "./pages/Clients";
 import Staff from "./pages/Staff";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/book" element={<Booking />} />
            <Route path="/booking/success" element={<Booking />} />
            <Route path="/booking/failed" element={<Booking />} />
            
            {/* Protected onboarding route (no layout) */}
            <Route path="/onboarding" element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            } />
            
            {/* Protected routes with dashboard layout */}
            <Route element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route path="/" element={<Calendar />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/clients" element={<Clients />} />
               <Route path="/staff" element={<Staff />} />
              <Route path="/services" element={<ComingSoon title="Services" />} />
              <Route path="/pos" element={<ComingSoon title="Point of Sale" />} />
              <Route path="/inventory" element={<ComingSoon title="Inventory" />} />
              <Route path="/reports" element={<ComingSoon title="Reports" />} />
              <Route path="/settings" element={<ComingSoon title="Settings" />} />
              <Route path="/subscription" element={<Subscription />} />
            </Route>
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

// Placeholder component for unimplemented pages
const ComingSoon = ({ title }: { title: string }) => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
      <p className="text-muted-foreground">This feature is coming soon!</p>
    </div>
  </div>
);

export default App;
