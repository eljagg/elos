/**
 * DishIngredientEditor - Component for adding/editing ingredients on a dish
 * Used within the Dish Library to compose dishes from ingredients
 */
import { useState, useEffect } from 'react';
import { ingredientAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function DishIngredientEditor({ dishId, dishName, onClose, onUpdate }) {
  const [ingredients, setIngredients] = useState([]);
  const [dishIngredients, setDishIngredients] = useState([]);
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadData();
  }, [dishId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allIngredientsRes, dishIngredientsRes, categoriesRes] = await Promise.all([
        ingredientAPI.getIngredients({ isActive: 'true' }),
        ingredientAPI.getDishIngredients(dishId),
        ingredientAPI.getCategories()
      ]);
      
      setIngredients(allIngredientsRes.data?.data?.ingredients || []);
      setDishIngredients(dishIngredientsRes.data?.data?.ingredients || []);
      setTotals(dishIngredientsRes.data?.data?.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 });
      setCategories(categoriesRes.data?.data?.categories || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load ingredients');
    } finally {
      setLoading(false);
    }
  };

  const handleAddIngredient = async (ingredient) => {
    try {
      await ingredientAPI.addDishIngredient(dishId, {
        ingredientId: ingredient.id,
        quantity: 1
      });
      toast.success(`Added ${ingredient.name}`);
      loadData();
    } catch (error) {
      toast.error('Failed to add ingredient');
    }
  };

  const handleUpdateQuantity = async (ingredientId, quantity) => {
    if (quantity <= 0) {
      handleRemoveIngredient(ingredientId);
      return;
    }
    try {
      await ingredientAPI.updateDishIngredient(dishId, ingredientId, { quantity });
      loadData();
    } catch (error) {
      toast.error('Failed to update quantity');
    }
  };

  const handleRemoveIngredient = async (ingredientId) => {
    try {
      await ingredientAPI.removeDishIngredient(dishId, ingredientId);
      toast.success('Ingredient removed');
      loadData();
    } catch (error) {
      toast.error('Failed to remove ingredient');
    }
  };

  const handleSyncNutrition = async () => {
    if (dishIngredients.length === 0) {
      toast.error('Add ingredients first');
      return;
    }
    try {
      setSyncing(true);
      await ingredientAPI.syncNutrition(dishId);
      toast.success('Dish nutrition updated from ingredients!');
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error('Failed to sync nutrition');
    } finally {
      setSyncing(false);
    }
  };

  // Filter available ingredients
  const filteredIngredients = ingredients.filter(ing => {
    // Exclude already added
    if (dishIngredients.some(di => di.ingredient_id === ing.id)) return false;
    // Search filter
    if (search && !ing.name.toLowerCase().includes(search.toLowerCase())) return false;
    // Category filter
    if (selectedCategory && ing.category !== selectedCategory) return false;
    return true;
  });

  // Group filtered ingredients by category
  const groupedIngredients = filteredIngredients.reduce((acc, ing) => {
    const cat = ing.category_name || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ing);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">🥗 Compose Dish Ingredients</h2>
            <p className="text-gray-600">{dishName}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Left: Current Ingredients */}
          <div className="w-1/2 border-r flex flex-col">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-700">Current Ingredients ({dishIngredients.length})</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
                </div>
              ) : dishIngredients.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-4xl mb-2">📝</p>
                  <p>No ingredients added yet</p>
                  <p className="text-sm">Select ingredients from the right panel</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dishIngredients.map(ing => (
                    <div key={ing.ingredient_id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{ing.name}</p>
                          <p className="text-xs text-gray-500">
                            {ing.serving_size}{ing.serving_unit} per serving
                          </p>
                        </div>
                        <button 
                          onClick={() => handleRemoveIngredient(ing.ingredient_id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUpdateQuantity(ing.ingredient_id, parseFloat(ing.quantity) - 0.5)}
                            className="w-7 h-7 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={ing.quantity}
                            onChange={(e) => handleUpdateQuantity(ing.ingredient_id, parseFloat(e.target.value) || 0)}
                            className="w-16 text-center border rounded px-1 py-1"
                            min="0.5"
                            step="0.5"
                          />
                          <button
                            onClick={() => handleUpdateQuantity(ing.ingredient_id, parseFloat(ing.quantity) + 0.5)}
                            className="w-7 h-7 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center"
                          >
                            +
                          </button>
                          <span className="text-sm text-gray-500">servings</span>
                        </div>
                        
                        <div className="flex-1 text-right text-xs text-gray-500">
                          {Math.round(ing.calories * ing.quantity)} cal | 
                          {(parseFloat(ing.protein_grams) * ing.quantity).toFixed(1)}g P | 
                          {(parseFloat(ing.carbs_grams) * ing.quantity).toFixed(1)}g C | 
                          {(parseFloat(ing.fat_grams) * ing.quantity).toFixed(1)}g F
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="p-4 border-t bg-indigo-50">
              <div className="grid grid-cols-4 gap-2 text-center mb-3">
                <div>
                  <p className="text-2xl font-bold text-indigo-600">{totals.calories}</p>
                  <p className="text-xs text-gray-500">🔥 Calories</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{totals.protein}g</p>
                  <p className="text-xs text-gray-500">💪 Protein</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{totals.carbs}g</p>
                  <p className="text-xs text-gray-500">🍞 Carbs</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-600">{totals.fat}g</p>
                  <p className="text-xs text-gray-500">🧈 Fat</p>
                </div>
              </div>
              
              <button
                onClick={handleSyncNutrition}
                disabled={syncing || dishIngredients.length === 0}
                className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {syncing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Syncing...
                  </>
                ) : (
                  <>
                    ✓ Save Nutrition to Dish
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right: Available Ingredients */}
          <div className="w-1/2 flex flex-col">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-700 mb-2">Available Ingredients</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 px-3 py-1.5 border rounded-lg text-sm"
                />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                >
                  <option value="">All</option>
                  {categories.map(cat => (
                    <option key={cat.code} value={cat.code}>{cat.icon} {cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {Object.entries(groupedIngredients).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No matching ingredients</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedIngredients).map(([category, items]) => (
                    <div key={category}>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">{category}</h4>
                      <div className="space-y-1">
                        {items.map(ing => (
                          <button
                            key={ing.id}
                            onClick={() => handleAddIngredient(ing)}
                            className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-indigo-50 rounded-lg flex justify-between items-center group transition-colors"
                          >
                            <div>
                              <p className="font-medium text-sm">{ing.name}</p>
                              <p className="text-xs text-gray-500">
                                {ing.calories} cal | {ing.protein_grams}g P | {ing.carbs_grams}g C | {ing.fat_grams}g F
                              </p>
                            </div>
                            <span className="text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              + Add
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
