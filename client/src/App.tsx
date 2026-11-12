import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AuthPage } from './pages/AuthPage';
import { BookAppointmentPage } from './pages/BookAppointmentPage';
import { ClientDashboardPage } from './pages/ClientDashboardPage';
import { ProviderDashboardPage } from './pages/ProviderDashboardPage';

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (user.role === 'PROVIDER') return <Navigate to="/provider" replace />;
  return <Navigate to="/appointments" replace />;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50">
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/login" element={<AuthPage />} />
              <Route
                path="/book"
                element={
                  <ProtectedRoute roles={['CLIENT', 'ADMIN']}>
                    <BookAppointmentPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/appointments"
                element={
                  <ProtectedRoute roles={['CLIENT', 'ADMIN']}>
                    <ClientDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/provider"
                element={
                  <ProtectedRoute roles={['PROVIDER', 'ADMIN']}>
                    <ProviderDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute roles={['ADMIN']}>
                    <AdminDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

