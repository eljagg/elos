import { useState, useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';

export default function EnhancedPrepList({ orders }) {
  const { colors } = useTheme();
  const [expandedItems, setExpandedItems] = useState({});

  // Aggregate orders by item → company → employees
  const aggregatedData = useMemo(() => {
    const data = {};

    orders
      .filter(o => ['pending', 'preparing'].includes(o.status))
      .forEach(order => {
        const companyName = order.company_name || 'Unknown Company';
        const employeeName = `${order.user_first_name || ''} ${order.user_last_name || ''}`.trim() || 'Unknown';
        const departmentName = order.department_name || '';

        (order.items || []).forEach(item => {
          const itemName = item.name;
          const quantity = item.quantity || 1;

          // Initialize item if not exists
          if (!data[itemName]) {
            data[itemName] = {
              totalQuantity: 0,
              companies: {}
            };
          }

          // Add to total
          data[itemName].totalQuantity += quantity;

          // Initialize company if not exists
          if (!data[itemName].companies[companyName]) {
            data[itemName].companies[companyName] = {
              quantity: 0,
              employees: []
            };
          }

          // Add to company total
          data[itemName].companies[companyName].quantity += quantity;

          // Add employee
          data[itemName].companies[companyName].employees.push({
            name: employeeName,
            department: departmentName,
            quantity: quantity,
            notes: order.notes || '',
            orderId: order.id
          });
        });
      });

    return data;
  }, [orders]);

  const toggleItem = (itemName) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemName]: !prev[itemName]
    }));
  };

  const itemNames = Object.keys(aggregatedData).sort();

  if (itemNames.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl mb-2">📋</p>
        <p className={colors.textMuted}>No items to prep</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className={`${colors.bgSecondary} rounded-xl p-4 text-center`}>
          <p className={`text-3xl font-bold ${colors.textPrimary}`}>{itemNames.length}</p>
          <p className={`text-sm ${colors.textMuted}`}>Total Items</p>
        </div>
        <div className={`${colors.bgSecondary} rounded-xl p-4 text-center`}>
          <p className={`text-3xl font-bold ${colors.textPrimary}`}>
            {Object.values(aggregatedData).reduce((sum, item) => sum + item.totalQuantity, 0)}
          </p>
          <p className={`text-sm ${colors.textMuted}`}>Total Portions</p>
        </div>
        <div className={`${colors.bgSecondary} rounded-xl p-4 text-center`}>
          <p className={`text-3xl font-bold ${colors.textPrimary}`}>
            {new Set(Object.values(aggregatedData).flatMap(item => 
              Object.keys(item.companies)
            )).size}
          </p>
          <p className={`text-sm ${colors.textMuted}`}>Companies</p>
        </div>
        <div className={`${colors.bgSecondary} rounded-xl p-4 text-center`}>
          <p className={`text-3xl font-bold ${colors.textPrimary}`}>
            {orders.filter(o => ['pending', 'preparing'].includes(o.status)).length}
          </p>
          <p className={`text-sm ${colors.textMuted}`}>Orders</p>
        </div>
      </div>

      {/* Item Breakdown */}
      <div className="space-y-3">
        {itemNames.map(itemName => {
          const itemData = aggregatedData[itemName];
          const isExpanded = expandedItems[itemName];
          const companyNames = Object.keys(itemData.companies).sort();

          return (
            <div key={itemName} className={`border ${colors.border} rounded-xl overflow-hidden`}>
              {/* Item Header */}
              <button
                onClick={() => toggleItem(itemName)}
                className={`w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${colors.bgCard}`}
              >
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-bold text-orange-600">
                    {itemData.totalQuantity}
                  </div>
                  <div className="text-left">
                    <h3 className={`text-lg font-semibold ${colors.textPrimary}`}>
                      {itemName}
                    </h3>
                    <p className={`text-sm ${colors.textMuted}`}>
                      {companyNames.length} {companyNames.length === 1 ? 'company' : 'companies'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${colors.textMuted}`}>
                    {isExpanded ? 'Hide Details' : 'Show Details'}
                  </span>
                  <svg
                    className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Company Breakdown */}
              {isExpanded && (
                <div className={`${colors.bgSecondary} p-6 space-y-4`}>
                  {companyNames.map(companyName => {
                    const companyData = itemData.companies[companyName];
                    
                    return (
                      <div key={companyName} className={`${colors.bgCard} rounded-lg p-4`}>
                        {/* Company Header */}
                        <div className="flex items-center justify-between mb-3 pb-3 border-b ${colors.border}">
                          <h4 className={`font-semibold ${colors.textPrimary}`}>
                            🏢 {companyName}
                          </h4>
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                            {companyData.quantity} {companyData.quantity === 1 ? 'order' : 'orders'}
                          </span>
                        </div>

                        {/* Employee List */}
                        <div className="space-y-2">
                          {companyData.employees.map((employee, idx) => (
                            <div key={idx} className="flex items-start gap-3 py-2">
                              <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium">
                                {employee.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className={`font-medium ${colors.textPrimary}`}>
                                    {employee.name}
                                  </p>
                                  {employee.quantity > 1 && (
                                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">
                                      ×{employee.quantity}
                                    </span>
                                  )}
                                </div>
                                {employee.department && (
                                  <p className={`text-sm ${colors.textMuted}`}>
                                    {employee.department}
                                  </p>
                                )}
                                {employee.notes && (
                                  <div className="mt-1 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded text-sm">
                                    <span className="font-medium">📝 Note:</span> {employee.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
