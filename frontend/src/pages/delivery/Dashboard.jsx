import { useState, useEffect } from 'react';
import { orderAPI, messageAPI, deliveryAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import toast from 'react-hot-toast';

export default function DeliveryDashboard() {
  const { colors, getStatCardColors } = useTheme();
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
      // Fallback to localStorage if API fails
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
      // Fallback to localStorage if API fails
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
      
      // Merge with localStorage as fallback
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
      // Update server
      await deliveryAPI.updateTracking(orderId, { status, ...data });
    } catch (error) {
      console.error('Server tracking update failed, using localStorage:', error);
    }
    // Always update localStorage as backup
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
    
    // Also update localStorage pending confirmations as backup
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className={`text-2xl font-bold ${colors.textPrimary}`}>Delivery Dashboard</h1><p className={colors.textMuted}>Manage pickups and deliveries</p></div>
        <div className="flex items-center gap-3">
          <select value={profile.status} onChange={(e) => handleUpdateStatus(e.target.value)} className={`px-3 py-1 rounded-full text-sm font-medium ${profile.status === 'available' ? 'bg-green-100 text-green-800' : profile.status === 'on_delivery' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}><option value="available">🟢 Available</option><option value="on_delivery">🔵 On Delivery</option><option value="off_duty">⚫ Off Duty</option></select>
          <button onClick={() => setShowProfileModal(true)} className={`px-4 py-2 ${colors.bgSecondary} rounded-lg ${colors.bgHover}`}>🚗 Profile</button>
        </div>
      </div>

      {!profile.vehiclePlate && <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 flex justify-between items-center"><div><p className="font-medium text-yellow-800">Complete Your Profile</p><p className="text-sm text-yellow-600">Add vehicle plate to start</p></div><button onClick={() => setShowProfileModal(true)} className="px-4 py-2 bg-yellow-600 text-white rounded-lg">Complete</button></div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[{ l: 'Pending', v: stats.pending }, { l: 'In Transit', v: stats.inTransit }, { l: 'Awaiting Confirm', v: stats.delivered }, { l: 'Completed', v: stats.completedToday }].map((s, i) => { const c = getStatCardColors(i); return <div key={i} className={`${c.bg} rounded-xl p-4 border-l-4 ${c.border} cursor-pointer`} onClick={() => setActiveTab(i === 0 ? 'pending' : i === 1 ? 'transit' : 'delivered')}><p className={`text-sm ${c.text} opacity-80`}>{s.l}</p><p className={`text-2xl font-bold ${c.text}`}>{s.v}</p></div>; })}
      </div>

      <div className={`${colors.bgCard} rounded-xl shadow-sm border ${colors.border}`}>
        <div className={`border-b ${colors.border} flex`}>{[{ id: 'pending', l: '📦 Pending' }, { id: 'transit', l: '🚚 In Transit' }, { id: 'delivered', l: '✅ Delivered' }].map(t => <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-6 py-4 text-sm font-medium border-b-2 ${activeTab === t.id ? 'border-cyan-500 text-cyan-600' : `border-transparent ${colors.textMuted}`}`}>{t.l}</button>)}</div>

        <div className="p-6">
          {activeTab === 'pending' && (
            <div className="space-y-4">
              {pendingDeliveries.length > 0 ? pendingDeliveries.map(order => (
                <div key={order.id} className="border-2 border-yellow-200 bg-yellow-50 rounded-xl p-4">
                  <div className="flex justify-between mb-2"><div><p className="font-mono font-bold">#{order.order_number || order.id?.slice(0, 8)}</p><p className={`text-sm ${colors.textMuted}`}>{order.user_first_name} {order.user_last_name}</p></div><span className="px-2 py-1 text-xs rounded-full bg-yellow-200 text-yellow-800">Ready</span></div>
                  <p className={`text-sm ${colors.textSecondary} mb-2`}>{order.company_name}</p>
                  {order.notes && <div className={`${colors.bgCard} border rounded p-2 text-sm mb-2`}>📝 {order.notes}</div>}
                  <button onClick={() => handlePickup(order)} disabled={!profile.vehiclePlate} className="w-full px-4 py-3 bg-cyan-600 text-white rounded-lg disabled:opacity-50">🚚 Pick Up</button>
                </div>
              )) : <p className={`text-center py-12 ${colors.textMuted}`}>No pending pickups</p>}
            </div>
          )}

          {activeTab === 'transit' && (
            <div className="space-y-4">
              {inTransitDeliveries.length > 0 ? inTransitDeliveries.map(order => (
                <div key={order.id} className="border-2 border-blue-200 bg-blue-50 rounded-xl p-4">
                  <div className="flex justify-between mb-2"><div><p className="font-mono font-bold">#{order.order_number || order.id?.slice(0, 8)}</p><p className={`text-sm ${colors.textMuted}`}>{order.user_first_name} {order.user_last_name}</p></div><span className="px-2 py-1 text-xs rounded-full bg-blue-200 text-blue-800 animate-pulse">🚚 In Transit</span></div>
                  <p className={`text-sm ${colors.textSecondary} mb-2`}>{order.company_name}</p>
                  <p className={`text-xs ${colors.textMuted} mb-2`}>Picked up: {order.pickupTime ? new Date(order.pickupTime).toLocaleTimeString() : 'N/A'}</p>
                  <button onClick={() => handleMarkDelivered(order)} className="w-full px-4 py-3 bg-green-600 text-white rounded-lg">✅ Mark Delivered</button>
                </div>
              )) : <p className={`text-center py-12 ${colors.textMuted}`}>No deliveries in transit</p>}
            </div>
          )}

          {activeTab === 'delivered' && (
            <div className="space-y-4">
              {deliveryHistory.length > 0 ? deliveryHistory.map((d, i) => (
                <div key={i} className={`border rounded-xl p-4 ${d.confirmed ? 'bg-gray-50' : 'bg-green-50 border-green-200'}`}>
                  <div className="flex justify-between"><div><p className="font-mono font-bold">#{d.orderNumber || d.orderId?.slice(0, 8)}</p><p className={`text-sm ${colors.textMuted}`}>{d.companyName}</p></div><span className={`px-2 py-1 text-xs rounded-full ${d.confirmed ? 'bg-gray-200 text-gray-700' : 'bg-green-200 text-green-800'}`}>{d.confirmed ? '✓ Confirmed' : '⏳ Awaiting'}</span></div>
                  <p className={`text-xs ${colors.textMuted} mt-1`}>{d.deliveryTime ? new Date(d.deliveryTime).toLocaleTimeString() : ''}</p>
                </div>
              )) : <p className={`text-center py-12 ${colors.textMuted}`}>No deliveries today</p>}
            </div>
          )}
        </div>
      </div>

      {showProfileModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-md`}><h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>🚗 Delivery Profile</h2><div className="space-y-4"><input placeholder="Vehicle Plate (e.g., ABC 1234)" value={profile.vehiclePlate} onChange={e => setProfile({ ...profile, vehiclePlate: e.target.value.toUpperCase() })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} /><input placeholder="Cell Phone" value={profile.cellPhone} onChange={e => setProfile({ ...profile, cellPhone: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} /><select value={profile.vehicleType} onChange={e => setProfile({ ...profile, vehicleType: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`}><option value="car">🚗 Car</option><option value="motorcycle">🏍️ Motorcycle</option><option value="bicycle">🚲 Bicycle</option><option value="van">🚐 Van</option></select><div className="flex justify-end gap-3"><button onClick={() => setShowProfileModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button onClick={saveProfile} className="px-4 py-2 bg-cyan-600 text-white rounded-lg">Save</button></div></div></div></div>}

      {showDeliveryModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-md`}><h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>✅ Confirm Delivery</h2><div className={`${colors.bgSecondary} rounded-lg p-4 mb-4`}><p className="font-mono font-bold">#{selectedDelivery?.order_number || selectedDelivery?.id?.slice(0, 8)}</p><p className={colors.textSecondary}>{selectedDelivery?.company_name}</p></div><textarea placeholder="Notes (optional)" value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} className={`w-full px-4 py-2 border ${colors.border} rounded-lg mb-4`} rows="3" /><div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">📤 Will notify Kitchen & Receptionist</div><div className="flex justify-end gap-3"><button onClick={() => setShowDeliveryModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button onClick={handleConfirmDelivery} className="px-4 py-2 bg-green-600 text-white rounded-lg">Confirm</button></div></div></div>}
    </div>
  );
}
