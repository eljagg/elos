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

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import GuestLoginPage from './pages/GuestLoginPage';
import DeliveryDashboard from './pages/delivery/Dashboard';


// Dashboard pages
import EmployeeDashboard from './pages/employee/Dashboard';
import MenuPage from './pages/employee/MenuPage';
import OrderHistoryPage from './pages/employee/OrderHistoryPage';

import KitchenDashboard from './pages/kitchen/Dashboard';
import HRDashboard from './pages/hr/Dashboard';
import ReceptionistDashboard from './pages/receptionist/Dashboard';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import UserManagement from './pages/admin/UserManagement';
import UserForm from './pages/admin/UserForm';
import MenuManagement from './pages/admin/MenuManagement';
import CompanySettings from './pages/admin/CompanySettings';
import Reports from './pages/admin/Reports';
import SystemSettings from './pages/admin/SystemSettings';
import OrderManagement from './pages/admin/OrderManagement';

// Layout
import MainLayout from './components/layout/MainLayout';

// Protected route wrapper
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, isAuthenticated } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner w-12 h-12"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

// Dashboard router based on role
const DashboardRouter = () => {
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/login" />;
  
  switch (user.role) {
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
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/guest" element={<GuestLoginPage />} />
          
          {/* Protected routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardRouter />} />
            
            {/* Employee routes */}
            <Route path="menu" element={<MenuPage />} />
            <Route path="orders" element={<OrderHistoryPage />} />
            
            {/* Kitchen routes */}
            <Route path="kitchen/*" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS', 'KITCHEN_STAFF']}>
                <KitchenDashboard />
              </ProtectedRoute>
            } />
            
            {/* HR routes */}
            <Route path="hr/*" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR_ADMIN']}>
                <HRDashboard />
              </ProtectedRoute>
            } />
            
            {/* Delivery routes */}
            <Route path="delivery/*" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'DELIVERY_PERSON', 'DELIVERY']}>
                <DeliveryDashboard />
              </ProtectedRoute>
            } />
            
            {/* Admin routes */}
            <Route path="admin" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="admin/users" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <UserManagement />
              </ProtectedRoute>
            } />
            <Route path="admin/users/new" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <UserForm />
              </ProtectedRoute>
            } />
            <Route path="admin/users/:id" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <UserForm />
              </ProtectedRoute>
            } />
            <Route path="admin/menus" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <MenuManagement />
              </ProtectedRoute>
            } />
            <Route path="admin/companies" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <CompanySettings />
              </ProtectedRoute>
            } />
            <Route path="admin/orders" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <OrderManagement />
              </ProtectedRoute>
            } />
            <Route path="admin/reports" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="admin/settings" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <SystemSettings />
              </ProtectedRoute>
            } />
          </Route>
          
          {/* 404 */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
