/**
 * Employee Dashboard - Mobile-first responsive design
 * Main interface for employees to order meals
 */
import { useState, useEffect } from 'react';
import { orderAPI, messageAPI, dailyMenuAPI, companyAPI } from '../../services/api';
import WeeklyMenuView from '../../components/employee/WeeklyMenuView';
import toast from 'react-hot-toast';

export default function EmployeeDashboard() {
  const [activeTab, setActiveTab] = useState('menu');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [dailyMenu, setDailyMenu] = useState(null);
  const [cafeterias, setCafeterias] = useState([]);
  const [selectedCafeteria, setSelectedCafeteria] = useState('');
  const [myOrders, setMyOrders] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [cart, setCart] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [preferences, setPreferences] = useState({ vegan: false, vegetarian: false, glutenFree: false, dairyFree: false, nutFree: false, halal: false, kosher: false });

  const [showCartModal, setShowCartModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [feedbackForm, setFeedbackForm] = useState({ type: 'feedback', subject: '', message: '' });

  useEffect(() => { loadCafeterias(); loadPreferences(); loadFavorites(); }, []);
  useEffect(() => { if (selectedCafeteria) loadData(); }, [selectedCafeteria, selectedDate]);

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
      const dateStr = selectedDate.toISOString().split('T')[0];
      const [dailyMenuRes, ordersRes] = await Promise.all([
        dailyMenuAPI.getDailyMenu({ cafeteriaId: selectedCafeteria, date: dateStr }).catch(() => ({ data: { data: { dailyMenu: null, items: [] } } })),
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

  const loadFavorites = () => { 
    try { 
      const saved = localStorage.getItem('elos_favorites'); 
      if (saved) setFavorites(JSON.parse(saved)); 
    } catch (e) { console.error('Failed to load favorites:', e); } 
  };

  const toggleFavorite = (item) => { 
    const exists = favorites.find(f => f.id === item.id); 
    let newFavorites; 
    if (exists) { 
      newFavorites = favorites.filter(f => f.id !== item.id); 
    } else { 
      newFavorites = [...favorites, { id: item.id, name: item.item_name || item.name, price: item.price }]; 
    } 
    setFavorites(newFavorites); 
    localStorage.setItem('elos_favorites', JSON.stringify(newFavorites)); 
  };

  const loadPreferences = () => { 
    const saved = JSON.parse(localStorage.getItem('dietaryPreferences') || '{}'); 
    if (saved) setPreferences(saved); 
  };

  const savePreferences = () => { 
    localStorage.setItem('dietaryPreferences', JSON.stringify(preferences)); 
    toast.success('Preferences saved'); 
    setShowPreferencesModal(false); 
  };

  const addToCart = (item) => { 
    const existing = cart.find(c => c.id === item.id); 
    if (existing) { 
      setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)); 
    } else { 
      setCart([...cart, { ...item, quantity: 1, note: '' }]); 
    } 
    toast.success(`${item.item_name || item.name} added`); 
  };

  const removeFromCart = (itemId) => setCart(cart.filter(c => c.id !== itemId));

  const updateQuantity = (itemId, qty) => { 
    if (qty < 1) { removeFromCart(itemId); return; } 
    setCart(cart.map(c => c.id === itemId ? { ...c, quantity: qty } : c)); 
  };

  const updateItemNote = (itemId, note) => { 
    setCart(cart.map(c => c.id === itemId ? { ...c, note: note } : c)); 
  };

  const cartTotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * item.quantity, 0);

  const handlePlaceOrder = async () => {
    if (!selectedCafeteria) { toast.error('Please select a cafeteria'); return; }
    if (cart.length === 0) { toast.error('Your selection is empty'); return; }
    try { 
      await orderAPI.createDailyOrder({ 
        cafeteriaId: selectedCafeteria,
        orderDate: selectedDate.toISOString().split('T')[0],
        items: cart.map(c => ({ menuItemId: c.id, quantity: c.quantity, specialInstructions: c.note || '' })), 
        notes: orderNotes,
        mealCount: 1
      }); 
      toast.success('Order placed!'); 
      setCart([]); 
      setOrderNotes(''); 
      setShowCartModal(false); 
      loadData(); 
    } catch (error) { 
      console.error('Order failed:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to place order'); 
    }
  };

  const handleCancelOrder = async (order) => {
    if (!confirm('Cancel this order?')) return;
    try { 
      await orderAPI.cancelOrder(order.id); 
      toast.success('Cancelled'); 
      loadData(); 
    } catch { toast.error('Failed'); }
  };

  const handleReorder = (order) => {
    const items = (order.items || []).map(i => ({ 
      id: i.menu_item_id, name: i.name, price: i.price, quantity: i.quantity || 1, note: ''
    }));
    setCart(items);
    setShowCartModal(true);
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    try { 
      await messageAPI.submitFeedback(feedbackForm); 
      toast.success('Feedback submitted'); 
      setShowFeedbackModal(false); 
      setFeedbackForm({ type: 'feedback', subject: '', message: '' }); 
    } catch { toast.error('Failed'); }
  };

  const filteredItems = menuItems.filter(item => {
    if (preferences.vegan && !item.is_vegan) return false;
    if (preferences.vegetarian && !item.is_vegetarian) return false;
    if (preferences.glutenFree && !item.is_gluten_free) return false;
    if (preferences.dairyFree && !item.is_dairy_free) return false;
    if (preferences.nutFree && !item.is_nut_free) return false;
    if (preferences.halal && !item.is_halal) return false;
    if (preferences.kosher && !item.is_kosher) return false;
    return true;
  });

  const getCafeteriaName = () => { 
    const c = cafeterias.find(c => c.id === selectedCafeteria); 
    return c?.name || 'Cafeteria'; 
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Welcome!</h1>
          <p className="text-gray-500 text-sm">Order your meal for today</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setShowPreferencesModal(true)} 
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
          >
            ⚙️ <span className="hidden sm:inline">Preferences</span>
          </button>
          <button 
            onClick={() => setShowFeedbackModal(true)} 
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
          >
            💬 <span className="hidden sm:inline">Feedback</span>
          </button>
          <button 
            onClick={() => setShowCartModal(true)} 
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium relative"
          >
            🍽️ <span className="hidden sm:inline">Selection</span>
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Current Order Status */}
      {currentOrder && (
        <div className={`${currentOrder.status === 'ready' ? 'bg-green-100 border-green-500 animate-pulse' : 'bg-blue-100 border-blue-500'} border-2 rounded-xl p-4`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <p className="font-bold text-gray-900">
                {currentOrder.status === 'ready' ? '🎉 Your order is READY!' : 
                 currentOrder.status === 'preparing' ? '👨‍🍳 Order being prepared...' : 
                 '⏳ Order pending'}
              </p>
              <p className="text-sm text-gray-600">Order #{currentOrder.order_number || currentOrder.id?.slice(0, 8)}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              currentOrder.status === 'ready' ? 'bg-green-500 text-white' : 
              currentOrder.status === 'preparing' ? 'bg-blue-500 text-white' : 
              'bg-yellow-500 text-white'
            }`}>
              {currentOrder.status}
            </span>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-1 sm:mb-2 text-lg sm:text-xl">🍽️</div>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{menuItems.length}</p>
          <p className="text-xs text-gray-500">Menu Items</p>
        </div>
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-1 sm:mb-2 text-lg sm:text-xl">📦</div>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{myOrders.length}</p>
          <p className="text-xs text-gray-500">Active Orders</p>
        </div>
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-1 sm:mb-2 text-lg sm:text-xl">⭐</div>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{favorites.length}</p>
          <p className="text-xs text-gray-500">Favorites</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 flex overflow-x-auto">
          {[
            { id: 'menu', l: '🍽️ Menu', short: '🍽️' }, 
            { id: 'orders', l: '📦 Orders', short: '📦' }, 
            { id: 'history', l: '📜 History', short: '📜' }
          ].map(t => (
            <button 
              key={t.id} 
              onClick={() => setActiveTab(t.id)} 
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === t.id 
                  ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="hidden sm:inline">{t.l}</span>
              <span className="sm:hidden">{t.short} {t.id.charAt(0).toUpperCase() + t.id.slice(1)}</span>
            </button>
          ))}
        </div>

        <div className="p-3 sm:p-6">
          {/* Menu Tab */}
          {activeTab === 'menu' && (
            <WeeklyMenuView 
              menuItems={filteredItems} 
              dailyMenu={dailyMenu} 
              selectedDate={selectedDate} 
              onDateChange={setSelectedDate} 
              onAddToCart={addToCart} 
              cafeteriaName={getCafeteriaName()} 
            />
          )}

          {/* My Orders Tab */}
          {activeTab === 'orders' && (
            <div className="space-y-3">
              {myOrders.length > 0 ? myOrders.map(order => (
                <div key={order.id} className="border border-gray-200 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-mono font-bold text-gray-900">
                        #{order.order_number || order.id?.slice(0, 8)}
                      </p>
                      <p className="text-sm text-gray-500">{order.order_date}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                      order.status === 'ready' ? 'bg-green-100 text-green-700' : 
                      order.status === 'preparing' ? 'bg-blue-100 text-blue-700' : 
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {order.status === 'ready' ? '✓ Ready' : order.status === 'preparing' ? '👨‍🍳 Preparing' : '⏳ Pending'}
                    </span>
                  </div>
                  {order.items && order.items.length > 0 && (
                    <div className="text-sm text-gray-600 mb-2">
                      {order.items.map(i => i.name).join(', ')}
                    </div>
                  )}
                  {order.status === 'pending' && (
                    <button onClick={() => handleCancelOrder(order)} className="text-red-600 text-sm font-medium">
                      ✕ Cancel Order
                    </button>
                  )}
                </div>
              )) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">📦</p>
                  <p className="text-gray-500">No active orders</p>
                  <p className="text-sm text-gray-400 mt-1">Your orders will appear here</p>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {orderHistory.length > 0 ? orderHistory.map(order => (
                <div key={order.id} className="border border-gray-200 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-mono font-bold text-gray-900">
                        #{order.order_number || order.id?.slice(0, 8)}
                      </p>
                      <p className="text-sm text-gray-500">{order.order_date}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                      order.status === 'completed' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {order.status === 'completed' ? '✓ Completed' : '✕ Cancelled'}
                    </span>
                  </div>
                  {order.items && order.items.length > 0 && (
                    <div className="text-sm text-gray-600 mb-2">
                      {order.items.map(i => i.name).join(', ')}
                    </div>
                  )}
                  <button onClick={() => handleReorder(order)} className="text-indigo-600 text-sm font-medium">
                    🔄 Reorder
                  </button>
                </div>
              )) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">📜</p>
                  <p className="text-gray-500">No order history</p>
                  <p className="text-sm text-gray-400 mt-1">Past orders will appear here</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* My Selection Modal (Cart) */}
      {showCartModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">🍽️ My Selection</h2>
              <button onClick={() => setShowCartModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
            </div>
            
            <div className="p-4">
              {cart.length > 0 ? (
                <>
                  <div className="space-y-3 mb-4">
                    {cart.map(item => (
                      <div key={item.id} className="p-4 bg-gray-50 rounded-xl">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{item.item_name || item.name}</p>
                            <p className="text-sm text-green-600 font-medium">${parseFloat(item.price || 0).toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-3">
                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-lg flex items-center justify-center text-lg">-</button>
                            <span className="w-6 text-center font-medium">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-lg flex items-center justify-center text-lg">+</button>
                            <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700 ml-1 text-xl">×</button>
                          </div>
                        </div>
                        <input
                          type="text"
                          placeholder="Special instructions..."
                          value={item.note || ''}
                          onChange={(e) => updateItemNote(item.id, e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg mt-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 pt-4 mb-4">
                    <div className="flex justify-between text-lg font-bold text-gray-900">
                      <span>Total:</span>
                      <span className="text-green-600">${cartTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                    <textarea 
                      placeholder="Any other notes for your order..." 
                      value={orderNotes} 
                      onChange={e => setOrderNotes(e.target.value)} 
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500" 
                      rows="2" 
                    />
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setShowCartModal(false)} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
                      Continue
                    </button>
                    <button onClick={handlePlaceOrder} className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">
                      ✓ Place Order
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-5xl mb-3">🍽️</p>
                  <p className="text-gray-600 font-medium">No items selected</p>
                  <p className="text-sm text-gray-400 mt-2">Go to the menu and select your meal</p>
                  <button onClick={() => setShowCartModal(false)} className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium">
                    View Menu
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">💬 Send Feedback</h2>
            </div>
            <form onSubmit={handleSubmitFeedback} className="p-4 sm:p-6 space-y-4">
              <select 
                value={feedbackForm.type} 
                onChange={e => setFeedbackForm({ ...feedbackForm, type: e.target.value })} 
                className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white"
              >
                <option value="feedback">General Feedback</option>
                <option value="suggestion">Suggestion</option>
                <option value="complaint">Complaint</option>
                <option value="compliment">Compliment</option>
                <option value="issue">Report Issue</option>
              </select>
              <input 
                placeholder="Subject" 
                value={feedbackForm.subject} 
                onChange={e => setFeedbackForm({ ...feedbackForm, subject: e.target.value })} 
                className="w-full px-4 py-3 border border-gray-200 rounded-lg" 
                required 
              />
              <textarea 
                placeholder="Your message..." 
                value={feedbackForm.message} 
                onChange={e => setFeedbackForm({ ...feedbackForm, message: e.target.value })} 
                className="w-full px-4 py-3 border border-gray-200 rounded-lg" 
                rows="4" 
                required 
              />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowFeedbackModal(false)} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      {showPreferencesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">⚙️ Dietary Preferences</h2>
              <p className="text-sm text-gray-500 mt-1">Filter menu items by your requirements</p>
            </div>
            <div className="p-4 sm:p-6 space-y-2">
              {[
                { key: 'vegan', label: '🌱 Vegan', bg: 'bg-green-50 hover:bg-green-100' },
                { key: 'vegetarian', label: '🥬 Vegetarian', bg: 'bg-lime-50 hover:bg-lime-100' },
                { key: 'glutenFree', label: '🌾 Gluten-Free', bg: 'bg-amber-50 hover:bg-amber-100' },
                { key: 'dairyFree', label: '🥛 Dairy-Free', bg: 'bg-blue-50 hover:bg-blue-100' },
                { key: 'nutFree', label: '🥜 Nut-Free', bg: 'bg-orange-50 hover:bg-orange-100' },
                { key: 'halal', label: '🍖 Halal', bg: 'bg-emerald-50 hover:bg-emerald-100' },
                { key: 'kosher', label: '✡️ Kosher', bg: 'bg-indigo-50 hover:bg-indigo-100' },
              ].map(pref => (
                <label key={pref.key} className={`flex items-center gap-3 p-4 ${pref.bg} rounded-xl cursor-pointer transition-colors`}>
                  <input 
                    type="checkbox" 
                    checked={preferences[pref.key]} 
                    onChange={e => setPreferences({ ...preferences, [pref.key]: e.target.checked })} 
                    className="w-5 h-5 rounded" 
                  />
                  <span className="font-medium">{pref.label}</span>
                </label>
              ))}
            </div>
            <div className="sticky bottom-0 bg-white p-4 sm:p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowPreferencesModal(false)} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
                Cancel
              </button>
              <button onClick={savePreferences} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
