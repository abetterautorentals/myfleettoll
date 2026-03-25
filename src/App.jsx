import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { TenantProvider } from '@/lib/TenantContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import { TimezoneProvider } from '@/lib/TimezoneContext';
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
import Settings from './pages/Settings';
import FleetAnalytics from './pages/FleetAnalytics';
import TollMatchQueue from './pages/TollMatchQueue';
import GmailSyncLog from './pages/GmailSyncLog';
import UnmatchedTollQueue from './pages/UnmatchedTollQueue';
import AdminLogPage from './pages/AdminLog';
import DocumentScanner from './pages/DocumentScanner';
import Subscription from './pages/Subscription';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1 } }
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TimezoneProvider>
          <TenantProvider>
            <Router>
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
              </Routes>
              <Toaster />
            </Router>
          </TenantProvider>
        </TimezoneProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
