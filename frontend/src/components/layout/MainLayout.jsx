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

  const navItems = [
    { to: '/dashboard', icon: '🏠', label: t('nav.dashboard') },
    { to: '/menu', icon: '📋', label: t('nav.menu') },
    { to: '/orders', icon: '📦', label: t('nav.orderHistory') },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2">☰</button>
            <NavLink to="/dashboard" className="flex items-center gap-2">
              <span className="text-2xl">🍽️</span>
              <span className="font-bold text-xl text-primary-600">ELOS</span>
            </NavLink>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium">{user?.firstName} {user?.lastName}</div>
              <div className="text-xs text-gray-500">{user?.companyName}</div>
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-gray-100 rounded-lg">🚪</button>
          </div>
        </div>
      </header>
      <div className="flex">
        <aside className={`fixed lg:sticky top-[57px] h-[calc(100vh-57px)] w-64 bg-white border-r transform transition-transform
                         ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <nav className="p-4 space-y-1">
            {navItems.map(item => (
              <NavLink key={item.to} to={item.to} onClick={() => setSidebarOpen(false)}
                       className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg ${isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                <span>{item.icon}</span><span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
        {sidebarOpen && <div className="fixed inset-0 bg-black/20 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}
        <main className="flex-1 p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
};

export default MainLayout;
