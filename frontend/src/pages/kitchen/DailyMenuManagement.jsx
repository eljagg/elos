/**
 * Daily Menu Management - Kitchen staff page to manage daily menus
 */
import { useState, useEffect } from 'react';
import { catalogAPI, dailyMenuAPI, companyAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function DailyMenuManagement() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [cafeterias, setCafeterias] = useState([]);
  const [selectedCafeteria, setSelectedCafeteria] = useState('');
  const [dailyMenu, setDailyMenu] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    loadCafeterias();
    loadCatalog();
  }, []);

  useEffect(() => {
    if (selectedCafeteria && selectedDate) {
      loadDailyMenu();
    }
  }, [selectedCafeteria, selectedDate]);

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
        date: selectedDate
      });
      setDailyMenu(res.data?.data?.dailyMenu);
      setMenuItems(res.data?.data?.items || []);
    } catch (error) {
      console.error('Failed to load daily menu:', error);
      setDailyMenu(null);
      setMenuItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItems = async (items) => {
    try {
      await dailyMenuAPI.createDailyMenu({
        cafeteriaId: selectedCafeteria,
        date: selectedDate,
        items: items.map(item => ({
          catalogItemId: item.id,
          portionsAvailable: item.portions || 50
        }))
      });
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

  const handleMarkSoldOut = async (dailyMenuItemId, itemName) => {
    if (!confirm(`Mark "${itemName}" as SOLD OUT? This will notify all affected customers.`)) return;
    
    try {
      const res = await dailyMenuAPI.markItemSoldOut(dailyMenuItemId, {
        reason: 'This item has sold out for today.'
      });
      toast.success(res.data?.message || 'Item marked as sold out');
      loadDailyMenu();
    } catch (error) {
      toast.error('Failed to mark as sold out');
    }
  };

  const handlePublishMenu = async () => {
    if (!dailyMenu) {
      toast.error('Create a menu first');
      return;
    }
    if (menuItems.length === 0) {
      toast.error('Add items to the menu first');
      return;
    }
    
    try {
      await dailyMenuAPI.publishDailyMenu(dailyMenu.id);
      toast.success('Menu published! Employees can now place orders.');
      loadDailyMenu();
    } catch (error) {
      toast.error('Failed to publish menu');
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD' }).format(price);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Daily Menu Management</h1>
          <p className="text-gray-600">Set up today's menu with portion counts</p>
        </div>
        <div className="flex gap-2">
          {dailyMenu && dailyMenu.status !== 'published' && menuItems.length > 0 && (
            <button
              onClick={handlePublishMenu}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              📢 Publish Menu
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            + Add Items
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4 flex-wrap items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cafeteria</label>
            <select
              value={selectedCafeteria}
              onChange={(e) => setSelectedCafeteria(e.target.value)}
              className="px-4 py-2 border rounded-lg min-w-[200px]"
            >
              {cafeterias.map(caf => (
                <option key={caf.id} value={caf.id}>{caf.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1"></div>
          <div className="text-right">
            <div className="text-lg font-semibold text-gray-800">{formatDate(selectedDate)}</div>
            {dailyMenu && (
              <span className={`inline-block px-2 py-1 rounded text-sm ${
                dailyMenu.status === 'published' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {dailyMenu.status === 'published' ? '✅ Published' : '📝 Draft'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-indigo-600">{menuItems.length}</div>
          <div className="text-gray-600">Menu Items</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-green-600">
            {menuItems.reduce((sum, i) => sum + (i.portions_available || 0), 0)}
          </div>
          <div className="text-gray-600">Total Portions</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-blue-600">
            {menuItems.reduce((sum, i) => sum + (i.portions_ordered || 0), 0)}
          </div>
          <div className="text-gray-600">Ordered</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-red-600">
            {menuItems.filter(i => i.is_sold_out).length}
          </div>
          <div className="text-gray-600">Sold Out</div>
        </div>
      </div>

      {/* Menu Items */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
        </div>
      ) : menuItems.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No menu set for this date</h3>
          <p className="text-gray-500 mb-4">Add items from your dish library to create today's menu</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            + Add Items from Library
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedItems).map(([category, items]) => (
            <div key={category} className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
                <h3 className="font-semibold text-gray-700">{category} ({items.length})</h3>
              </div>
              <div className="divide-y">
                {items.map(item => (
                  <div key={item.id} className={`p-4 ${item.is_sold_out ? 'bg-red-50' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800">{item.item_name}</span>
                          {item.is_sold_out && (
                            <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded">SOLD OUT</span>
                          )}
                          {item.is_spicy && <span>🌶️</span>}
                          {item.is_vegetarian && <span>🥬</span>}
                        </div>
                        <p className="text-sm text-gray-500">{item.description}</p>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        {/* Price */}
                        <div className="text-right">
                          <div className="font-bold text-green-600">{formatPrice(item.price)}</div>
                        </div>
                        
                        {/* Portions */}
                        <div className="text-center">
                          <div className="text-sm text-gray-500">Portions</div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={item.portions_available}
                              onChange={(e) => handleUpdatePortions(item.id, parseInt(e.target.value))}
                              className="w-20 px-2 py-1 border rounded text-center"
                              min="0"
                              disabled={item.is_sold_out}
                            />
                          </div>
                        </div>
                        
                        {/* Ordered/Remaining */}
                        <div className="text-center min-w-[100px]">
                          <div className="text-sm text-gray-500">Ordered / Left</div>
                          <div className="font-medium">
                            <span className="text-blue-600">{item.portions_ordered || 0}</span>
                            {' / '}
                            <span className={item.portions_remaining <= 5 ? 'text-red-600' : 'text-green-600'}>
                              {item.portions_remaining || item.portions_available}
                            </span>
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div>
                          {!item.is_sold_out ? (
                            <button
                              onClick={() => handleMarkSoldOut(item.id, item.item_name)}
                              className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                            >
                              Mark Sold Out
                            </button>
                          ) : (
                            <span className="text-sm text-gray-400">
                              Sold out at {new Date(item.sold_out_at).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Items Modal */}
      {showAddModal && (
        <AddItemsModal
          catalogItems={availableToAdd}
          categories={categories}
          onAdd={handleAddItems}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

// Modal component for adding items
function AddItemsModal({ catalogItems, categories, onAdd, onClose }) {
  const [selectedItems, setSelectedItems] = useState({});
  const [filterCategory, setFilterCategory] = useState('');

  const filteredItems = filterCategory
    ? catalogItems.filter(item => item.category_id === filterCategory)
    : catalogItems;

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

  const handleSubmit = () => {
    const items = Object.values(selectedItems);
    if (items.length === 0) {
      alert('Select at least one item');
      return;
    }
    onAdd(items);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD' }).format(price);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">Add Items to Daily Menu</h2>
          <p className="text-gray-500">Select dishes from your library and set portion counts</p>
        </div>
        
        <div className="p-4 border-b bg-gray-50">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
            ))}
          </select>
          <span className="ml-4 text-gray-600">
            {Object.keys(selectedItems).length} items selected
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No items available to add
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    selectedItems[item.id]
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleItem(item)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!selectedItems[item.id]}
                          onChange={() => {}}
                          className="w-4 h-4"
                        />
                        <span className="font-medium">{item.name}</span>
                        {item.is_spicy && <span>🌶️</span>}
                      </div>
                      <div className="text-sm text-gray-500 ml-6">
                        {item.category_name} • {formatPrice(item.price)}
                      </div>
                    </div>
                    {selectedItems[item.id] && (
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <label className="text-sm text-gray-500">Portions:</label>
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
        
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            disabled={Object.keys(selectedItems).length === 0}
          >
            Add {Object.keys(selectedItems).length} Items
          </button>
        </div>
      </div>
    </div>
  );
}
