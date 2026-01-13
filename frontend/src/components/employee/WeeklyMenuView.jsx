import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';

const CATEGORY_COLORS = {
  'protein': { bg: 'bg-orange-500', light: 'bg-orange-50' },
  'proteins': { bg: 'bg-orange-500', light: 'bg-orange-50' },
  'carbohydrate': { bg: 'bg-yellow-500', light: 'bg-yellow-50' },
  'carbohydrates': { bg: 'bg-yellow-500', light: 'bg-yellow-50' },
  'sides': { bg: 'bg-green-500', light: 'bg-green-50' },
  'vegetable': { bg: 'bg-teal-500', light: 'bg-teal-50' },
  'soup': { bg: 'bg-purple-500', light: 'bg-purple-50' },
  'beverage': { bg: 'bg-blue-500', light: 'bg-blue-50' },
  'dessert': { bg: 'bg-pink-500', light: 'bg-pink-50' },
  'specials': { bg: 'bg-red-500', light: 'bg-red-50' },
  'main': { bg: 'bg-indigo-500', light: 'bg-indigo-50' },
  'other': { bg: 'bg-gray-500', light: 'bg-gray-50' },
};

const getCategoryColor = (cat) => CATEGORY_COLORS[(cat||'other').toLowerCase()] || CATEGORY_COLORS['other'];

export default function WeeklyMenuView({ menuItems, dailyMenu, selectedDate, onDateChange, onAddToCart, cafeteriaName }) {
  const { colors } = useTheme();
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(selectedDate); d.setDate(d.getDate() - d.getDay() + 1); return d;
  });
  const getWeekDates = () => { const dates = []; for (let i = 0; i < 7; i++) { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); dates.push(d); } return dates; };
  const weekDates = getWeekDates();
  const isToday = (date) => date.toDateString() === new Date().toDateString();
  const isSelected = (date) => date.toDateString() === selectedDate.toDateString();
  const navigateWeek = (dir) => { const n = new Date(weekStart); n.setDate(n.getDate() + (dir * 7)); setWeekStart(n); onDateChange(n); };
  const formatWeekRange = () => { const e = new Date(weekStart); e.setDate(weekStart.getDate() + 6); return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`; };
  const groupedItems = menuItems.reduce((acc, item) => { const cat = item.category || 'Other'; if (!acc[cat]) acc[cat] = []; acc[cat].push(item); return acc; }, {});
  const categories = Object.keys(groupedItems);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white text-center py-4 rounded-xl">
        <h2 className="text-xl font-bold uppercase">{cafeteriaName || 'Cafeteria'} - Lunch Menu</h2>
        {dailyMenu?.status !== 'published' && <p className="text-yellow-200 text-sm mt-1">⚠️ Menu not published yet</p>}
      </div>
      <div className={`${colors.bgCard} p-4 rounded-xl border ${colors.border}`}>
        <div className="flex items-center justify-between mb-4">
          <div><p className={`text-sm ${colors.textMuted}`}>📅 Menu For the Week</p><p className="text-indigo-600 font-semibold text-lg">{formatWeekRange()}</p></div>
          <div className="flex gap-2">
            <button onClick={() => navigateWeek(-1)} className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">‹</button>
            <button onClick={() => navigateWeek(1)} className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">›</button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((date, idx) => (
            <button key={idx} onClick={() => onDateChange(date)} className={`p-3 rounded-lg text-center transition-all ${isSelected(date) ? 'bg-indigo-600 text-white shadow-lg scale-105' : isToday(date) ? 'bg-indigo-100 ring-2 ring-indigo-400' : 'bg-gray-100 hover:bg-indigo-50'}`}>
              <p className="text-xs uppercase font-medium">{date.toLocaleDateString('en-US', { weekday: 'short' })}</p>
              <p className="text-2xl font-bold">{date.getDate()}</p>
              {isToday(date) && !isSelected(date) && <span className="block w-2 h-2 bg-indigo-500 rounded-full mx-auto mt-1"></span>}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-between items-center">
        <h3 className={`font-semibold ${colors.textPrimary}`}>Menu for {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
        {dailyMenu?.status === 'published' && <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">✅ Published</span>}
      </div>
      {dailyMenu?.status === 'published' && categories.length > 0 ? (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {categories.map(category => {
              const catColor = getCategoryColor(category);
              const items = groupedItems[category] || [];
              return (
                <div key={category} className="w-44 flex-shrink-0 rounded-xl overflow-hidden shadow-sm">
                  <div className={`${catColor.bg} text-white text-center py-2`}><h4 className="font-bold text-xs uppercase">{category}</h4></div>
                  <div className={`${catColor.light} p-2 min-h-[180px] space-y-2`}>
                    {items.map(item => (
                      <div key={item.id} onClick={() => !item.is_sold_out && onAddToCart(item)} className={`bg-white rounded-lg p-2 shadow-sm hover:shadow-md cursor-pointer ${item.is_sold_out ? 'opacity-50' : ''}`}>
                        <p className="font-medium text-sm">{item.item_name || item.name}</p>
                        <p className="text-xs text-green-600 font-semibold">${parseFloat(item.price).toFixed(2)}</p>
                        {item.is_sold_out && <p className="text-xs text-red-500">Sold Out</p>}
                      </div>
                    ))}
                    {items.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">No items</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-50 rounded-xl"><p className="text-4xl mb-3">📋</p><p className="text-lg text-gray-500">No menu available</p></div>
      )}
    </div>
  );
}
