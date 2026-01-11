/**
 * Admin - Reports & Analytics
 * View order statistics, revenue reports, and popular items
 */

import { useState, useEffect } from 'react';
import { reportAPI, orderAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('week');
  const [summary, setSummary] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    completedOrders: 0,
    cancelledOrders: 0
  });
  const [popularItems, setPopularItems] = useState([]);
  const [dailyCounts, setDailyCounts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);

  useEffect(() => {
    loadReportData();
  }, [dateRange]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      // Calculate date range
      const today = new Date();
      let dateFrom, dateTo = today.toISOString().split('T')[0];
      
      if (dateRange === 'today') {
        dateFrom = dateTo;
      } else if (dateRange === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateFrom = weekAgo.toISOString().split('T')[0];
      } else if (dateRange === 'month') {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        dateFrom = monthAgo.toISOString().split('T')[0];
      } else {
        const yearAgo = new Date(today);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        dateFrom = yearAgo.toISOString().split('T')[0];
      }

      const [summaryRes, popularRes, dailyRes, ordersRes] = await Promise.all([
        reportAPI.getOrderSummary({ dateFrom, dateTo, groupBy: 'date' }).catch(() => ({ data: { data: { report: { data: [] } } } })),
        reportAPI.getPopularItems({ dateFrom, dateTo, limit: 5 }).catch(() => ({ data: { data: { items: [] } } })),
        reportAPI.getDailyOrderCounts({ dateFrom, dateTo }).catch(() => ({ data: { data: { dailyCounts: [] } } })),
        orderAPI.getOrders({ limit: 10 }).catch(() => ({ data: { data: { orders: [] } } }))
      ]);

      // Process summary data
      const reportData = summaryRes.data?.data?.report?.data || [];
      const totalOrders = reportData.reduce((sum, d) => sum + (d.orderCount || 0), 0);
      const totalRevenue = reportData.reduce((sum, d) => sum + (d.totalValue || 0), 0);
      const completedOrders = reportData.reduce((sum, d) => sum + (d.completedCount || 0), 0);
      const cancelledOrders = reportData.reduce((sum, d) => sum + (d.cancelledCount || 0), 0);
      
      setSummary({
        totalOrders,
        totalRevenue,
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        completedOrders,
        cancelledOrders
      });
      
      setPopularItems(popularRes.data?.data?.items || []);
      
      // Transform daily counts for chart
      const dailyData = dailyRes.data?.data?.dailyCounts || [];
      const groupedByDate = dailyData.reduce((acc, d) => {
        const date = d.order_date;
        if (!acc[date]) acc[date] = { date, count: 0, total: 0 };
        acc[date].count += parseInt(d.count || 0);
        acc[date].total += parseFloat(d.total || 0);
        return acc;
      }, {});
      setDailyCounts(Object.values(groupedByDate).sort((a, b) => new Date(a.date) - new Date(b.date)));
      
      setRecentOrders(ordersRes.data?.data?.orders || []);
    } catch (error) {
      console.error('Failed to load report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, subtitle, icon, color }) => (
    <div className={`bg-white rounded-xl shadow-sm p-6 border-l-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
          {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className="text-3xl opacity-30">{icon}</div>
      </div>
    </div>
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
          <h1 className="text-2xl font-bold text-gray-800">Reports & Analytics</h1>
          <p className="text-gray-500">View order statistics and trends</p>
        </div>
        <div className="flex gap-2">
          {['today', 'week', 'month', 'year'].map(range => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Orders"
          value={summary.totalOrders || 0}
          icon="📦"
          color="border-blue-500"
        />
        <StatCard
          title="Total Revenue"
          value={`$${parseFloat(summary.totalRevenue || 0).toFixed(2)}`}
          icon="💰"
          color="border-green-500"
        />
        <StatCard
          title="Average Order"
          value={`$${parseFloat(summary.averageOrderValue || 0).toFixed(2)}`}
          icon="📊"
          color="border-purple-500"
        />
        <StatCard
          title="Completed"
          value={`${summary.completedOrders || 0}`}
          subtitle={`${summary.cancelledOrders || 0} cancelled`}
          icon="✅"
          color="border-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Items */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">🔥 Popular Items</h2>
          {popularItems.length > 0 ? (
            <div className="space-y-4">
              {popularItems.map((item, index) => (
                <div key={item.id || index} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold mr-3 ${
                      index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-400' :
                      index === 2 ? 'bg-orange-400' :
                      'bg-gray-300'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{item.name}</p>
                      <p className="text-sm text-gray-500">{item.category_name || 'Uncategorized'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">{item.order_count || 0} orders</p>
                    <p className="text-sm text-gray-500">${parseFloat(item.revenue || 0).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No data available</p>
          )}
        </div>

        {/* Daily Orders Chart (Simple) */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">📈 Daily Orders</h2>
          {dailyCounts.length > 0 ? (
            <div className="space-y-3">
              {dailyCounts.slice(-7).map((day, index) => {
                const maxCount = Math.max(...dailyCounts.map(d => d.count || 0), 1);
                const percentage = ((day.count || 0) / maxCount) * 100;
                return (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 w-20">
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(percentage, 10)}%` }}
                      >
                        <span className="text-xs text-white font-medium">{day.count || 0}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No data available</p>
          )}
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">📋 Recent Orders</h2>
        {recentOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Meal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentOrders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      {order.order_number || `#${order.id?.slice(0, 8)}`}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {order.user_name || 'Guest'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(order.order_date || order.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                      {order.meal_type}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      ${parseFloat(order.total || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        order.status === 'completed' ? 'bg-green-100 text-green-800' :
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No orders found</p>
        )}
      </div>
    </div>
  );
}
