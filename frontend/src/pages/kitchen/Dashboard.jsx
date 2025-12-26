/**
 * Kitchen Dashboard - Order Management & Preparation
 */

import { useState, useEffect } from 'react';
import { orderAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function KitchenDashboard() {
  const [activeTab, setActiveTab] = useState('orders');
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [prepList, setPrepList] = useState([]);
  const [stats, setStats] = useState({
    pending: 0,
    preparing: 0,
    ready: 0,
    completed: 0
  });
  const [selectedMealType, setSelectedMealType] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await orderAPI.getKitchenOrders().catch(() => 
        orderAPI.getOrders({ date: new Date().toISOString().split('T')[0] })
      );
      
      const ordersList = response.data?.data?.orders || [];
      setOrders(ordersList);
      
      // Calculate stats
      setStats({
        pending: ordersList.filter(o => o.status === 'pending').length,
        preparing: ordersList.filter(o => o.status === 'preparing').length,
        ready: ordersList.filter(o => o.status === 'ready').length,
        completed: ordersList.filter(o => o.status === 'completed').length
      });

      // Generate prep list from orders
      const itemCounts = {};
      ordersList.filter(o => o.status === 'pending' || o.status === 'preparing').forEach(order => {
        if (order.items) {
          order.items.forEach(item => {
            const key = item.menu_item_id || item.name;
            if (!itemCounts[key]) {
              itemCounts[key] = { name: item.name, quantity: 0, orders: [] };
            }
            itemCounts[key].quantity += item.quantity || 1;
            itemCounts[key].orders.push(order.order_number || order.id?.slice(0, 8));
          });
        }
      });
      setPrepList(Object.values(itemCounts).sort((a, b) => b.quantity - a.quantity));
    } catch (error) {
      console.error('Failed to load kitchen orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await orderAPI.updateOrderStatus(orderId, newStatus);
      toast.success(`Order marked as ${newStatus}`);
      loadOrders();
    } catch (error) {
      toast.error('Failed to update order');
    }
  };

  const filteredOrders = orders.filter(order => {
    if (selectedMealType !== 'all' && order.meal_type !== selectedMealType) return false;
    return true;
  });

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      preparing: 'bg-blue-100 text-blue-800 border-blue-300',
      ready: 'bg-green-100 text-green-800 border-green-300',
      completed: 'bg-gray-100 text-gray-800 border-gray-300'
    };
    return colors[status] || colors.pending;
  };

  const getNextStatus = (currentStatus) => {
    const flow = { pending: 'preparing', preparing: 'ready', ready: 'completed' };
    return flow[currentStatus];
  };

  const tabs = [
    { id: 'orders', label: 'Today\'s Orders', icon: '📦' },
    { id: 'prep', label: 'Prep List', icon: '📋' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Kitchen Dashboard</h1>
          <p className="text-gray-500">Manage today's orders and preparation</p>
        </div>
        <button onClick={loadOrders} className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 flex items-center gap-2">
          🔄 Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-yellow-50 rounded-xl p-4 border-l-4 border-yellow-500">
          <p className="text-sm text-yellow-600">Pending</p>
          <p className="text-3xl font-bold text-yellow-700">{stats.pending}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500">
          <p className="text-sm text-blue-600">Preparing</p>
          <p className="text-3xl font-bold text-blue-700">{stats.preparing}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500">
          <p className="text-sm text-green-600">Ready</p>
          <p className="text-3xl font-bold text-green-700">{stats.ready}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-gray-500">
          <p className="text-sm text-gray-600">Completed</p>
          <p className="text-3xl font-bold text-gray-700">{stats.completed}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b flex justify-between items-center px-4">
          <div className="flex">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>{tab.label}
              </button>
            ))}
          </div>
          {activeTab === 'orders' && (
            <select
              value={selectedMealType}
              onChange={(e) => setSelectedMealType(e.target.value)}
              className="px-3 py-1 border rounded-lg text-sm"
            >
              <option value="all">All Meals</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
            </select>
          )}
        </div>

        <div className="p-6">
          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {filteredOrders.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredOrders.map(order => (
                    <div key={order.id} className={`border-2 rounded-xl p-4 ${getStatusColor(order.status)}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold text-lg">#{order.order_number || order.id?.slice(0, 8)}</p>
                          <p className="text-sm opacity-75">{order.first_name} {order.last_name}</p>
                        </div>
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-white bg-opacity-50">
                          {order.meal_type}
                        </span>
                      </div>

                      <div className="mb-3">
                        {order.items?.slice(0, 3).map((item, idx) => (
                          <p key={idx} className="text-sm">• {item.quantity || 1}x {item.name}</p>
                        ))}
                        {order.items?.length > 3 && (
                          <p className="text-sm opacity-75">+{order.items.length - 3} more items</p>
                        )}
                        {!order.items?.length && (
                          <p className="text-sm opacity-75">No items listed</p>
                        )}
                      </div>

                      {order.special_instructions && (
                        <div className="mb-3 p-2 bg-white bg-opacity-50 rounded text-sm">
                          📝 {order.special_instructions}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="flex-1 px-3 py-2 bg-white bg-opacity-50 rounded-lg text-sm hover:bg-opacity-75"
                        >
                          View Details
                        </button>
                        {getNextStatus(order.status) && (
                          <button
                            onClick={() => updateOrderStatus(order.id, getNextStatus(order.status))}
                            className="flex-1 px-3 py-2 bg-white rounded-lg text-sm font-medium hover:bg-gray-50"
                          >
                            Mark {getNextStatus(order.status)}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-2">🍳</p>
                  <p className="text-gray-500">No orders to display</p>
                </div>
              )}
            </div>
          )}

          {/* Prep List Tab */}
          {activeTab === 'prep' && (
            <div>
              {prepList.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-4 font-semibold text-gray-500 text-sm pb-2 border-b">
                    <span>Item</span>
                    <span className="text-center">Quantity</span>
                    <span className="text-right">Orders</span>
                  </div>
                  {prepList.map((item, index) => (
                    <div key={index} className="grid grid-cols-3 gap-4 items-center p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-800">{item.name}</span>
                      <span className="text-center">
                        <span className="inline-flex items-center justify-center w-10 h-10 bg-orange-100 text-orange-700 rounded-full font-bold">
                          {item.quantity}
                        </span>
                      </span>
                      <span className="text-right text-sm text-gray-500">
                        {item.orders.slice(0, 3).join(', ')}{item.orders.length > 3 ? '...' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-2">✅</p>
                  <p className="text-gray-500">No items to prepare</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Order #{selectedOrder.order_number || selectedOrder.id?.slice(0, 8)}</h2>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Customer</span>
                <span className="font-medium">{selectedOrder.first_name} {selectedOrder.last_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Meal Type</span>
                <span className="font-medium capitalize">{selectedOrder.meal_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(selectedOrder.status)}`}>
                  {selectedOrder.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Delivery Location</span>
                <span className="font-medium">{selectedOrder.delivery_location || 'N/A'}</span>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">Items</h3>
                {selectedOrder.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-2 border-b border-gray-100">
                    <span>{item.quantity || 1}x {item.name}</span>
                    {item.customizations && <span className="text-sm text-gray-500">{item.customizations}</span>}
                  </div>
                )) || <p className="text-gray-500">No items</p>}
              </div>

              {selectedOrder.special_instructions && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Special Instructions</h3>
                  <p className="text-gray-700 bg-yellow-50 p-3 rounded-lg">{selectedOrder.special_instructions}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setSelectedOrder(null)} className="flex-1 px-4 py-2 border rounded-lg">Close</button>
              {getNextStatus(selectedOrder.status) && (
                <button
                  onClick={() => {
                    updateOrderStatus(selectedOrder.id, getNextStatus(selectedOrder.status));
                    setSelectedOrder(null);
                  }}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg"
                >
                  Mark as {getNextStatus(selectedOrder.status)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
