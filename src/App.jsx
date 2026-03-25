import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { TenantProvider } from '@/lib/TenantContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import { TimezoneProvider } from '@/lib/TimezoneContext';
import TenantGuard from '@/components/shared/TenantGuard';
import { ErrorBoundary } from '@/lib/useErrorBoundary';
import AppLayout from './components/layout/AppLayout';
import Home from './pages/Home';
import Tolls from './pages/Tolls.jsx';
import TollUpload from './pages/TollUpload';
import Contracts from './pages/Contracts.jsx';
import ContractAdd from './pages/ContractAdd';
import Reports from './pages/Reports';
import Alerts from './pages/Alerts';
import VehicleAdd from './pages/VehicleAdd';
import Customers from './pages/Customers';
import AdminDashboard from './pages/AdminDashboard';
import Subscription from './pages/Subscription';
import Settings from './pages/Settings';
import FleetAnalytics from './pages/FleetAnalytics';
import TollMatchQueue from './pages/TollMatchQueue';
import GmailSyncLog from './pages/GmailSyncLog';
import UnmatchedTollQueue from './pages/UnmatchedTollQueue';
import AdminLogPage from './pages/AdminLog';
import DocumentScanner from './pages/DocumentScanner';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <span className="text-5xl">🚗</span>
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="font-bold text-muted-foreground text-sm">Loading FleetToll Pro...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <TenantProvider>
      <TenantGuard>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/tolls" element={<Tolls />} />
            <Route path="/tolls/upload" element={<TollUpload />} />
            <Route path="/contracts" element={<Contracts />} />
            <Route path="/contracts/add" element={<ContractAdd />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/vehicles/add" element={<VehicleAdd />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/analytics" element={<FleetAnalytics />} />
            <Route path="/match-queue" element={<TollMatchQueue />} />
            <Route path="/gmail-log" element={<GmailSyncLog />} />
            <Route path="/unmatched-queue" element={<UnmatchedTollQueue />} />
            <Route path="/admin-log" element={<AdminLogPage />} />
            <Route path="/scanner" element={<DocumentScanner />} />
          </Route>
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </TenantGuard>
    </TenantProvider>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <TimezoneProvider>
            <QueryClientProvider client={queryClientInstance}>
              <Router>
                <AuthenticatedApp />
              </Router>
              <Toaster />
            </QueryClientProvider>
          </TimezoneProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;