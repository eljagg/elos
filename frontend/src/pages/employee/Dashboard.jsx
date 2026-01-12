import { useState, useEffect } from 'react';
import { orderAPI, menuAPI, messageAPI, dailyMenuAPI, companyAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import toast from 'react-hot-toast';

export default function EmployeeDashboard() {
  const { colors, getStatCardColors } = useTheme();
  const [activeTab, setActiveTab] = useState('menu');
  const [loading, setLoading] = useState(true);
  const [menus, setMenus] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [dailyMenu, setDailyMenu] = useState(null);
  const [cafeterias, setCafeterias] = useState([]);
  const [selectedCafeteria, setSelectedCafeteria] = useState('');
  const [myOrders, setMyOrders] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [cart, setCart] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [preferences, setPreferences] = useState({ vegan: false, vegetarian: false, glutenFree: false });
  const [filters, setFilters] = useState({ mealType: '', menuType: '', search: '' });

  const [showCartModal, setShowCartModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [feedbackForm, setFeedbackForm] = useState({ type: 'feedback', subject: '', message: '' });

  useEffect(() => { loadCafeterias(); loadPreferences(); loadFavorites(); }, []);
  useEffect(() => { if (selectedCafeteria) loadData(); }, [selectedCafeteria]);

  const loadCafeterias = async () => {
    try {
      const res = await companyAPI.getCafeterias();
      const list = res.data?.data?.cafeterias || [];
      setCafeterias(list);
      if (list.length > 0) setSelectedCafeteria(list[0].id);
    } catch (error) { console.error('Failed to load cafeterias:', error); }
  };
  const loadData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [dailyMenuRes, ordersRes] = await Promise.all([
        dailyMenuAPI.getDailyMenu({ cafeteriaId: selectedCafeteria, date: today }).catch(() => ({ data: { data: { dailyMenu: null, items: [] } } })),
        orderAPI.getMyOrders().catch(() => ({ data: { data: { orders: [] } } }))
      ]);
      setDailyMenu(dailyMenuRes.data?.data?.dailyMenu);
      setMenuItems(dailyMenuRes.data?.data?.items?.filter(i => !i.is_sold_out && i.portions_remaining > 0) || []);
      const orders = ordersRes.data?.data?.orders || [];
      setMyOrders(orders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status)));
      setOrderHistory(orders.filter(o => ['completed', 'cancelled'].includes(o.status)));
      setCurrentOrder(orders.find(o => ['pending', 'preparing', 'ready'].includes(o.status)));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const loadPreferences = () => { const saved = JSON.parse(localStorage.getItem('dietaryPreferences') || '{}'); if (saved) setPreferences(saved); };
  const savePreferences = () => { localStorage.setItem('dietaryPreferences', JSON.stringify(preferences)); toast.success('Preferences saved'); setShowPreferencesModal(false); };

  const addToCart = (item) => { const existing = cart.find(c => c.id === item.id); if (existing) { setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)); } else { setCart([...cart, { ...item, quantity: 1, note: '' }]); } toast.success(`${item.name} added`); };
  const removeFromCart = (itemId) => { setCart(cart.filter(c => c.id !== itemId)); };
  const updateQuantity = (itemId, qty) => { if (qty < 1) { removeFromCart(itemId); return; } setCart(cart.map(c => c.id === itemId ? { ...c, quantity: qty } : c)); };
  const updateItemNote = (itemId, note) => { setCart(cart.map(c => c.id === itemId ? { ...c, note: note } : c)); };
  const cartTotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * item.quantity, 0);

  const handlePlaceOrder = async () => {
    try { await orderAPI.createOrder({ items: cart.map(c => ({ menuItemId: c.id, quantity: c.quantity, specialInstructions: c.note || '' })), notes: orderNotes }); toast.success('Order placed!'); setCart([]); setOrderNotes(''); setShowCartModal(false); loadData(); } catch { toast.error('Failed'); }
  };

  const handleCancelOrder = async (order) => {
    if (!confirm('Cancel this order?')) return;
    try { await orderAPI.cancelOrder(order.id); toast.success('Cancelled'); loadData(); } catch { toast.error('Failed'); }
  };

  const handleReorder = (order) => {
    const items = (order.items || []).map(i => ({ id: i.menu_item_id, name: i.name, price: i.price, quantity: i.quantity || 1 }));
    setCart(items);
    setShowCartModal(true);
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    try { await messageAPI.submitFeedback(feedbackForm); toast.success('Feedback submitted'); setShowFeedbackModal(false); setFeedbackForm({ type: 'feedback', subject: '', message: '' }); } catch { toast.error('Failed'); }
  };

  const filteredItems = menuItems.filter(item => {
    if (filters.search && !item.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (preferences.vegan && !item.is_vegan) return false;
    if (preferences.vegetarian && !item.is_vegetarian) return false;
    if (preferences.glutenFree && !item.is_gluten_free) return false;
    return true;
  });

  const groupedItems = filteredItems.reduce((acc, item) => { const cat = item.category || 'Other'; if (!acc[cat]) acc[cat] = []; acc[cat].push(item); return acc; }, {});

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className={`text-2xl font-bold ${colors.textPrimary}`}>Welcome!</h1><p className={colors.textMuted}>Order your meal for today</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowPreferencesModal(true)} className={`px-4 py-2 ${colors.bgSecondary} rounded-lg ${colors.bgHover}`}>⚙️ Preferences</button>
          <button onClick={() => setShowFeedbackModal(true)} className={`px-4 py-2 ${colors.bgSecondary} rounded-lg ${colors.bgHover}`}>💬 Feedback</button>
          <button onClick={() => setShowCartModal(true)} className={`px-4 py-2 ${colors.btnPrimary} rounded-lg relative`}>🛒 Cart {cart.length > 0 && <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{cart.length}</span>}</button>
        </div>
      </div>

      {currentOrder && (
        <div className={`${currentOrder.status === 'ready' ? 'bg-green-100 border-green-500 animate-pulse' : 'bg-blue-100 border-blue-500'} border-2 rounded-xl p-4`}>
          <div className="flex justify-between items-center">
            <div><p className="font-bold">{currentOrder.status === 'ready' ? '🎉 Your order is READY!' : currentOrder.status === 'preparing' ? '👨‍🍳 Order being prepared...' : '⏳ Order pending'}</p><p className="text-sm">Order #{currentOrder.order_number || currentOrder.id?.slice(0, 8)}</p></div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${currentOrder.status === 'ready' ? 'bg-green-500 text-white' : currentOrder.status === 'preparing' ? 'bg-blue-500 text-white' : 'bg-yellow-500 text-white'}`}>{currentOrder.status}</span>
          </div>
        </div>
      )}

      <div className={`${colors.bgCard} rounded-xl shadow-sm border ${colors.border}`}>
        <div className={`border-b ${colors.border} flex`}>{[{ id: 'menu', l: '🍽️ Menu' }, { id: 'orders', l: '📦 My Orders' }, { id: 'history', l: '📜 History' }].map(t => <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-6 py-4 text-sm font-medium border-b-2 ${activeTab === t.id ? 'border-indigo-500 text-indigo-600' : `border-transparent ${colors.textMuted}`}`}>{t.l}</button>)}</div>

        <div className="p-6">
          {activeTab === 'menu' && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-4">
                <input placeholder="Search items..." className={`px-4 py-2 border ${colors.border} rounded-lg flex-1`} value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} />
                <div className="flex gap-2">
                  {preferences.vegan && <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">Vegan</span>}
                  {preferences.vegetarian && <span className="px-3 py-1 bg-lime-100 text-lime-700 rounded-full text-sm">Vegetarian</span>}
                </div>
              </div>

              {Object.entries(groupedItems).map(([category, items]) => (
                <div key={category}>
                  <h3 className={`font-semibold mb-3 ${colors.textPrimary} capitalize`}>{category}s</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map(item => (
                      <div key={item.id} className={`border ${colors.border} rounded-xl p-4 ${colors.bgCard} hover:shadow-md transition-shadow`}>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className={`font-medium ${colors.textPrimary}`}>{item.name}</h4>
                          <span className={`font-bold ${colors.accentText}`}>${item.price}</span>
                        </div>
                        <p className={`text-sm ${colors.textMuted} mb-2`}>{item.description}</p>
                        <div className="flex gap-1 mb-3">
                          {item.is_vegan && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">Vegan</span>}
                          {item.is_vegetarian && <span className="px-2 py-0.5 bg-lime-100 text-lime-700 text-xs rounded">Veg</span>}
                        </div>
                        {item.ingredients && <p className={`text-xs ${colors.textMuted} mb-2`}>📝 {item.ingredients}</p>}
                        <button onClick={() => addToCart(item)} className={`w-full px-4 py-2 ${colors.btnPrimary} rounded-lg text-sm`}>+ Add to Cart</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-4">
              {myOrders.length > 0 ? myOrders.map(order => (
                <div key={order.id} className={`border ${colors.border} rounded-xl p-4 ${colors.bgCard}`}>
                  <div className="flex justify-between mb-2"><div><p className={`font-mono font-bold ${colors.textPrimary}`}>#{order.order_number || order.id?.slice(0, 8)}</p><p className={`text-sm ${colors.textMuted}`}>{order.order_date}</p></div><span className={`px-2 py-1 text-xs rounded-full ${order.status === 'ready' ? 'bg-green-100 text-green-700' : order.status === 'preparing' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{order.status}</span></div>
                  {order.status === 'pending' && <button onClick={() => handleCancelOrder(order)} className="text-red-600 text-sm">Cancel Order</button>}
                </div>
              )) : <p className={colors.textMuted}>No active orders</p>}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              {orderHistory.length > 0 ? orderHistory.map(order => (
                <div key={order.id} className={`border ${colors.border} rounded-xl p-4 ${colors.bgCard}`}>
                  <div className="flex justify-between mb-2"><div><p className={`font-mono font-bold ${colors.textPrimary}`}>#{order.order_number || order.id?.slice(0, 8)}</p><p className={`text-sm ${colors.textMuted}`}>{order.order_date}</p></div><span className={`px-2 py-1 text-xs rounded-full ${order.status === 'completed' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'}`}>{order.status}</span></div>
                  <button onClick={() => handleReorder(order)} className="text-blue-600 text-sm">🔄 Reorder</button>
                </div>
              )) : <p className={colors.textMuted}>No order history</p>}
            </div>
          )}
        </div>
      </div>

      {showCartModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto`}><h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>🛒 Your Cart</h2>{cart.length > 0 ? <><div className="space-y-3 mb-4">{cart.map(item => <div key={item.id} className={`flex justify-between items-center p-3 ${colors.bgSecondary} rounded-lg`}><div><p className={colors.textPrimary}>{item.name}</p><p className={`text-sm ${colors.textMuted}`}>${item.price}</p></div><div className="flex items-center gap-2"><button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 bg-gray-200 rounded">-</button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 bg-gray-200 rounded">+</button><button onClick={() => removeFromCart(item.id)} className="text-red-600 ml-2">✕</button></div></div>)}</div><div className={`border-t ${colors.border} pt-4 mb-4`}><div className="flex justify-between text-lg font-bold"><span>Total:</span><span>${cartTotal.toFixed(2)}</span></div></div><textarea placeholder="Order notes..." value={orderNotes} onChange={e => setOrderNotes(e.target.value)} className={`w-full px-4 py-2 border ${colors.border} rounded-lg mb-4`} rows="2" /><div className="flex gap-3"><button onClick={() => setShowCartModal(false)} className={`flex-1 px-4 py-2 border ${colors.border} rounded-lg`}>Continue</button><button onClick={handlePlaceOrder} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg">Place Order</button></div></> : <p className={colors.textMuted}>Cart is empty</p>}</div></div>}

      {showFeedbackModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-lg`}><h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>💬 Send Feedback</h2><form onSubmit={handleSubmitFeedback} className="space-y-4"><select value={feedbackForm.type} onChange={e => setFeedbackForm({ ...feedbackForm, type: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`}><option value="feedback">General Feedback</option><option value="suggestion">Suggestion</option><option value="complaint">Complaint</option><option value="compliment">Compliment</option><option value="issue">Report Issue</option></select><input placeholder="Subject" value={feedbackForm.subject} onChange={e => setFeedbackForm({ ...feedbackForm, subject: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} required /><textarea placeholder="Your message..." value={feedbackForm.message} onChange={e => setFeedbackForm({ ...feedbackForm, message: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} rows="4" required /><div className="flex justify-end gap-3"><button type="button" onClick={() => setShowFeedbackModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Submit</button></div></form></div></div>}

      {showPreferencesModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-md`}><h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>⚙️ Dietary Preferences</h2><div className="space-y-3 mb-4"><label className="flex items-center gap-3 p-3 bg-green-50 rounded-lg"><input type="checkbox" checked={preferences.vegan} onChange={e => setPreferences({ ...preferences, vegan: e.target.checked })} className="w-5 h-5" /><span>🌱 Vegan</span></label><label className="flex items-center gap-3 p-3 bg-lime-50 rounded-lg"><input type="checkbox" checked={preferences.vegetarian} onChange={e => setPreferences({ ...preferences, vegetarian: e.target.checked })} className="w-5 h-5" /><span>🥬 Vegetarian</span></label><label className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg"><input type="checkbox" checked={preferences.glutenFree} onChange={e => setPreferences({ ...preferences, glutenFree: e.target.checked })} className="w-5 h-5" /><span>🌾 Gluten-Free</span></label></div><div className="flex justify-end gap-3"><button onClick={() => setShowPreferencesModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button onClick={savePreferences} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Save</button></div></div></div>}
    </div>
  );
}
