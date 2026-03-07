/**
 * Delivery Dashboard - Mobile-first responsive design
 * Interface for delivery personnel to manage pickups and deliveries
 */
import { useState, useEffect } from 'react';
import { orderAPI, messageAPI, deliveryAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function DeliveryDashboard() {
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState([]);
  const [deliveryHistory, setDeliveryHistory] = useState([]);
  const [profile, setProfile] = useState({ vehiclePlate: '', cellPhone: '', vehicleType: 'car', status: 'available' });
  const [stats, setStats] = useState({ pending: 0, inTransit: 0, delivered: 0, completedToday: 0 });
  const [tracking, setTracking] = useState({});

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [deliveryNotes, setDeliveryNotes] = useState('');

  useEffect(() => { loadData(); loadProfile(); const interval = setInterval(loadData, 30000); return () => clearInterval(interval); }, []);

  const loadProfile = async () => { 
    try {
      const res = await deliveryAPI.getProfile();
      const p = res.data?.data?.profile;
      if (p) {
        setProfile({
          vehiclePlate: p.vehiclePlate || '',
          cellPhone: p.cellPhone || '',
          vehicleType: p.vehicleType || 'car',
          status: p.status || 'available'
        });
      }
    } catch (error) {
      const saved = JSON.parse(localStorage.getItem('deliveryProfile') || '{}'); 
      if (saved.vehiclePlate) setProfile(saved); 
    }
  };

  const saveProfile = async () => { 
    try {
      await deliveryAPI.updateProfile(profile);
      toast.success('Profile saved'); 
      setShowProfileModal(false); 
    } catch (error) {
      localStorage.setItem('deliveryProfile', JSON.stringify(profile)); 
      toast.success('Profile saved locally'); 
      setShowProfileModal(false); 
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, trackingRes] = await Promise.all([
        orderAPI.getOrders({ status: 'ready', limit: 100 }).catch(() => ({ data: { data: { orders: [] } } })),
        deliveryAPI.getTracking().catch(() => ({ data: { data: { tracking: {} } } }))
      ]);
      
      const allOrders = ordersRes.data?.data?.orders || [];
      const serverTracking = trackingRes.data?.data?.tracking || {};
      
      const localTracking = JSON.parse(localStorage.getItem('deliveryTracking') || '{}');
      const mergedTracking = { ...localTracking, ...serverTracking };
      setTracking(mergedTracking);
      
      const pending = allOrders.filter(o => !mergedTracking[o.id] || mergedTracking[o.id].status === 'pending').map(o => ({ ...o, deliveryStatus: 'pending' }));
      const inTransit = allOrders.filter(o => mergedTracking[o.id]?.status === 'in_transit').map(o => ({ ...o, deliveryStatus: 'in_transit', pickupTime: mergedTracking[o.id]?.pickupTime }));
      const today = new Date().toDateString();
      const deliveredToday = Object.entries(mergedTracking).filter(([_, t]) => t.status === 'delivered' && t.deliveryTime && new Date(t.deliveryTime).toDateString() === today).map(([id, t]) => ({ orderId: id, ...t }));

      setDeliveries([...pending, ...inTransit]);
      setDeliveryHistory(deliveredToday);
      setStats({ pending: pending.length, inTransit: inTransit.length, delivered: deliveredToday.filter(d => !d.confirmed).length, completedToday: deliveredToday.filter(d => d.confirmed).length });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const updateTrackingData = async (orderId, status, data = {}) => { 
    try {
      await deliveryAPI.updateTracking(orderId, { status, ...data });
    } catch (error) {
      console.error('Server tracking update failed, using localStorage:', error);
    }
    const localTracking = JSON.parse(localStorage.getItem('deliveryTracking') || '{}'); 
    localTracking[orderId] = { ...localTracking[orderId], status, ...data, updatedAt: new Date().toISOString() }; 
    localStorage.setItem('deliveryTracking', JSON.stringify(localTracking)); 
    setTracking(prev => ({ ...prev, [orderId]: localTracking[orderId] }));
  };

  const handlePickup = async (order) => {
    const pickupTime = new Date().toISOString();
    await updateTrackingData(order.id, 'in_transit', { pickupTime, vehiclePlate: profile.vehiclePlate });
    await messageAPI.sendMessage({ recipientRole: 'KITCHEN_HEAD', subject: `Order #${order.order_number || order.id?.slice(0, 8)} Picked Up`, message: `Picked up for delivery. Vehicle: ${profile.vehiclePlate}` }).catch(() => {});
    toast.success('Picked up!');
    loadData();
  };

  const handleMarkDelivered = (order) => { setSelectedDelivery(order); setDeliveryNotes(''); setShowDeliveryModal(true); };

  const handleConfirmDelivery = async () => {
    const time = new Date().toISOString();
    await updateTrackingData(selectedDelivery.id, 'delivered', { deliveryTime: time, notes: deliveryNotes, confirmed: false });
    await orderAPI.updateOrderStatus(selectedDelivery.id, 'delivered').catch(() => {});
    await messageAPI.sendMessage({ recipientRole: 'KITCHEN_HEAD', subject: `✅ Order #${selectedDelivery.order_number || selectedDelivery.id?.slice(0, 8)} Delivered`, message: `Delivered at ${new Date(time).toLocaleTimeString()}` }).catch(() => {});
    await messageAPI.sendMessage({ recipientRole: 'RECEPTIONIST', subject: `📦 Delivery - Order #${selectedDelivery.order_number || selectedDelivery.id?.slice(0, 8)}`, message: `Please confirm receipt.` }).catch(() => {});
    
    const pending = JSON.parse(localStorage.getItem('pendingDeliveryConfirmations') || '[]');
    pending.push({ orderId: selectedDelivery.id, orderNumber: selectedDelivery.order_number || selectedDelivery.id?.slice(0, 8), companyName: selectedDelivery.company_name, deliveryTime: time, deliveryPersonPlate: profile.vehiclePlate, notes: deliveryNotes });
    localStorage.setItem('pendingDeliveryConfirmations', JSON.stringify(pending));
    
    toast.success('Delivered!');
    setShowDeliveryModal(false);
    loadData();
  };

  const handleUpdateStatus = async (newStatus) => { 
    const newProfile = { ...profile, status: newStatus };
    setProfile(newProfile); 
    try {
      await deliveryAPI.updateProfile(newProfile);
    } catch (error) {
      localStorage.setItem('deliveryProfile', JSON.stringify(newProfile)); 
    }
    toast.success('Status updated'); 
  };

  const pendingDeliveries = deliveries.filter(d => d.deliveryStatus === 'pending');
  const inTransitDeliveries = deliveries.filter(d => d.deliveryStatus === 'in_transit');

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
    </div>
  );

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Delivery Dashboard</h1>
          <p className="text-gray-500 text-sm">Manage pickups and deliveries</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select 
            value={profile.status} 
            onChange={(e) => handleUpdateStatus(e.target.value)} 
            className={`flex-1 sm:flex-none px-3 py-2 rounded-full text-sm font-medium border-0 ${
              profile.status === 'available' ? 'bg-green-100 text-green-800' : 
              profile.status === 'on_delivery' ? 'bg-blue-100 text-blue-800' : 
              'bg-gray-100 text-gray-800'
            }`}
          >
            <option value="available">🟢 Available</option>
            <option value="on_delivery">🔵 On Delivery</option>
            <option value="off_duty">⚫ Off Duty</option>
          </select>
          <button 
            onClick={() => setShowProfileModal(true)} 
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
          >
            🚗 Profile
          </button>
        </div>
      </div>

      {/* Setup Banner */}
      {!profile.vehiclePlate && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <p className="font-bold text-yellow-800">⚠️ Complete Your Profile</p>
            <p className="text-sm text-yellow-600">Add your vehicle plate number to start delivering</p>
          </div>
          <button onClick={() => setShowProfileModal(true)} className="w-full sm:w-auto px-4 py-2 bg-yellow-600 text-white rounded-lg font-medium">
            Complete Setup
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        {[
          { l: 'Pending', v: stats.pending, icon: '📦', bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-700' },
          { l: 'In Transit', v: stats.inTransit, icon: '🚚', bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700' },
          { l: 'Awaiting', v: stats.delivered, icon: '⏳', bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-700' },
          { l: 'Completed', v: stats.completedToday, icon: '✅', bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700' },
        ].map((s, i) => (
          <button 
            key={i} 
            onClick={() => setActiveTab(i === 0 ? 'pending' : i === 1 ? 'transit' : 'delivered')}
            className={`${s.bg} rounded-xl p-3 sm:p-4 border-l-4 ${s.border} text-left hover:shadow-md transition-shadow`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{s.icon}</span>
              <p className={`text-xs sm:text-sm ${s.text} opacity-80`}>{s.l}</p>
            </div>
            <p className={`text-2xl sm:text-3xl font-bold ${s.text}`}>{s.v}</p>
          </button>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 flex overflow-x-auto">
          {[
            { id: 'pending', l: '📦 Pending', count: stats.pending },
            { id: 'transit', l: '🚚 In Transit', count: stats.inTransit },
            { id: 'delivered', l: '✅ Delivered', count: stats.delivered + stats.completedToday }
          ].map(t => (
            <button 
              key={t.id} 
              onClick={() => setActiveTab(t.id)} 
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === t.id 
                  ? 'border-cyan-500 text-cyan-600 bg-cyan-50/50' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.l}
              {t.count > 0 && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  activeTab === t.id ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-3 sm:p-6">
          {/* Pending Tab */}
          {activeTab === 'pending' && (
            <div className="space-y-3">
              {pendingDeliveries.length > 0 ? pendingDeliveries.map(order => (
                <div key={order.id} className="border-2 border-yellow-200 bg-yellow-50 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-mono font-bold text-gray-900">#{order.order_number || order.id?.slice(0, 8)}</p>
                      <p className="text-sm text-gray-600">{order.user_first_name} {order.user_last_name}</p>
                    </div>
                    <span className="px-3 py-1 text-xs rounded-full bg-yellow-200 text-yellow-800 font-medium">
                      Ready for Pickup
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2 flex items-center gap-2">
                    <span>🏢</span> {order.company_name}
                  </p>
                  {order.notes && (
                    <div className="bg-white border border-yellow-200 rounded-lg p-3 text-sm mb-3">
                      📝 {order.notes}
                    </div>
                  )}
                  <button 
                    onClick={() => handlePickup(order)} 
                    disabled={!profile.vehiclePlate} 
                    className="w-full px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    🚚 Pick Up Order
                  </button>
                </div>
              )) : (
                <div className="text-center py-12">
                  <p className="text-5xl mb-3">📦</p>
                  <p className="text-gray-600 font-medium">No pending pickups</p>
                  <p className="text-sm text-gray-400 mt-1">New orders will appear here when ready</p>
                </div>
              )}
            </div>
          )}

          {/* In Transit Tab */}
          {activeTab === 'transit' && (
            <div className="space-y-3">
              {inTransitDeliveries.length > 0 ? inTransitDeliveries.map(order => (
                <div key={order.id} className="border-2 border-blue-200 bg-blue-50 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-mono font-bold text-gray-900">#{order.order_number || order.id?.slice(0, 8)}</p>
                      <p className="text-sm text-gray-600">{order.user_first_name} {order.user_last_name}</p>
                    </div>
                    <span className="px-3 py-1 text-xs rounded-full bg-blue-200 text-blue-800 font-medium animate-pulse flex items-center gap-1">
                      🚚 In Transit
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2 flex items-center gap-2">
                    <span>🏢</span> {order.company_name}
                  </p>
                  <p className="text-xs text-gray-500 mb-3 flex items-center gap-2">
                    <span>⏰</span> Picked up: {order.pickupTime ? new Date(order.pickupTime).toLocaleTimeString() : 'N/A'}
                  </p>
                  <button 
                    onClick={() => handleMarkDelivered(order)} 
                    className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    ✅ Mark Delivered
                  </button>
                </div>
              )) : (
                <div className="text-center py-12">
                  <p className="text-5xl mb-3">🚚</p>
                  <p className="text-gray-600 font-medium">No deliveries in transit</p>
                  <p className="text-sm text-gray-400 mt-1">Pick up an order to start delivering</p>
                </div>
              )}
            </div>
          )}

          {/* Delivered Tab */}
          {activeTab === 'delivered' && (
            <div className="space-y-3">
              {deliveryHistory.length > 0 ? deliveryHistory.map((d, i) => (
                <div key={i} className={`border rounded-xl p-4 ${d.confirmed ? 'bg-gray-50 border-gray-200' : 'bg-green-50 border-green-200'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-mono font-bold text-gray-900">#{d.orderNumber || d.orderId?.slice(0, 8)}</p>
                      <p className="text-sm text-gray-600">{d.companyName}</p>
                    </div>
                    <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                      d.confirmed ? 'bg-gray-200 text-gray-700' : 'bg-green-200 text-green-800'
                    }`}>
                      {d.confirmed ? '✓ Confirmed' : '⏳ Awaiting Confirmation'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                    <span>⏰</span> {d.deliveryTime ? new Date(d.deliveryTime).toLocaleTimeString() : ''}
                  </p>
                  {d.notes && (
                    <p className="text-sm text-gray-600 mt-2">📝 {d.notes}</p>
                  )}
                </div>
              )) : (
                <div className="text-center py-12">
                  <p className="text-5xl mb-3">✅</p>
                  <p className="text-gray-600 font-medium">No deliveries today</p>
                  <p className="text-sm text-gray-400 mt-1">Completed deliveries will appear here</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">🚗 Delivery Profile</h2>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Plate *</label>
                <input 
                  placeholder="e.g., ABC 1234" 
                  value={profile.vehiclePlate} 
                  onChange={e => setProfile({ ...profile, vehiclePlate: e.target.value.toUpperCase() })} 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg tracking-wider font-mono" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cell Phone</label>
                <input 
                  placeholder="Phone number" 
                  value={profile.cellPhone} 
                  onChange={e => setProfile({ ...profile, cellPhone: e.target.value })} 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                <select 
                  value={profile.vehicleType} 
                  onChange={e => setProfile({ ...profile, vehicleType: e.target.value })} 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white"
                >
                  <option value="car">🚗 Car</option>
                  <option value="motorcycle">🏍️ Motorcycle</option>
                  <option value="bicycle">🚲 Bicycle</option>
                  <option value="van">🚐 Van</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowProfileModal(false)} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">
                  Cancel
                </button>
                <button onClick={saveProfile} className="flex-1 px-4 py-3 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 font-medium">
                  Save Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delivery Modal */}
      {showDeliveryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">✅ Confirm Delivery</h2>
            </div>
            <div className="p-4 sm:p-6">
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="font-mono font-bold text-gray-900">#{selectedDelivery?.order_number || selectedDelivery?.id?.slice(0, 8)}</p>
                <p className="text-gray-600">{selectedDelivery?.company_name}</p>
                <p className="text-sm text-gray-500">{selectedDelivery?.user_first_name} {selectedDelivery?.user_last_name}</p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Notes (optional)</label>
                <textarea 
                  placeholder="e.g., Left with receptionist, signature obtained..." 
                  value={deliveryNotes} 
                  onChange={e => setDeliveryNotes(e.target.value)} 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl" 
                  rows="3" 
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-sm text-blue-800 flex items-center gap-2">
                <span>📤</span> Will notify Kitchen & Receptionist
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowDeliveryModal(false)} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">
                  Cancel
                </button>
                <button onClick={handleConfirmDelivery} className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium">
                  Confirm Delivery
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
