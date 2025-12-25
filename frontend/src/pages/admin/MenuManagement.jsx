/**
 * Admin - Menu Management
 * Manage weekly menus, items, and categories
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { menuAPI, companyAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function MenuManagement() {
  const [loading, setLoading] = useState(true);
  const [menus, setMenus] = useState([]);
  const [cafeterias, setCafeterias] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCafeteria, setSelectedCafeteria] = useState('');
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [menuItems, setMenuItems] = useState([]);

  const [newMenu, setNewMenu] = useState({
    name: '',
    cafeteriaId: '',
    weekStartDate: '',
    weekEndDate: ''
  });

  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    price: '',
    categoryId: '',
    mealType: 'both',
    isActive: true
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedCafeteria) {
      loadMenus();
    }
  }, [selectedCafeteria]);

  const loadInitialData = async () => {
    try {
      const [cafeteriasRes, categoriesRes] = await Promise.all([
        companyAPI.getCafeterias().catch(() => ({ data: { data: { cafeterias: [] } } })),
        menuAPI.getCategories().catch(() => ({ data: { data: { categories: [] } } }))
      ]);
      
      const cafeteriasList = cafeteriasRes.data?.data?.cafeterias || [];
      setCafeterias(cafeteriasList);
      setCategories(categoriesRes.data?.data?.categories || []);
      
      if (cafeteriasList.length > 0) {
        setSelectedCafeteria(cafeteriasList[0].id);
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMenus = async () => {
    setLoading(true);
    try {
      const response = await menuAPI.getMenus({ cafeteriaId: selectedCafeteria });
      setMenus(response.data?.data?.menus || []);
    } catch (error) {
      console.error('Failed to load menus:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMenuItems = async (menuId) => {
    try {
      const response = await menuAPI.getMenuById(menuId);
      setMenuItems(response.data?.data?.items || []);
    } catch (error) {
      console.error('Failed to load menu items:', error);
    }
  };

  const handleCreateMenu = async (e) => {
    e.preventDefault();
    try {
      await menuAPI.createMenu(newMenu);
      toast.success('Menu created successfully');
      setShowMenuModal(false);
      setNewMenu({ name: '', cafeteriaId: '', weekStartDate: '', weekEndDate: '' });
      loadMenus();
    } catch (error) {
      toast.error('Failed to create menu');
    }
  };

  const handlePublishMenu = async (menuId) => {
    try {
      await menuAPI.publishMenu(menuId);
      toast.success('Menu published successfully');
      loadMenus();
    } catch (error) {
      toast.error('Failed to publish menu');
    }
  };

  const handleUnpublishMenu = async (menuId) => {
    try {
      await menuAPI.unpublishMenu(menuId);
      toast.success('Menu unpublished');
      loadMenus();
    } catch (error) {
      toast.error('Failed to unpublish menu');
    }
  };

  const handleDeleteMenu = async (menuId) => {
    if (!confirm('Are you sure you want to delete this menu?')) return;
    try {
      await menuAPI.deleteMenu(menuId);
      toast.success('Menu deleted');
      loadMenus();
    } catch (error) {
      toast.error('Failed to delete menu');
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!selectedMenu) return;
    try {
      await menuAPI.addMenuItem(selectedMenu.id, newItem);
      toast.success('Item added successfully');
      setShowItemModal(false);
      setNewItem({ name: '', description: '', price: '', categoryId: '', mealType: 'both', isActive: true });
      loadMenuItems(selectedMenu.id);
    } catch (error) {
      toast.error('Failed to add item');
    }
  };

  const handleDeleteItem = async (menuId, itemId) => {
    if (!confirm('Delete this item?')) return;
    try {
      await menuAPI.deleteMenuItem(menuId, itemId);
      toast.success('Item deleted');
      loadMenuItems(menuId);
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'draft': 'bg-gray-100 text-gray-800',
      'published': 'bg-green-100 text-green-800',
      'archived': 'bg-yellow-100 text-yellow-800'
    };
    return badges[status] || badges.draft;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Menu Management</h1>
          <p className="text-gray-500">Create and manage weekly menus</p>
        </div>
        <button
          onClick={() => {
            setNewMenu({ ...newMenu, cafeteriaId: selectedCafeteria });
            setShowMenuModal(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Create Menu
        </button>
      </div>

      {/* Cafeteria Selector */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Cafeteria</label>
        <select
          value={selectedCafeteria}
          onChange={(e) => setSelectedCafeteria(e.target.value)}
          className="w-full md:w-64 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {cafeterias.map(cafeteria => (
            <option key={cafeteria.id} value={cafeteria.id}>{cafeteria.name}</option>
          ))}
        </select>
      </div>

      {/* Menus Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : menus.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menus.map(menu => (
            <div key={menu.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{menu.name}</h3>
                    <p className="text-sm text-gray-500">
                      {new Date(menu.week_start_date).toLocaleDateString()} - {new Date(menu.week_end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(menu.status)}`}>
                    {menu.status}
                  </span>
                </div>

                <div className="text-sm text-gray-600 mb-4">
                  <p>{menu.item_count || 0} items</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setSelectedMenu(menu);
                      loadMenuItems(menu.id);
                    }}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    View Items
                  </button>
                  {menu.status === 'draft' ? (
                    <button
                      onClick={() => handlePublishMenu(menu.id)}
                      className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                    >
                      Publish
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUnpublishMenu(menu.id)}
                      className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                    >
                      Unpublish
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteMenu(menu.id)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-500 mb-4">No menus found for this cafeteria</p>
          <button
            onClick={() => {
              setNewMenu({ ...newMenu, cafeteriaId: selectedCafeteria });
              setShowMenuModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create First Menu
          </button>
        </div>
      )}

      {/* Selected Menu Items */}
      {selectedMenu && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">{selectedMenu.name} - Items</h2>
              <p className="text-sm text-gray-500">{menuItems.length} items</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowItemModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                + Add Item
              </button>
              <button
                onClick={() => setSelectedMenu(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>

          {menuItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Meal Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {menuItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-800">{item.name}</p>
                          <p className="text-sm text-gray-500">{item.description?.substring(0, 50)}...</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.category_name || '-'}</td>
                      <td className="px-4 py-3 text-sm font-medium">${parseFloat(item.price || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">{item.meal_type}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${item.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteItem(selectedMenu.id, item.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No items in this menu yet</p>
          )}
        </div>
      )}

      {/* Create Menu Modal */}
      {showMenuModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New Menu</h2>
            <form onSubmit={handleCreateMenu} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Menu Name</label>
                <input
                  type="text"
                  value={newMenu.name}
                  onChange={(e) => setNewMenu({ ...newMenu, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Week Start Date</label>
                <input
                  type="date"
                  value={newMenu.weekStartDate}
                  onChange={(e) => setNewMenu({ ...newMenu, weekStartDate: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Week End Date</label>
                <input
                  type="date"
                  value={newMenu.weekEndDate}
                  onChange={(e) => setNewMenu({ ...newMenu, weekEndDate: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowMenuModal(false)} className="px-4 py-2 border rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                  Create Menu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Menu Item</h2>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows="2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={newItem.categoryId}
                    onChange={(e) => setNewItem({ ...newItem, categoryId: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meal Type</label>
                <select
                  value={newItem.mealType}
                  onChange={(e) => setNewItem({ ...newItem, mealType: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="both">Both</option>
                  <option value="breakfast">Breakfast Only</option>
                  <option value="lunch">Lunch Only</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowItemModal(false)} className="px-4 py-2 border rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg">
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
