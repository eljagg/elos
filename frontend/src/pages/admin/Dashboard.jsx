/**
 * Admin Dashboard - Main Overview with Real Stats
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI, userAPI, orderAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    users: { total_users: 0, active_users: 0, new_today: 0, logged_in_today: 0 },
    orders: { total_today: 0, pending: 0, preparing: 0, ready: 0, completed: 0, total_value: 0 },
    companies: { total_companies: 0 }
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [dashboardRes, usersRes, ordersRes] = await Promise.all([
        adminAPI.getDashboard().catch(() => null),
        userAPI.getUsers({ limit: 5, sortBy: 'created_at', sortOrder: 'desc' }).catch(() => ({ data: { data: { users: [] } } })),
        orderAPI.getOrders({ limit: 5 }).catch(() => ({ data: { data: { orders: [] } } }))
      ]);

      if (dashboardRes?.data?.data?.stats) {
        setStats(dashboardRes.data.data.stats);
        setRecentActivity(dashboardRes.data.data.stats.recentActivity || []);
      }

      setRecentUsers(usersRes.data?.data?.users || []);
      setRecentOrders(ordersRes.data?.data?.orders || []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, subtitle, icon, color, link }) => (
    <Link to={link} className={`bg-white rounded-xl shadow-sm p-6 border-l-4 ${color} hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className="text-4xl opacity-20">{icon}</div>
      </div>
    </Link>
  );

  const QuickAction = ({ title, description, icon, link, color }) => (
    <Link to={link} className="flex items-center p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-all border border-gray-100">
      <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center text-white text-xl mr-4`}>{icon}</div>
      <div>
        <h4 className="font-semibold text-gray-800">{title}</h4>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </Link>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
          <p className="text-gray-500">Welcome back! Here's what's happening today.</p>
        </div>
        <button onClick={loadDashboardData} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2">
          🔄 Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Users" value={stats.users?.total_users || 0} subtitle={`${stats.users?.active_users || 0} active`} icon="👥" color="border-blue-500" link="/admin/users" />
        <StatCard title="Today's Orders" value={stats.orders?.total_today || 0} subtitle={`$${parseFloat(stats.orders?.total_value || 0).toFixed(2)} revenue`} icon="🍽️" color="border-green-500" link="/admin/orders" />
        <StatCard title="Pending Orders" value={stats.orders?.pending || 0} subtitle={`${stats.orders?.preparing || 0} preparing`} icon="⏳" color="border-orange-500" link="/admin/orders" />
        <StatCard title="Companies" value={stats.companies?.total_companies || 0} icon="🏢" color="border-purple-500" link="/admin/companies" />
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Today's Order Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">{stats.orders?.pending || 0}</p>
            <p className="text-sm text-yellow-700">Pending</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{stats.orders?.preparing || 0}</p>
            <p className="text-sm text-blue-700">Preparing</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-2xl font-bold text-purple-600">{stats.orders?.ready || 0}</p>
            <p className="text-sm text-purple-700">Ready</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{stats.orders?.completed || 0}</p>
            <p className="text-sm text-green-700">Completed</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-600">${parseFloat(stats.orders?.total_value || 0).toFixed(2)}</p>
            <p className="text-sm text-gray-700">Revenue</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickAction title="Add User" description="Create new employee" icon="👤" link="/admin/users/new" color="bg-blue-500" />
          <QuickAction title="Manage Menu" description="Edit weekly menu" icon="📋" link="/admin/menus" color="bg-green-500" />
          <QuickAction title="View Reports" description="Analytics & stats" icon="📈" link="/admin/reports" color="bg-purple-500" />
          <QuickAction title="Settings" description="System config" icon="⚙️" link="/admin/settings" color="bg-gray-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Recent Orders</h2>
            <Link to="/admin/orders" className="text-sm text-blue-600 hover:underline">View all →</Link>
          </div>
          {recentOrders.length > 0 ? (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-800">{order.order_number || `#${order.id?.slice(0, 8)}`}</p>
                    <p className="text-sm text-gray-500">{order.first_name} {order.last_name} • {order.meal_type}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      order.status === 'completed' ? 'bg-green-100 text-green-800' :
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      order.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>{order.status}</span>
                    <p className="text-sm text-gray-500 mt-1">${parseFloat(order.total || 0).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No recent orders</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">New Users</h2>
            <Link to="/admin/users" className="text-sm text-blue-600 hover:underline">View all →</Link>
          </div>
          {recentUsers.length > 0 ? (
            <div className="space-y-3">
              {recentUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold mr-3">
                      {user.first_name?.[0]}{user.last_name?.[0]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{user.first_name} {user.last_name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {user.role_name || 'Employee'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No recent users</p>
          )}
        </div>
      </div>

      {recentActivity.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  activity.action?.includes('LOGIN') ? 'bg-blue-100 text-blue-600' :
                  activity.action?.includes('CREATE') ? 'bg-green-100 text-green-600' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {activity.action?.includes('LOGIN') ? '🔑' : activity.action?.includes('CREATE') ? '➕' : '📋'}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{activity.action?.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-gray-500">{activity.user_name || 'System'}</p>
                </div>
                <p className="text-sm text-gray-400">{new Date(activity.created_at).toLocaleTimeString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">System Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center p-4 bg-green-50 rounded-lg">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-3 animate-pulse"></div>
            <div><p className="font-medium text-green-800">Database</p><p className="text-sm text-green-600">Connected</p></div>
          </div>
          <div className="flex items-center p-4 bg-green-50 rounded-lg">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-3 animate-pulse"></div>
            <div><p className="font-medium text-green-800">API Server</p><p className="text-sm text-green-600">Running</p></div>
          </div>
          <div className="flex items-center p-4 bg-yellow-50 rounded-lg">
            <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
            <div><p className="font-medium text-yellow-800">Email Service</p><p className="text-sm text-yellow-600">Not configured</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
