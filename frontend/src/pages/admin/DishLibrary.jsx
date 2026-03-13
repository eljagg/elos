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
  
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    categoryId: '',
    prepTimeMinutes: 15,
    // Nutrition fields
    calories: '',
    proteinGrams: '',
    carbsGrams: '',
    fatGrams: '',
    // Dietary options
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

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    const cat = item.category_name || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dish Library</h1>
          <p className="text-gray-600">Manage your master catalog of dishes</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            + Category
          </button>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            + Add Dish
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4 flex-wrap">
          <input
            type="text"
            placeholder="Search dishes..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="px-4 py-2 border rounded-lg w-64"
          />
          <select
            value={filter.categoryId}
            onChange={(e) => setFilter({ ...filter, categoryId: e.target.value })}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
            ))}
          </select>
          <select
            value={filter.isActive}
            onChange={(e) => setFilter({ ...filter, isActive: e.target.value })}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="true">Active Only</option>
            <option value="">All Items</option>
            <option value="false">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-indigo-600">{items.length}</div>
          <div className="text-gray-600">Total Dishes</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-green-600">{categories.length}</div>
          <div className="text-gray-600">Categories</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-orange-600">{items.filter(i => i.is_featured).length}</div>
          <div className="text-gray-600">Featured</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-red-600">{items.filter(i => i.is_spicy).length}</div>
          <div className="text-gray-600">Spicy Items</div>
        </div>
      </div>

      {/* Items List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">🍽️</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No dishes yet</h3>
          <p className="text-gray-500 mb-4">Start building your dish library by adding your first item</p>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Add First Dish
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedItems).map(([category, categoryItems]) => (
            <div key={category} className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
                <h3 className="font-semibold text-gray-700">{category} ({categoryItems.length})</h3>
              </div>
              <div className="divide-y">
                {categoryItems.map(item => (
                  <div key={item.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-800">{item.name}</span>
                        {item.is_featured && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">Featured</span>}
                        {item.is_spicy && <span className="text-red-500">🌶️</span>}
                        {item.is_vegetarian && <span className="text-green-500" title="Vegetarian">🥬</span>}
                        {item.is_vegan && <span className="text-green-600" title="Vegan">🌱</span>}
                        {item.is_gluten_free && <span className="text-amber-600" title="Gluten-Free">🌾</span>}
                        {item.is_dairy_free && <span className="text-blue-500" title="Dairy-Free">🥛</span>}
                        {item.is_nut_free && <span className="text-orange-500" title="Nut-Free">🥜</span>}
                        {item.is_halal && <span className="text-emerald-600" title="Halal">☪️</span>}
                        {item.is_kosher && <span className="text-blue-600" title="Kosher">✡️</span>}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                      {/* Nutrition Info */}
                      {(item.calories || item.protein_grams || item.carbs_grams || item.fat_grams) && (
                        <div className="flex gap-3 mt-2 text-xs text-gray-500">
                          {item.calories && <span>🔥 {item.calories} cal</span>}
                          {item.protein_grams && <span>💪 {item.protein_grams}g protein</span>}
                          {item.carbs_grams && <span>🍞 {item.carbs_grams}g carbs</span>}
                          {item.fat_grams && <span>🧈 {item.fat_grams}g fat</span>}
                        </div>
                      )}
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {item.dietary_tags?.map(tag => (
                          <span key={tag.id} className="px-2 py-0.5 text-xs rounded" style={{ backgroundColor: tag.color + '20', color: tag.color }}>
                            {tag.icon} {tag.name}
                          </span>
                        ))}
                        {item.allergens?.map(allergen => (
                          <span key={allergen.id} className="px-2 py-0.5 text-xs rounded bg-red-50 text-red-600 border border-red-200">
                            ⚠️ {allergen.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">{formatPrice(item.price)}</div>
                      <div className="text-sm text-gray-500">{item.prep_time_minutes} min</div>
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => handleEdit(item)} className="text-indigo-600 hover:text-indigo-800 text-sm">Edit</button>
                        <button onClick={() => handleDelete(item)} className="text-red-600 hover:text-red-800 text-sm">Remove</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dish Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">{selectedItem ? 'Edit Dish' : 'Add New Dish'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Dish Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div className="col-span-2">
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
              </div>

              {/* Nutrition Information */}
              <div>
                <label className="block text-sm font-medium mb-2">📊 Nutrition Information</label>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Calories</label>
                    <input
                      type="number"
                      value={form.calories}
                      onChange={(e) => setForm({ ...form, calories: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      min="0"
                      placeholder="kcal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Protein (g)</label>
                    <input
                      type="number"
                      value={form.proteinGrams}
                      onChange={(e) => setForm({ ...form, proteinGrams: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      min="0"
                      step="0.1"
                      placeholder="grams"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Carbs (g)</label>
                    <input
                      type="number"
                      value={form.carbsGrams}
                      onChange={(e) => setForm({ ...form, carbsGrams: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      min="0"
                      step="0.1"
                      placeholder="grams"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Fat (g)</label>
                    <input
                      type="number"
                      value={form.fatGrams}
                      onChange={(e) => setForm({ ...form, fatGrams: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      min="0"
                      step="0.1"
                      placeholder="grams"
                    />
                  </div>
                </div>
              </div>

              {/* Dietary Options */}
              <div>
                <label className="block text-sm font-medium mb-2">🥗 Dietary Options</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={form.isVegetarian} onChange={(e) => setForm({ ...form, isVegetarian: e.target.checked })} />
                    <span className="text-sm">🥬 Vegetarian</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={form.isVegan} onChange={(e) => setForm({ ...form, isVegan: e.target.checked })} />
                    <span className="text-sm">🌱 Vegan</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={form.isGlutenFree} onChange={(e) => setForm({ ...form, isGlutenFree: e.target.checked })} />
                    <span className="text-sm">🌾 Gluten-Free</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={form.isDairyFree} onChange={(e) => setForm({ ...form, isDairyFree: e.target.checked })} />
                    <span className="text-sm">🥛 Dairy-Free</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={form.isNutFree} onChange={(e) => setForm({ ...form, isNutFree: e.target.checked })} />
                    <span className="text-sm">🥜 Nut-Free</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={form.isHalal} onChange={(e) => setForm({ ...form, isHalal: e.target.checked })} />
                    <span className="text-sm">☪️ Halal</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={form.isKosher} onChange={(e) => setForm({ ...form, isKosher: e.target.checked })} />
                    <span className="text-sm">✡️ Kosher</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={form.isSpicy} onChange={(e) => setForm({ ...form, isSpicy: e.target.checked })} />
                    <span className="text-sm">🌶️ Spicy</span>
                  </label>
                </div>
              </div>

              {/* Spice Level */}
              {form.isSpicy && (
                <div>
                  <label className="block text-sm font-medium mb-2">🌶️ Spice Level</label>
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
              <div>
                <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-yellow-50 border-yellow-200 bg-yellow-50/50">
                  <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
                  <span className="font-medium">⭐ Featured Dish</span>
                  <span className="text-sm text-gray-500">- Highlight this dish on menus</span>
                </label>
              </div>

              {/* Dietary Tags */}
              {dietaryTags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">🏷️ Dietary Tags</label>
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
                  <label className="block text-sm font-medium mb-2">⚠️ Contains Allergens</label>
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
