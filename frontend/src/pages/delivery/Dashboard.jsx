import { useState, useEffect } from 'react';
import { orderAPI, messageAPI, userAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function DeliveryDashboard() {
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState([]);
  const [deliveryHistory, setDeliveryHistory] = useState([]);
  const [profile, setProfile] = useState({ vehiclePlate: '', cellPhone: '', vehicleType: 'car', status: 'available' });
  const [stats, setStats] = useState({ pending: 0, inTransit: 0, delivered: 0, completedToday: 0 });

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [deliveryNotes, setDeliveryNotes] = useState('');

  useEffect(() => { 
    loadData(); 
    loadProfile();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadProfile = () => {
    const saved = JSON.parse(localStorage.getItem('deliveryProfile') || '{}');
    if (saved.vehiclePlate) setProfile(saved);
  };

  const saveProfile = () => {
    localStorage.setItem('deliveryProfile', JSON.stringify(profile));
    toast.success('Profile updated');
    setShowProfileModal(false);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Get orders that are ready for delivery
      const ordersRes = await orderAPI.getOrders({ status: 'ready', limit: 100 }).catch(() => ({ data: { data: { orders: [] } } }));
      const allOrders = ordersRes.data?.data?.orders || [];

      // Load delivery tracking from localStorage (would be database in production)
      const tracking = JSON.parse(localStorage.getItem('deliveryTracking') || '{}');
      
      // Combine orders with delivery status
      const pendingDeliveries = allOrders.filter(o => !tracking[o.id] || tracking[o.id].status === 'pending').map(o => ({
        ...o,
        deliveryStatus: tracking[o.id]?.status || 'pending',
        pickupTime: tracking[o.id]?.pickupTime,
        deliveryTime: tracking[o.id]?.deliveryTime
      }));

      const inTransitDeliveries = allOrders.filter(o => tracking[o.id]?.status === 'in_transit').map(o => ({
        ...o,
        deliveryStatus: 'in_transit',
        pickupTime: tracking[o.id]?.pickupTime
      }));

      const deliveredToday = Object.entries(tracking)
        .filter(([_, t]) => t.status === 'delivered' && new Date(t.deliveryTime).toDateString() === new Date().toDateString())
        .map(([orderId, t]) => ({ orderId, ...t }));

      setDeliveries([...pendingDeliveries, ...inTransitDeliveries]);
      setDeliveryHistory(deliveredToday);

      setStats({
        pending: pendingDeliveries.length,
        inTransit: inTransitDeliveries.length,
        delivered: deliveredToday.filter(d => d.status === 'delivered' && !d.confirmed).length,
        completedToday: deliveredToday.filter(d => d.confirmed).length
      });
    } catch (error) { 
      console.error('Failed to load deliveries:', error); 
    } finally { 
      setLoading(false); 
    }
  };

  // Update delivery status
  const updateDeliveryStatus = (orderId, status, additionalData = {}) => {
    const tracking = JSON.parse(localStorage.getItem('deliveryTracking') || '{}');
    tracking[orderId] = {
      ...tracking[orderId],
      status,
      ...additionalData,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem('deliveryTracking', JSON.stringify(tracking));
  };

  // Pick up order for delivery
  const handlePickupOrder = async (order) => {
    try {
      updateDeliveryStatus(order.id, 'in_transit', { 
        pickupTime: new Date().toISOString(),
        deliveryPersonId: 'current_user',
        vehiclePlate: profile.vehiclePlate
      });
      
      // Notify kitchen
      await messageAPI.sendMessage({
        recipientRole: 'KITCHEN_HEAD',
        subject: `Order #${order.order_number || order.id?.slice(0,8)} Picked Up`,
        message: `Order picked up for delivery to ${order.company_name || 'customer'}. Delivery person: ${profile.vehiclePlate || 'N/A'}`
      }).catch(() => {});

      toast.success('Order picked up - In Transit');
      loadData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // Mark as delivered
  const handleMarkDelivered = (order) => {
    setSelectedDelivery(order);
    setDeliveryNotes('');
    setShowDeliveryModal(true);
  };

  const handleConfirmDelivery = async () => {
    try {
      const deliveryTime = new Date().toISOString();
      
      updateDeliveryStatus(selectedDelivery.id, 'delivered', {
        deliveryTime,
        notes: deliveryNotes,
        confirmed: false
      });

      // Update order status
      await orderAPI.updateOrderStatus(selectedDelivery.id, 'delivered').catch(() => {});

      // Notify Kitchen
      await messageAPI.sendMessage({
        recipientRole: 'KITCHEN_HEAD',
        subject: `✅ Order #${selectedDelivery.order_number || selectedDelivery.id?.slice(0,8)} Delivered`,
        message: `Order delivered to ${selectedDelivery.company_name || 'customer'} at ${new Date(deliveryTime).toLocaleTimeString()}. ${deliveryNotes ? `Notes: ${deliveryNotes}` : ''}`
      }).catch(() => {});

      // Notify Receptionist
      await messageAPI.sendMessage({
        recipientRole: 'RECEPTIONIST',
        subject: `📦 Delivery Arrived - Order #${selectedDelivery.order_number || selectedDelivery.id?.slice(0,8)}`,
        message: `Order delivered and awaiting confirmation. Company: ${selectedDelivery.company_name || 'N/A'}. Please confirm receipt.`
      }).catch(() => {});

      // Store pending confirmation for receptionist
      const pendingConfirmations = JSON.parse(localStorage.getItem('pendingDeliveryConfirmations') || '[]');
      pendingConfirmations.push({
        orderId: selectedDelivery.id,
        orderNumber: selectedDelivery.order_number || selectedDelivery.id?.slice(0,8),
        companyName: selectedDelivery.company_name,
        deliveryTime,
        deliveryPersonPlate: profile.vehiclePlate,
        notes: deliveryNotes
      });
      localStorage.setItem('pendingDeliveryConfirmations', JSON.stringify(pendingConfirmations));

      toast.success('Delivery notification sent to Kitchen & Receptionist');
      setShowDeliveryModal(false);
      setSelectedDelivery(null);
      loadData();
    } catch (error) {
      toast.error('Failed to confirm delivery');
    }
  };

  // Update availability status
  const handleUpdateStatus = (newStatus) => {
    setProfile({ ...profile, status: newStatus });
    localStorage.setItem('deliveryProfile', JSON.stringify({ ...profile, status: newStatus }));
    toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
  };

  // Group deliveries by company/location
  const groupedDeliveries = deliveries.reduce((acc, delivery) => {
    const key = delivery.company_name || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(delivery);
    return acc;
  }, {});

  const pendingDeliveries = deliveries.filter(d => d.deliveryStatus === 'pending');
  const inTransitDeliveries = deliveries.filter(d => d.deliveryStatus === 'in_transit');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Delivery Dashboard</h1>
          <p className="text-gray-500">Manage pickups and deliveries</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Status:</span>
            <select 
              value={profile.status} 
              onChange={(e) => handleUpdateStatus(e.target.value)}
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                profile.status === 'available' ? 'bg-green-100 text-green-800' :
                profile.status === 'on_delivery' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}
            >
              <option value="available">🟢 Available</option>
              <option value="on_delivery">🔵 On Delivery</option>
              <option value="off_duty">⚫ Off Duty</option>
            </select>
          </div>
          <button onClick={() => setShowProfileModal(true)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            🚗 My Profile
          </button>
        </div>
      </div>

      {/* Profile Alert */}
      {!profile.vehiclePlate && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-medium text-yellow-800">Complete Your Profile</p>
              <p className="text-sm text-yellow-600">Add your vehicle plate and phone number to start deliveries</p>
            </div>
          </div>
          <button onClick={() => setShowProfileModal(true)} className="px-4 py-2 bg-yellow-600 text-white rounded-lg">
            Complete Profile
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div 
          className={`rounded-xl p-4 border-l-4 cursor-pointer hover:shadow-md transition-shadow ${activeTab === 'pending' ? 'bg-yellow-100 border-yellow-500' : 'bg-yellow-50 border-yellow-400'}`}
          onClick={() => setActiveTab('pending')}
        >
          <p className="text-sm text-yellow-600">Pending Pickup</p>
          <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
        </div>
        <div 
          className={`rounded-xl p-4 border-l-4 cursor-pointer hover:shadow-md transition-shadow ${activeTab === 'transit' ? 'bg-blue-100 border-blue-500' : 'bg-blue-50 border-blue-400'}`}
          onClick={() => setActiveTab('transit')}
        >
          <p className="text-sm text-blue-600">In Transit</p>
          <p className="text-2xl font-bold text-blue-700">{stats.inTransit}</p>
        </div>
        <div 
          className={`rounded-xl p-4 border-l-4 cursor-pointer hover:shadow-md transition-shadow ${activeTab === 'delivered' ? 'bg-green-100 border-green-500' : 'bg-green-50 border-green-400'}`}
          onClick={() => setActiveTab('delivered')}
        >
          <p className="text-sm text-green-600">Awaiting Confirm</p>
          <p className="text-2xl font-bold text-green-700">{stats.delivered}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-gray-400">
          <p className="text-sm text-gray-600">Completed Today</p>
          <p className="text-2xl font-bold text-gray-700">{stats.completedToday}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b flex">
          {[
            { id: 'pending', label: '📦 Pending Pickup', count: stats.pending },
            { id: 'transit', label: '🚚 In Transit', count: stats.inTransit },
            { id: 'delivered', label: '✅ Delivered Today', count: deliveryHistory.length },
            { id: 'route', label: '🗺️ Route View' }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              className={`px-6 py-4 text-sm font-medium border-b-2 ${activeTab === tab.id ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-gray-500'}`}
            >
              {tab.label} {tab.count !== undefined && <span className="ml-1 px-2 py-0.5 bg-gray-100 rounded-full text-xs">{tab.count}</span>}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Pending Pickup Tab */}
          {activeTab === 'pending' && (
            <div>
              {pendingDeliveries.length > 0 ? (
                <div className="space-y-4">
                  {pendingDeliveries.map(order => (
                    <div key={order.id} className="border-2 border-yellow-200 bg-yellow-50 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-mono font-bold text-lg">#{order.order_number || order.id?.slice(0,8)}</p>
                          <p className="text-sm text-gray-600">{order.user_first_name} {order.user_last_name}</p>
                        </div>
                        <div className="text-right">
                          <span className="px-3 py-1 bg-yellow-200 text-yellow-800 rounded-full text-sm">Ready for Pickup</span>
                          <p className="text-sm text-gray-500 mt-1">{order.meal_type}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                        <div>
                          <p className="text-gray-500">Company</p>
                          <p className="font-medium">{order.company_name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Department</p>
                          <p className="font-medium">{order.department_name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Cafeteria</p>
                          <p className="font-medium">{order.cafeteria_name || 'Main'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Items</p>
                          <p className="font-medium">{order.item_count || order.items?.length || 1} items</p>
                        </div>
                      </div>
                      {order.notes && (
                        <div className="bg-white border border-yellow-200 rounded p-2 mb-3">
                          <p className="text-xs font-semibold text-yellow-800">📝 Order Notes:</p>
                          <p className="text-sm">{order.notes}</p>
                        </div>
                      )}
                      <button 
                        onClick={() => handlePickupOrder(order)} 
                        className="w-full px-4 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 font-medium"
                        disabled={!profile.vehiclePlate}
                      >
                        🚚 Pick Up for Delivery
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-2">📦</p>
                  <p className="text-gray-500">No orders pending pickup</p>
                  <p className="text-sm text-gray-400 mt-1">Orders will appear here when kitchen marks them ready</p>
                </div>
              )}
            </div>
          )}

          {/* In Transit Tab */}
          {activeTab === 'transit' && (
            <div>
              {inTransitDeliveries.length > 0 ? (
                <div className="space-y-4">
                  {inTransitDeliveries.map(order => (
                    <div key={order.id} className="border-2 border-blue-200 bg-blue-50 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-mono font-bold text-lg">#{order.order_number || order.id?.slice(0,8)}</p>
                          <p className="text-sm text-gray-600">{order.user_first_name} {order.user_last_name}</p>
                        </div>
                        <div className="text-right">
                          <span className="px-3 py-1 bg-blue-200 text-blue-800 rounded-full text-sm animate-pulse">🚚 In Transit</span>
                          <p className="text-xs text-gray-500 mt-1">
                            Picked up: {order.pickupTime ? new Date(order.pickupTime).toLocaleTimeString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                        <div>
                          <p className="text-gray-500">Deliver To</p>
                          <p className="font-medium text-lg">{order.company_name || 'Customer'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Department</p>
                          <p className="font-medium">{order.department_name || 'N/A'}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleMarkDelivered(order)} 
                        className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                      >
                        ✅ Mark as Delivered
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-2">🚚</p>
                  <p className="text-gray-500">No deliveries in transit</p>
                </div>
              )}
            </div>
          )}

          {/* Delivered Today Tab */}
          {activeTab === 'delivered' && (
            <div>
              {deliveryHistory.length > 0 ? (
                <div className="space-y-3">
                  {deliveryHistory.map((delivery, idx) => (
                    <div key={idx} className={`border rounded-xl p-4 ${delivery.confirmed ? 'bg-gray-50' : 'bg-green-50 border-green-200'}`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-mono font-bold">#{delivery.orderNumber || delivery.orderId?.slice(0,8)}</p>
                          <p className="text-sm text-gray-500">{delivery.companyName || 'Customer'}</p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 text-xs rounded-full ${delivery.confirmed ? 'bg-gray-200 text-gray-700' : 'bg-green-200 text-green-800'}`}>
                            {delivery.confirmed ? '✓ Confirmed' : '⏳ Awaiting Confirmation'}
                          </span>
                          <p className="text-xs text-gray-500 mt-1">
                            {delivery.deliveryTime ? new Date(delivery.deliveryTime).toLocaleTimeString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                      {delivery.notes && <p className="text-sm text-gray-600 mt-2">📝 {delivery.notes}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-2">✅</p>
                  <p className="text-gray-500">No deliveries completed today</p>
                </div>
              )}
            </div>
          )}

          {/* Route View Tab */}
          {activeTab === 'route' && (
            <div>
              <h3 className="font-semibold mb-4">Deliveries by Location</h3>
              {Object.keys(groupedDeliveries).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(groupedDeliveries).map(([location, orders]) => (
                    <div key={location} className="border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">🏢</span>
                          <div>
                            <h4 className="font-semibold">{location}</h4>
                            <p className="text-sm text-gray-500">{orders.length} order(s)</p>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full text-sm">
                          {orders.filter(o => o.deliveryStatus === 'pending').length} pending
                        </span>
                      </div>
                      <div className="space-y-2">
                        {orders.map(order => (
                          <div key={order.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div>
                              <span className="font-mono text-sm">#{order.order_number || order.id?.slice(0,8)}</span>
                              <span className="text-sm text-gray-500 ml-2">{order.user_first_name} {order.user_last_name}</span>
                            </div>
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              order.deliveryStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              order.deliveryStatus === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {order.deliveryStatus === 'pending' ? 'Pending' : order.deliveryStatus === 'in_transit' ? 'In Transit' : 'Delivered'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-2">🗺️</p>
                  <p className="text-gray-500">No deliveries to show</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">🚗 Delivery Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Vehicle License Plate *</label>
                <input 
                  type="text" 
                  value={profile.vehiclePlate} 
                  onChange={(e) => setProfile({ ...profile, vehiclePlate: e.target.value.toUpperCase() })} 
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., ABC 1234"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cell Phone *</label>
                <input 
                  type="tel" 
                  value={profile.cellPhone} 
                  onChange={(e) => setProfile({ ...profile, cellPhone: e.target.value })} 
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., 876-555-1234"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Vehicle Type</label>
                <select 
                  value={profile.vehicleType} 
                  onChange={(e) => setProfile({ ...profile, vehicleType: e.target.value })} 
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="car">🚗 Car</option>
                  <option value="motorcycle">🏍️ Motorcycle</option>
                  <option value="bicycle">🚲 Bicycle</option>
                  <option value="van">🚐 Van</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button onClick={() => setShowProfileModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button onClick={saveProfile} className="px-4 py-2 bg-cyan-600 text-white rounded-lg">Save Profile</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Confirmation Modal */}
      {showDeliveryModal && selectedDelivery && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">✅ Confirm Delivery</h2>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="font-mono font-bold">Order #{selectedDelivery.order_number || selectedDelivery.id?.slice(0,8)}</p>
              <p className="text-sm text-gray-600">{selectedDelivery.company_name || 'Customer'}</p>
              <p className="text-sm text-gray-500">{selectedDelivery.user_first_name} {selectedDelivery.user_last_name}</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Delivery Notes (optional)</label>
              <textarea 
                value={deliveryNotes} 
                onChange={(e) => setDeliveryNotes(e.target.value)} 
                className="w-full px-4 py-2 border rounded-lg" 
                rows="3"
                placeholder="Any notes about the delivery..."
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800">
                📤 This will notify:
              </p>
              <ul className="text-sm text-blue-700 mt-1">
                <li>• Kitchen Staff</li>
                <li>• Receptionist (for confirmation)</li>
              </ul>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeliveryModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={handleConfirmDelivery} className="px-4 py-2 bg-green-600 text-white rounded-lg">
                Confirm Delivery
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
