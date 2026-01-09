import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { dailyMenuAPI, orderAPI, companyAPI } from '../../services/api';

const MenuPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [dailyMenu, setDailyMenu] = useState(null);
  const [cart, setCart] = useState([]);
  const [cafeterias, setCafeterias] = useState([]);
  const [selectedCafeteria, setSelectedCafeteria] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { loadCafeterias(); }, []);
  useEffect(() => { if (selectedCafeteria) { loadDailyMenu(); } }, [selectedCafeteria]);

  const loadCafeterias = async () => {
    try {
      const res = await companyAPI.getCafeterias();
      const list = res.data?.data?.cafeterias || res.data?.cafeterias || [];
      setCafeterias(list);
      if (list.length > 0) { setSelectedCafeteria(list[0].id); }
    } catch (error) { console.error('Failed to load cafeterias:', error); }
  };

  const loadDailyMenu = async () => {
    try {
      setLoading(true);
      const res = await dailyMenuAPI.getDailyMenu({ cafeteriaId: selectedCafeteria, date: today });
      const menu = res.data?.data?.dailyMenu;
      const items = res.data?.data?.items || [];
      setDailyMenu(menu);
      setMenuItems(items.filter(item => !item.is_sold_out && item.portions_remaining > 0));
    } catch (error) {
      console.error('Failed to load menu:', error);
      setDailyMenu(null);
      setMenuItems([]);
    } finally { setLoading(false); }
  };
  const groupedItems = menuItems.reduce((acc, item) => {
    const cat = item.category_name || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const addToCart = (item) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      if (existing.qty >= item.portions_remaining) { toast.error('Maximum available quantity reached'); return; }
      setCart(cart.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, { id: item.id, catalogItemId: item.catalog_item_id, name: item.item_name, price: parseFloat(item.price), qty: 1, maxQty: item.portions_remaining }]);
    }
    toast.success('Added ' + item.item_name);
  };

  const updateQty = (itemId, delta) => {
    setCart(cart.map(item => {
      if (item.id === itemId) {
        const newQty = item.qty + delta;
        if (newQty <= 0) return null;
        if (newQty > item.maxQty) { toast.error('Maximum available: ' + item.maxQty); return item; }
        return { ...item, qty: newQty };
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (itemId) => { setCart(cart.filter(item => item.id !== itemId)); };
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const formatPrice = (price) => new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD' }).format(price);
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const handlePlaceOrder = async () => {
    if (cart.length === 0) { toast.error('Your cart is empty'); return; }
    setPlacingOrder(true);
    try {
      const orderData = {
        cafeteriaId: selectedCafeteria,
        mealType: 'lunch',
        orderDate: today,
        notes: orderNotes,
        items: cart.map(item => ({ dailyMenuItemId: item.id, catalogItemId: item.catalogItemId, quantity: item.qty, unitPrice: item.price }))
      };
      await orderAPI.createOrder(orderData);
      toast.success('Order placed successfully!');
      setCart([]);
      setOrderNotes('');
      loadDailyMenu();
    } catch (error) {
      const msg = error.response?.data?.error?.message || 'Failed to place order';
      toast.error(msg);
    } finally { setPlacingOrder(false); }
  };

  if (loading) {
    return (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>);
  }
  return (
    <div className="p-6">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Todays Menu</h1>
          <p className="text-gray-600">{formatDate(today)}</p>
          {dailyMenu?.default_lunch_cutoff && (
            <p className="text-sm text-orange-600 font-medium mt-1">⏰ Order by {dailyMenu.default_lunch_cutoff} for lunch</p>
          )}
        </div>
        {cafeterias.length > 1 && (
          <select value={selectedCafeteria} onChange={(e) => setSelectedCafeteria(e.target.value)} className="px-4 py-2 border rounded-lg">
            {cafeterias.map(caf => (<option key={caf.id} value={caf.id}>{caf.name}</option>))}
          </select>
        )}
      </div>
      {!dailyMenu || dailyMenu.status !== 'published' ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">🍽️</div>
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Menu Not Available</h2>
          <p className="text-yellow-700">Todays menu has not been published yet. Please check back later.</p>
        </div>
      ) : menuItems.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">😔</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">All Items Sold Out</h2>
          <p className="text-gray-600">Sorry, all items for today have been sold out.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {Object.entries(groupedItems).map(([category, items]) => (
              <div key={category} className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">{category} ({items.length})</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {items.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{item.item_name} {item.is_spicy && '🌶️'} {item.is_vegetarian && '🥬'}</div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="font-bold text-green-600">{formatPrice(item.price)}</span>
                          <span className="text-xs text-gray-400">{item.portions_remaining} left</span>
                        </div>
                      </div>
                      <button onClick={() => addToCart(item)} className="ml-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">+ Add</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-24">
              <h3 className="text-lg font-bold mb-4">🛒 Your Order {cart.length > 0 && <span className="bg-indigo-100 text-indigo-800 text-sm px-2 py-0.5 rounded-full">{cart.reduce((sum, item) => sum + item.qty, 0)} items</span>}</h3>
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">🛒</div>
                  <p>Your cart is empty</p>
                </div>
              ) : (
                <div>
                  <ul className="space-y-3 mb-4">
                    {cart.map(item => (
                      <li key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.name}</div>
                          <div className="text-gray-500 text-xs">{formatPrice(item.price)} each</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center">-</button>
                          <span className="w-8 text-center font-medium">{item.qty}</span>
                          <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center">+</button>
                          <button onClick={() => removeFromCart(item.id)} className="ml-2 text-red-500 hover:text-red-700">x</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mb-4">
                    <label className="block text-sm text-gray-600 mb-1">Special Instructions</label>
                    <textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Any allergies or special requests?" className="w-full px-3 py-2 border rounded-lg text-sm" rows="2" />
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-bold text-lg">Total</span>
                      <span className="font-bold text-lg text-green-600">{formatPrice(cartTotal)}</span>
                    </div>
                    <button onClick={handlePlaceOrder} disabled={placingOrder} className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50">
                      {placingOrder ? 'Placing Order...' : 'Place Order'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default MenuPage;
