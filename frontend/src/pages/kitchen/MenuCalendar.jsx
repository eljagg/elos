/**
 * Menu Planning Calendar - Weekly/Monthly calendar view for kitchen staff
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dailyMenuAPI, companyAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import toast from 'react-hot-toast';

export default function MenuCalendar() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const [view, setView] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [cafeterias, setCafeterias] = useState([]);
  const [selectedCafeteria, setSelectedCafeteria] = useState('');
  const [menuData, setMenuData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCafeterias();
  }, []);

  useEffect(() => {
    if (selectedCafeteria) {
      loadMenuData();
    }
  }, [selectedCafeteria, currentDate, view]);

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

  const loadMenuData = async () => {
    setLoading(true);
    try {
      const dates = getDatesForView();
      const data = {};
      for (const date of dates) {
        const dateStr = date.toISOString().split('T')[0];
        try {
          const res = await dailyMenuAPI.getDailyMenu({ cafeteriaId: selectedCafeteria, date: dateStr });
          data[dateStr] = res.data?.data?.dailyMenu || null;
        } catch { data[dateStr] = null; }
      }
      setMenuData(data);
    } catch (error) {
      console.error('Failed to load menu data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDatesForView = () => {
    const dates = [];
    if (view === 'week') {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay());
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        dates.push(d);
      }
    } else {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDate = new Date(firstDay);
      startDate.setDate(startDate.getDate() - startDate.getDay());
      for (let d = new Date(startDate); d <= lastDay || d.getDay() !== 0; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
        if (dates.length >= 42) break;
      }
    }
    return dates;
  };

  const navigatePrev = () => {
    const newDate = new Date(currentDate);
    if (view === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (view === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const openDailyMenu = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    navigate('/kitchen/daily-menu?date=' + dateStr);
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isPast = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const dates = getDatesForView();

  return (
    <div className="p-6">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className={`text-2xl font-bold ${colors.textPrimary}`}>Menu Planning Calendar</h1>
          <p className={colors.textMuted}>Plan and manage daily menus</p>
        </div>
        <div className="flex items-center gap-3">
          {cafeterias.length > 1 && (
            <select value={selectedCafeteria} onChange={(e) => setSelectedCafeteria(e.target.value)} className={`px-4 py-2 border ${colors.border} rounded-lg ${colors.bgCard}`}>
              {cafeterias.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <div className={`flex border ${colors.border} rounded-lg overflow-hidden`}>
            <button onClick={() => setView('week')} className={`px-4 py-2 text-sm ${view === 'week' ? 'bg-indigo-600 text-white' : colors.bgCard}`}>Week</button>
            <button onClick={() => setView('month')} className={`px-4 py-2 text-sm ${view === 'month' ? 'bg-indigo-600 text-white' : colors.bgCard}`}>Month</button>
          </div>
        </div>
      </div>

      <div className={`${colors.bgCard} rounded-xl shadow-sm border ${colors.border} overflow-hidden`}>
        <div className={`flex justify-between items-center p-4 border-b ${colors.border}`}>
          <button onClick={navigatePrev} className={`p-2 rounded-lg ${colors.bgSecondary} hover:bg-gray-200`}>← Prev</button>
          <div className="flex items-center gap-4">
            <h2 className={`text-lg font-semibold ${colors.textPrimary}`}>
              {view === 'week' 
                ? `Week of ${dates[0]?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <button onClick={goToToday} className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-lg">Today</button>
          </div>
          <button onClick={navigateNext} className={`p-2 rounded-lg ${colors.bgSecondary} hover:bg-gray-200`}>Next →</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className={`grid ${view === 'week' ? 'grid-cols-7' : 'grid-cols-7'} gap-px bg-gray-200`}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className={`p-2 text-center text-sm font-medium ${colors.bgSecondary} ${colors.textMuted}`}>{day}</div>
            ))}
            {dates.map((date, idx) => {
              const dateStr = date.toISOString().split('T')[0];
              const menu = menuData[dateStr];
              const isCurrentMonth = view === 'month' ? date.getMonth() === currentDate.getMonth() : true;
              return (
                <div key={idx} onClick={() => openDailyMenu(date)} className={`min-h-24 p-2 cursor-pointer transition-colors ${colors.bgCard} ${isToday(date) ? 'ring-2 ring-indigo-500' : ''} ${!isCurrentMonth ? 'opacity-40' : ''} ${isPast(date) ? 'bg-gray-50' : 'hover:bg-indigo-50'}`}>
                  <div className={`text-sm font-medium mb-1 ${isToday(date) ? 'text-indigo-600' : colors.textPrimary}`}>{date.getDate()}</div>
                  {menu ? (
                    <div className={`text-xs p-1 rounded ${menu.status === 'published' ? 'bg-green-100 text-green-700' : menu.status === 'draft' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                      {menu.status === 'published' ? '✓ Published' : menu.status === 'draft' ? '📝 Draft' : menu.status}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">{isPast(date) ? '—' : '+ Add Menu'}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={`mt-6 p-4 ${colors.bgCard} rounded-xl border ${colors.border}`}>
        <h3 className={`font-semibold mb-3 ${colors.textPrimary}`}>Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2"><span className="w-4 h-4 bg-green-100 rounded"></span> Published</div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 bg-yellow-100 rounded"></span> Draft</div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 bg-gray-100 rounded"></span> No Menu</div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 ring-2 ring-indigo-500 rounded"></span> Today</div>
        </div>
      </div>
    </div>
  );
}
