import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { dailyMenuAPI, orderAPI, companyAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

const CATEGORY_CONFIG = {
  'proteins': { bg: 'bg-red-500', light: 'bg-red-50', required: true, label: 'PROTEIN' },
  'protein': { bg: 'bg-red-500', light: 'bg-red-50', required: true, label: 'PROTEIN' },
  'carbohydrates': { bg: 'bg-yellow-500', light: 'bg-yellow-50', required: true, label: 'CARBOHYDRATE' },
  'carbohydrate': { bg: 'bg-yellow-500', light: 'bg-yellow-50', required: true, label: 'CARBOHYDRATE' },
  'sides': { bg: 'bg-green-500', light: 'bg-green-50', required: false, label: 'SIDES' },
  'fibre': { bg: 'bg-teal-500', light: 'bg-teal-50', required: true, label: 'FIBRE' },
  'vegetables': { bg: 'bg-teal-500', light: 'bg-teal-50', required: true, label: 'FIBRE' },
  'soup': { bg: 'bg-purple-500', light: 'bg-purple-50', required: false, label: 'SOUP' },
  'vegetarian': { bg: 'bg-green-600', light: 'bg-green-50', required: false, label: 'VEGETARIAN' },
  'done to order': { bg: 'bg-blue-500', light: 'bg-blue-50', required: false, label: 'DONE TO ORDER' },
  'beverage': { bg: 'bg-cyan-500', light: 'bg-cyan-50', required: false, label: 'BEVERAGE' },
  'dessert': { bg: 'bg-pink-500', light: 'bg-pink-50', required: false, label: 'DESSERT' },
  'specials': { bg: 'bg-orange-500', light: 'bg-orange-50', required: false, label: 'SPECIALS' },
  'other': { bg: 'bg-gray-500', light: 'bg-gray-50', required: false, label: 'OTHER' },
};
const getCatConfig = (cat) => CATEGORY_CONFIG[(cat||'other').toLowerCase()] || CATEGORY_CONFIG['other'];

const CATEGORY_ORDER = ['proteins', 'protein', 'carbohydrates', 'carbohydrate', 'sides', 'fibre', 'vegetables', 'soup', 'vegetarian', 'done to order', 'beverage', 'dessert', 'specials', 'other'];

const MenuPage = () => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [dailyMenu, setDailyMenu] = useState(null);
  const [meals, setMeals] = useState([{ id: 1, selections: {} }]);
  const [cafeterias, setCafeterias] = useState([]);
  const [selectedCafeteria, setSelectedCafeteria] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d;
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

  const addMeal = () => {
    const newId = Math.max(...meals.map(m => m.id)) + 1;
    setMeals([...meals, { id: newId, selections: {} }]);
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
      if (currentSelection === itemId) {
        delete newSelections[category];
      } else {
        newSelections[category] = itemId;
      }
      return { ...meal, selections: newSelections };
    }));
  };

  const getMealPrice = () => {
    return parseFloat(dailyMenu?.meal_price) || 900.00;
  };

  const getTotalPrice = () => meals.filter(m => Object.keys(m.selections).length > 0).length * getMealPrice();

  const isMealComplete = (meal) => {
    return Object.keys(meal.selections).length > 0;
  };

  const allMealsComplete = () => meals.every(isMealComplete);

  const placeOrder = async () => {
    if (!allMealsComplete()) {
      toast.error('Please complete all meals (select protein, carbohydrate, and fibre)');
      return;
    }
    try {
      setPlacingOrder(true);
      const orderDate = selectedDate.toISOString().split('T')[0];
      const allItems = [];
      meals.forEach(meal => {
        Object.values(meal.selections).forEach(itemId => {
          const existing = allItems.find(i => i.menuItemId === itemId);
          if (existing) {
            existing.quantity += 1;
          } else {
            allItems.push({ menuItemId: itemId, quantity: 1, specialInstructions: '' });
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
      toast.success(`Order placed successfully! (${meals.length} meal${meals.length > 1 ? 's' : ''})`);
      setMeals([{ id: 1, selections: {} }]);
      setOrderNotes('');
      loadDailyMenu();
    } catch (error) {
      toast.error('Failed to place order');
    } finally {
      setPlacingOrder(false);
    }
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
    const cat = (item.category_name || item.category || 'Other').toLowerCase();
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const sortedCategories = Object.keys(groupedItems).sort((a, b) => {
    const aIdx = CATEGORY_ORDER.indexOf(a.toLowerCase());
    const bIdx = CATEGORY_ORDER.indexOf(b.toLowerCase());
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });

  const getCafeName = () => cafeterias.find(c => c.id === selectedCafeteria)?.name || 'Cafeteria';

  if (loading && !dailyMenu) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="space-y-4">
      {/* Company Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white text-center py-4 rounded-xl">
        <h2 className="text-xl font-bold uppercase">{getCafeName()} - LUNCH MENU</h2>
        <p className="text-sm text-green-100 mt-1">Tick your selections for each meal</p>
        {dailyMenu?.status !== 'published' && (
          <p className="text-yellow-200 text-sm mt-1">⚠️ Menu for this day has not been published yet</p>
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

      {/* Meals */}
      {dailyMenu?.status === 'published' && sortedCategories.length > 0 ? (
        <div className="space-y-6">
          {meals.map((meal, mealIdx) => (
            <div key={meal.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Meal Header */}
              <div className="bg-gray-100 px-4 py-3 flex justify-between items-center">
                <h4 className="font-bold text-gray-700">MEAL {mealIdx + 1}</h4>
                <div className="flex items-center gap-4">
                  <span className="text-green-600 font-semibold">${getMealPrice().toFixed(2)}</span>
                  {meals.length > 1 && (
                    <button onClick={() => removeMeal(meal.id)} className="text-red-500 hover:text-red-700 text-sm">
                      ✕ Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Category Columns */}
              <div className="overflow-x-auto">
                <div className="flex" style={{ minWidth: 'max-content' }}>
                  {sortedCategories.map(category => {
                    const config = getCatConfig(category);
                    const items = groupedItems[category] || [];
                    return (
                      <div key={category} className="flex-shrink-0 w-40 border-r border-gray-200 last:border-r-0">
                        <div className={`${config.bg} text-white text-center py-2 px-2`}>
                          <h5 className="font-bold text-xs uppercase tracking-wide">{config.label}</h5>
                          
                        </div>
                        <div className={`${config.light} p-2 min-h-[150px] space-y-1`}>
                          {items.map(item => {
                            const isChecked = meal.selections[category] === item.id;
                            return (
                              <label key={item.id} 
                                className={`flex items-start gap-2 p-2 rounded cursor-pointer transition ${
                                  isChecked ? 'bg-white shadow-sm ring-2 ring-indigo-400' : 'hover:bg-white/50'
                                } ${item.is_sold_out ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => !item.is_sold_out && toggleSelection(meal.id, category, item.id)}
                                  disabled={item.is_sold_out}
                                  className="mt-1 w-4 h-4 rounded"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-800 leading-tight">{item.item_name || item.name}</p>
                                  
                                  {item.is_sold_out && <p className="text-xs text-red-500">Sold Out</p>}
                                </div>
                              </label>
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

          {/* Add Another Meal Button */}
          <button
            onClick={addMeal}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition font-medium"
          >
            + Add Another Meal
          </button>

          {/* Order Summary */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h4 className="font-bold text-gray-700 mb-3">Order Summary</h4>
            <div className="space-y-2 mb-4">
              {meals.map((meal, idx) => (
                <div key={meal.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    Meal {idx + 1}: {Object.keys(meal.selections).length > 0 
                      ? Object.entries(meal.selections).map(([cat, itemId]) => {
                          const item = menuItems.find(i => i.id === itemId);
                          return item ? (item.item_name || item.name) : '';
                        }).filter(Boolean).join(' + ')
                      : 'No selections'}
                  </span>
                  <span className="font-medium">${getMealPrice().toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 flex justify-between items-center">
              <div>
                <p className="text-lg font-bold">Total: ${getTotalPrice().toFixed(2)}</p>
                <p className="text-sm text-gray-500">{meals.length} meal{meals.length > 1 ? 's' : ''}</p>
              </div>
            </div>
            <textarea
              placeholder="Special instructions or allergies..."
              value={orderNotes}
              onChange={e => setOrderNotes(e.target.value)}
              className="w-full mt-3 p-2 border border-gray-200 rounded-lg text-sm"
              rows="2"
            />
            <button
              onClick={placeOrder}
              disabled={placingOrder || !allMealsComplete()}
              className={`w-full mt-3 py-3 rounded-lg font-semibold text-white transition ${
                allMealsComplete() 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {placingOrder ? 'Placing Order...' : `Place Order (${meals.length} meal${meals.length > 1 ? 's' : ''})`}
            </button>
            {!allMealsComplete() && (
              <p className="text-center text-sm text-orange-600 mt-2">
                ⚠️ Please select at least one item for each meal
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-50 rounded-xl">
          <p className="text-5xl mb-4">📋</p>
          <p className="text-xl text-gray-500">No menu available for this date</p>
          <p className="text-sm text-gray-400 mt-2">Please select another date or check back later</p>
        </div>
      )}
    </div>
  );
};

export default MenuPage;
