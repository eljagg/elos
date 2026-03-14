/**
 * Ingredient Library - Manage ingredients with nutrition data
 */
import { useState, useEffect } from 'react';
import { ingredientAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function IngredientLibrary() {
  const [ingredients, setIngredients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [filter, setFilter] = useState({ category: '', search: '', isActive: 'true' });
  
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'PROTEIN',
    servingSize: 100,
    servingUnit: 'g',
    servingDescription: '',
    calories: '',
    proteinGrams: '',
    carbsGrams: '',
    fatGrams: '',
    fiberGrams: '',
    sugarGrams: '',
    sodiumMg: '',
    isVegetarian: false,
    isVegan: false,
    isGlutenFree: true,
    isDairyFree: true,
    isNutFree: true,
    isHalal: true,
    isKosher: true,
    containsGluten: false,
    containsDairy: false,
    containsEggs: false,
    containsNuts: false,
    containsPeanuts: false,
    containsSoy: false,
    containsFish: false,
    containsShellfish: false,
    containsSesame: false,
    costPerServing: ''
  });

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ingredientsRes, categoriesRes] = await Promise.all([
        ingredientAPI.getIngredients(filter),
        ingredientAPI.getCategories()
      ]);
      
      setIngredients(ingredientsRes.data?.data?.ingredients || []);
      setCategories(categoriesRes.data?.data?.categories || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load ingredients');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...form,
        servingSize: parseFloat(form.servingSize) || 100,
        calories: form.calories ? parseInt(form.calories) : 0,
        proteinGrams: form.proteinGrams ? parseFloat(form.proteinGrams) : 0,
        carbsGrams: form.carbsGrams ? parseFloat(form.carbsGrams) : 0,
        fatGrams: form.fatGrams ? parseFloat(form.fatGrams) : 0,
        fiberGrams: form.fiberGrams ? parseFloat(form.fiberGrams) : 0,
        sugarGrams: form.sugarGrams ? parseFloat(form.sugarGrams) : 0,
        sodiumMg: form.sodiumMg ? parseFloat(form.sodiumMg) : 0,
        costPerServing: form.costPerServing ? parseFloat(form.costPerServing) : null
      };

      if (selectedIngredient) {
        await ingredientAPI.updateIngredient(selectedIngredient.id, data);
        toast.success('Ingredient updated');
      } else {
        await ingredientAPI.createIngredient(data);
        toast.success('Ingredient created');
      }
      
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to save ingredient');
    }
  };

  const handleEdit = (ingredient) => {
    setSelectedIngredient(ingredient);
    setForm({
      name: ingredient.name,
      description: ingredient.description || '',
      category: ingredient.category || 'PROTEIN',
      servingSize: ingredient.serving_size || 100,
      servingUnit: ingredient.serving_unit || 'g',
      servingDescription: ingredient.serving_description || '',
      calories: ingredient.calories || '',
      proteinGrams: ingredient.protein_grams || '',
      carbsGrams: ingredient.carbs_grams || '',
      fatGrams: ingredient.fat_grams || '',
      fiberGrams: ingredient.fiber_grams || '',
      sugarGrams: ingredient.sugar_grams || '',
      sodiumMg: ingredient.sodium_mg || '',
      isVegetarian: ingredient.is_vegetarian || false,
      isVegan: ingredient.is_vegan || false,
      isGlutenFree: ingredient.is_gluten_free !== false,
      isDairyFree: ingredient.is_dairy_free !== false,
      isNutFree: ingredient.is_nut_free !== false,
      isHalal: ingredient.is_halal !== false,
      isKosher: ingredient.is_kosher !== false,
      containsGluten: ingredient.contains_gluten || false,
      containsDairy: ingredient.contains_dairy || false,
      containsEggs: ingredient.contains_eggs || false,
      containsNuts: ingredient.contains_nuts || false,
      containsPeanuts: ingredient.contains_peanuts || false,
      containsSoy: ingredient.contains_soy || false,
      containsFish: ingredient.contains_fish || false,
      containsShellfish: ingredient.contains_shellfish || false,
      containsSesame: ingredient.contains_sesame || false,
      costPerServing: ingredient.cost_per_serving || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (ingredient) => {
    if (!confirm(`Delete "${ingredient.name}"?`)) return;
    try {
      await ingredientAPI.deleteIngredient(ingredient.id);
      toast.success('Ingredient deleted');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to delete');
    }
  };

  const resetForm = () => {
    setSelectedIngredient(null);
    setForm({
      name: '',
      description: '',
      category: 'PROTEIN',
      servingSize: 100,
      servingUnit: 'g',
      servingDescription: '',
      calories: '',
      proteinGrams: '',
      carbsGrams: '',
      fatGrams: '',
      fiberGrams: '',
      sugarGrams: '',
      sodiumMg: '',
      isVegetarian: false,
      isVegan: false,
      isGlutenFree: true,
      isDairyFree: true,
      isNutFree: true,
      isHalal: true,
      isKosher: true,
      containsGluten: false,
      containsDairy: false,
      containsEggs: false,
      containsNuts: false,
      containsPeanuts: false,
      containsSoy: false,
      containsFish: false,
      containsShellfish: false,
      containsSesame: false,
      costPerServing: ''
    });
  };

  // Group by category
  const groupedIngredients = ingredients.reduce((acc, ing) => {
    const cat = ing.category_name || 'Other';
    if (!acc[cat]) acc[cat] = { icon: ing.category_icon || '📦', items: [] };
    acc[cat].items.push(ing);
    return acc;
  }, {});

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🥗 Ingredient Library</h1>
          <p className="text-gray-600">Manage ingredients with nutrition data for automatic dish calculations</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          + Add Ingredient
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4 flex-wrap">
          <input
            type="text"
            placeholder="Search ingredients..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="px-4 py-2 border rounded-lg w-64"
          />
          <select
            value={filter.category}
            onChange={(e) => setFilter({ ...filter, category: e.target.value })}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.code} value={cat.code}>{cat.icon} {cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-indigo-600">{ingredients.length}</div>
          <div className="text-gray-600">Total Ingredients</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-green-600">{categories.length}</div>
          <div className="text-gray-600">Categories</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-emerald-600">
            {ingredients.filter(i => i.is_vegetarian).length}
          </div>
          <div className="text-gray-600">Vegetarian</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-teal-600">
            {ingredients.filter(i => i.is_vegan).length}
          </div>
          <div className="text-gray-600">Vegan</div>
        </div>
      </div>

      {/* Ingredients List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
        </div>
      ) : ingredients.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">🥗</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No ingredients yet</h3>
          <p className="text-gray-500 mb-4">Add ingredients to build dishes with automatic nutrition calculation</p>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Add First Ingredient
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedIngredients).map(([category, { icon, items }]) => (
            <div key={category} className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg flex justify-between items-center">
                <h3 className="font-semibold text-gray-700">{icon} {category} ({items.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Ingredient</th>
                      <th className="px-4 py-2 text-center">Serving</th>
                      <th className="px-4 py-2 text-center">🔥 Cal</th>
                      <th className="px-4 py-2 text-center">💪 Protein</th>
                      <th className="px-4 py-2 text-center">🍞 Carbs</th>
                      <th className="px-4 py-2 text-center">🧈 Fat</th>
                      <th className="px-4 py-2 text-center">Diet</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map(ing => (
                      <tr key={ing.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{ing.name}</div>
                          {ing.description && (
                            <div className="text-xs text-gray-500">{ing.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-sm">
                          {ing.serving_size}{ing.serving_unit}
                          {ing.serving_description && (
                            <div className="text-xs text-gray-400">{ing.serving_description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-medium">{ing.calories || 0}</td>
                        <td className="px-4 py-3 text-center">{ing.protein_grams || 0}g</td>
                        <td className="px-4 py-3 text-center">{ing.carbs_grams || 0}g</td>
                        <td className="px-4 py-3 text-center">{ing.fat_grams || 0}g</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-1">
                            {ing.is_vegetarian && <span title="Vegetarian">🥬</span>}
                            {ing.is_vegan && <span title="Vegan">🌱</span>}
                            {ing.is_gluten_free && <span title="Gluten-Free">🌾</span>}
                            {ing.is_halal && <span title="Halal">☪️</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleEdit(ing)} className="text-indigo-600 hover:text-indigo-800 text-sm mr-3">Edit</button>
                          <button onClick={() => handleDelete(ing)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold">{selectedIngredient ? 'Edit Ingredient' : 'Add New Ingredient'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Ingredient Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="e.g., Chicken Breast (grilled)"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="Optional description"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    {categories.map(cat => (
                      <option key={cat.code} value={cat.code}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Serving Info */}
              <div>
                <label className="block text-sm font-medium mb-2">📏 Serving Information</label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Serving Size</label>
                    <input
                      type="number"
                      value={form.servingSize}
                      onChange={(e) => setForm({ ...form, servingSize: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Unit</label>
                    <select
                      value={form.servingUnit}
                      onChange={(e) => setForm({ ...form, servingUnit: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="g">grams (g)</option>
                      <option value="ml">milliliters (ml)</option>
                      <option value="oz">ounces (oz)</option>
                      <option value="cup">cups</option>
                      <option value="tbsp">tablespoons</option>
                      <option value="tsp">teaspoons</option>
                      <option value="piece">pieces</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Description</label>
                    <input
                      type="text"
                      value={form.servingDescription}
                      onChange={(e) => setForm({ ...form, servingDescription: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="e.g., 1 medium breast"
                    />
                  </div>
                </div>
              </div>

              {/* Nutrition Info */}
              <div>
                <label className="block text-sm font-medium mb-2">📊 Nutrition per Serving</label>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">🔥 Calories</label>
                    <input
                      type="number"
                      value={form.calories}
                      onChange={(e) => setForm({ ...form, calories: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      min="0"
                      placeholder="kcal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">💪 Protein (g)</label>
                    <input
                      type="number"
                      value={form.proteinGrams}
                      onChange={(e) => setForm({ ...form, proteinGrams: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">🍞 Carbs (g)</label>
                    <input
                      type="number"
                      value={form.carbsGrams}
                      onChange={(e) => setForm({ ...form, carbsGrams: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">🧈 Fat (g)</label>
                    <input
                      type="number"
                      value={form.fatGrams}
                      onChange={(e) => setForm({ ...form, fatGrams: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">🥬 Fiber (g)</label>
                    <input
                      type="number"
                      value={form.fiberGrams}
                      onChange={(e) => setForm({ ...form, fiberGrams: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">🍬 Sugar (g)</label>
                    <input
                      type="number"
                      value={form.sugarGrams}
                      onChange={(e) => setForm({ ...form, sugarGrams: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">🧂 Sodium (mg)</label>
                    <input
                      type="number"
                      value={form.sodiumMg}
                      onChange={(e) => setForm({ ...form, sodiumMg: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">💰 Cost/Serving</label>
                    <input
                      type="number"
                      value={form.costPerServing}
                      onChange={(e) => setForm({ ...form, costPerServing: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      min="0"
                      step="0.01"
                      placeholder="$"
                    />
                  </div>
                </div>
              </div>

              {/* Dietary Info */}
              <div>
                <label className="block text-sm font-medium mb-2">🥗 Dietary Classification</label>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { key: 'isVegetarian', label: '🥬 Vegetarian' },
                    { key: 'isVegan', label: '🌱 Vegan' },
                    { key: 'isGlutenFree', label: '🌾 Gluten-Free' },
                    { key: 'isDairyFree', label: '🥛 Dairy-Free' },
                    { key: 'isNutFree', label: '🥜 Nut-Free' },
                    { key: 'isHalal', label: '☪️ Halal' },
                    { key: 'isKosher', label: '✡️ Kosher' }
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={form[key]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Allergens */}
              <div>
                <label className="block text-sm font-medium mb-2">⚠️ Contains Allergens</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'containsGluten', label: 'Gluten' },
                    { key: 'containsDairy', label: 'Dairy' },
                    { key: 'containsEggs', label: 'Eggs' },
                    { key: 'containsNuts', label: 'Tree Nuts' },
                    { key: 'containsPeanuts', label: 'Peanuts' },
                    { key: 'containsSoy', label: 'Soy' },
                    { key: 'containsFish', label: 'Fish' },
                    { key: 'containsShellfish', label: 'Shellfish' },
                    { key: 'containsSesame', label: 'Sesame' }
                  ].map(({ key, label }) => (
                    <label key={key} className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer ${form[key] ? 'bg-red-50 border-red-300' : 'hover:bg-gray-50'}`}>
                      <input
                        type="checkbox"
                        checked={form[key]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                      />
                      <span className={`text-sm ${form[key] ? 'text-red-600' : ''}`}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  {selectedIngredient ? 'Update Ingredient' : 'Add Ingredient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
