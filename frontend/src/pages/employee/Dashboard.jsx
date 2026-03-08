/**
 * Employee Dashboard - Redesigned with proper meal ordering
 * Features:
 * - Shows today's menu immediately on login
 * - Proper category grouping
 * - Meal-based pricing (not per-item)
 * - Per-item notes (e.g., "No Gravy")
 * - Favorites and order history
 */
import { useState, useEffect } from 'react';
import { orderAPI, messageAPI, dailyMenuAPI, companyAPI } from '../../services/api';
import toast from 'react-hot-toast';

// Category configuration
const CATEGORY_CONFIG = {
  'proteins': { bg: 'bg-rose-600', light: 'bg-rose-50', label: 'PROTEIN', icon: '🍗' },
  'protein': { bg: 'bg-rose-600', light: 'bg-rose-50', label: 'PROTEIN', icon: '🍗' },
  'carbohydrates': { bg: 'bg-amber-500', light: 'bg-amber-50', label: 'CARBS', icon: '🍚' },
  'carbohydrate': { bg: 'bg-amber-500', light: 'bg-amber-50', label: 'CARBS', icon: '🍚' },
  'carbs': { bg: 'bg-amber-500', light: 'bg-amber-50', label: 'CARBS', icon: '🍚' },
  'sides': { bg: 'bg-emerald-600', light: 'bg-emerald-50', label: 'SIDES', icon: '🥗' },
  'fibre': { bg: 'bg-teal-600', light: 'bg-teal-50', label: 'FIBRE', icon: '🥬' },
  'vegetables': { bg: 'bg-teal-600', light: 'bg-teal-50', label: 'VEGGIES', icon: '🥬' },
  'soup': { bg: 'bg-purple-600', light: 'bg-purple-50', label: 'SOUP', icon: '🍲' },
  'vegetarian': { bg: 'bg-green-600', light: 'bg-green-50', label: 'VEGETARIAN', icon: '🥕' },
  'beverage': { bg: 'bg-cyan-600', light: 'bg-cyan-50', label: 'DRINKS', icon: '🥤' },
  'dessert': { bg: 'bg-pink-600', light: 'bg-pink-50', label: 'DESSERT', icon: '🍰' },
  'specials': { bg: 'bg-orange-600', light: 'bg-orange-50', label: 'SPECIALS', icon: '⭐' },
  'other': { bg: 'bg-slate-600', light: 'bg-slate-50', label: 'OTHER', icon: '🍽️' },
};

const getCatConfig = (cat) => CATEGORY_CONFIG[(cat || 'other').toLowerCase()] || CATEGORY_CONFIG['other'];
const CATEGORY_ORDER = ['proteins', 'protein', 'carbohydrates', 'carbohydrate', 'carbs', 'sides', 'fibre', 'vegetables', 'soup', 'vegetarian', 'beverage', 'dessert', 'specials', 'other'];

export default function EmployeeDashboard() {
  // Tab state
  const [activeTab, setActiveTab] = useState('menu');
  
  // Data states
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [dailyMenu, setDailyMenu] = useState(null);
  const [cafeterias, setCafeterias] = useState([]);
  const [selectedCafeteria, setSelectedCafeteria] = useState('');
  const [myOrders, setMyOrders] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  
  // Date selection
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - today.getDay());
    return startDate;
  });
  
  // Meal selection state
  const [meals, setMeals] = useState([{ id: 1, selections: {}, notes: {} }]);
  const [orderNotes, setOrderNotes] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  
  // Modals
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [showSaveFavoriteModal, setShowSaveFavoriteModal] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [reorderTarget, setReorderTarget] = useState(null);
  const [favoriteName, setFavoriteName] = useState('');
  
  // Preferences
  const [preferences, setPreferences] = useState({ 
    vegan: false, vegetarian: false, glutenFree: false, 
    dairyFree: false, nutFree: false, halal: false, kosher: false 
  });
  const [feedbackForm, setFeedbackForm] = useState({ type: 'feedback', subject: '', message: '' });

  // Load data on mount
  useEffect(() => { 
    loadCafeterias(); 
    loadPreferences(); 
    loadFavorites(); 
  }, []);
  
  useEffect(() => { 
    if (selectedCafeteria) loadData(); 
  }, [selectedCafeteria, selectedDate]);

  const loadCafeterias = async () => {
    try {
      const res = await companyAPI.getCafeterias();
      const list = res.data?.data?.cafeterias || [];
      setCafeterias(list);
      if (list.length > 0) setSelectedCafeteria(list[0].id);
    } catch (error) { 
      console.error('Failed to load cafeterias:', error); 
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const [dailyMenuRes, ordersRes] = await Promise.all([
        dailyMenuAPI.getDailyMenu({ cafeteriaId: selectedCafeteria, date: dateStr })
          .catch(() => ({ data: { data: { dailyMenu: null, items: [] } } })),
        orderAPI.getMyOrders().catch(() => ({ data: { data: { orders: [] } } }))
      ]);
      
      setDailyMenu(dailyMenuRes.data?.data?.dailyMenu);
      setMenuItems(dailyMenuRes.data?.data?.items || []);
      
      const orders = ordersRes.data?.data?.orders || [];
      setMyOrders(orders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status)));
      setOrderHistory(orders.filter(o => ['completed', 'cancelled'].includes(o.status)));
      setCurrentOrder(orders.find(o => ['pending', 'preparing', 'ready'].includes(o.status)));
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
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

  const loadFavorites = async () => {
    try {
      const res = await orderAPI.getFavorites();
      setFavorites(res.data?.data?.favorites || []);
    } catch (error) {
      const saved = localStorage.getItem('elos_favorites');
      if (saved) setFavorites(JSON.parse(saved));
    }
  };

  // Meal management
  const addMeal = () => {
    const newId = Math.max(...meals.map(m => m.id)) + 1;
    setMeals([...meals, { id: newId, selections: {}, notes: {} }]);
  };

  const removeMeal = (mealId) => {
    if (meals.length === 1) return;
    setMeals(meals.filter(m => m.id !== mealId));
  };

  const toggleSelection = (mealId, category, itemId) => {
    setMeals(meals.map(meal => {
      if (meal.id !== mealId) return meal;
      const currentSelection = meal.selections[category];
      const newSelections = { ...meal.selections };
      const newNotes = { ...meal.notes };
      
      if (currentSelection === itemId) {
        delete newSelections[category];
        delete newNotes[itemId];
      } else {
        newSelections[category] = itemId;
      }
      return { ...meal, selections: newSelections, notes: newNotes };
    }));
  };

  const updateItemNote = (mealId, itemId, note) => {
    setMeals(meals.map(meal => {
      if (meal.id !== mealId) return meal;
      return { ...meal, notes: { ...meal.notes, [itemId]: note } };
    }));
  };

  // Pricing
  const getMealPrice = () => parseFloat(dailyMenu?.meal_price) || 900.00;
  const getTotalPrice = () => meals.filter(m => Object.keys(m.selections).length > 0).length * getMealPrice();
  const isMealComplete = (meal) => Object.keys(meal.selections).length > 0;
  const allMealsComplete = () => meals.every(isMealComplete);

  // Place Order
  const placeOrder = async () => {
    if (!allMealsComplete()) {
      toast.error('Please select at least one item for each meal');
      return;
    }
    try {
      setPlacingOrder(true);
      const orderDate = selectedDate.toISOString().split('T')[0];
      const allItems = [];
      
      meals.forEach(meal => {
        Object.entries(meal.selections).forEach(([category, itemId]) => {
          const existing = allItems.find(i => i.menuItemId === itemId);
          const itemNote = meal.notes[itemId] || '';
          
          if (existing) {
            existing.quantity += 1;
            if (itemNote && !existing.specialInstructions.includes(itemNote)) {
              existing.specialInstructions = existing.specialInstructions 
                ? `${existing.specialInstructions}; ${itemNote}` 
                : itemNote;
            }
          } else {
            allItems.push({ 
              menuItemId: itemId, 
              quantity: 1, 
              specialInstructions: itemNote 
            });
          }
        });
      });
      
      await orderAPI.createDailyOrder({
        cafeteriaId: selectedCafeteria,
        mealType: 'lunch',
        orderDate: orderDate,
        items: allItems,
        mealCount: meals.filter(m => Object.keys(m.selections).length > 0).length,
        notes: orderNotes
      });
      
      toast.success(`Order placed successfully!`);
      setMeals([{ id: 1, selections: {}, notes: {} }]);
      setOrderNotes('');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to place order');
    } finally {
      setPlacingOrder(false);
    }
  };

  // Favorites
  const saveCurrentAsFavorite = async () => {
    if (!favoriteName.trim()) {
      toast.error('Please enter a name for this favorite');
      return;
    }
    try {
      const items = [];
      meals.forEach(meal => {
        Object.entries(meal.selections).forEach(([cat, itemId]) => {
          const item = menuItems.find(i => i.id === itemId);
          if (item) {
            items.push({
              id: item.id,
              name: item.item_name || item.name,
              category: cat,
              note: meal.notes[itemId] || ''
            });
          }
        });
      });
      
      try {
        await orderAPI.saveFavorite({ name: favoriteName, mealType: 'lunch', items });
      } catch (e) {
        const existing = JSON.parse(localStorage.getItem('elos_favorites') || '[]');
        existing.push({ id: Date.now(), name: favoriteName, items, createdAt: new Date().toISOString() });
        localStorage.setItem('elos_favorites', JSON.stringify(existing));
      }
      
      toast.success('Saved to favorites!');
      setShowSaveFavoriteModal(false);
      setFavoriteName('');
      loadFavorites();
    } catch (error) {
      toast.error('Failed to save favorite');
    }
  };

  const applyFavorite = (favorite) => {
    const newSelections = {};
    const newNotes = {};
    
    (favorite.items || []).forEach(item => {
      const menuItem = menuItems.find(m => 
        (m.item_name || m.name)?.toLowerCase() === item.name?.toLowerCase()
      );
      if (menuItem) {
        newSelections[item.category] = menuItem.id;
        if (item.note) newNotes[menuItem.id] = item.note;
      }
    });
    
    if (Object.keys(newSelections).length === 0) {
      toast.error('None of the favorite items are available today');
      return;
    }
    
    setMeals([{ id: 1, selections: newSelections, notes: newNotes }]);
    setActiveTab('menu');
    toast.success('Favorite applied! Review and place order.');
  };

  const deleteFavorite = async (id) => {
    try {
      await orderAPI.deleteFavorite(id);
      toast.success('Favorite removed');
      loadFavorites();
    } catch (error) {
      const existing = JSON.parse(localStorage.getItem('elos_favorites') || '[]');
      const updated = existing.filter(f => f.id !== id);
      localStorage.setItem('elos_favorites', JSON.stringify(updated));
      setFavorites(updated);
      toast.success('Favorite removed');
    }
  };

  // Reorder
  const handleReorder = (order) => {
    setReorderTarget(order);
    setShowReorderModal(true);
  };

  const confirmReorder = async () => {
    if (!reorderTarget) return;
    try {
      const orderDate = selectedDate.toISOString().split('T')[0];
      const items = (reorderTarget.items || []).map(item => ({
        menuItemId: item.menu_item_id || item.id,
        quantity: item.quantity || 1,
        specialInstructions: item.special_instructions || ''
      }));
      
      await orderAPI.createDailyOrder({
        cafeteriaId: selectedCafeteria,
        mealType: 'lunch',
        orderDate: orderDate,
        items: items,
        mealCount: 1,
        notes: `Reorder of order #${reorderTarget.order_number || reorderTarget.id}`
      });
      
      toast.success('Reorder placed!');
      setShowReorderModal(false);
      setReorderTarget(null);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to reorder');
    }
  };

  // Week navigation
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
    const newStart = new Date(weekStart);
    newStart.setDate(weekStart.getDate() + (dir * 7));
    setWeekStart(newStart);
    setSelectedDate(newStart);
  };
  const formatWeekRange = () => {
    const endDate = new Date(weekStart);
    endDate.setDate(weekStart.getDate() + 6);
    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const getCafeteriaName = () => cafeterias.find(c => c.id === selectedCafeteria)?.name || 'Cafeteria';

  // Group items by category - USE category_name from backend!
  const groupedItems = menuItems.reduce((acc, item) => {
    const cat = (item.category_name || item.category || 'Other').toLowerCase();
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const sortedCategories = Object.keys(groupedItems).sort((a, b) => {
    const aIdx = CATEGORY_ORDER.indexOf(a.toLowerCase());
    const bIdx = CATEGORY_ORDER.indexOf(b.toLowerCase());
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  const tabs = [
    { id: 'menu', label: "Today's Menu", icon: '🍽️' },
    { id: 'orders', label: 'My Orders', icon: '📦', count: myOrders.length },
    { id: 'favorites', label: 'Favorites', icon: '❤️', count: favorites.length },
    { id: 'history', label: 'History', icon: '📋' }
  ];

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome!</h1>
          <p className="text-slate-600">Order your meal for today</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowPreferencesModal(true)} 
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm"
          >
            ⚙️ Preferences
          </button>
          <button 
            onClick={() => setShowFeedbackModal(true)} 
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm"
          >
            💬 Feedback
          </button>
        </div>
      </div>

      {/* Current Order Status */}
      {currentOrder && (
        <div className={`rounded-xl p-4 border-2 ${
          currentOrder.status === 'ready' 
            ? 'bg-green-50 border-green-500 animate-pulse' 
            : currentOrder.status === 'preparing'
            ? 'bg-blue-50 border-blue-500'
            : 'bg-amber-50 border-amber-500'
        }`}>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold text-lg">
                {currentOrder.status === 'ready' ? '🎉 Your order is READY!' : 
                 currentOrder.status === 'preparing' ? '👨‍🍳 Order being prepared...' : 
                 '⏳ Order pending'}
              </p>
              <p className="text-sm text-slate-600">Order #{currentOrder.order_number || currentOrder.id?.slice(0, 8)}</p>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-bold uppercase ${
              currentOrder.status === 'ready' ? 'bg-green-500 text-white' : 
              currentOrder.status === 'preparing' ? 'bg-blue-500 text-white' : 
              'bg-amber-500 text-white'
            }`}>
              {currentOrder.status}
            </span>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 border border-slate-200 text-center">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-2 text-xl">🍽️</div>
          <p className="text-2xl font-bold text-slate-800">{menuItems.length}</p>
          <p className="text-xs text-slate-500">Menu Items</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 text-center">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2 text-xl">📦</div>
          <p className="text-2xl font-bold text-slate-800">{myOrders.length}</p>
          <p className="text-xs text-slate-500">Active Orders</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 text-center">
          <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center mx-auto mb-2 text-xl">❤️</div>
          <p className="text-2xl font-bold text-slate-800">{favorites.length}</p>
          <p className="text-xs text-slate-500">Favorites</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-slate-700 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className="bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* MENU TAB */}
      {activeTab === 'menu' && (
        <>
          {/* Cafeteria & Menu Header */}
          <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white text-center py-4 px-4 rounded-xl shadow-lg">
            <h2 className="text-xl font-bold uppercase">{getCafeteriaName()} - LUNCH MENU</h2>
            {dailyMenu?.status === 'published' && (
              <p className="text-green-300 text-sm mt-1">Meal Price: ${getMealPrice().toFixed(2)}</p>
            )}
          </div>

          {/* Week Calendar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-slate-500">📅 Select a date</p>
                <p className="text-slate-700 font-semibold text-lg">{formatWeekRange()}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => navigateWeek(-1)} className="px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-xl">‹</button>
                <button onClick={() => navigateWeek(1)} className="px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-xl">›</button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {weekDates.map((date, idx) => (
                <button 
                  key={idx} 
                  onClick={() => setSelectedDate(date)}
                  className={`p-3 rounded-lg text-center transition-all ${
                    isSelected(date) ? 'bg-slate-700 text-white shadow-lg transform scale-105' 
                    : isToday(date) ? 'bg-slate-200 ring-2 ring-slate-400'
                    : 'bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <p className="text-xs uppercase font-medium">{date.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                  <p className="text-2xl font-bold">{date.getDate()}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Menu Date Header */}
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">
              Menu for {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            {dailyMenu?.status === 'published' && (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">✅ Published</span>
            )}
          </div>

          {/* Loading / No Menu / Menu Display */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-600"></div>
            </div>
          ) : dailyMenu?.status === 'published' && sortedCategories.length > 0 ? (
            <div className="space-y-4">
              {/* Meals */}
              {meals.map((meal, mealIdx) => (
                <div key={meal.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Meal Header */}
                  <div className="bg-slate-100 px-4 py-3 flex justify-between items-center">
                    <h4 className="font-bold text-slate-700">MEAL {mealIdx + 1}</h4>
                    <div className="flex items-center gap-4">
                      <span className="text-green-600 font-semibold">${getMealPrice().toFixed(2)}</span>
                      {meals.length > 1 && (
                        <button onClick={() => removeMeal(meal.id)} className="text-red-500 hover:text-red-700 text-sm">
                          ✕ Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Category Grid */}
                  <div className="overflow-x-auto">
                    <div className="flex" style={{ minWidth: 'max-content' }}>
                      {sortedCategories.map(category => {
                        const config = getCatConfig(category);
                        const items = groupedItems[category] || [];
                        return (
                          <div key={category} className="flex-shrink-0 w-48 border-r border-slate-200 last:border-r-0">
                            <div className={`${config.bg} text-white text-center py-2 px-2`}>
                              <h5 className="font-bold text-xs uppercase tracking-wide">{config.icon} {config.label}</h5>
                            </div>
                            <div className={`${config.light} p-2 min-h-[200px] space-y-2`}>
                              {items.map(item => {
                                const isChecked = meal.selections[category] === item.id;
                                const itemNote = meal.notes[item.id] || '';
                                return (
                                  <div key={item.id} className={`rounded-lg transition ${
                                    isChecked ? 'bg-white shadow-md ring-2 ring-slate-400' : 'bg-white/60 hover:bg-white'
                                  } ${item.is_sold_out ? 'opacity-50' : ''}`}>
                                    <label className={`flex items-start gap-2 p-2 cursor-pointer ${item.is_sold_out ? 'cursor-not-allowed' : ''}`}>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => !item.is_sold_out && toggleSelection(meal.id, category, item.id)}
                                        disabled={item.is_sold_out}
                                        className="mt-1 w-4 h-4 rounded accent-slate-600"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-800 leading-tight">
                                          {item.item_name || item.name}
                                        </p>
                                        {item.is_sold_out && <p className="text-xs text-red-500">Sold Out</p>}
                                      </div>
                                    </label>
                                    {/* Per-item note field */}
                                    {isChecked && (
                                      <div className="px-2 pb-2">
                                        <input
                                          type="text"
                                          value={itemNote}
                                          onChange={(e) => updateItemNote(meal.id, item.id, e.target.value)}
                                          placeholder="Note: e.g., No gravy"
                                          className="w-full text-xs px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-slate-400"
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {/* Add Another Meal */}
              <button
                onClick={addMeal}
                className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-slate-400 hover:text-slate-600 transition font-medium"
              >
                + Add Another Meal
              </button>

              {/* Order Summary */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-slate-700">Order Summary</h4>
                  {allMealsComplete() && (
                    <button
                      onClick={() => setShowSaveFavoriteModal(true)}
                      className="text-sm text-slate-600 hover:text-slate-800 flex items-center gap-1"
                    >
                      ❤️ Save as Favorite
                    </button>
                  )}
                </div>
                
                <div className="space-y-2 mb-4">
                  {meals.map((meal, idx) => (
                    <div key={meal.id} className="text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600 font-medium">Meal {idx + 1}:</span>
                        <span className="font-medium">
                          ${Object.keys(meal.selections).length > 0 ? getMealPrice().toFixed(2) : '0.00'}
                        </span>
                      </div>
                      {Object.keys(meal.selections).length > 0 && (
                        <div className="text-xs text-slate-500 ml-2">
                          {Object.entries(meal.selections).map(([cat, itemId]) => {
                            const item = menuItems.find(i => i.id === itemId);
                            const note = meal.notes[itemId];
                            return item ? (
                              <p key={itemId}>
                                • {item.item_name || item.name}
                                {note && <span className="text-orange-600"> ({note})</span>}
                              </p>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="border-t pt-3 flex justify-between items-center">
                  <div>
                    <p className="text-xl font-bold text-slate-800">Total: ${getTotalPrice().toFixed(2)}</p>
                    <p className="text-sm text-slate-500">
                      {meals.filter(m => Object.keys(m.selections).length > 0).length} meal(s)
                    </p>
                  </div>
                </div>
                
                <textarea
                  placeholder="General order notes..."
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  className="w-full mt-3 p-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-400"
                  rows="2"
                />
                
                <button
                  onClick={placeOrder}
                  disabled={placingOrder || !allMealsComplete()}
                  className={`w-full mt-3 py-3 rounded-lg font-semibold text-white transition ${
                    allMealsComplete() 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-slate-400 cursor-not-allowed'
                  }`}
                >
                  {placingOrder ? 'Placing Order...' : 'Place Order'}
                </button>
                
                {!allMealsComplete() && (
                  <p className="text-center text-sm text-orange-600 mt-2">
                    ⚠️ Please select at least one item for each meal
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 bg-slate-50 rounded-xl">
              <p className="text-5xl mb-4">📋</p>
              <p className="text-xl text-slate-500">No menu available for this date</p>
              <p className="text-sm text-slate-400 mt-2">Please select another date or check back later</p>
            </div>
          )}
        </>
      )}

      {/* ORDERS TAB */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-800 mb-4">📦 Active Orders</h3>
          {myOrders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-3">📦</p>
              <p className="text-slate-500">No active orders</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myOrders.map(order => (
                <div key={order.id} className={`rounded-lg p-4 border-2 ${
                  order.status === 'ready' ? 'bg-green-50 border-green-400' :
                  order.status === 'preparing' ? 'bg-blue-50 border-blue-400' :
                  'bg-amber-50 border-amber-400'
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-slate-800">Order #{order.order_number || order.id?.slice(0, 8)}</h4>
                      <p className="text-sm text-slate-500">
                        {new Date(order.order_date || order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      order.status === 'ready' ? 'bg-green-500 text-white' :
                      order.status === 'preparing' ? 'bg-blue-500 text-white' :
                      'bg-amber-500 text-white'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    {(order.items || []).map(i => i.item_name || i.name).join(', ') || 'No items'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FAVORITES TAB */}
      {activeTab === 'favorites' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-800 mb-4">❤️ My Favorites</h3>
          {favorites.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-3">❤️</p>
              <p className="text-slate-500">No favorites saved yet</p>
              <p className="text-sm text-slate-400 mt-2">Build a meal and save it for quick reordering</p>
            </div>
          ) : (
            <div className="space-y-3">
              {favorites.map(fav => (
                <div key={fav.id} className="bg-slate-50 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <h4 className="font-medium text-slate-800">{fav.name}</h4>
                    <p className="text-sm text-slate-500">
                      {(fav.items || []).map(i => i.name).join(', ')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => applyFavorite(fav)}
                      className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
                    >
                      Order Now
                    </button>
                    <button
                      onClick={() => deleteFavorite(fav.id)}
                      className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-800 mb-4">📋 Order History</h3>
          {orderHistory.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-slate-500">No order history</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orderHistory.slice(0, 20).map(order => (
                <div key={order.id} className="bg-slate-50 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-slate-800">
                        Order #{order.order_number || order.id?.slice(0, 8)}
                      </h4>
                      <p className="text-sm text-slate-500">
                        {new Date(order.order_date || order.created_at).toLocaleDateString('en-US', { 
                          weekday: 'short', month: 'short', day: 'numeric' 
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        order.status === 'completed' ? 'bg-green-100 text-green-700' :
                        order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-slate-200 text-slate-600'
                      }`}>
                        {order.status}
                      </span>
                      <span className="font-semibold text-slate-700">
                        ${parseFloat(order.total_amount || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">
                    {(order.items || []).map(i => i.item_name || i.name).join(', ') || 'No items'}
                  </p>
                  <button
                    onClick={() => handleReorder(order)}
                    className="w-full py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 flex items-center justify-center gap-2"
                  >
                    🔄 Order Again
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== MODALS ========== */}

      {/* Preferences Modal */}
      {showPreferencesModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">⚙️ Dietary Preferences</h2>
            </div>
            <div className="p-6 space-y-3">
              {Object.entries(preferences).map(([key, value]) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setPreferences({ ...preferences, [key]: e.target.checked })}
                    className="w-5 h-5 rounded accent-slate-600"
                  />
                  <span className="capitalize text-slate-700">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                </label>
              ))}
            </div>
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setShowPreferencesModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={savePreferences}
                className="flex-1 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">💬 Send Feedback</h2>
            </div>
            <div className="p-6 space-y-4">
              <select
                value={feedbackForm.type}
                onChange={(e) => setFeedbackForm({ ...feedbackForm, type: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              >
                <option value="feedback">General Feedback</option>
                <option value="complaint">Complaint</option>
                <option value="suggestion">Suggestion</option>
              </select>
              <input
                type="text"
                placeholder="Subject"
                value={feedbackForm.subject}
                onChange={(e) => setFeedbackForm({ ...feedbackForm, subject: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
              <textarea
                placeholder="Your message..."
                value={feedbackForm.message}
                onChange={(e) => setFeedbackForm({ ...feedbackForm, message: e.target.value })}
                rows="4"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  toast.success('Feedback sent!');
                  setFeedbackForm({ type: 'feedback', subject: '', message: '' });
                  setShowFeedbackModal(false);
                }}
                className="flex-1 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Favorite Modal */}
      {showSaveFavoriteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">❤️ Save as Favorite</h2>
            </div>
            <div className="p-6">
              <input
                type="text"
                value={favoriteName}
                onChange={(e) => setFavoriteName(e.target.value)}
                placeholder="e.g., My Monday Lunch"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4"
              />
              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <p className="font-medium text-slate-800 mb-2">Items:</p>
                {meals.map((meal, idx) => (
                  <p key={meal.id} className="text-sm text-slate-600">
                    {Object.entries(meal.selections).map(([cat, itemId]) => {
                      const item = menuItems.find(i => i.id === itemId);
                      return item ? (item.item_name || item.name) : '';
                    }).filter(Boolean).join(', ')}
                  </p>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowSaveFavoriteModal(false); setFavoriteName(''); }}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCurrentAsFavorite}
                  className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reorder Modal */}
      {showReorderModal && reorderTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">🔄 Reorder</h2>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-4">
                Reorder for <strong>{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</strong>?
              </p>
              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <p className="font-medium text-slate-800">Items:</p>
                <p className="text-sm text-slate-600">
                  {(reorderTarget.items || []).map(i => i.item_name || i.name).join(', ') || 'No items'}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowReorderModal(false); setReorderTarget(null); }}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmReorder}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
