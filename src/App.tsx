import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// ─── Lazy-load every page — reduces initial bundle from 3MB → ~400KB ──────────
const DashboardPage       = lazy(() => import("./pages/DashboardPage"));
const LeadsPage           = lazy(() => import("./pages/LeadsPage"));
const LeadDetailPage      = lazy(() => import("./pages/LeadDetailPage"));
const BuyerMatchingPage   = lazy(() => import("./pages/BuyerMatchingPage"));
const ColdCallsPage       = lazy(() => import("./pages/ColdCallsPage"));
const CalendarPage        = lazy(() => import("./pages/CalendarPage"));
const TasksPage           = lazy(() => import("./pages/TasksPage"));
const PropertiesPage      = lazy(() => import("./pages/PropertiesPage"));
const PlotsPage           = lazy(() => import("./pages/PlotsPage"));
const TemplatesPage       = lazy(() => import("./pages/TemplatesPage"));
const ReportsPage         = lazy(() => import("./pages/ReportsPage"));
const SettingsPage        = lazy(() => import("./pages/SettingsPage"));
const AuthPage            = lazy(() => import("./pages/AuthPage"));
const SetupPage           = lazy(() => import("./pages/SetupPage"));
const OutreachCenterPage  = lazy(() => import("./pages/OutreachCenterPage"));
const AllLeadsPage        = lazy(() => import("./pages/AllLeadsPage"));
const LeadGenerationPage  = lazy(() => import("./pages/LeadGenerationPage"));
const NotFound            = lazy(() => import("./pages/NotFound"));

// ─── Minimal page-level loader ────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen bg-[hsl(220,25%,8%)]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-[hsl(220,20%,18%)]" />
          <div className="absolute inset-0 rounded-full border-2 border-t-white animate-spin" />
        </div>
        <span className="text-[11px] text-[hsl(220,10%,40%)] font-medium tracking-wider uppercase">
          Land OS
        </span>
      </div>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      // Don't refetch on window focus for GIS data — expensive
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/setup" element={<ProtectedRoute><SetupPage /></ProtectedRoute>} />
              <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/leads" element={<ProtectedRoute><LeadsPage /></ProtectedRoute>} />
              <Route path="/leads/:id" element={<ProtectedRoute><LeadDetailPage /></ProtectedRoute>} />
              <Route path="/leads/:id/matching" element={<ProtectedRoute><BuyerMatchingPage /></ProtectedRoute>} />
              <Route path="/cold-calls" element={<ProtectedRoute><ColdCallsPage /></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
              <Route path="/tasks" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
              <Route path="/properties" element={<ProtectedRoute><PropertiesPage /></ProtectedRoute>} />
              <Route path="/plots" element={<ProtectedRoute><PlotsPage /></ProtectedRoute>} />
              <Route path="/templates" element={<ProtectedRoute><TemplatesPage /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/outreach" element={<ProtectedRoute><OutreachCenterPage /></ProtectedRoute>} />
              <Route path="/all-leads" element={<ProtectedRoute><AllLeadsPage /></ProtectedRoute>} />
              <Route path="/lead-generation" element={<ProtectedRoute><LeadGenerationPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
