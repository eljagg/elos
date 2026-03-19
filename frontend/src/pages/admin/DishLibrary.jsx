/**
 * Dish Library - Master catalog of all menu items
 * Updated with full nutrition fields and additional dietary options
 */
import { useState, useEffect } from 'react';
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
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'list'
  
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    categoryId: '',
    prepTimeMinutes: 15,
    calories: '',
    proteinGrams: '',
    carbsGrams: '',
    fatGrams: '',
    isVegetarian: false,
    isVegan: false,
    isGlutenFree: false,
    isDairyFree: false,
    isNutFree: false,
    isHalal: false,
    isKosher: false,
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...form,
        price: parseFloat(form.price),
        calories: form.calories ? parseInt(form.calories) : null,
        proteinGrams: form.proteinGrams ? parseFloat(form.proteinGrams) : null,
        carbsGrams: form.carbsGrams ? parseFloat(form.carbsGrams) : null,
        fatGrams: form.fatGrams ? parseFloat(form.fatGrams) : null,
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
      proteinGrams: item.protein_grams || '',
      carbsGrams: item.carbs_grams || '',
      fatGrams: item.fat_grams || '',
      isVegetarian: item.is_vegetarian || false,
      isVegan: item.is_vegan || false,
      isGlutenFree: item.is_gluten_free || false,
      isDairyFree: item.is_dairy_free || false,
      isNutFree: item.is_nut_free || false,
      isHalal: item.is_halal || false,
      isKosher: item.is_kosher || false,
      isSpicy: item.is_spicy || false,
      spiceLevel: item.spice_level || 0,
      isFeatured: item.is_featured || false,
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
      proteinGrams: '',
      carbsGrams: '',
      fatGrams: '',
      isVegetarian: false,
      isVegan: false,
      isGlutenFree: false,
      isDairyFree: false,
      isNutFree: false,
      isHalal: false,
      isKosher: false,
      isSpicy: false,
      spiceLevel: 0,
      isFeatured: false,
      dietaryTagIds: [],
      allergenIds: []
    });
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD' }).format(price);
  };

  // Category color mapping
  const categoryColors = {
    'Proteins': { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', accent: 'bg-rose-500', icon: '🍗' },
    'Carbohydrates': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', accent: 'bg-amber-500', icon: '🍚' },
    'Sides': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', accent: 'bg-emerald-500', icon: '🥗' },
    'Vegetables': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', accent: 'bg-green-500', icon: '🥬' },
    'Soup': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', accent: 'bg-purple-500', icon: '🍲' },
    'Beverage': { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', accent: 'bg-cyan-500', icon: '🥤' },
    'Dessert': { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', accent: 'bg-pink-500', icon: '🍰' },
    'Specials': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', accent: 'bg-orange-500', icon: '⭐' },
  };
  const defaultCatColor = { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', accent: 'bg-slate-500', icon: '🍽️' };
  const getCatColor = (name) => categoryColors[name] || defaultCatColor;

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    const cat = item.category_name || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  // Dietary badges renderer
  const DietaryBadges = ({ item, size = 'sm' }) => {
    const badges = [];
    if (item.is_featured) badges.push({ label: 'Featured', icon: '⭐', cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' });
    if (item.is_spicy) badges.push({ label: `Spicy${item.spice_level > 1 ? ` (${item.spice_level}/5)` : ''}`, icon: '🌶️', cls: 'bg-red-50 text-red-700 border-red-200' });
    if (item.is_vegetarian) badges.push({ label: 'Vegetarian', icon: '🥬', cls: 'bg-green-50 text-green-700 border-green-200' });
    if (item.is_vegan) badges.push({ label: 'Vegan', icon: '🌱', cls: 'bg-green-50 text-green-700 border-green-200' });
    if (item.is_gluten_free) badges.push({ label: 'GF', icon: '🌾', cls: 'bg-amber-50 text-amber-700 border-amber-200' });
    if (item.is_halal) badges.push({ label: 'Halal', icon: '☪️', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' });
    if (item.is_kosher) badges.push({ label: 'Kosher', icon: '✡️', cls: 'bg-blue-50 text-blue-700 border-blue-200' });
    
    if (badges.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {badges.map((b, i) => (
          <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${b.cls}`}>
            {b.icon} {size !== 'xs' && b.label}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dish Library</h1>
          <p className="text-gray-500 mt-1">Manage your master catalog of dishes</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            + Category
          </button>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-medium transition-colors shadow-sm"
          >
            + Add Dish
          </button>
        </div>
      </div>

      {/* Filters - Inline Row */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              placeholder="Search dishes..."
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>
          <select
            value={filter.categoryId}
            onChange={(e) => setFilter({ ...filter, categoryId: e.target.value })}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 min-w-[180px]"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
            ))}
          </select>
          <select
            value={filter.isActive}
            onChange={(e) => setFilter({ ...filter, isActive: e.target.value })}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 min-w-[140px]"
          >
            <option value="true">Active Only</option>
            <option value="">All Items</option>
            <option value="false">Inactive Only</option>
          </select>
          {/* View toggle */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-2.5 text-sm ${viewMode === 'cards' ? 'bg-indigo-50 text-indigo-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              title="Card view"
            >
              ▦
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2.5 text-sm ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              title="List view"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-xl">🍽️</div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{items.length}</div>
            <div className="text-sm text-gray-500">Total Dishes</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-xl">📂</div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{categories.length}</div>
            <div className="text-sm text-gray-500">Categories</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center text-xl">⭐</div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{items.filter(i => i.is_featured).length}</div>
            <div className="text-sm text-gray-500">Featured</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-xl">🌶️</div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{items.filter(i => i.is_spicy).length}</div>
            <div className="text-sm text-gray-500">Spicy Items</div>
          </div>
        </div>
      </div>

      {/* Items */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <div className="text-6xl mb-4">🍽️</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No dishes yet</h3>
          <p className="text-gray-500 mb-6">Start building your dish library by adding your first item</p>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium"
          >
            Add First Dish
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedItems).map(([category, categoryItems]) => {
            const catColor = getCatColor(category);
            return (
              <div key={category}>
                {/* Category Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-8 h-8 ${catColor.accent} rounded-lg flex items-center justify-center text-white text-sm`}>
                    {catColor.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{category}</h3>
                  <span className="text-sm text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full">{categoryItems.length}</span>
                </div>

                {/* Card View */}
                {viewMode === 'cards' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {categoryItems.map(item => (
                      <div key={item.id} className={`bg-white rounded-xl border ${catColor.border} overflow-hidden hover:shadow-md transition-shadow group`}>
                        <div className="p-5">
                          {/* Name + Price Row */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 truncate">{item.name}</h4>
                              {item.description && (
                                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                              )}
                            </div>
                            <div className="text-right ml-4 flex-shrink-0">
                              <div className="text-lg font-bold text-gray-900">{formatPrice(item.price)}</div>
                              <div className="text-xs text-gray-400">{item.prep_time_minutes} min prep</div>
                            </div>
                          </div>

                          {/* Dietary Badges */}
                          <div className="mt-3">
                            <DietaryBadges item={item} />
                          </div>

                          {/* Nutrition Row */}
                          {(item.calories || item.protein_grams || item.carbs_grams || item.fat_grams) && (
                            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                              {item.calories != null && (
                                <div className="text-center">
                                  <div className="text-sm font-semibold text-gray-800">{item.calories}</div>
                                  <div className="text-xs text-gray-400">cal</div>
                                </div>
                              )}
                              {item.protein_grams != null && (
                                <div className="text-center">
                                  <div className="text-sm font-semibold text-blue-600">{item.protein_grams}g</div>
                                  <div className="text-xs text-gray-400">protein</div>
                                </div>
                              )}
                              {item.carbs_grams != null && (
                                <div className="text-center">
                                  <div className="text-sm font-semibold text-amber-600">{item.carbs_grams}g</div>
                                  <div className="text-xs text-gray-400">carbs</div>
                                </div>
                              )}
                              {item.fat_grams != null && (
                                <div className="text-center">
                                  <div className="text-sm font-semibold text-orange-600">{item.fat_grams}g</div>
                                  <div className="text-xs text-gray-400">fat</div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Tags & Allergens */}
                          {(item.dietary_tags?.length > 0 || item.allergens?.length > 0) && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {item.dietary_tags?.map(tag => (
                                <span key={tag.id} className="px-2 py-0.5 text-xs rounded-full" style={{ backgroundColor: tag.color + '15', color: tag.color, border: `1px solid ${tag.color}30` }}>
                                  {tag.icon} {tag.name}
                                </span>
                              ))}
                              {item.allergens?.map(allergen => (
                                <span key={allergen.id} className="px-2 py-0.5 text-xs rounded-full bg-red-50 text-red-600 border border-red-200">
                                  ⚠️ {allergen.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions Footer */}
                        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEdit(item)} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                            Edit
                          </button>
                          <button onClick={() => handleDelete(item)} className="text-sm text-red-500 hover:text-red-700 font-medium">
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* List View */
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Dish</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Nutrition</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Tags</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Price</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase w-28">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {categoryItems.map(item => (
                          <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{item.name}</div>
                              {item.description && <div className="text-sm text-gray-500 truncate max-w-xs">{item.description}</div>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-3 text-xs text-gray-500">
                                {item.calories != null && <span>{item.calories} cal</span>}
                                {item.protein_grams != null && <span>{item.protein_grams}g P</span>}
                                {item.carbs_grams != null && <span>{item.carbs_grams}g C</span>}
                                {item.fat_grams != null && <span>{item.fat_grams}g F</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <DietaryBadges item={item} size="xs" />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="font-semibold text-gray-900">{formatPrice(item.price)}</div>
                              <div className="text-xs text-gray-400">{item.prep_time_minutes} min</div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => handleEdit(item)} className="text-sm text-indigo-600 hover:text-indigo-800 mr-3">Edit</button>
                              <button onClick={() => handleDelete(item)} className="text-sm text-red-500 hover:text-red-700">Remove</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dish Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-6 border-b z-10 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">{selectedItem ? 'Edit Dish' : 'Add New Dish'}</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dish Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (JMD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prep Time (minutes)</label>
                  <input
                    type="number"
                    value={form.prepTimeMinutes}
                    onChange={(e) => setForm({ ...form, prepTimeMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Nutrition */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nutrition (per serving)</label>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Calories</label>
                    <input type="number" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Protein (g)</label>
                    <input type="number" step="0.1" value={form.proteinGrams} onChange={(e) => setForm({ ...form, proteinGrams: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Carbs (g)</label>
                    <input type="number" step="0.1" value={form.carbsGrams} onChange={(e) => setForm({ ...form, carbsGrams: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Fat (g)</label>
                    <input type="number" step="0.1" value={form.fatGrams} onChange={(e) => setForm({ ...form, fatGrams: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="0" />
                  </div>
                </div>
              </div>

              {/* Dietary Options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dietary Options</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: 'isVegetarian', label: 'Vegetarian', icon: '🥬' },
                    { key: 'isVegan', label: 'Vegan', icon: '🌱' },
                    { key: 'isGlutenFree', label: 'Gluten-Free', icon: '🌾' },
                    { key: 'isDairyFree', label: 'Dairy-Free', icon: '🥛' },
                    { key: 'isNutFree', label: 'Nut-Free', icon: '🥜' },
                    { key: 'isHalal', label: 'Halal', icon: '☪️' },
                    { key: 'isKosher', label: 'Kosher', icon: '✡️' },
                    { key: 'isSpicy', label: 'Spicy', icon: '🌶️' },
                  ].map(opt => (
                    <label key={opt.key} className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer transition-colors ${form[opt.key] ? 'bg-indigo-50 border-indigo-300' : 'hover:bg-gray-50 border-gray-200'}`}>
                      <input type="checkbox" checked={form[opt.key]} onChange={(e) => setForm({ ...form, [opt.key]: e.target.checked })} className="hidden" />
                      <span className="text-sm">{opt.icon} {opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Spice Level */}
              {form.isSpicy && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Spice Level</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(level => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setForm({ ...form, spiceLevel: level })}
                        className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-colors ${form.spiceLevel >= level ? 'bg-red-500 border-red-500 text-white' : 'border-gray-300 text-gray-400 hover:border-red-300'}`}
                      >
                        🌶️
                      </button>
                    ))}
                    <span className="flex items-center text-sm text-gray-500 ml-2">
                      {form.spiceLevel === 1 && 'Mild'}
                      {form.spiceLevel === 2 && 'Medium'}
                      {form.spiceLevel === 3 && 'Hot'}
                      {form.spiceLevel === 4 && 'Very Hot'}
                      {form.spiceLevel === 5 && 'Extremely Hot'}
                    </span>
                  </div>
                </div>
              )}

              {/* Featured */}
              <label className="flex items-center gap-3 p-3 border border-yellow-200 bg-yellow-50/50 rounded-xl cursor-pointer hover:bg-yellow-50">
                <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
                <span className="font-medium text-gray-800">⭐ Featured Dish</span>
                <span className="text-sm text-gray-500">— Highlight this dish on menus</span>
              </label>

              {/* Dietary Tags */}
              {dietaryTags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dietary Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {dietaryTags.map(tag => (
                      <label key={tag.id} className={`flex items-center gap-1 px-3 py-1.5 border rounded-full cursor-pointer transition-colors ${form.dietaryTagIds.includes(tag.id) ? 'bg-indigo-50 border-indigo-300' : 'hover:bg-gray-50 border-gray-200'}`}>
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
                        <span style={{ color: form.dietaryTagIds.includes(tag.id) ? tag.color : '#666' }}>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">⚠️ Contains Allergens</label>
                  <div className="flex flex-wrap gap-2">
                    {allergens.map(allergen => (
                      <label key={allergen.id} className={`flex items-center gap-1 px-3 py-1.5 border rounded-full cursor-pointer transition-colors ${form.allergenIds.includes(allergen.id) ? 'bg-red-50 border-red-300' : 'hover:bg-gray-50 border-gray-200'}`}>
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
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium text-gray-700">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Add Category</h2>
            </div>
            <form onSubmit={handleCategorySubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  type="text"
                  value={categoryForm.code}
                  onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                <input
                  type="text"
                  value={categoryForm.icon}
                  onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                  placeholder="🍽️"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowCategoryModal(false)} className="px-5 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium text-gray-700">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">
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
