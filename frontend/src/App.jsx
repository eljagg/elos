/**
 * ELOS - Main App Component
 * 
 * Handles routing and layout structure
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LicenseProvider } from './context/LicenseContext';
import LicenseCheck from './components/LicenseCheck';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import GuestLoginPage from './pages/GuestLoginPage';
import DeliveryDashboard from './pages/delivery/Dashboard';


// Dashboard pages
import EmployeeDashboard from './pages/employee/Dashboard';
import MenuPage from './pages/employee/MenuPage';
import OrderHistoryPage from './pages/employee/OrderHistoryPage';

import KitchenDashboard from './pages/kitchen/Dashboard';
import DailyMenuManagement from './pages/kitchen/DailyMenuManagement';
import MenuCalendar from './pages/kitchen/MenuCalendar';
import HRDashboard from './pages/hr/Dashboard';
import HRUserForm from './pages/hr/UserForm';
import ReceptionistDashboard from './pages/receptionist/Dashboard';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import UserManagement from './pages/admin/UserManagement';
import UserForm from './pages/admin/UserForm';
import MenuManagement from './pages/admin/MenuManagement';
import DishLibrary from './pages/admin/DishLibrary';
import CompanySettings from './pages/admin/CompanySettings';
import Reports from './pages/admin/Reports';
import SystemSettings from './pages/admin/SystemSettings';
import OrderManagement from './pages/admin/OrderManagement';

// Layout
import MainLayout from './components/layout/MainLayout';

// Protected route wrapper
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, isAuthenticated } = useAuth();
  
  // Also check localStorage directly as fallback for race condition after login
  const hasToken = localStorage.getItem('accessToken');
  const hasSavedUser = localStorage.getItem('user');
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner w-12 h-12"></div>
      </div>
    );
  }
  
  // Check both React state AND localStorage
  // This handles the race condition where login sets localStorage but React state hasn't updated yet
  const effectivelyAuthenticated = isAuthenticated || (hasToken && hasSavedUser);
  
  if (!effectivelyAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // Get user from state or localStorage
  const effectiveUser = user || (hasSavedUser ? JSON.parse(hasSavedUser) : null);
  
  if (allowedRoles && effectiveUser && !allowedRoles.includes(effectiveUser.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

// Dashboard router based on role
const DashboardRouter = () => {
  const { user } = useAuth();
  
  // Also check localStorage as fallback
  const savedUser = localStorage.getItem('user');
  const effectiveUser = user || (savedUser ? JSON.parse(savedUser) : null);
  
  if (!effectiveUser) return <Navigate to="/login" />;
  
  switch (effectiveUser.role) {
    case 'SYSTEM_OWNER':
    case 'SUPER_ADMIN':
      return <AdminDashboard />;
    case 'HR_ADMIN':
      return <HRDashboard />;
    case 'KITCHEN_HEAD':
    case 'KITCHEN_SOUS':
    case 'KITCHEN_STAFF':
      return <KitchenDashboard />;
    case 'RECEPTIONIST':
      return <ReceptionistDashboard />;
    case 'DELIVERY_PERSON':
    case 'DELIVERY':
      return <DeliveryDashboard />;
    default:
      return <EmployeeDashboard />;
  }
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <LicenseProvider>
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                style: {
                  background: '#10b981',
                },
              },
              error: {
                style: {
                  background: '#ef4444',
                },
              },
            }}
          />
          
          <Routes>
            {/* Public routes - No license check needed */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/guest" element={<GuestLoginPage />} />
            
            {/* Protected routes - License check required */}
            <Route path="/" element={
              <ProtectedRoute>
                <LicenseCheck>
                  <MainLayout />
                </LicenseCheck>
              </ProtectedRoute>
            }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardRouter />} />
            
            {/* Employee routes */}
            <Route path="menu" element={<MenuPage />} />
            <Route path="orders" element={<OrderHistoryPage />} />
            
            {/* Kitchen routes */}
            <Route path="kitchen/menu-calendar" element={
              <ProtectedRoute>
                <MainLayout>
                  <MenuCalendar />
                </MainLayout>
              </ProtectedRoute>
            } />
            <Route path="kitchen/daily-menu" element={
              <ProtectedRoute allowedRoles={['SYSTEM_OWNER', 'SUPER_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS', 'KITCHEN_STAFF']}>
                <DailyMenuManagement />
              </ProtectedRoute>
            } />
            <Route path="kitchen/*" element={
              <ProtectedRoute allowedRoles={['SYSTEM_OWNER', 'SUPER_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS', 'KITCHEN_STAFF']}>
                <KitchenDashboard />
              </ProtectedRoute>
            } />
            
            {/* HR routes */}
            <Route path="hr" element={
              <ProtectedRoute allowedRoles={['SYSTEM_OWNER', 'SUPER_ADMIN', 'HR_ADMIN']}>
                <HRDashboard />
              </ProtectedRoute>
            } />
            <Route path="hr/users/new" element={
              <ProtectedRoute allowedRoles={['SYSTEM_OWNER', 'SUPER_ADMIN', 'HR_ADMIN']}>
                <HRUserForm />
              </ProtectedRoute>
            } />
            <Route path="hr/users/:id" element={
              <ProtectedRoute allowedRoles={['SYSTEM_OWNER', 'SUPER_ADMIN', 'HR_ADMIN']}>
                <HRUserForm />
              </ProtectedRoute>
            } />
            
            {/* Delivery routes */}
            <Route path="delivery/*" element={
              <ProtectedRoute allowedRoles={['SYSTEM_OWNER', 'SUPER_ADMIN', 'DELIVERY_PERSON', 'DELIVERY']}>
                <DeliveryDashboard />
              </ProtectedRoute>
            } />
            
            {/* Admin routes */}
            <Route path="admin" element={
              <ProtectedRoute allowedRoles={['SYSTEM_OWNER', 'SUPER_ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="admin/users" element={
              <ProtectedRoute allowedRoles={['SYSTEM_OWNER', 'SUPER_ADMIN']}>
                <UserManagement />
              </ProtectedRoute>
            } />
            <Route path="admin/users/new" element={
              <ProtectedRoute allowedRoles={['SYSTEM_OWNER', 'SUPER_ADMIN']}>
                <UserForm />
              </ProtectedRoute>
            } />
            <Route path="admin/users/:id" element={
              <ProtectedRoute allowedRoles={['SYSTEM_OWNER', 'SUPER_ADMIN']}>
                <UserForm />
              </ProtectedRoute>
            } />
            <Route path="admin/dish-library" element={
              <ProtectedRoute allowedRoles={['SYSTEM_OWNER', 'SUPER_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS', 'KITCHEN_STAFF']}>
                <DishLibrary />
              </ProtectedRoute>
            } />
            <Route path="admin/menus" element={
              <ProtectedRoute allowedRoles={['SYSTEM_OWNER', 'SUPER_ADMIN']}>
                <MenuManagement />
              </ProtectedRoute>
            } />
            <Route path="admin/companies" element={
              <ProtectedRoute allowedRoles={['SYSTEM_OWNER', 'SUPER_ADMIN']}>
                <CompanySettings />
              </ProtectedRoute>
            } />
            <Route path="admin/orders" element={
              <ProtectedRoute allowedRoles={['SYSTEM_OWNER', 'SUPER_ADMIN']}>
                <OrderManagement />
              </ProtectedRoute>
            } />
            <Route path="admin/reports" element={
              <ProtectedRoute allowedRoles={['SYSTEM_OWNER', 'SUPER_ADMIN']}>
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="admin/settings" element={
              <ProtectedRoute allowedRoles={['SYSTEM_OWNER', 'SUPER_ADMIN']}>
                <SystemSettings />
              </ProtectedRoute>
            } />
          </Route>
          
          {/* 404 */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </LicenseProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
