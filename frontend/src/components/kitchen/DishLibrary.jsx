import { useState, useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';

export default function DishLibrary({ menuItems, onEdit, onDelete, onAdd }) {
  const { colors } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('grid');

  const categoryInfo = {
    // Use UPPERCASE keys to match database codes
    'PROTEIN': { name: 'Proteins', emoji: '🍗', color: 'bg-red-50 border-red-200' },
    'CARBS': { name: 'Carbohydrates', emoji: '🍚', color: 'bg-yellow-50 border-yellow-200' },
    'VEG': { name: 'Vegetables', emoji: '🥗', color: 'bg-green-50 border-green-200' },
    'SOUP': { name: 'Soups', emoji: '🍲', color: 'bg-orange-50 border-orange-200' },
    'DRINKS': { name: 'Beverages', emoji: '🥤', color: 'bg-cyan-50 border-cyan-200' },
    'SPECIAL': { name: 'Specials', emoji: '⭐', color: 'bg-purple-50 border-purple-200' },
    'DESSERT': { name: 'Desserts', emoji: '🍰', color: 'bg-pink-50 border-pink-200' },
    'SIDES': { name: 'Sides', emoji: '🍟', color: 'bg-gray-50 border-gray-200' },
    
    // Also support lowercase for backward compatibility
    'protein': { name: 'Proteins', emoji: '🍗', color: 'bg-red-50 border-red-200' },
    'carbohydrate': { name: 'Carbohydrates', emoji: '🍚', color: 'bg-yellow-50 border-yellow-200' },
    'fibre': { name: 'Vegetables', emoji: '🥗', color: 'bg-green-50 border-green-200' },
    'soup': { name: 'Soups', emoji: '🍲', color: 'bg-orange-50 border-orange-200' },
    'vegetarian': { name: 'Vegetarian', emoji: '🌱', color: 'bg-lime-50 border-lime-200' },
    'done_to_order': { name: 'Made to Order', emoji: '👨‍🍳', color: 'bg-blue-50 border-blue-200' },
    'beverage': { name: 'Beverages', emoji: '🥤', color: 'bg-cyan-50 border-cyan-200' },
    'dessert': { name: 'Desserts', emoji: '🍰', color: 'bg-pink-50 border-pink-200' },
    'specials': { name: 'Specials', emoji: '⭐', color: 'bg-purple-50 border-purple-200' }
  };

  const groupedItems = useMemo(() => {
    let filtered = menuItems;
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => {
        const itemCategory = item.category_code || item.category;
        return itemCategory === selectedCategory;
      });
    }
    const grouped = {};
    filtered.forEach(item => {
      const category = item.category_code || item.category || 'other';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(item);
    });
    return grouped;
  }, [menuItems, searchTerm, selectedCategory]);

  const categories = useMemo(() => {
    const counts = {};
    menuItems.forEach(item => {
      const cat = item.category_code || item.category || 'other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({
      key,
      ...(categoryInfo[key] || {
        name: key.charAt(0).toUpperCase() + key.slice(1).toLowerCase(), // Fallback: capitalize first letter
        emoji: '📦',
        color: 'bg-gray-50 border-gray-200'
      }),
      count: counts[key]
    }));
  }, [menuItems]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Search dishes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full px-4 py-2.5 pl-10 border ${colors.border} rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent`}
            />
            <span className="absolute left-3 top-3 text-gray-400">🔍</span>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={`px-4 py-2.5 border ${colors.border} rounded-lg`}
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.key} value={cat.key}>
                {cat.emoji} {cat.name} ({cat.count})
              </option>
            ))}
          </select>
          <div className={`flex border ${colors.border} rounded-lg overflow-hidden`}>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 text-sm ${viewMode === 'grid' ? 'bg-orange-600 text-white' : colors.textSecondary}`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 text-sm ${viewMode === 'table' ? 'bg-orange-600 text-white' : colors.textSecondary}`}
            >
              Table
            </button>
          </div>
          <button
            onClick={onAdd}
            className="px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
          >
            + Add Item
          </button>
        </div>
      </div>
      {Object.keys(groupedItems).length === 0 ? (
        <div className={`text-center py-12 ${colors.textMuted}`}>
          <p className="text-lg">No items found</p>
          <p className="text-sm mt-2">Try adjusting your search or filters</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="space-y-8">
          {Object.entries(groupedItems).map(([category, items]) => {
            const catInfo = categoryInfo[category] || { name: category, emoji: '📦', color: 'bg-gray-50 border-gray-200' };
            return (
              <div key={category}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{catInfo.emoji}</span>
                  <h3 className={`text-xl font-bold ${colors.textPrimary}`}>{catInfo.name}</h3>
                  <span className={`px-3 py-1 rounded-full text-sm ${colors.bgSecondary} ${colors.textMuted}`}>
                    {items.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {items.map(item => (
                    <div key={item.id} className={`border-2 ${catInfo.color} rounded-xl p-4 hover:shadow-lg transition-all`}>
                      <div className="text-4xl mb-3 text-center">{catInfo.emoji}</div>
                      <h4 className={`font-semibold text-center mb-2 ${colors.textPrimary}`}>{item.name}</h4>
                      <div className="flex gap-1 justify-center mb-3 flex-wrap">
                        {item.is_vegan && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">🌱 Vegan</span>
                        )}
                        {item.is_vegetarian && (
                          <span className="px-2 py-0.5 bg-lime-100 text-lime-700 text-xs rounded-full">🥬 Veg</span>
                        )}
                      </div>
                      {item.description && (
                        <p className={`text-xs ${colors.textMuted} text-center mb-3 line-clamp-2`}>{item.description}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => onEdit(item)}
                          className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(item)}
                          className="flex-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`${colors.bgSecondary} sticky top-0`}>
              <tr>
                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${colors.textMuted}`}>Item</th>
                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${colors.textMuted}`}>Category</th>
                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${colors.textMuted}`}>Tags</th>
                <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${colors.textMuted}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedItems).map(([category, items]) => {
                const catInfo = categoryInfo[category] || { name: category, emoji: '📦', color: 'bg-gray-50 border-gray-200' };
                return items.map((item, index) => (
                  <tr 
                    key={item.id}
                    className={`border-b ${colors.border} hover:bg-gray-50 transition-colors`}
                  >
                    <td className={`px-6 py-4 ${colors.textPrimary} font-medium`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{catInfo.emoji}</span>
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td className={`px-6 py-4`}>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${catInfo.color.replace('border-', 'text-').replace('-200', '-700')}`}>
                        {catInfo.emoji} {catInfo.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {item.is_vegan && (
                          <span className="inline-flex items-center px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            🌱 Vegan
                          </span>
                        )}
                        {item.is_vegetarian && (
                          <span className="inline-flex items-center px-2.5 py-1 bg-lime-100 text-lime-700 text-xs font-medium rounded-full">
                            🥬 Veg
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => onEdit(item)} 
                          className="px-3 py-1.5 text-blue-600 hover:bg-blue-50 text-sm font-medium rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => onDelete(item)} 
                          className="px-3 py-1.5 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
