import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { orderAPI } from '../../services/api';
import toast from 'react-hot-toast';

const OrderHistoryPage = () => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrderHistory();
  }, []);

  const loadOrderHistory = async () => {
    try {
      setLoading(true);
      const response = await orderAPI.getMyOrderHistory();
      setOrders(response.data?.data?.orders || []);
    } catch (error) {
      console.error('Failed to load order history:', error);
      toast.error('Failed to load order history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'completed':
      case 'delivered':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">{t('nav.orderHistory')}</h1>
        <p className="text-gray-500 mt-1">View your past orders</p>
      </div>

      <div className="card overflow-hidden">
        {orders.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Order #</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Meal</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Items</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Total</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{order.orderNumber || order.order_number}</td>
                  <td className="px-4 py-3">{formatDate(order.orderDate || order.order_date)}</td>
                  <td className="px-4 py-3 capitalize">{order.mealType || order.meal_type || '-'}</td>
                  <td className="px-4 py-3">
                    {order.items?.length > 0 ? (
                      <span className="text-sm text-gray-600">
                        {order.items.slice(0, 2).map(i => i.name).join(', ')}
                        {order.items.length > 2 && ` +${order.items.length - 2} more`}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    ${(order.total || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">No order history found</p>
            <p className="text-sm mt-2">Your completed orders will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderHistoryPage;
