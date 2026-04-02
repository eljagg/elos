/**
 * Enhanced Daily Menu Management - Kitchen Staff
 * Features:
 * - Menu Templates (save & load)
 * - Copy from Previous Day
 * - Week Planning View
 * - Quick Setup
 */
import { useState, useEffect } from 'react';
import { catalogAPI, dailyMenuAPI, companyAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function DailyMenuManagement() {
  // View mode: 'day' or 'week'
  const [viewMode, setViewMode] = useState('day');
  
  // Date selection
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day;
    return new Date(today.setDate(diff)).toISOString().split('T')[0];
  });
  
  // Data
  const [cafeterias, setCafeterias] = useState([]);
  const [selectedCafeteria, setSelectedCafeteria] = useState('');
  const [dailyMenu, setDailyMenu] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mealPrice, setMealPrice] = useState('900.00');
  
  // Templates
  const [templates, setTemplates] = useState([]);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  
  // Copy from previous
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySourceDate, setCopySourceDate] = useState('');
  const [sourceMenuItems, setSourceMenuItems] = useState([]);
  
  // Add items modal
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Week planning
  const [weekMenus, setWeekMenus] = useState({});

  useEffect(() => {
    loadCafeterias();
    loadCatalog();
    loadTemplates();
  }, []);

  useEffect(() => {
    if (selectedCafeteria && selectedDate) {
      loadDailyMenu();
    }
  }, [selectedCafeteria, selectedDate]);

  useEffect(() => {
    if (selectedCafeteria && viewMode === 'week') {
      loadWeekMenus();
    }
  }, [selectedCafeteria, weekStart, viewMode]);

  const loadCafeterias = async () => {
    try {
      const res = await companyAPI.getCafeterias();
      const cafeteriaList = res.data?.data?.cafeterias || res.data?.cafeterias || [];
      setCafeterias(cafeteriaList);
      if (cafeteriaList.length > 0) {
        setSelectedCafeteria(cafeteriaList[0].id);
      }
    } catch (error) {
      console.error('Failed to load cafeterias:', error);
      toast.error('Failed to load cafeterias');
    }
  };

  const loadCatalog = async () => {
    try {
      const [itemsRes, categoriesRes] = await Promise.all([
        catalogAPI.getItems({ isActive: true }),
        catalogAPI.getCategories()
      ]);
      setCatalogItems(itemsRes.data?.data?.items || []);
      setCategories(categoriesRes.data?.data?.categories || []);
    } catch (error) {
      console.error('Failed to load catalog:', error);
    }
  };

  const loadDailyMenu = async () => {
    try {
      setLoading(true);
      const res = await dailyMenuAPI.getDailyMenu({
        cafeteriaId: selectedCafeteria,
        date: selectedDate,
        mealType: 'lunch'
      });
      setDailyMenu(res.data?.data?.dailyMenu);
      setMenuItems(res.data?.data?.items || []);
      if (res.data?.data?.dailyMenu?.meal_price) {
        setMealPrice(res.data.data.dailyMenu.meal_price.toString());
      }
    } catch (error) {
      console.error('Failed to load daily menu:', error);
      setDailyMenu(null);
      setMenuItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadWeekMenus = async () => {
    try {
      const weekData = {};
      for (let i = 0; i < 7; i++) { // Sun-Sat (full week)
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i); // Start from Sunday
        const dateStr = date.toISOString().split('T')[0];
        
        try {
          const res = await dailyMenuAPI.getDailyMenu({
            cafeteriaId: selectedCafeteria,
            date: dateStr,
            mealType: 'lunch'
          });
          weekData[dateStr] = {
            menu: res.data?.data?.dailyMenu,
            items: res.data?.data?.items || []
          };
        } catch (e) {
          weekData[dateStr] = { menu: null, items: [] };
        }
      }
      setWeekMenus(weekData);
    } catch (error) {
      console.error('Failed to load week menus:', error);
    }
  };

  // ========== TEMPLATES ==========
  const loadTemplates = () => {
    try {
      const saved = localStorage.getItem('elos_menu_templates');
      if (saved) setTemplates(JSON.parse(saved));
    } catch (e) {
      console.error('Failed to load templates:', e);
    }
  };

  const saveAsTemplate = () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    if (menuItems.length === 0) {
      toast.error('No items to save');
      return;
    }
    
    const template = {
      id: Date.now(),
      name: templateName,
      items: menuItems.map(item => ({
        catalogItemId: item.catalog_item_id,
        name: item.item_name,
        categoryName: item.category_name,
        portions: item.portions_available
      })),
      mealPrice: mealPrice,
      createdAt: new Date().toISOString()
    };
    
    const updated = [...templates, template];
    setTemplates(updated);
    localStorage.setItem('elos_menu_templates', JSON.stringify(updated));
    
    toast.success(`Template "${templateName}" saved!`);
    setShowSaveTemplateModal(false);
    setTemplateName('');
  };

  const applyTemplate = async (template) => {
    try {
      const items = template.items.map(item => ({
        catalogItemId: item.catalogItemId,
        portionsAvailable: item.portions
      }));
      
      await dailyMenuAPI.createDailyMenu({
        cafeteriaId: selectedCafeteria,
        date: selectedDate,
        mealType: 'lunch',
        cutoffTime: '10:00:00',
        items: items
      });
      
      setMealPrice(template.mealPrice || '900.00');
      toast.success(`Template "${template.name}" applied!`);
      setShowTemplatesModal(false);
      loadDailyMenu();
    } catch (error) {
      toast.error('Failed to apply template');
    }
  };

  const deleteTemplate = (id) => {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    localStorage.setItem('elos_menu_templates', JSON.stringify(updated));
    toast.success('Template deleted');
  };

  // ========== COPY FROM PREVIOUS ==========
  const loadSourceMenu = async () => {
    if (!copySourceDate) {
      toast.error('Please select a source date');
      return;
    }
    
    try {
      const res = await dailyMenuAPI.getDailyMenu({
        cafeteriaId: selectedCafeteria,
        date: copySourceDate,
        mealType: 'lunch'
      });
      const items = res.data?.data?.items || [];
      if (items.length === 0) {
        toast.error('No menu found for that date');
        return;
      }
      setSourceMenuItems(items);
    } catch (error) {
      toast.error('Failed to load source menu');
    }
  };

  const copyFromPrevious = async () => {
    if (sourceMenuItems.length === 0) {
      toast.error('Load a source menu first');
      return;
    }
    
    try {
      const items = sourceMenuItems.map(item => ({
        catalogItemId: item.catalog_item_id,
        portionsAvailable: item.portions_available
      }));
      
      await dailyMenuAPI.createDailyMenu({
        cafeteriaId: selectedCafeteria,
        date: selectedDate,
        mealType: 'lunch',
        cutoffTime: '10:00:00',
        items: items
      });
      
      toast.success('Menu copied successfully!');
      setShowCopyModal(false);
      setCopySourceDate('');
      setSourceMenuItems([]);
      loadDailyMenu();
    } catch (error) {
      toast.error('Failed to copy menu');
    }
  };

  // ========== MENU ACTIONS ==========
  const handleAddItems = async (items) => {
    try {
      if (dailyMenu) {
        // Menu already exists — add items to it
        await dailyMenuAPI.addItemsToMenu(dailyMenu.id, {
          catalogItemIds: items.map(item => item.id),
          portionsAvailable: 50
        });
      } else {
        // No menu yet — create one with items
        await dailyMenuAPI.createDailyMenu({
          cafeteriaId: selectedCafeteria,
          date: selectedDate,
          mealType: 'lunch',
          cutoffTime: '10:00:00',
          items: items.map(item => ({
            catalogItemId: item.id,
            portionsAvailable: item.portions || 50
          }))
        });
      }
      toast.success('Items added to daily menu');
      setShowAddModal(false);
      loadDailyMenu();
    } catch (error) {
      toast.error('Failed to add items');
    }
  };

  const handleUpdatePortions = async (dailyMenuItemId, portions) => {
    try {
      await dailyMenuAPI.updatePortions(dailyMenuItemId, { portionsAvailable: portions });
      toast.success('Portions updated');
      loadDailyMenu();
    } catch (error) {
      toast.error('Failed to update portions');
    }
  };

  const handleUpdatePrice = async () => {
    if (!dailyMenu) return;
    const price = parseFloat(mealPrice);
    if (isNaN(price) || price <= 0) {
      toast.error('Please enter a valid price');
      return;
    }
    try {
      await dailyMenuAPI.updateMenu(dailyMenu.id, { mealPrice: price });
      toast.success('Meal price updated');
      loadDailyMenu();
    } catch (error) {
      toast.error('Failed to update price');
    }
  };

  const handleMarkSoldOut = async (dailyMenuItemId, itemName) => {
    if (!confirm(`Mark "${itemName}" as SOLD OUT?`)) return;
    
    try {
      await dailyMenuAPI.markItemSoldOut(dailyMenuItemId, {
        reason: 'This item has sold out for today.'
      });
      toast.success('Item marked as sold out');
      loadDailyMenu();
    } catch (error) {
      toast.error('Failed to mark as sold out');
    }
  };

  const handleRemoveItem = async (dailyMenuItemId) => {
    try {
      await dailyMenuAPI.removeMenuItem(dailyMenu.id, dailyMenuItemId);
      toast.success('Item removed');
      loadDailyMenu();
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };

  const handlePublishMenu = async () => {
    if (!mealPrice || parseFloat(mealPrice) <= 0) {
      toast.error('Please set a valid meal price');
      return;
    }
    if (!dailyMenu) {
      toast.error('Create a menu first');
      return;
    }
    if (menuItems.length === 0) {
      toast.error('Add items to the menu first');
      return;
    }
    
    try {
      await dailyMenuAPI.publishDailyMenu(dailyMenu.id, { mealPrice: parseFloat(mealPrice) });
      toast.success('Menu published! Employees can now place orders.');
      loadDailyMenu();
    } catch (error) {
      toast.error('Failed to publish menu');
    }
  };

  const handleUnpublishMenu = async () => {
    if (!dailyMenu) return;
    
    try {
      await dailyMenuAPI.unpublishDailyMenu(dailyMenu.id);
      toast.success('Menu unpublished');
      loadDailyMenu();
    } catch (error) {
      toast.error('Failed to unpublish menu');
    }
  };

  // ========== HELPERS ==========
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD' }).format(price);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  };

  const getWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) { // Sun-Sat (full week)
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  // Group menu items by category
  const groupedItems = menuItems.reduce((acc, item) => {
    const cat = item.category_name || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  // Get items not yet in daily menu
  const availableToAdd = catalogItems.filter(
    ci => !menuItems.find(mi => mi.catalog_item_id === ci.id)
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Daily Menu Management</h1>
          <p className="text-slate-600">Create, publish and manage daily menus</p>
        </div>
        
        {/* View Toggle */}
        <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('day')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              viewMode === 'day' ? 'bg-white shadow text-slate-800' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            📅 Day View
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              viewMode === 'week' ? 'bg-white shadow text-slate-800' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            📆 Week View
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Cafeteria */}
          <div>
            <label className="block text-sm text-slate-600 mb-1">Cafeteria</label>
            <select
              value={selectedCafeteria}
              onChange={(e) => setSelectedCafeteria(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg min-w-[200px]"
            >
              {cafeterias.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {viewMode === 'day' && (
            <>
              {/* Date */}
              <div>
                <label className="block text-sm text-slate-600 mb-1">Menu Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => setShowTemplatesModal(true)}
                  className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 font-medium flex items-center gap-2"
                >
                  📋 Templates
                </button>
                <button
                  onClick={() => setShowCopyModal(true)}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium flex items-center gap-2"
                >
                  📄 Copy From...
                </button>
              </div>
            </>
          )}

          {viewMode === 'week' && (
            <div className="flex gap-2 items-center ml-auto">
              <button
                onClick={() => {
                  const newStart = new Date(weekStart);
                  newStart.setDate(newStart.getDate() - 7);
                  setWeekStart(newStart.toISOString().split('T')[0]);
                }}
                className="px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                ← Prev
              </button>
              <span className="font-medium text-slate-700">
                Week of {formatDate(weekStart)}
              </span>
              <button
                onClick={() => {
                  const newStart = new Date(weekStart);
                  newStart.setDate(newStart.getDate() + 7);
                  setWeekStart(newStart.toISOString().split('T')[0]);
                }}
                className="px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DAY VIEW */}
      {viewMode === 'day' && (
        <>
          {/* Status Banner */}
          <div className={`rounded-xl p-4 mb-6 ${
            dailyMenu?.status === 'published' 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-amber-50 border border-amber-200'
          }`}>
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div>
                <h2 className="font-semibold text-lg">
                  {formatDate(selectedDate)}
                </h2>
                <p className={dailyMenu?.status === 'published' ? 'text-green-700' : 'text-amber-700'}>
                  {dailyMenu?.status === 'published' 
                    ? '✅ Menu is PUBLISHED - Employees can order' 
                    : '⚠️ Menu is DRAFT - Not visible to employees'}
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Meal Price */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600">Meal Price:</label>
                  <input
                    type="number"
                    value={mealPrice}
                    onChange={(e) => setMealPrice(e.target.value)}
                    className="w-28 px-3 py-2 border rounded-lg text-right font-bold"
                    step="0.01"
                  />
                  {dailyMenu?.status === 'published' && (
                    <button
                      onClick={handleUpdatePrice}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                      Save
                    </button>
                  )}
                </div>
                
                {/* Publish/Unpublish */}
                {dailyMenu?.status === 'published' ? (
                  <button
                    onClick={handleUnpublishMenu}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium"
                  >
                    Unpublish
                  </button>
                ) : (
                  <button
                    onClick={handlePublishMenu}
                    disabled={menuItems.length === 0}
                    className={`px-6 py-2 rounded-lg font-medium ${
                      menuItems.length > 0
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    🚀 Publish Menu
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Menu Items */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-600"></div>
            </div>
          ) : menuItems.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <p className="text-5xl mb-4">🍽️</p>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No items in today's menu</h3>
              <p className="text-slate-500 mb-6">Add items from your dish library or apply a template</p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-6 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-800 font-medium"
                >
                  + Add Items
                </button>
                <button
                  onClick={() => setShowTemplatesModal(true)}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                >
                  📋 Use Template
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Action Bar */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-700">
                  {menuItems.length} items in menu
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 font-medium"
                  >
                    + Add More Items
                  </button>
                  {menuItems.length > 0 && (
                    <button
                      onClick={() => setShowSaveTemplateModal(true)}
                      className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 font-medium"
                    >
                      💾 Save as Template
                    </button>
                  )}
                </div>
              </div>

              {/* Items by Category */}
              <div className="space-y-6">
                {Object.entries(groupedItems).map(([category, items]) => (
                  <div key={category} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
                      <h4 className="font-bold text-slate-700">{category}</h4>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {items.map(item => (
                        <div key={item.id} className={`p-4 ${item.is_sold_out ? 'bg-red-50' : ''}`}>
                          <div className="flex flex-wrap items-center gap-4">
                            {/* Item Name */}
                            <div className="flex-1 min-w-[200px]">
                              <p className="font-medium text-slate-800">{item.item_name}</p>
                              <p className="text-sm text-slate-500">{item.description}</p>
                            </div>
                            
                            {/* Portions */}
                            <div className="text-center">
                              <div className="text-xs text-slate-500 mb-1">Portions</div>
                              <input
                                type="number"
                                defaultValue={item.portions_available}
                                onBlur={(e) => {
                                  const val = parseInt(e.target.value);
                                  if (!isNaN(val) && val >= 0 && val !== item.portions_available) {
                                    handleUpdatePortions(item.id, val);
                                  }
                                }}
                                className="w-20 px-2 py-1 border rounded text-center"
                                min="0"
                                disabled={item.is_sold_out}
                              />
                            </div>
                            
                            {/* Ordered/Remaining */}
                            <div className="text-center min-w-[100px]">
                              <div className="text-xs text-slate-500 mb-1">Ordered / Left</div>
                              <div className="font-medium">
                                <span className="text-blue-600">{item.portions_ordered || 0}</span>
                                {' / '}
                                <span className={item.portions_remaining <= 5 ? 'text-red-600' : 'text-green-600'}>
                                  {item.portions_remaining ?? item.portions_available}
                                </span>
                              </div>
                            </div>
                            
                            {/* Actions */}
                            <div className="flex gap-2">
                              {!item.is_sold_out ? (
                                <button
                                  onClick={() => handleMarkSoldOut(item.id, item.item_name)}
                                  className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium"
                                >
                                  Sold Out
                                </button>
                              ) : (
                                <span className="px-3 py-1.5 bg-red-200 text-red-800 rounded-lg text-sm">
                                  SOLD OUT
                                </span>
                              )}
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 rounded-lg text-sm"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* WEEK VIEW */}
      {viewMode === 'week' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-7 divide-x divide-slate-200">
            {getWeekDates().map(dateStr => {
              const dayData = weekMenus[dateStr] || { menu: null, items: [] };
              const dayName = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
              const dayNum = new Date(dateStr).getDate();
              
              return (
                <div key={dateStr} className="min-h-[300px]">
                  {/* Day Header */}
                  <div className={`p-3 text-center border-b ${
                    dayData.menu?.status === 'published' ? 'bg-green-50' : 'bg-slate-50'
                  }`}>
                    <p className="text-sm text-slate-500">{dayName}</p>
                    <p className="text-xl font-bold">{dayNum}</p>
                    {dayData.menu?.status === 'published' && (
                      <span className="text-xs text-green-600">✅ Published</span>
                    )}
                  </div>
                  
                  {/* Day Content */}
                  <div className="p-3">
                    {dayData.items.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-slate-400 text-sm mb-3">No menu</p>
                        <button
                          onClick={() => {
                            setSelectedDate(dateStr);
                            setViewMode('day');
                          }}
                          className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded text-sm hover:bg-slate-200"
                        >
                          + Create
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 mb-2">{dayData.items.length} items</p>
                        {dayData.items.slice(0, 5).map(item => (
                          <p key={item.id} className="text-xs text-slate-600 truncate">
                            • {item.item_name}
                          </p>
                        ))}
                        {dayData.items.length > 5 && (
                          <p className="text-xs text-slate-400">+{dayData.items.length - 5} more</p>
                        )}
                        <button
                          onClick={() => {
                            setSelectedDate(dateStr);
                            setViewMode('day');
                          }}
                          className="mt-2 w-full px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs hover:bg-slate-200"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========== MODALS ========== */}

      {/* Add Items Modal */}
      {showAddModal && (
        <AddItemsModal
          catalogItems={availableToAdd}
          categories={categories}
          onAdd={handleAddItems}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Templates Modal */}
      {showTemplatesModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">📋 Menu Templates</h2>
              <button onClick={() => setShowTemplatesModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {templates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-4xl mb-3">📋</p>
                  <p className="text-slate-500">No templates saved yet</p>
                  <p className="text-sm text-slate-400 mt-2">Create a menu and save it as a template</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map(template => (
                    <div key={template.id} className="bg-slate-50 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium text-slate-800">{template.name}</h4>
                          <p className="text-sm text-slate-500">
                            {template.items.length} items • {formatPrice(template.mealPrice)}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteTemplate(template.id)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          🗑️
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 mb-3">
                        {template.items.map(i => i.name).join(', ')}
                      </p>
                      <button
                        onClick={() => applyTemplate(template)}
                        className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                      >
                        Apply to {formatDate(selectedDate)}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save Template Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">💾 Save as Template</h2>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-4">Save this menu configuration for quick reuse.</p>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Monday Special, Friday Feast"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4"
              />
              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <p className="font-medium text-slate-800 mb-2">{menuItems.length} items:</p>
                <p className="text-sm text-slate-600">
                  {menuItems.map(i => i.item_name).join(', ')}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowSaveTemplateModal(false); setTemplateName(''); }}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAsTemplate}
                  className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                >
                  Save Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Copy From Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">📄 Copy Menu From...</h2>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-4">Select a date to copy the menu from:</p>
              <div className="flex gap-2 mb-4">
                <input
                  type="date"
                  value={copySourceDate}
                  onChange={(e) => setCopySourceDate(e.target.value)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg"
                />
                <button
                  onClick={loadSourceMenu}
                  className="px-4 py-2 bg-slate-200 rounded-lg hover:bg-slate-300"
                >
                  Load
                </button>
              </div>
              
              {sourceMenuItems.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-4 mb-4">
                  <p className="font-medium text-slate-800 mb-2">Menu from {formatDate(copySourceDate)}:</p>
                  <p className="text-sm text-slate-600">
                    {sourceMenuItems.map(i => i.item_name).join(', ')}
                  </p>
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowCopyModal(false); setCopySourceDate(''); setSourceMenuItems([]); }}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={copyFromPrevious}
                  disabled={sourceMenuItems.length === 0}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-medium ${
                    sourceMenuItems.length > 0
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Copy to {formatDate(selectedDate)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== ADD ITEMS MODAL ==========
function AddItemsModal({ catalogItems, categories, onAdd, onClose }) {
  const [selectedItems, setSelectedItems] = useState({});
  const [filterCategory, setFilterCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = catalogItems.filter(item => {
    const matchesCategory = !filterCategory || item.category_id === filterCategory;
    const matchesSearch = !searchTerm || item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleItem = (item) => {
    setSelectedItems(prev => {
      if (prev[item.id]) {
        const { [item.id]: removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [item.id]: { ...item, portions: 50 } };
    });
  };

  const updatePortions = (itemId, portions) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], portions }
    }));
  };

  const selectAll = () => {
    const newSelected = {};
    filteredItems.forEach(item => {
      newSelected[item.id] = { ...item, portions: 50 };
    });
    setSelectedItems(prev => ({ ...prev, ...newSelected }));
  };

  const clearAll = () => {
    setSelectedItems({});
  };

  const handleSubmit = () => {
    const items = Object.values(selectedItems);
    if (items.length === 0) {
      alert('Select at least one item');
      return;
    }
    onAdd(items);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">Add Items to Menu</h2>
          <p className="text-slate-500">Select dishes from your library</p>
        </div>
        
        {/* Filters */}
        <div className="p-4 border-b bg-slate-50 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search dishes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg w-64"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
            ))}
          </select>
          <div className="flex gap-2 ml-auto">
            <button onClick={selectAll} className="px-3 py-1.5 text-sm bg-slate-200 rounded hover:bg-slate-300">
              Select All
            </button>
            <button onClick={clearAll} className="px-3 py-1.5 text-sm bg-slate-200 rounded hover:bg-slate-300">
              Clear
            </button>
          </div>
          <span className="text-slate-600 font-medium">
            {Object.keys(selectedItems).length} selected
          </span>
        </div>
        
        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No items available</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    selectedItems[item.id]
                      ? 'border-slate-600 bg-slate-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => toggleItem(item)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="checkbox"
                        checked={!!selectedItems[item.id]}
                        onChange={() => {}}
                        className="w-4 h-4 accent-slate-600"
                      />
                      <div>
                        <span className="font-medium text-slate-800">{item.name}</span>
                        {item.is_spicy && <span className="ml-1">🌶️</span>}
                        <p className="text-sm text-slate-500">{item.category_name}</p>
                      </div>
                    </div>
                    {selectedItems[item.id] && (
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <label className="text-sm text-slate-500">Portions:</label>
                        <input
                          type="number"
                          value={selectedItems[item.id].portions}
                          onChange={(e) => updatePortions(item.id, parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border rounded text-center"
                          min="1"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={Object.keys(selectedItems).length === 0}
            className={`px-6 py-2 rounded-lg font-medium ${
              Object.keys(selectedItems).length > 0
                ? 'bg-slate-700 text-white hover:bg-slate-800'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            Add {Object.keys(selectedItems).length} Items
          </button>
        </div>
      </div>
    </div>
  );
}
