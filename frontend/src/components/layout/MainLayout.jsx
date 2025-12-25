import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

const MainLayout = () => {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Base navigation items for all users
  const baseNavItems = [
    { to: '/dashboard', icon: '🏠', label: t('nav.dashboard') || 'Dashboard' },
    { to: '/menu', icon: '📋', label: t('nav.menu') || 'Menu' },
    { to: '/orders', icon: '📦', label: t('nav.orderHistory') || 'Order History' },
  ];

  // Admin navigation items
  const adminNavItems = [
    { to: '/admin', icon: '🏠', label: 'Dashboard' },
    { to: '/admin/users', icon: '👥', label: 'Users' },
    { to: '/admin/menus', icon: '📋', label: 'Menus' },
    { to: '/admin/orders', icon: '📦', label: 'Orders' },
    { to: '/admin/companies', icon: '🏢', label: 'Companies' },
    { to: '/admin/reports', icon: '📈', label: 'Reports' },
    { to: '/admin/settings', icon: '⚙️', label: 'Settings' },
  ];

  // Kitchen navigation items
  const kitchenNavItems = [
    { to: '/dashboard', icon: '🏠', label: 'Dashboard' },
    { to: '/kitchen/orders', icon: '📦', label: 'Today\'s Orders' },
    { to: '/kitchen/prep', icon: '👨‍🍳', label: 'Prep List' },
  ];

  // HR navigation items
  const hrNavItems = [
    { to: '/dashboard', icon: '🏠', label: 'Dashboard' },
    { to: '/hr/employees', icon: '👥', label: 'Employees' },
    { to: '/hr/feedback', icon: '💬', label: 'Feedback' },
  ];

  // Select nav items based on role
  const getNavItems = () => {
    switch (user?.role) {
      case 'SUPER_ADMIN':
        return adminNavItems;
      case 'HR_ADMIN':
        return hrNavItems;
      case 'KITCHEN_HEAD':
      case 'KITCHEN_SOUS':
      case 'KITCHEN_STAFF':
        return kitchenNavItems;
      default:
        return baseNavItems;
    }
  };

  const navItems = getNavItems();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2">☰</button>
            <NavLink to="/dashboard" className="flex items-center gap-2">
              <span className="text-2xl">🍽️</span>
              <span className="font-bold text-xl text-blue-600">ELOS</span>
            </NavLink>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium">{user?.firstName} {user?.lastName}</div>
              <div className="text-xs text-gray-500">{user?.roleName || user?.role}</div>
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-gray-100 rounded-lg" title="Logout">🚪</button>
          </div>
        </div>
      </header>
      <div className="flex">
        <aside className={`fixed lg:sticky top-[57px] h-[calc(100vh-57px)] w-64 bg-white border-r transform transition-transform z-30
                         ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <nav className="p-4 space-y-1">
            {navItems.map(item => (
              <NavLink key={item.to} to={item.to} onClick={() => setSidebarOpen(false)}
                       className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                <span className="text-lg">{item.icon}</span><span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          
          {/* Role badge at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-gray-50">
            <div className="text-xs text-gray-500 text-center">
              Logged in as <span className="font-medium text-gray-700">{user?.roleName || user?.role}</span>
            </div>
          </div>
        </aside>
        {sidebarOpen && <div className="fixed inset-0 bg-black/20 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}
        <main className="flex-1 p-4 lg:p-8 min-h-[calc(100vh-57px)]"><Outlet /></main>
      </div>
    </div>
  );
};

export default MainLayout;
