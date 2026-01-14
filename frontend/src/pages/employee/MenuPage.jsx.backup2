import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { dailyMenuAPI, orderAPI, companyAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

const CATEGORY_COLORS = {
  'protein': { bg: 'bg-orange-500', light: 'bg-orange-50' },
  'proteins': { bg: 'bg-orange-500', light: 'bg-orange-50' },
  'carbohydrate': { bg: 'bg-yellow-500', light: 'bg-yellow-50' },
  'carbohydrates': { bg: 'bg-yellow-500', light: 'bg-yellow-50' },
  'sides': { bg: 'bg-green-500', light: 'bg-green-50' },
  'vegetable': { bg: 'bg-teal-500', light: 'bg-teal-50' },
  'vegetables': { bg: 'bg-teal-500', light: 'bg-teal-50' },
  'fibre': { bg: 'bg-teal-500', light: 'bg-teal-50' },
  'soup': { bg: 'bg-purple-500', light: 'bg-purple-50' },
  'soups': { bg: 'bg-purple-500', light: 'bg-purple-50' },
  'vegetarian': { bg: 'bg-lime-500', light: 'bg-lime-50' },
  'beverage': { bg: 'bg-cyan-500', light: 'bg-cyan-50' },
  'dessert': { bg: 'bg-pink-500', light: 'bg-pink-50' },
  'specials': { bg: 'bg-red-500', light: 'bg-red-50' },
  'done to order': { bg: 'bg-blue-500', light: 'bg-blue-50' },
  'other': { bg: 'bg-gray-500', light: 'bg-gray-50' },
};
const getCatColor = (cat) => CATEGORY_COLORS[(cat||'other').toLowerCase()] || CATEGORY_COLORS['other'];

const MenuPage = () => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [dailyMenu, setDailyMenu] = useState(null);
  const [cart, setCart] = useState([]);
  const [cafeterias, setCafeterias] = useState([]);
  const [selectedCafeteria, setSelectedCafeteria] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d;
  });
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');

  useEffect(() => { loadCafeterias(); }, []);
  useEffect(() => { if (selectedCafeteria) loadDailyMenu(); }, [selectedCafeteria, selectedDate]);

  const loadCafeterias = async () => {
    try {
      const res = await companyAPI.getCafeterias();
      const list = res.data?.data?.cafeterias || [];
      setCafeterias(list);
      if (list.length > 0) setSelectedCafeteria(list[0].id);
    } catch (error) { console.error('Failed to load cafeterias:', error); }
  };

  const loadDailyMenu = async () => {
    try {
      setLoading(true);
      const dateStr = selectedDate.toISOString().split('T')[0];
      const res = await dailyMenuAPI.getDailyMenu({ cafeteriaId: selectedCafeteria, date: dateStr });
      setDailyMenu(res.data?.data?.dailyMenu);
      setMenuItems(res.data?.data?.items || []);
    } catch (error) {
      console.error('Failed to load menu:', error);
      setDailyMenu(null);
      setMenuItems([]);
    } finally { setLoading(false); }
  };

  const addToCart = (item) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { ...item, name: item.item_name || item.name, quantity: 1 }]);
    }
  };

  const updateQty = (id, qty) => {
    if (qty < 1) { setCart(cart.filter(c => c.id !== id)); return; }
    setCart(cart.map(c => c.id === id ? { ...c, quantity: qty } : c));
  };

  const removeFromCart = (id) => setCart(cart.filter(c => c.id !== id));
  const cartTotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * item.quantity, 0);

  const placeOrder = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    try {
      setPlacingOrder(true);
      const orderDate = selectedDate.toISOString().split('T')[0];
      await orderAPI.createOrder({ 
        cafeteriaId: selectedCafeteria,
        mealType: 'lunch',
        orderDate: orderDate,
        items: cart.map(c => ({ menuItemId: c.id, quantity: c.quantity, specialInstructions: c.note || '' })), 
        notes: orderNotes 
      });
      toast.success('Order placed successfully!');
      setCart([]);
      setOrderNotes('');
      loadDailyMenu();
    } catch (error) { toast.error('Failed to place order'); } 
    finally { setPlacingOrder(false); }
  };

  const getWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      dates.push(d);
    }
    return dates;
  };
  const weekDates = getWeekDates();
  const isToday = (d) => d.toDateString() === new Date().toDateString();
  const isSelected = (d) => d.toDateString() === selectedDate.toDateString();
  const navigateWeek = (dir) => {
    const n = new Date(weekStart);
    n.setDate(n.getDate() + (dir * 7));
    setWeekStart(n);
    setSelectedDate(n);
  };
  const formatWeekRange = () => {
    const e = new Date(weekStart);
    e.setDate(weekStart.getDate() + 6);
    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };
  const groupedItems = menuItems.reduce((acc, item) => {
    const cat = item.category_name || item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});
  const categories = Object.keys(groupedItems);
  const getCafeName = () => cafeterias.find(c => c.id === selectedCafeteria)?.name || 'Cafeteria';

  if (loading && !dailyMenu) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="space-y-4">
      {/* Company Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white text-center py-4 rounded-xl">
        <h2 className="text-xl font-bold uppercase">{getCafeName()} - LUNCH MENU</h2>
        {dailyMenu?.status !== 'published' && (
          <p className="text-yellow-200 text-sm mt-1">Menu details for this day have not been published yet.</p>
        )}
      </div>

      {/* Week Calendar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-500">📅 Menu For the Week</p>
            <p className="text-indigo-600 font-semibold text-lg">{formatWeekRange()}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigateWeek(-1)} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-xl">‹</button>
            <button onClick={() => navigateWeek(1)} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-xl">›</button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((date, idx) => (
            <button key={idx} onClick={() => setSelectedDate(date)}
              className={`p-3 rounded-lg text-center transition-all ${
                isSelected(date) ? 'bg-indigo-600 text-white shadow-lg transform scale-105' 
                : isToday(date) ? 'bg-indigo-100 ring-2 ring-indigo-400'
                : 'bg-gray-50 hover:bg-indigo-50'}`}>
              <p className="text-xs uppercase font-medium">{date.toLocaleDateString('en-US', { weekday: 'short' })}</p>
              <p className="text-2xl font-bold">{date.getDate()}</p>
              {isToday(date) && !isSelected(date) && <span className="block w-2 h-2 bg-indigo-500 rounded-full mx-auto mt-1"></span>}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Date Header */}
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">
          Menu for {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </h3>
        {dailyMenu?.status === 'published' && (
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">✅ Published</span>
        )}
      </div>

      {/* Category Columns */}
      {dailyMenu?.status === 'published' && categories.length > 0 ? (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
            {categories.map(category => {
              const catColor = getCatColor(category);
              const items = groupedItems[category] || [];
              return (
                <div key={category} className="w-48 flex-shrink-0 rounded-xl overflow-hidden shadow-sm border border-gray-200">
                  <div className={`${catColor.bg} text-white text-center py-3`}>
                    <h4 className="font-bold text-sm uppercase tracking-wide">{category}</h4>
                  </div>
                  <div className={`${catColor.light} p-3 min-h-[200px] space-y-2`}>
                    {items.map(item => (
                      <div key={item.id} 
                        onClick={() => !item.is_sold_out && addToCart(item)}
                        className={`bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition cursor-pointer border border-gray-100 ${item.is_sold_out ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <p className="font-semibold text-sm text-gray-800">{item.item_name || item.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{item.description || ''}</p>
                        <p className="text-sm text-green-600 font-bold mt-1">${parseFloat(item.price).toFixed(2)}</p>
                        {item.is_sold_out && <p className="text-xs text-red-500 mt-1">Sold Out</p>}
                        {!item.is_sold_out && item.portions_remaining <= 10 && (
                          <p className="text-xs text-orange-500 mt-1">{item.portions_remaining} left</p>
                        )}
                      </div>
                    ))}
                    {items.length === 0 && <p className="text-sm text-gray-400 italic text-center py-8">No items</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-50 rounded-xl">
          <p className="text-5xl mb-4">📋</p>
          <p className="text-xl text-gray-500">No menu available for this date</p>
          <p className="text-sm text-gray-400 mt-2">Please select another date or check back later</p>
        </div>
      )}

      {/* Order Cart - Fixed at bottom on mobile, sidebar on desktop */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 md:static bg-white border-t md:border md:rounded-xl shadow-lg p-4 md:mt-4">
          <h3 className="font-bold text-lg mb-3">🛒 Your Order ({cart.length} items)</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {cart.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-sm">{item.name}</p>
                  <p className="text-xs text-gray-500">${parseFloat(item.price).toFixed(2)} each</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(item.id, item.quantity - 1)} className="w-7 h-7 bg-gray-200 rounded text-lg">-</button>
                  <span className="w-6 text-center font-medium">{item.quantity}</span>
                  <button onClick={() => updateQty(item.id, item.quantity + 1)} className="w-7 h-7 bg-gray-200 rounded text-lg">+</button>
                  <button onClick={() => removeFromCart(item.id)} className="text-red-500 ml-2 text-lg">×</button>
                </div>
              </div>
            ))}
          </div>
          <textarea 
            placeholder="Special instructions or allergies..." 
            value={orderNotes} 
            onChange={e => setOrderNotes(e.target.value)}
            className="w-full mt-3 p-2 border border-gray-200 rounded-lg text-sm" 
            rows="2"
          />
          <div className="flex justify-between items-center mt-3 pt-3 border-t">
            <span className="text-lg font-bold">Total: ${cartTotal.toFixed(2)}</span>
            <button 
              onClick={placeOrder} 
              disabled={placingOrder}
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50">
              {placingOrder ? 'Placing...' : 'Place Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuPage;
