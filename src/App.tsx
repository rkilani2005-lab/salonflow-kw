import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import SuperAdminRoute from "@/components/admin/SuperAdminRoute";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AdminLayout from "@/components/admin/AdminLayout";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Calendar from "./pages/Calendar";
import Booking from "./pages/Booking";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Subscription from "./pages/Subscription";
import Clients from "./pages/Clients";
import Staff from "./pages/Staff";
import Services from "./pages/Services";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import WhatsAppAgent from "./pages/WhatsAppAgent";
import Inventory from "./pages/Inventory";
import POS from "./pages/POS";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminTenants from "./pages/admin/AdminTenants";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminLogin from "./pages/admin/AdminLogin";
import AIScheduling from "./pages/AIScheduling";
import AIClientIntelligence from "./pages/AIClientIntelligence";
import AIInventory from "./pages/AIInventory";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Bug 6 fix: ComingSoon must be defined BEFORE App so it is in scope when routes render
const ComingSoon = ({ title }: { title: string }) => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
      <p className="text-muted-foreground">This feature is coming soon!</p>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      {/* Bug 4 fix: LanguageProvider correctly wraps the whole app */}
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/book" element={<Booking />} />
              <Route path="/booking/success" element={<Booking />} />
              <Route path="/booking/failed" element={<Booking />} />

              {/* Protected onboarding route (no layout) */}
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <Onboarding />
                  </ProtectedRoute>
                }
              />

              {/* WhatsApp Agent - standalone page with its own layout */}
              <Route
                path="/whatsapp-agent"
                element={
                  <ProtectedRoute allowSuperAdmin={true}>
                    <WhatsAppAgent />
                  </ProtectedRoute>
                }
              />

              {/* Protected routes with dashboard layout */}
              <Route
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/staff" element={<Staff />} />
                <Route path="/services" element={<Services />} />
                <Route path="/pos" element={<POS />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/subscription" element={<Subscription />} />
              <Route path="/ai/scheduling" element={<AIScheduling />} />
              <Route path="/ai/clients" element={<AIClientIntelligence />} />
              <Route path="/ai/inventory" element={<AIInventory />} />
              </Route>

              {/* Super Admin routes — all under /zaina-admin/ */}
              {/* Public admin login — no auth guard needed */}
              <Route path="/zaina-admin/login" element={<AdminLogin />} />

              {/* Protected admin routes */}
              <Route
                element={
                  <SuperAdminRoute>
                    <AdminLayout />
                  </SuperAdminRoute>
                }
              >
                <Route path="/zaina-admin" element={<AdminDashboard />} />
                <Route path="/zaina-admin/tenants" element={<AdminTenants />} />
                <Route path="/zaina-admin/subscriptions" element={<AdminSubscriptions />} />
                <Route path="/zaina-admin/analytics" element={<AdminAnalytics />} />
                <Route path="/zaina-admin/users" element={<ComingSoon title="User Management" />} />
                <Route path="/zaina-admin/settings" element={<ComingSoon title="Admin Settings" />} />
              </Route>

              {/* Legacy /admin/* redirects → /zaina-admin/* for backwards compatibility */}
              <Route path="/admin" element={<Navigate to="/zaina-admin" replace />} />
              <Route path="/admin/*" element={<Navigate to="/zaina-admin" replace />} />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
