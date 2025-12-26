import { useState, useEffect } from 'react';
import { menuAPI, orderAPI, messageAPI, userAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function EmployeeDashboard() {
  const [activeTab, setActiveTab] = useState('menu');
  const [loading, setLoading] = useState(true);
  const [menus, setMenus] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [cart, setCart] = useState([]);
  const [dietaryPrefs, setDietaryPrefs] = useState({ vegan: false, vegetarian: false, glutenFree: false });
  const [filters, setFilters] = useState({ mealType: 'lunch', menuType: '', search: '' });

  // Modals
  const [showCartModal, setShowCartModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showPrefsModal, setShowPrefsModal] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(null);

  const [feedbackForm, setFeedbackForm] = useState({ type: 'feedback', subject: '', message: '', orderId: '' });
  const [orderNotes, setOrderNotes] = useState('');

  useEffect(() => { loadData(); loadPreferences(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [menusRes, itemsRes, ordersRes] = await Promise.all([
        menuAPI.getMenus({ isActive: true }).catch(() => ({ data: { data: { menus: [] } } })),
        menuAPI.getMenuItems({ isAvailable: true }).catch(() => ({ data: { data: { items: [] } } })),
        orderAPI.getMyOrders({ limit: 50 }).catch(() => ({ data: { data: { orders: [] } } }))
      ]);

      setMenus(menusRes.data?.data?.menus || []);
      setMenuItems(itemsRes.data?.data?.items || []);
      setOrders(ordersRes.data?.data?.orders || []);

      // Check for current active order
      const active = ordersRes.data?.data?.orders?.find(o => ['pending', 'preparing', 'ready'].includes(o.status));
      setCurrentOrder(active || null);
    } catch (error) { console.error('Failed to load data:', error); }
    finally { setLoading(false); }
  };

  const loadPreferences = () => {
    const saved = JSON.parse(localStorage.getItem('dietaryPrefs') || '{}');
    if (saved) setDietaryPrefs({ vegan: saved.vegan || false, vegetarian: saved.vegetarian || false, glutenFree: saved.glutenFree || false });
  };

  const savePreferences = () => {
    localStorage.setItem('dietaryPrefs', JSON.stringify(dietaryPrefs));
    toast.success('Preferences saved');
    setShowPrefsModal(false);
  };

  // Cart Management
  const addToCart = (item) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
    toast.success(`${item.name} added to cart`);
  };

  const updateCartQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      setCart(cart.filter(c => c.id !== itemId));
    } else {
      setCart(cart.map(c => c.id === itemId ? { ...c, quantity } : c));
    }
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(c => c.id !== itemId));
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * item.quantity, 0);
  };

  // Order Submission
  const handleSubmitOrder = async () => {
    if (cart.length === 0) return toast.error('Cart is empty');
    
    try {
      const orderData = {
        mealType: filters.mealType,
        orderDate: new Date().toISOString().split('T')[0],
        notes: orderNotes,
        items: cart.map(item => ({
          menuItemId: item.id,
          quantity: item.quantity,
          price: item.price,
          notes: item.notes || ''
        }))
      };
      
      await orderAPI.createOrder(orderData);
      toast.success('Order placed successfully!');
      setCart([]);
      setOrderNotes('');
      setShowCartModal(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to place order');
    }
  };

  // Quick Reorder
  const handleReorder = async (order) => {
    if (!order.items || order.items.length === 0) {
      toast.error('No items to reorder');
      return;
    }
    setCart(order.items.map(item => ({
      id: item.menu_item_id || item.id,
      name: item.name || item.menu_item_name,
      price: item.price,
      quantity: item.quantity
    })));
    setShowCartModal(true);
    toast.success('Items added to cart');
  };

  // Cancel Order
  const handleCancelOrder = async (orderId) => {
    if (!confirm('Cancel this order?')) return;
    try {
      await orderAPI.cancelOrder(orderId);
      toast.success('Order cancelled');
      loadData();
    } catch { toast.error('Failed to cancel order'); }
  };

  // Feedback
  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    try {
      await messageAPI.submitFeedback(feedbackForm);
      toast.success('Feedback submitted');
      setShowFeedbackModal(false);
      setFeedbackForm({ type: 'feedback', subject: '', message: '', orderId: '' });
    } catch { toast.error('Failed to submit feedback'); }
  };

  const handleReportIssue = (order) => {
    setFeedbackForm({ type: 'complaint', subject: `Issue with Order #${order.order_number || order.id?.slice(0,8)}`, message: '', orderId: order.id });
    setShowFeedbackModal(true);
  };

  // Filter menus and items
  const filteredMenus = menus.filter(menu => {
    if (filters.mealType && menu.meal_type !== filters.mealType) return false;
    if (filters.menuType && menu.menu_type !== filters.menuType) return false;
    return true;
  });

  const filteredItems = menuItems.filter(item => {
    if (filters.search && !item.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    // Apply dietary preferences
    if (dietaryPrefs.vegan && !item.is_vegan) return false;
    if (dietaryPrefs.vegetarian && !item.is_vegetarian && !item.is_vegan) return false;
    if (dietaryPrefs.glutenFree && !item.is_gluten_free) return false;
    return item.is_available !== false;
  });

  // Group items by category
  const itemsByCategory = filteredItems.reduce((acc, item) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categoryOrder = ['soup', 'main', 'side', 'dessert', 'beverage', 'special', 'other'];
  const categoryLabels = { soup: '🍲 Soups', main: '🍽️ Main Courses', side: '🥗 Sides', dessert: '🍰 Desserts', beverage: '🥤 Beverages', special: '⭐ Specials', other: '📦 Other' };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-gray-800">Welcome!</h1><p className="text-gray-500">Browse menus, place orders, and track your meals</p></div>
        <div className="flex gap-3">
          <button onClick={() => setShowPrefsModal(true)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">⚙️ Preferences</button>
          <button onClick={() => setShowFeedbackModal(true)} className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50">💬 Feedback</button>
          <button onClick={() => setShowCartModal(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 relative">
            🛒 Cart
            {cart.length > 0 && <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{cart.length}</span>}
          </button>
        </div>
      </div>

      {/* Current Order Status */}
      {currentOrder && (
        <div className={`rounded-xl p-4 border-2 ${currentOrder.status === 'ready' ? 'bg-green-50 border-green-500' : currentOrder.status === 'preparing' ? 'bg-blue-50 border-blue-500' : 'bg-yellow-50 border-yellow-500'}`}>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold">Current Order: #{currentOrder.order_number || currentOrder.id?.slice(0,8)}</p>
              <p className="text-sm">Status: <span className="font-bold uppercase">{currentOrder.status}</span></p>
            </div>
            <div className="flex gap-2">
              {currentOrder.status === 'ready' && <span className="px-4 py-2 bg-green-600 text-white rounded-lg animate-pulse">🔔 Ready for Pickup!</span>}
              {currentOrder.status === 'pending' && <button onClick={() => handleCancelOrder(currentOrder.id)} className="px-4 py-2 border border-red-600 text-red-600 rounded-lg">Cancel</button>}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b flex">
          {[
            { id: 'menu', label: '🍽️ Menu' },
            { id: 'orders', label: '📦 My Orders' },
            { id: 'history', label: '📜 History' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-6 py-4 text-sm font-medium border-b-2 ${activeTab === tab.id ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500'}`}>{tab.label}</button>
          ))}
        </div>

        <div className="p-6">
          {/* Menu Tab */}
          {activeTab === 'menu' && (
            <div>
              {/* Filters */}
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex gap-2">
                  <button onClick={() => setFilters({ ...filters, mealType: 'breakfast' })} className={`px-4 py-2 rounded-lg ${filters.mealType === 'breakfast' ? 'bg-orange-600 text-white' : 'bg-gray-100'}`}>☀️ Breakfast</button>
                  <button onClick={() => setFilters({ ...filters, mealType: 'lunch' })} className={`px-4 py-2 rounded-lg ${filters.mealType === 'lunch' ? 'bg-orange-600 text-white' : 'bg-gray-100'}`}>🌞 Lunch</button>
                </div>
                <div className="flex gap-2">
                  {['', 'regular', 'soup', 'vegan', 'special', 'done-to-order'].map(type => (
                    <button key={type} onClick={() => setFilters({ ...filters, menuType: type })} className={`px-3 py-1 rounded-full text-sm ${filters.menuType === type ? 'bg-green-600 text-white' : 'bg-gray-100'}`}>
                      {type === '' ? 'All' : type === 'done-to-order' ? '🔥 Fresh' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
                <input type="text" placeholder="Search items..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="px-4 py-2 border rounded-lg flex-1 min-w-48" />
              </div>

              {/* Active Dietary Filters */}
              {(dietaryPrefs.vegan || dietaryPrefs.vegetarian || dietaryPrefs.glutenFree) && (
                <div className="flex gap-2 mb-4">
                  <span className="text-sm text-gray-500">Filtering by:</span>
                  {dietaryPrefs.vegan && <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">🌱 Vegan</span>}
                  {dietaryPrefs.vegetarian && <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">🥬 Vegetarian</span>}
                  {dietaryPrefs.glutenFree && <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">GF</span>}
                </div>
              )}

              {/* Menu Sections */}
              {filteredMenus.length > 0 && filteredMenus.some(m => m.is_highlighted) && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-300 rounded-xl">
                  <h3 className="font-semibold text-yellow-800 mb-2">📢 Updated Menus</h3>
                  <div className="flex flex-wrap gap-2">
                    {filteredMenus.filter(m => m.is_highlighted).map(menu => (
                      <span key={menu.id} className="px-3 py-1 bg-yellow-200 text-yellow-900 rounded-lg text-sm">{menu.name}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Items by Category */}
              {categoryOrder.map(category => {
                const items = itemsByCategory[category];
                if (!items || items.length === 0) return null;
                return (
                  <div key={category} className="mb-8">
                    <h3 className="font-semibold text-lg mb-4">{categoryLabels[category] || category}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {items.map(item => (
                        <div key={item.id} className="border rounded-xl p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-semibold">{item.name}</h4>
                              {item.is_done_to_order && <span className="text-xs text-blue-600">🔥 Made Fresh</span>}
                            </div>
                            <span className="font-bold text-green-600">${parseFloat(item.price || 0).toFixed(2)}</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                          {item.ingredients && (
                            <p className="text-xs text-gray-500 mb-2">📝 {item.ingredients}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mb-3">
                            {item.is_vegan && <span className="px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded">🌱 Vegan</span>}
                            {item.is_vegetarian && <span className="px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded">🥬 Veg</span>}
                            {item.is_gluten_free && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-600 text-xs rounded">GF</span>}
                          </div>
                          <button onClick={() => addToCart(item)} className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">+ Add to Cart</button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {filteredItems.length === 0 && (
                <p className="text-gray-500 text-center py-12">No menu items available for your selection</p>
              )}
            </div>
          )}

          {/* Current Orders Tab */}
          {activeTab === 'orders' && (
            <div>
              {orders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status)).length > 0 ? (
                <div className="space-y-4">
                  {orders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status)).map(order => (
                    <div key={order.id} className={`border-2 rounded-xl p-4 ${order.status === 'ready' ? 'border-green-500 bg-green-50' : order.status === 'preparing' ? 'border-blue-500 bg-blue-50' : 'border-yellow-500 bg-yellow-50'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-mono font-bold text-lg">#{order.order_number || order.id?.slice(0,8)}</p>
                          <p className="text-sm text-gray-600">{order.meal_type} • {new Date(order.order_date).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${order.status === 'ready' ? 'bg-green-600 text-white' : order.status === 'preparing' ? 'bg-blue-600 text-white' : 'bg-yellow-600 text-white'}`}>
                            {order.status === 'ready' ? '🔔 READY!' : order.status === 'preparing' ? '👨‍🍳 Preparing' : '⏳ Pending'}
                          </span>
                          <p className="text-lg font-bold mt-1">${parseFloat(order.total || 0).toFixed(2)}</p>
                        </div>
                      </div>
                      {order.items && order.items.length > 0 && (
                        <div className="mb-3">
                          {order.items.map((item, i) => <p key={i} className="text-sm">• {item.quantity}x {item.name || item.menu_item_name}</p>)}
                        </div>
                      )}
                      {order.notes && <p className="text-sm text-gray-600 bg-white rounded p-2 mb-3">📝 {order.notes}</p>}
                      <div className="flex gap-2">
                        {order.status === 'pending' && <button onClick={() => handleCancelOrder(order.id)} className="px-4 py-2 border border-red-600 text-red-600 rounded-lg text-sm">Cancel Order</button>}
                        <button onClick={() => handleReportIssue(order)} className="px-4 py-2 border border-orange-600 text-orange-600 rounded-lg text-sm">Report Issue</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12"><p className="text-4xl mb-2">📦</p><p className="text-gray-500">No active orders</p><button onClick={() => setActiveTab('menu')} className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg">Browse Menu</button></div>
              )}
            </div>
          )}

          {/* Order History Tab */}
          {activeTab === 'history' && (
            <div>
              {orders.filter(o => ['completed', 'cancelled'].includes(o.status)).length > 0 ? (
                <div className="space-y-4">
                  {orders.filter(o => ['completed', 'cancelled'].includes(o.status)).map(order => (
                    <div key={order.id} className={`border rounded-xl p-4 ${order.status === 'cancelled' ? 'opacity-60' : ''}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-mono font-bold">#{order.order_number || order.id?.slice(0,8)}</p>
                          <p className="text-sm text-gray-500">{new Date(order.order_date).toLocaleDateString()} • {order.meal_type}</p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 text-xs rounded-full ${order.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{order.status}</span>
                          <p className="font-bold mt-1">${parseFloat(order.total || 0).toFixed(2)}</p>
                        </div>
                      </div>
                      {order.items && <p className="text-sm text-gray-600 mb-3">{order.items.length} items</p>}
                      <div className="flex gap-2">
                        {order.status === 'completed' && <button onClick={() => handleReorder(order)} className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm">🔄 Reorder</button>}
                        <button onClick={() => setShowOrderDetails(order)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">View Details</button>
                        {order.status === 'completed' && <button onClick={() => handleReportIssue(order)} className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm">Report Issue</button>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-12">No order history</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cart Modal */}
      {showCartModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">🛒 Your Cart</h2>
              <button onClick={() => setShowCartModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            {cart.length > 0 ? (
              <>
                <div className="space-y-4 mb-4">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-500">${parseFloat(item.price || 0).toFixed(2)} each</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => updateCartQuantity(item.id, item.quantity - 1)} className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300">-</button>
                        <span className="font-bold w-8 text-center">{item.quantity}</span>
                        <button onClick={() => updateCartQuantity(item.id, item.quantity + 1)} className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300">+</button>
                        <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700 ml-2">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div><label className="block text-sm font-medium mb-1">Order Notes (optional)</label><textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Any special instructions..." className="w-full px-4 py-2 border rounded-lg" rows="2" /></div>
                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-semibold">Total:</span>
                    <span className="text-2xl font-bold text-green-600">${getCartTotal().toFixed(2)}</span>
                  </div>
                  <button onClick={handleSubmitOrder} className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold">Place Order</button>
                </div>
              </>
            ) : (
              <div className="text-center py-8"><p className="text-4xl mb-2">🛒</p><p className="text-gray-500">Your cart is empty</p></div>
            )}
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">💬 Submit Feedback</h2>
            <form onSubmit={handleSubmitFeedback} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Type</label>
                <select value={feedbackForm.type} onChange={(e) => setFeedbackForm({ ...feedbackForm, type: e.target.value })} className="w-full px-4 py-2 border rounded-lg">
                  <option value="feedback">General Feedback</option>
                  <option value="suggestion">Suggestion</option>
                  <option value="complaint">Issue/Complaint</option>
                  <option value="compliment">Compliment</option>
                </select>
              </div>
              <div><label className="block text-sm font-medium mb-1">Subject</label><input type="text" value={feedbackForm.subject} onChange={(e) => setFeedbackForm({ ...feedbackForm, subject: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required /></div>
              <div><label className="block text-sm font-medium mb-1">Message</label><textarea value={feedbackForm.message} onChange={(e) => setFeedbackForm({ ...feedbackForm, message: e.target.value })} className="w-full px-4 py-2 border rounded-lg" rows="4" required /></div>
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowFeedbackModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Submit</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      {showPrefsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">⚙️ Dietary Preferences</h2>
            <p className="text-sm text-gray-500 mb-4">Menu items will be filtered based on your preferences</p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                <input type="checkbox" checked={dietaryPrefs.vegan} onChange={(e) => setDietaryPrefs({ ...dietaryPrefs, vegan: e.target.checked })} className="w-5 h-5" />
                <span>🌱 Vegan</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                <input type="checkbox" checked={dietaryPrefs.vegetarian} onChange={(e) => setDietaryPrefs({ ...dietaryPrefs, vegetarian: e.target.checked })} className="w-5 h-5" />
                <span>🥬 Vegetarian</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                <input type="checkbox" checked={dietaryPrefs.glutenFree} onChange={(e) => setDietaryPrefs({ ...dietaryPrefs, glutenFree: e.target.checked })} className="w-5 h-5" />
                <span>Gluten-Free</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-6"><button onClick={() => setShowPrefsModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button><button onClick={savePreferences} className="px-4 py-2 bg-green-600 text-white rounded-lg">Save</button></div>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {showOrderDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Order #{showOrderDetails.order_number || showOrderDetails.id?.slice(0,8)}</h2>
            <div className="space-y-2 mb-4">
              <p><span className="text-gray-500">Date:</span> {new Date(showOrderDetails.order_date).toLocaleDateString()}</p>
              <p><span className="text-gray-500">Meal:</span> {showOrderDetails.meal_type}</p>
              <p><span className="text-gray-500">Status:</span> <span className="font-semibold">{showOrderDetails.status}</span></p>
            </div>
            {showOrderDetails.items && showOrderDetails.items.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">Items:</h3>
                {showOrderDetails.items.map((item, i) => (
                  <div key={i} className="flex justify-between py-2 border-b">
                    <span>{item.quantity}x {item.name || item.menu_item_name}</span>
                    <span>${parseFloat(item.price || 0).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 font-bold">
                  <span>Total:</span>
                  <span>${parseFloat(showOrderDetails.total || 0).toFixed(2)}</span>
                </div>
              </div>
            )}
            {showOrderDetails.notes && <p className="text-sm text-gray-600 mt-4">📝 Notes: {showOrderDetails.notes}</p>}
            <div className="flex justify-end mt-6"><button onClick={() => setShowOrderDetails(null)} className="px-4 py-2 border rounded-lg">Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
