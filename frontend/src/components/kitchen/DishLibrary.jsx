import { useState, useMemo } from 'react';

export default function DishLibrary({ menuItems = [], onEdit, onDelete, onAdd }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [statusFilter, setStatusFilter] = useState('active');

  // Category configuration with colors and icons
  const categoryInfo = {
    'PROTEIN': { name: 'Proteins', icon: '🍗', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700 border-red-200' },
    'CARBS': { name: 'Carbs', icon: '🍚', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
    'VEG': { name: 'Vegetables', icon: '🥗', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700 border-green-200' },
    'SOUP': { name: 'Soups', icon: '🍲', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
    'DRINKS': { name: 'Beverages', icon: '🥤', bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', badge: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
    'SPECIAL': { name: 'Specials', icon: '⭐', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700 border-purple-200' },
    'DESSERT': { name: 'Desserts', icon: '🍰', bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', badge: 'bg-pink-100 text-pink-700 border-pink-200' },
    'SIDES': { name: 'Sides', icon: '🍟', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
    // Lowercase fallbacks
    'protein': { name: 'Proteins', icon: '🍗', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700 border-red-200' },
    'carbohydrate': { name: 'Carbs', icon: '🍚', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
    'fibre': { name: 'Vegetables', icon: '🥗', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700 border-green-200' },
    'soup': { name: 'Soups', icon: '🍲', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
    'vegetarian': { name: 'Vegetarian', icon: '🌱', bg: 'bg-lime-50', border: 'border-lime-200', text: 'text-lime-700', badge: 'bg-lime-100 text-lime-700 border-lime-200' },
    'done_to_order': { name: 'Made to Order', icon: '👨‍🍳', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
    'beverage': { name: 'Beverages', icon: '🥤', bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', badge: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
    'dessert': { name: 'Desserts', icon: '🍰', bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', badge: 'bg-pink-100 text-pink-700 border-pink-200' },
    'specials': { name: 'Specials', icon: '⭐', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700 border-purple-200' }
  };

  const getCategory = (cat) => categoryInfo[cat] || { 
    name: cat?.charAt(0).toUpperCase() + cat?.slice(1).toLowerCase() || 'Other', 
    icon: '📦', 
    bg: 'bg-gray-50', 
    border: 'border-gray-200', 
    text: 'text-gray-700',
    badge: 'bg-gray-100 text-gray-700 border-gray-200'
  };

  // Calculate stats
  const stats = useMemo(() => {
    const uniqueCategories = new Set(menuItems.map(item => item.category_code || item.category));
    const spicyCount = menuItems.filter(item => item.is_spicy).length;
    const veganCount = menuItems.filter(item => item.is_vegan).length;
    const vegCount = menuItems.filter(item => item.is_vegetarian).length;
    return {
      total: menuItems.length,
      categories: uniqueCategories.size,
      featured: menuItems.filter(item => item.is_featured).length,
      spicy: spicyCount,
      vegan: veganCount,
      vegetarian: vegCount
    };
  }, [menuItems]);

  // Get categories with counts
  const categories = useMemo(() => {
    const counts = {};
    menuItems.forEach(item => {
      const cat = item.category_code || item.category || 'other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([key, count]) => ({
      key,
      ...getCategory(key),
      count
    }));
  }, [menuItems]);

  // Filter items
  const filteredItems = useMemo(() => {
    let result = menuItems;
    
    if (searchTerm) {
      result = result.filter(item =>
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (selectedCategory !== 'all') {
      result = result.filter(item => {
        const itemCategory = item.category_code || item.category;
        return itemCategory === selectedCategory;
      });
    }

    if (statusFilter === 'active') {
      result = result.filter(item => item.is_active !== false);
    } else if (statusFilter === 'inactive') {
      result = result.filter(item => item.is_active === false);
    }
    
    return result;
  }, [menuItems, searchTerm, selectedCategory, statusFilter]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const grouped = {};
    filteredItems.forEach(item => {
      const category = item.category_code || item.category || 'other';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(item);
    });
    return grouped;
  }, [filteredItems]);

  return (
    <div className="space-y-4">
      {/* Stats Row - Compact for mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
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
          <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center text-lg shrink-0">🌱</div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-gray-900">{stats.vegan}</p>
            <p className="text-xs text-gray-500 truncate">Vegan</p>
          </div>
        </div>
      </div>

      {/* Search & Filters - Mobile Optimized */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
        {/* Search + Add Button Row */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              placeholder="Search dishes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
            />
          </div>
          <button
            onClick={onAdd}
            className="px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium text-sm whitespace-nowrap shrink-0"
          >
            + Add
          </button>
        </div>

        {/* Filters Row */}
        <div className="flex gap-2 flex-wrap">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="flex-1 min-w-[140px] px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.key} value={cat.key}>
                {cat.icon} {cat.name} ({cat.count})
              </option>
            ))}
          </select>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All Status</option>
          </select>

          {/* View Toggle */}
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

        {/* Category Quick Filters - Horizontal scroll on mobile */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
              selectedCategory === 'all' 
                ? 'bg-orange-600 text-white border-orange-600' 
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            All ({menuItems.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors flex items-center gap-1 ${
                selectedCategory === cat.key 
                  ? 'bg-orange-600 text-white border-orange-600' 
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
              <span className="opacity-70">({cat.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* No Results */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-4xl mb-3">🍽️</p>
          <p className="text-lg text-gray-600 font-medium">No dishes found</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
          <button
            onClick={onAdd}
            className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm"
          >
            + Add First Dish
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View - Mobile optimized cards */
        <div className="space-y-6">
          {Object.entries(groupedItems).map(([category, items]) => {
            const catInfo = getCategory(category);
            return (
              <div key={category}>
                {/* Category Header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{catInfo.icon}</span>
                  <h3 className="text-lg font-bold text-gray-900">{catInfo.name}</h3>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                    {items.length}
                  </span>
                </div>
                
                {/* Cards Grid - 1 col mobile, 2 col tablet, 3-4 col desktop */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {items.map(item => (
                    <div 
                      key={item.id} 
                      className={`${catInfo.bg} ${catInfo.border} border-2 rounded-xl overflow-hidden hover:shadow-md transition-all group`}
                    >
                      {/* Card Header with Icon */}
                      <div className="h-20 sm:h-24 flex items-center justify-center text-4xl relative bg-white/50">
                        {catInfo.icon}
                        {/* Badges */}
                        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                          {item.is_vegan && (
                            <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">🌱</span>
                          )}
                          {item.is_vegetarian && !item.is_vegan && (
                            <span className="bg-lime-500 text-white text-xs px-1.5 py-0.5 rounded-full">🥬</span>
                          )}
                          {item.is_spicy && (
                            <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">🌶️</span>
                          )}
                        </div>
                        {/* Quick Actions - Show on hover (desktop) or always visible (mobile) */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 sm:flex hidden sm:group-hover:flex">
                          <button 
                            onClick={() => onEdit(item)}
                            className="px-3 py-1.5 bg-white text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-100"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => onDelete(item)}
                            className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      
                      {/* Card Content */}
                      <div className="p-3">
                        <h4 className="font-semibold text-gray-900 mb-1 truncate">{item.name}</h4>
                        
                        {/* Price - prominent display */}
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-lg font-bold text-green-600">
                            ${parseFloat(item.price || item.base_price || 0).toLocaleString()}
                          </span>
                          {(item.add_on_price && parseFloat(item.add_on_price) > 0) && (
                            <span className="text-xs text-gray-500">
                              +${parseFloat(item.add_on_price).toFixed(0)} extra
                            </span>
                          )}
                        </div>

                        {/* Category badge + prep time */}
                        <div className="flex items-center gap-2 flex-wrap mb-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${catInfo.badge}`}>
                            {catInfo.name}
                          </span>
                          {item.prep_time && (
                            <span className="text-xs text-gray-500">⏱️ {item.prep_time}m</span>
                          )}
                        </div>

                        {/* Description - truncated */}
                        {item.description && (
                          <p className="text-xs text-gray-500 line-clamp-2 mb-3">{item.description}</p>
                        )}

                        {/* Action Buttons - Always visible on mobile */}
                        <div className="flex gap-2 sm:hidden">
                          <button 
                            onClick={() => onEdit(item)}
                            className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => onDelete(item)}
                            className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-lg font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          
          {/* Add New Dish Card */}
          <div 
            onClick={onAdd}
            className="border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center py-8 hover:border-orange-400 hover:bg-orange-50/50 transition-colors cursor-pointer"
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2 text-2xl">+</div>
              <p className="text-gray-600 font-medium">Add New Dish</p>
            </div>
          </div>
        </div>
      ) : (
        /* List View - Mobile optimized table */
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
                  const catInfo = getCategory(item.category_code || item.category);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 ${catInfo.bg} rounded-lg flex items-center justify-center text-lg`}>
                            {catInfo.icon}
                          </div>
                          <div>
                            <span className="font-medium text-gray-900">{item.name}</span>
                            {item.description && (
                              <p className="text-xs text-gray-500 truncate max-w-[200px]">{item.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full border ${catInfo.badge}`}>
                          {catInfo.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {item.is_vegan && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">🌱 Vegan</span>}
                          {item.is_vegetarian && !item.is_vegan && <span className="text-xs bg-lime-100 text-lime-700 px-2 py-0.5 rounded">🥬 Veg</span>}
                          {item.is_spicy && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">🌶️ Spicy</span>}
                          {!item.is_vegan && !item.is_vegetarian && !item.is_spicy && <span className="text-gray-300">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-green-600">
                          ${parseFloat(item.price || item.base_price || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => onEdit(item)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => onDelete(item)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile List - Card-like rows */}
          <div className="sm:hidden divide-y divide-gray-100">
            {filteredItems.map(item => {
              const catInfo = getCategory(item.category_code || item.category);
              return (
                <div key={item.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 ${catInfo.bg} rounded-lg flex items-center justify-center text-2xl shrink-0`}>
                      {catInfo.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-semibold text-gray-900 truncate">{item.name}</h4>
                        <span className="font-bold text-green-600 shrink-0 ml-2">
                          ${parseFloat(item.price || item.base_price || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${catInfo.badge}`}>
                          {catInfo.name}
                        </span>
                        {item.is_vegan && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">🌱</span>}
                        {item.is_vegetarian && !item.is_vegan && <span className="text-xs bg-lime-100 text-lime-700 px-1.5 py-0.5 rounded">🥬</span>}
                      </div>
                      <div className="flex gap-3 mt-2">
                        <button 
                          onClick={() => onEdit(item)}
                          className="text-blue-600 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => onDelete(item)}
                          className="text-red-600 text-sm font-medium"
                        >
                          Delete
                        </button>
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
        <p className="text-center text-sm text-gray-500 py-2">
          Showing {filteredItems.length} of {menuItems.length} dishes
        </p>
      )}
    </div>
  );
}
