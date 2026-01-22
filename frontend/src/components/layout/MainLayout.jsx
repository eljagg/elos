/**
 * MainLayout - Themed layout with sidebar navigation
 */

import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { messageAPI } from '../../services/api';
import { DashboardFooter } from '../Footer';

const MainLayout = () => {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Fetch unread message count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await messageAPI.getUnreadCount();
        setUnreadCount(response.data?.data?.unreadCount || 0);
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Navigation items based on role
  const getNavItems = () => {
    const baseItems = [
      { path: '/dashboard', icon: '🏠', label: 'Dashboard' },
    ];

    switch (user?.role) {
      case 'SYSTEM_OWNER':
        return [
          ...baseItems,
          { path: '/admin/users', icon: '👥', label: 'Users' },
          { path: '/admin/companies', icon: '🏢', label: 'Companies' },
          { path: '/admin/orders', icon: '📦', label: 'Orders' },
          { path: '/dashboard?tab=items', icon: '📚', label: 'Dish Library' },
          { path: '/admin/menus', icon: '🍽️', label: 'Menus' },
          { path: '/admin/reports', icon: '📊', label: 'Reports' },
          { path: '/admin/settings', icon: '⚙️', label: 'Settings' },
        ];
      case 'SUPER_ADMIN':
        return [
          ...baseItems,
          { path: '/admin/users', icon: '👥', label: 'Users' },
          { path: '/admin/companies', icon: '🏢', label: 'Companies' },
          { path: '/admin/orders', icon: '📦', label: 'Orders' },
          { path: '/dashboard?tab=items', icon: '📚', label: 'Dish Library' },
          { path: '/admin/menus', icon: '🍽️', label: 'Menus' },
          { path: '/admin/reports', icon: '📊', label: 'Reports' },
          { path: '/admin/settings', icon: '⚙️', label: 'Settings' },
        ];
      case 'HR_ADMIN':
        return [
          ...baseItems,
          { path: '/hr', icon: '👥', label: 'Employees' },
          { path: '/hr/feedback', icon: '💬', label: 'Feedback' },
          { path: '/hr/reports', icon: '📊', label: 'Reports' },
        ];
      case 'KITCHEN_HEAD':
      case 'KITCHEN_SOUS':
      case 'KITCHEN_STAFF':
        return [
          ...baseItems,
          { path: '/dashboard?tab=items', icon: '📚', label: 'Dish Library' },
          { path: '/kitchen/daily-menu', icon: '📅', label: 'Daily Menu' },
          { path: '/kitchen/menu-calendar', icon: '🗓️', label: 'Menu Calendar' },
          { path: '/kitchen/orders', icon: '📦', label: 'Orders' },
          { path: '/kitchen/menus', icon: '🍽️', label: 'Menus' },
          { path: '/kitchen/prep', icon: '📋', label: 'Prep List' },
        ];
      case 'RECEPTIONIST':
        return [
          ...baseItems,
          { path: '/dashboard?tab=codes', icon: '🎟️', label: 'Guest Codes' },
          { path: '/dashboard?tab=deliveries', icon: '📦', label: 'Deliveries' },
          { path: '/reports', icon: '📊', label: 'Reports' },
        ];
      case 'DELIVERY_PERSON':
      case 'DELIVERY':
        return [
          ...baseItems,
          { path: '/delivery', icon: '🚚', label: 'Deliveries' },
          { path: '/delivery', icon: '📜', label: 'History' },
        ];
      default:
        return [
          ...baseItems,
          { path: '/menu', icon: '🍽️', label: 'Menu' },
          { path: '/orders', icon: '📦', label: 'My Orders' },
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <div className={`min-h-screen ${colors.bgPrimary} flex`}>
      {/* Sidebar */}
      <aside className={`${colors.sidebar} ${sidebarCollapsed ? 'w-20' : 'w-64'} min-h-screen flex flex-col transition-all duration-300 shadow-xl`}>
        {/* Logo */}
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <div>
                <h1 className="text-white font-bold text-xl">ELOS</h1>
                <p className="text-white/60 text-xs">Meal Ordering</p>
              </div>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-lg">E</span>
            </div>
          )}
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="text-white/60 hover:text-white p-1 rounded transition-colors"
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item, index) => (
            <NavLink
              key={index}
              to={item.path}
              className={() => {
                // Use React Router's location for proper reactivity
                const currentPath = location.pathname + location.search;
                const itemPath = item.path;
                
                // Exact match for paths with query params
                // Dashboard only active when no query params
                let isCurrentlyActive;
                if (itemPath.includes('?')) {
                  // For paths with query params, require exact match
                  isCurrentlyActive = currentPath === itemPath;
                } else if (itemPath === '/dashboard') {
                  // Dashboard only active when path is exactly /dashboard with no query
                  isCurrentlyActive = location.pathname === '/dashboard' && !location.search;
                } else {
                  // For other paths, standard matching
                  isCurrentlyActive = currentPath === itemPath;
                }
                
                return `
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                  ${isCurrentlyActive 
                  ? `${colors.sidebarItemActive} ${colors.sidebarTextActive} shadow-lg` 
                  : `${colors.sidebarText} ${colors.sidebarItem}`
                }
              `;
            }}
            >
              <span className="text-xl">{item.icon}</span>
              {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-white/10">
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white font-semibold">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{user?.firstName} {user?.lastName}</p>
                <p className="text-white/60 text-xs truncate">{user?.role?.replace('_', ' ')}</p>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <button
              onClick={handleLogout}
              className="w-full mt-3 px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
            >
              <span>🚪</span>
              <span>Logout</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className={`${colors.bgCard} shadow-sm border-b ${colors.border} px-6 py-4`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-lg font-semibold ${colors.textPrimary}`}>
                {user?.role === 'SYSTEM_OWNER' ? 'System Owner' :
                 user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 
                 user?.role === 'HR_ADMIN' ? 'HR Dashboard' :
                 user?.role?.includes('KITCHEN') ? 'Kitchen' :
                 user?.role === 'RECEPTIONIST' ? 'Reception' :
                 user?.role === 'DELIVERY_PERSON' || user?.role === 'DELIVERY' ? 'Delivery' :
                 'Employee'} Portal
              </h2>
              <p className={`text-sm ${colors.textMuted}`}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Notifications */}
              <button className={`relative p-2 ${colors.bgSecondary} rounded-lg ${colors.bgHover} transition-colors`}>
                <span className="text-xl">🔔</span>
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{unreadCount}</span>}
              </button>
              
              {/* User Menu */}
              <div className="relative">
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className={`flex items-center gap-2 px-3 py-2 ${colors.bgSecondary} rounded-lg ${colors.bgHover} transition-colors`}
                >
                  <div className={`w-8 h-8 ${colors.accent} rounded-full flex items-center justify-center text-white text-sm font-semibold`}>
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </div>
                  <span className={`${colors.textPrimary} font-medium hidden md:block`}>{user?.firstName}</span>
                  <span className={colors.textMuted}>▼</span>
                </button>
                
                {showUserMenu && (
                  <div className={`absolute right-0 mt-2 w-48 ${colors.bgCard} rounded-xl shadow-lg border ${colors.border} py-2 z-50`}>
                    <a href="#" className={`block px-4 py-2 ${colors.textSecondary} ${colors.bgHover}`}>👤 Profile</a>
                    <a href="#" className={`block px-4 py-2 ${colors.textSecondary} ${colors.bgHover}`}>⚙️ Settings</a>
                    <hr className={`my-2 ${colors.border}`} />
                    <button 
                      onClick={handleLogout}
                      className={`w-full text-left px-4 py-2 text-red-600 ${colors.bgHover}`}
                    >
                      🚪 Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className={`flex-1 p-6 ${colors.bgPrimary}`}>
          <Outlet />
        </main>

        {/* Footer */}
        <DashboardFooter />
      </div>
    </div>
  );
};

export default MainLayout;
