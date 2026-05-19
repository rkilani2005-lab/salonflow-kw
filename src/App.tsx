import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { TenantThemeProvider, PoweredByFooter } from "@/contexts/TenantThemeContext";
import { lazy, Suspense } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import SuperAdminRoute from "@/components/admin/SuperAdminRoute";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AdminLayout from "@/components/admin/AdminLayout";

// ── Lazy-loaded pages (each becomes its own JS chunk) ─────────
// Critical path: Landing + Auth load eagerly (no layout shift)
import Landing from "./pages/Landing";
import Auth    from "./pages/Auth";

// All other pages load on demand — 2.2MB → ~300KB initial bundle
const Dashboard        = lazy(() => import("./pages/Dashboard"));
const Inbox            = lazy(() => import("./pages/Inbox"));
const Calendar         = lazy(() => import("./pages/Calendar"));
const Booking          = lazy(() => import("./pages/Booking"));
const Onboarding       = lazy(() => import("./pages/Onboarding"));
const Subscription     = lazy(() => import("./pages/Subscription"));
const Clients          = lazy(() => import("./pages/Clients"));
const Staff            = lazy(() => import("./pages/Staff"));
const Services         = lazy(() => import("./pages/Services"));
const Reports          = lazy(() => import("./pages/Reports"));
const Settings         = lazy(() => import("./pages/Settings"));
const WhatsAppAgent    = lazy(() => import("./pages/WhatsAppAgent"));
const Inventory        = lazy(() => import("./pages/Inventory"));
const POS              = lazy(() => import("./pages/POS"));
const DaySession       = lazy(() => import("./pages/DaySession"));
const TeamUsers        = lazy(() => import("./pages/TeamUsers"));
const GiftCardsAndPromos = lazy(() => import("./pages/GiftCardsAndPromos"));
const ReorderReport    = lazy(() => import("./pages/ReorderReport"));
const StaffAttendance  = lazy(() => import("./pages/StaffAttendance"));
const WaitingList      = lazy(() => import("./pages/WaitingList"));
const ClientFeedback   = lazy(() => import("./pages/ClientFeedback"));
const Packages         = lazy(() => import("./pages/Packages"));
const MyDay            = lazy(() => import("./pages/MyDay"));
const BackBarVariance  = lazy(() => import("./pages/BackBarVariance"));
const BookingRequests  = lazy(() => import("./pages/BookingRequests"));
const ClientPortal     = lazy(() => import("./pages/ClientPortal"));
const NotFound         = lazy(() => import("./pages/NotFound"));

// Finance module (heavy — always lazy)
const FinanceHub       = lazy(() => import("./pages/finance/FinanceHub"));
const ProfitLoss       = lazy(() => import("./pages/finance/ProfitLoss"));
const ExpenseManager   = lazy(() => import("./pages/finance/ExpenseManager"));
const GeneralLedger    = lazy(() => import("./pages/finance/GeneralLedger"));
const CheckRegister    = lazy(() => import("./pages/finance/CheckRegister"));
const LoanManager      = lazy(() => import("./pages/finance/LoanManager"));
const ChartOfAccounts  = lazy(() => import("./pages/finance/ChartOfAccounts"));
const ARInvoices       = lazy(() => import("./pages/finance/ARInvoices"));
const GLConfig         = lazy(() => import("./pages/finance/GLConfig"));

// AI module (lazy — rarely used)
const AIScheduling        = lazy(() => import("./pages/AIScheduling"));
const AIClientIntelligence = lazy(() => import("./pages/AIClientIntelligence"));
const AIInventory         = lazy(() => import("./pages/AIInventory"));

// Admin panel (lazy — owner only, different user type)
const AdminDashboard      = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminTenants        = lazy(() => import("./pages/admin/AdminTenants"));
const AdminSubscriptions  = lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminAnalytics      = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminLogin          = lazy(() => import("./pages/admin/AdminLogin"));
const AdminFinance        = lazy(() => import("./pages/admin/AdminFinance"));
const AdminAccounts       = lazy(() => import("./pages/admin/AdminAccounts"));

// ── Page loading fallback ─────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <p className="text-xs text-muted-foreground font-medium tracking-wider uppercase">Loading</p>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:  30_000,       // data fresh for 30s — stops refetch on every mount
      gcTime:     5 * 60_000,   // keep in cache 5 min after last subscriber
      retry:      1,            // only retry once on failure (default 3 = slow UX)
      refetchOnWindowFocus: false, // stop re-fetching when user tabs back in
    },
    mutations: {
      retry: 0,                 // never retry mutations (prevent duplicate inserts)
    },
  },
});

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
      <TenantThemeProvider>
      {/* Bug 4 fix: LanguageProvider correctly wraps the whole app */}
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <PoweredByFooter />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/book" element={<Booking />} />
              <Route path="/booking/success" element={<Booking />} />
              <Route path="/booking/failed" element={<Booking />} />
              <Route path="/my"     element={<ClientPortal />} />
              <Route path="/portal" element={<ClientPortal />} />

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
                <Route path="/inbox" element={<Inbox />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/staff" element={<Staff />} />
                <Route path="/services" element={<Services />} />
                <Route path="/pos" element={<POS />} />
                <Route path="/day-session" element={<DaySession />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings"    element={<Settings />} />
                <Route path="/team"        element={<TeamUsers />} />
                <Route path="/marketing"   element={<GiftCardsAndPromos />} />
                <Route path="/inventory/reorder" element={<ReorderReport />} />
                <Route path="/attendance"  element={<StaffAttendance />} />
                <Route path="/waitlist"    element={<WaitingList />} />
                <Route path="/feedback"         element={<ClientFeedback />} />
                <Route path="/packages"         element={<Packages />} />
                <Route path="/booking-requests" element={<BookingRequests />} />
                <Route path="/my-day" element={<MyDay />} />
                <Route path="/reports/back-bar-variance" element={<BackBarVariance />} />
                <Route path="/subscription" element={<Subscription />} />
              <Route path="/ai/scheduling" element={<AIScheduling />} />
              <Route path="/ai/clients" element={<AIClientIntelligence />} />
              <Route path="/ai/inventory" element={<AIInventory />} />
              <Route path="/finance" element={<FinanceHub />} />
              <Route path="/finance/pnl" element={<ProfitLoss />} />
              <Route path="/finance/expenses" element={<ExpenseManager />} />
              <Route path="/finance/ledger" element={<GeneralLedger />} />
              <Route path="/finance/checks" element={<CheckRegister />} />
              <Route path="/finance/loans" element={<LoanManager />} />
              <Route path="/finance/accounts" element={<ChartOfAccounts />} />
              <Route path="/finance/invoices" element={<ARInvoices />} />
              <Route path="/finance/gl-config" element={<GLConfig />} />
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
                <Route path="/zaina-admin/finance" element={<AdminFinance />} />
                <Route path="/zaina-admin/accounts" element={<AdminAccounts />} />
              </Route>

              {/* Legacy /admin/* redirects → /zaina-admin/* for backwards compatibility */}
              <Route path="/admin" element={<Navigate to="/zaina-admin" replace />} />
              <Route path="/admin/*" element={<Navigate to="/zaina-admin" replace />} />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
      </TenantThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
