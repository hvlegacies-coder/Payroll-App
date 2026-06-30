import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import UploadCenter from "./pages/UploadCenter";
import PayrollProcessing from "./pages/PayrollProcessing";
import BackendTable from "./pages/BackendTable";
import Advances from "./pages/Advances";
import LookupManagement from "./pages/LookupManagement";
import Clients from "./pages/Clients";
import Preparers from "./pages/Preparers";
import Offices from "./pages/Offices";
import FeeIntercept from "./pages/FeeIntercept";
import OfficeReportPage from "./pages/OfficeReportPage";
import OfficeHierarchy from "./pages/OfficeHierarchy";
import HigherViewDetail from "./pages/HigherViewDetail";
import Reports from "./pages/Reports";
import ExportsEmails from "./pages/ExportsEmails";
import AuditLog from "./pages/AuditLog";
import ProcessingLogsPage from "./pages/ProcessingLogsPage";
import SystemLogicPage from "./pages/SystemLogicPage";
import DataDictionaryPage from "./pages/DataDictionaryPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import DebugIntegrity from "./pages/DebugIntegrity";
import Login from "./pages/Login";
import KingJLogin from "./pages/KingJLogin";
import PreparerLogin from "./pages/PreparerLogin";
import MyEarnings from "./pages/MyEarnings";
import Unsubscribe from "./pages/Unsubscribe";
import { ActiveWeekProvider } from "./hooks/useActiveWeek";
import { AdminLockProvider } from "./hooks/useAdminLock";
import { AdminLockDialog } from "./components/AdminLockDialog";
import { AdminRouteGuard } from "./components/AdminRouteGuard";
import { AccountProvider } from "@/contexts/AccountContext";
import { AlignmentProvider } from "@/contexts/AlignmentContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AccountsPage from "./pages/AccountsPage";
import SubAccountDashboard from "./pages/SubAccountDashboard";
import SubLogin from "./pages/SubLogin";
import { SubAccountLayout } from "./components/layout/SubAccountLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ActiveWeekProvider>
      <BrowserRouter>
        <AuthProvider>
        <AccountProvider>
        <AlignmentProvider>
        <AdminLockProvider>
        <AdminLockDialog />
        <Routes>
          <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />
          <Route path="/login/kingj" element={<KingJLogin />} />
          <Route path="/login/sub" element={<SubLogin />} />
          <Route path="/preparer-login" element={<PreparerLogin />} />
          <Route path="/my-earnings" element={<ErrorBoundary><MyEarnings /></ErrorBoundary>} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/" element={<Navigate to="/upload" replace />} />
            <Route path="/upload" element={<ErrorBoundary><UploadCenter /></ErrorBoundary>} />
            <Route path="/payroll" element={<ErrorBoundary><PayrollProcessing /></ErrorBoundary>} />
            <Route path="/backend" element={<ErrorBoundary><BackendTable /></ErrorBoundary>} />
            <Route path="/advances" element={<ErrorBoundary><Advances /></ErrorBoundary>} />
            <Route path="/lookup" element={<ErrorBoundary><LookupManagement /></ErrorBoundary>} />
            <Route path="/clients" element={<ErrorBoundary><Clients /></ErrorBoundary>} />
            <Route path="/preparers" element={<ErrorBoundary><Preparers /></ErrorBoundary>} />
            <Route path="/offices" element={<ErrorBoundary><Offices /></ErrorBoundary>} />
            <Route path="/offices/:officeName" element={<ErrorBoundary><OfficeReportPage /></ErrorBoundary>} />
            <Route path="/office-hierarchy" element={<ErrorBoundary><OfficeHierarchy /></ErrorBoundary>} />
            <Route path="/fee-intercept" element={<ErrorBoundary><FeeIntercept /></ErrorBoundary>} />
            <Route path="/higher-view" element={<ErrorBoundary><HigherViewDetail /></ErrorBoundary>} />
            <Route path="/reports" element={<ErrorBoundary><Reports /></ErrorBoundary>} />
            <Route path="/exports" element={<ErrorBoundary><ExportsEmails /></ErrorBoundary>} />
            <Route path="/inbox" element={<ErrorBoundary><ExportsEmails /></ErrorBoundary>} />
            <Route path="/sent" element={<ErrorBoundary><ExportsEmails /></ErrorBoundary>} />
            <Route path="/audit" element={<AdminRouteGuard><ErrorBoundary><AuditLog /></ErrorBoundary></AdminRouteGuard>} />
            <Route path="/processing-logs" element={<AdminRouteGuard><ErrorBoundary><ProcessingLogsPage /></ErrorBoundary></AdminRouteGuard>} />
            <Route path="/system-logic" element={<AdminRouteGuard><ErrorBoundary><SystemLogicPage /></ErrorBoundary></AdminRouteGuard>} />
            <Route path="/data-dictionary" element={<AdminRouteGuard><ErrorBoundary><DataDictionaryPage /></ErrorBoundary></AdminRouteGuard>} />
            <Route path="/settings" element={<AdminRouteGuard><ErrorBoundary><SettingsPage /></ErrorBoundary></AdminRouteGuard>} />
            <Route path="/accounts" element={<AdminRouteGuard><ErrorBoundary><AccountsPage /></ErrorBoundary></AdminRouteGuard>} />
            <Route path="/debug/integrity" element={<AdminRouteGuard><ErrorBoundary><DebugIntegrity /></ErrorBoundary></AdminRouteGuard>} />
          </Route>
          <Route element={<ProtectedRoute require="sub"><SubAccountLayout /></ProtectedRoute>}>
            <Route path="/sub/:slug" element={<ErrorBoundary><SubAccountDashboard /></ErrorBoundary>} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        </AdminLockProvider>
        </AlignmentProvider>
        </AccountProvider>
        </AuthProvider>
      </BrowserRouter>
      </ActiveWeekProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
