/**
 * AllergenBadges Component
 * Displays allergen and dietary badges for menu items
 */

import { 
  Leaf, Wheat, Milk, Egg, Fish, 
  AlertTriangle, Flame, Star
} from 'lucide-react';

// Allergen/dietary badge configurations
const badges = {
  // Dietary (positive attributes)
  is_vegetarian: { 
    label: 'Vegetarian', 
    shortLabel: 'V', 
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: Leaf
  },
  is_vegan: { 
    label: 'Vegan', 
    shortLabel: 'VG', 
    color: 'bg-green-100 text-green-800 border-green-300',
    icon: Leaf
  },
  is_gluten_free: { 
    label: 'Gluten-Free', 
    shortLabel: 'GF', 
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: Wheat
  },
  is_dairy_free: { 
    label: 'Dairy-Free', 
    shortLabel: 'DF', 
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Milk
  },
  is_nut_free: { 
    label: 'Nut-Free', 
    shortLabel: 'NF', 
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: null
  },
  is_halal: { 
    label: 'Halal', 
    shortLabel: 'H', 
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: null
  },
  is_kosher: { 
    label: 'Kosher', 
    shortLabel: 'K', 
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    icon: null
  },
  is_spicy: { 
    label: 'Spicy', 
    shortLabel: '🌶️', 
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: Flame
  },
  is_featured: { 
    label: 'Featured', 
    shortLabel: '★', 
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: Star
  }
};

// Allergen configurations (warnings)
const allergenBadges = {
  gluten: { label: 'Contains Gluten', color: 'bg-amber-50 text-amber-800', severity: 'warning' },
  dairy: { label: 'Contains Dairy', color: 'bg-blue-50 text-blue-800', severity: 'warning' },
  eggs: { label: 'Contains Eggs', color: 'bg-yellow-50 text-yellow-800', severity: 'warning' },
  nuts: { label: 'Contains Nuts', color: 'bg-red-50 text-red-800', severity: 'danger' },
  peanuts: { label: 'Contains Peanuts', color: 'bg-red-50 text-red-800', severity: 'danger' },
  soy: { label: 'Contains Soy', color: 'bg-emerald-50 text-emerald-800', severity: 'warning' },
  fish: { label: 'Contains Fish', color: 'bg-cyan-50 text-cyan-800', severity: 'warning' },
  shellfish: { label: 'Contains Shellfish', color: 'bg-orange-50 text-orange-800', severity: 'danger' },
  sesame: { label: 'Contains Sesame', color: 'bg-amber-50 text-amber-800', severity: 'warning' }
};

/**
 * Display dietary badges for a menu item
 */
export const DietaryBadges = ({ item, compact = false, showAll = false }) => {
  if (!item) return null;
  
  const activeBadges = Object.entries(badges).filter(([key]) => item[key] === true);
  
  if (activeBadges.length === 0 && !showAll) return null;
  
  return (
    <div className="flex flex-wrap gap-1">
      {activeBadges.map(([key, config]) => {
        const Icon = config.icon;
        return (
          <span
            key={key}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border ${config.color}`}
            title={config.label}
          >
            {Icon && <Icon className="w-3 h-3" />}
            {compact ? config.shortLabel : config.label}
          </span>
        );
      })}
    </div>
  );
};

/**
 * Display allergen warnings for a menu item
 */
export const AllergenWarnings = ({ allergens, compact = false }) => {
  if (!allergens || allergens.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1">
      {allergens.map((allergen) => {
        const config = allergenBadges[allergen.code] || allergenBadges[allergen];
        if (!config) return null;
        
        return (
          <span
            key={allergen.code || allergen}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${config.color}`}
            title={config.label}
          >
            {config.severity === 'danger' && <AlertTriangle className="w-3 h-3" />}
            {compact ? (allergen.code || allergen) : config.label}
          </span>
        );
      })}
    </div>
  );
};

/**
 * Display nutrition info for a menu item
 */
export const NutritionInfo = ({ item, compact = false }) => {
  if (!item) return null;
  
  const hasNutrition = item.calories || item.protein_grams || item.carbs_grams || item.fat_grams;
  if (!hasNutrition) return null;
  
  if (compact) {
    return (
      <span className="text-xs text-slate-500">
        {item.calories && `${item.calories} cal`}
      </span>
    );
  }
  
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
      {item.calories && (
        <span className="flex items-center gap-1">
          <span className="font-medium">{item.calories}</span> cal
        </span>
      )}
      {item.protein_grams && (
        <span className="flex items-center gap-1">
          <span className="font-medium">{item.protein_grams}g</span> protein
        </span>
      )}
      {item.carbs_grams && (
        <span className="flex items-center gap-1">
          <span className="font-medium">{item.carbs_grams}g</span> carbs
        </span>
      )}
      {item.fat_grams && (
        <span className="flex items-center gap-1">
          <span className="font-medium">{item.fat_grams}g</span> fat
        </span>
      )}
    </div>
  );
};

/**
 * Display spice level indicator
 */
export const SpiceLevel = ({ level, max = 5 }) => {
  if (!level || level === 0) return null;
  
  return (
    <div className="flex items-center gap-0.5" title={`Spice level: ${level}/${max}`}>
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`text-xs ${i < level ? 'text-red-500' : 'text-slate-200'}`}
        >
          🌶️
        </span>
      ))}
    </div>
  );
};

/**
 * Combined display of all item info (badges, allergens, nutrition)
 */
const AllergenBadges = ({ item, showNutrition = true, compact = false }) => {
  if (!item) return null;
  
  return (
    <div className="space-y-1.5">
      <DietaryBadges item={item} compact={compact} />
      <AllergenWarnings allergens={item.allergens} compact={compact} />
      {item.spice_level > 0 && <SpiceLevel level={item.spice_level} />}
      {showNutrition && <NutritionInfo item={item} compact={compact} />}
    </div>
  );
};

export default AllergenBadges;
