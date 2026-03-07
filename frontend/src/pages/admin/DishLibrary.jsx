/**
 * Dish Library - Master catalog of all menu items
 * Mobile-first responsive design
 */
import { useState, useEffect, useMemo } from 'react';
import { catalogAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function DishLibrary() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [dietaryTags, setDietaryTags] = useState([]);
  const [allergens, setAllergens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filter, setFilter] = useState({ categoryId: '', search: '', isActive: 'true' });
  const [viewMode, setViewMode] = useState('grid');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    categoryId: '',
    prepTimeMinutes: 15,
    calories: '',
    isVegetarian: false,
    isVegan: false,
    isGlutenFree: false,
    isSpicy: false,
    spiceLevel: 0,
    isFeatured: false,
    dietaryTagIds: [],
    allergenIds: []
  });

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    code: '',
    description: '',
    icon: '🍽️',
    displayOrder: 0
  });

  // Category styling
  const getCategoryStyle = (categoryName) => {
    const styles = {
      'Proteins': { icon: '🍗', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700 border-red-200' },
      'Carbs': { icon: '🍚', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
      'Carbohydrates': { icon: '🍚', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
      'Vegetables': { icon: '🥗', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700 border-green-200' },
      'Soups': { icon: '🍲', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
      'Beverages': { icon: '🥤', bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', badge: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
      'Desserts': { icon: '🍰', bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', badge: 'bg-pink-100 text-pink-700 border-pink-200' },
      'Specials': { icon: '⭐', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700 border-purple-200' },
      'Sides': { icon: '🍟', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
    };
    return styles[categoryName] || { icon: '📦', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-700 border-gray-200' };
  };

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [itemsRes, categoriesRes, tagsRes, allergensRes] = await Promise.all([
        catalogAPI.getItems(filter),
        catalogAPI.getCategories(),
        catalogAPI.getDietaryTags(),
        catalogAPI.getAllergens()
      ]);
      
      setItems(itemsRes.data?.data?.items || []);
      setCategories(categoriesRes.data?.data?.categories || []);
      setDietaryTags(tagsRes.data?.data?.dietaryTags || []);
      setAllergens(allergensRes.data?.data?.allergens || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load dish library');
    } finally {
      setLoading(false);
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    const uniqueCategories = new Set(items.map(item => item.category_name).filter(Boolean));
    return {
      total: items.length,
      categories: uniqueCategories.size,
      vegetarian: items.filter(item => item.is_vegetarian).length,
      vegan: items.filter(item => item.is_vegan).length,
      spicy: items.filter(item => item.is_spicy).length,
      featured: items.filter(item => item.is_featured).length
    };
  }, [items]);

  // Category counts for filter pills
  const categoryCounts = useMemo(() => {
    const counts = {};
    items.forEach(item => {
      const cat = item.category_name || 'Uncategorized';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    let result = items;
    if (selectedCategoryFilter !== 'all') {
      result = result.filter(item => item.category_name === selectedCategoryFilter);
    }
    return result;
  }, [items, selectedCategoryFilter]);

  // Group items by category
  const groupedItems = useMemo(() => {
    return filteredItems.reduce((acc, item) => {
      const cat = item.category_name || 'Uncategorized';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
  }, [filteredItems]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...form,
        price: parseFloat(form.price),
        calories: form.calories ? parseInt(form.calories) : null,
        categoryId: form.categoryId || null
      };

      if (selectedItem) {
        await catalogAPI.updateItem(selectedItem.id, data);
        toast.success('Dish updated successfully');
      } else {
        await catalogAPI.createItem(data);
        toast.success('Dish added to library');
      }
      
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to save dish');
    }
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    try {
      await catalogAPI.createCategory(categoryForm);
      toast.success('Category created');
      setShowCategoryModal(false);
      setCategoryForm({ name: '', code: '', description: '', icon: '🍽️', displayOrder: 0 });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to create category');
    }
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setForm({
      name: item.name,
      description: item.description || '',
      price: item.price,
      categoryId: item.category_id || '',
      prepTimeMinutes: item.prep_time_minutes || 15,
      calories: item.calories || '',
      isVegetarian: item.is_vegetarian,
      isVegan: item.is_vegan,
      isGlutenFree: item.is_gluten_free,
      isSpicy: item.is_spicy,
      spiceLevel: item.spice_level || 0,
      isFeatured: item.is_featured,
      dietaryTagIds: item.dietary_tags?.map(t => t.id) || [],
      allergenIds: item.allergens?.map(a => a.id) || []
    });
    setShowModal(true);
  };

  const handleDelete = async (item) => {
    if (!confirm(`Remove "${item.name}" from the library?`)) return;
    try {
      await catalogAPI.deleteItem(item.id);
      toast.success('Dish removed');
      loadData();
    } catch (error) {
      toast.error('Failed to remove dish');
    }
  };

  const resetForm = () => {
    setSelectedItem(null);
    setForm({
      name: '',
      description: '',
      price: '',
      categoryId: '',
      prepTimeMinutes: 15,
      calories: '',
      isVegetarian: false,
      isVegan: false,
      isGlutenFree: false,
      isSpicy: false,
      spiceLevel: 0,
      isFeatured: false,
      dietaryTagIds: [],
      allergenIds: []
    });
  };

  const formatPrice = (price) => {
    return `$${parseFloat(price || 0).toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Dish Library</h1>
          <p className="text-gray-500 text-sm">Manage your master catalog of dishes</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
          >
            + Category
          </button>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            + Add Dish
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
        <div className="bg-white rounded-xl p-3 border border-gray-200 flex items-center gap-2">
          <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center text-lg shrink-0">🍽️</div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500 truncate">Total Dishes</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-gray-200 flex items-center gap-2">
          <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center text-lg shrink-0">📁</div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-gray-900">{stats.categories}</p>
            <p className="text-xs text-gray-500 truncate">Categories</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-gray-200 flex items-center gap-2">
          <div className="w-9 h-9 bg-lime-100 rounded-lg flex items-center justify-center text-lg shrink-0">🥬</div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-gray-900">{stats.vegetarian}</p>
            <p className="text-xs text-gray-500 truncate">Vegetarian</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-gray-200 flex items-center gap-2">
          <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center text-lg shrink-0">🌶️</div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-gray-900">{stats.spicy}</p>
            <p className="text-xs text-gray-500 truncate">Spicy Items</p>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 space-y-3">
        {/* Search + View Toggle */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              placeholder="Search dishes..."
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}
            >
              ▦
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}
            >
              ☰
            </button>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex gap-2 flex-wrap">
          <select
            value={filter.categoryId}
            onChange={(e) => setFilter({ ...filter, categoryId: e.target.value })}
            className="flex-1 min-w-[140px] px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
            ))}
          </select>
          <select
            value={filter.isActive}
            onChange={(e) => setFilter({ ...filter, isActive: e.target.value })}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="true">Active Only</option>
            <option value="false">Inactive</option>
            <option value="">All Status</option>
          </select>
        </div>

        {/* Category Quick Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3">
          <button
            onClick={() => setSelectedCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
              selectedCategoryFilter === 'all' 
                ? 'bg-indigo-600 text-white border-indigo-600' 
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            All ({items.length})
          </button>
          {Object.entries(categoryCounts).map(([cat, count]) => {
            const style = getCategoryStyle(cat);
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors flex items-center gap-1 ${
                  selectedCategoryFilter === cat 
                    ? 'bg-indigo-600 text-white border-indigo-600' 
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                <span>{style.icon}</span>
                <span>{cat}</span>
                <span className="opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-4xl mb-3">🍽️</p>
          <p className="text-lg text-gray-600 font-medium">No dishes found</p>
          <p className="text-sm text-gray-400 mt-1">Add your first dish to get started</p>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
          >
            + Add First Dish
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="space-y-6">
          {Object.entries(groupedItems).map(([category, categoryItems]) => {
            const style = getCategoryStyle(category);
            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{style.icon}</span>
                  <h3 className="text-lg font-bold text-gray-900">{category}</h3>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                    {categoryItems.length}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {categoryItems.map(item => (
                    <div 
                      key={item.id} 
                      className={`${style.bg} ${style.border} border-2 rounded-xl overflow-hidden hover:shadow-md transition-all group`}
                    >
                      {/* Card Header */}
                      <div className="h-20 sm:h-24 flex items-center justify-center text-4xl relative bg-white/50">
                        {style.icon}
                        {/* Badges */}
                        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                          {item.is_vegan && <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">🌱</span>}
                          {item.is_vegetarian && !item.is_vegan && <span className="bg-lime-500 text-white text-xs px-1.5 py-0.5 rounded-full">🥬</span>}
                          {item.is_spicy && <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">🌶️</span>}
                          {item.is_featured && <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">⭐</span>}
                        </div>
                        {/* Hover Actions */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center justify-center gap-2">
                          <button onClick={() => handleEdit(item)} className="px-3 py-1.5 bg-white text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-100">Edit</button>
                          <button onClick={() => handleDelete(item)} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600">Delete</button>
                        </div>
                      </div>
                      
                      {/* Card Content */}
                      <div className="p-3">
                        <h4 className="font-semibold text-gray-900 mb-1 truncate">{item.name}</h4>
                        <p className="text-lg font-bold text-green-600 mb-2">{formatPrice(item.price)}</p>
                        
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${style.badge}`}>{category}</span>
                          {item.prep_time_minutes && <span className="text-xs text-gray-500">⏱️ {item.prep_time_minutes}m</span>}
                        </div>

                        {item.description && (
                          <p className="text-xs text-gray-500 line-clamp-2 mb-3">{item.description}</p>
                        )}

                        {/* Mobile Actions */}
                        <div className="flex gap-2 sm:hidden">
                          <button onClick={() => handleEdit(item)} className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium">Edit</button>
                          <button onClick={() => handleDelete(item)} className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-lg font-medium">Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Dish</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tags</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Price</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map(item => {
                  const style = getCategoryStyle(item.category_name);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 ${style.bg} rounded-lg flex items-center justify-center text-lg`}>{style.icon}</div>
                          <div>
                            <span className="font-medium text-gray-900">{item.name}</span>
                            {item.description && <p className="text-xs text-gray-500 truncate max-w-[200px]">{item.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full border ${style.badge}`}>{item.category_name || 'Uncategorized'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {item.is_vegan && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">🌱 Vegan</span>}
                          {item.is_vegetarian && !item.is_vegan && <span className="text-xs bg-lime-100 text-lime-700 px-2 py-0.5 rounded">🥬 Veg</span>}
                          {item.is_spicy && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">🌶️ Spicy</span>}
                          {!item.is_vegan && !item.is_vegetarian && !item.is_spicy && <span className="text-gray-300">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">{formatPrice(item.price)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
                          <button onClick={() => handleDelete(item)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="sm:hidden divide-y divide-gray-100">
            {filteredItems.map(item => {
              const style = getCategoryStyle(item.category_name);
              return (
                <div key={item.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 ${style.bg} rounded-lg flex items-center justify-center text-2xl shrink-0`}>{style.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-semibold text-gray-900 truncate">{item.name}</h4>
                        <span className="font-bold text-green-600 shrink-0 ml-2">{formatPrice(item.price)}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${style.badge}`}>{item.category_name || 'Uncategorized'}</span>
                        {item.is_vegan && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">🌱</span>}
                        {item.is_vegetarian && !item.is_vegan && <span className="text-xs bg-lime-100 text-lime-700 px-1.5 py-0.5 rounded">🥬</span>}
                      </div>
                      <div className="flex gap-3 mt-2">
                        <button onClick={() => handleEdit(item)} className="text-blue-600 text-sm font-medium">Edit</button>
                        <button onClick={() => handleDelete(item)} className="text-red-600 text-sm font-medium">Delete</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results count */}
      {filteredItems.length > 0 && (
        <p className="text-center text-sm text-gray-500 py-4">
          Showing {filteredItems.length} of {items.length} dishes
        </p>
      )}

      {/* Add/Edit Dish Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-bold">{selectedItem ? 'Edit Dish' : 'Add New Dish'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">Dish Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Price (JMD) *</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Prep Time (minutes)</label>
                  <input
                    type="number"
                    value={form.prepTimeMinutes}
                    onChange={(e) => setForm({ ...form, prepTimeMinutes: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border rounded-lg"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Calories</label>
                  <input
                    type="number"
                    value={form.calories}
                    onChange={(e) => setForm({ ...form, calories: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    min="0"
                  />
                </div>
              </div>

              {/* Dietary Options */}
              <div>
                <label className="block text-sm font-medium mb-2">Dietary Options</label>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.isVegetarian} onChange={(e) => setForm({ ...form, isVegetarian: e.target.checked })} className="rounded" />
                    <span>🥬 Vegetarian</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.isVegan} onChange={(e) => setForm({ ...form, isVegan: e.target.checked })} className="rounded" />
                    <span>🌱 Vegan</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.isGlutenFree} onChange={(e) => setForm({ ...form, isGlutenFree: e.target.checked })} className="rounded" />
                    <span>🌾 Gluten-Free</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.isSpicy} onChange={(e) => setForm({ ...form, isSpicy: e.target.checked })} className="rounded" />
                    <span>🌶️ Spicy</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} className="rounded" />
                    <span>⭐ Featured</span>
                  </label>
                </div>
              </div>

              {/* Dietary Tags */}
              {dietaryTags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Dietary Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {dietaryTags.map(tag => (
                      <label key={tag.id} className={`flex items-center gap-1 px-3 py-1.5 border rounded-full cursor-pointer transition-colors ${form.dietaryTagIds.includes(tag.id) ? 'bg-indigo-50 border-indigo-300' : 'hover:bg-gray-50'}`}>
                        <input
                          type="checkbox"
                          checked={form.dietaryTagIds.includes(tag.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({ ...form, dietaryTagIds: [...form.dietaryTagIds, tag.id] });
                            } else {
                              setForm({ ...form, dietaryTagIds: form.dietaryTagIds.filter(id => id !== tag.id) });
                            }
                          }}
                          className="hidden"
                        />
                        <span className={form.dietaryTagIds.includes(tag.id) ? 'text-indigo-700' : 'text-gray-600'}>
                          {tag.icon} {tag.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Allergens */}
              {allergens.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Contains Allergens</label>
                  <div className="flex flex-wrap gap-2">
                    {allergens.map(allergen => (
                      <label key={allergen.id} className={`flex items-center gap-1 px-3 py-1.5 border rounded-full cursor-pointer transition-colors ${form.allergenIds.includes(allergen.id) ? 'bg-red-50 border-red-300' : 'hover:bg-gray-50'}`}>
                        <input
                          type="checkbox"
                          checked={form.allergenIds.includes(allergen.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({ ...form, allergenIds: [...form.allergenIds, allergen.id] });
                            } else {
                              setForm({ ...form, allergenIds: form.allergenIds.filter(id => id !== allergen.id) });
                            }
                          }}
                          className="hidden"
                        />
                        <span className={form.allergenIds.includes(allergen.id) ? 'text-red-600' : 'text-gray-600'}>
                          {allergen.icon} {allergen.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  {selectedItem ? 'Update Dish' : 'Add Dish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Add Category</h2>
            </div>
            <form onSubmit={handleCategorySubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category Name *</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Code</label>
                <input
                  type="text"
                  value={categoryForm.code}
                  onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Icon</label>
                <input
                  type="text"
                  value={categoryForm.icon}
                  onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="🍽️"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowCategoryModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
