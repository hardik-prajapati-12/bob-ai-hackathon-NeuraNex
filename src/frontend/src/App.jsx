import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Layout
import Sidebar from './components/layout/Sidebar';
import TopNav from './components/layout/TopNav';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import VesselManagementPage from './pages/VesselManagementPage';
import PortOverviewPage from './pages/PortOverviewPage';
import CongestionAnalyticsPage from './pages/CongestionAnalyticsPage';
import OptimizationCenterPage from './pages/OptimizationCenterPage';
import OperationsPlanPage from './pages/OperationsPlanPage';
import AIAssistantPage from './pages/AIAssistantPage';
import AlertsCenterPage from './pages/AlertsCenterPage';

/**
 * Protected route — redirects to /login if not authenticated.
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

/**
 * Authenticated layout — sidebar + topnav + page content.
 */
function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopNav />
        <main className="page-body">{children}</main>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />

      {/* Protected */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout>
              <DashboardPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/vessels"
        element={
          <ProtectedRoute>
            <AppLayout>
              <VesselManagementPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/port-overview"
        element={
          <ProtectedRoute>
            <AppLayout>
              <PortOverviewPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/congestion"
        element={
          <ProtectedRoute>
            <AppLayout>
              <CongestionAnalyticsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/optimization"
        element={
          <ProtectedRoute>
            <AppLayout>
              <OptimizationCenterPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/operations-plan"
        element={
          <ProtectedRoute>
            <AppLayout>
              <OperationsPlanPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-assistant"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AIAssistantPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/alerts"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AlertsCenterPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
