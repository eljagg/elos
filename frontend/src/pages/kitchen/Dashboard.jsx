import { useState, useEffect } from 'react';
import { menuAPI, orderAPI, messageAPI, companyAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function KitchenDashboard() {
  const [activeTab, setActiveTab] = useState('orders');
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [menus, setMenus] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [issues, setIssues] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [cafeterias, setCafeterias] = useState([]);
  const [stats, setStats] = useState({ pendingOrders: 0, preparingOrders: 0, readyOrders: 0, completedToday: 0, openIssues: 0, deliveryUpdates: 0 });
  const [deliveryNotifications, setDeliveryNotifications] = useState([]);
  const [filters, setFilters] = useState({ status: 'pending', company: '', department: '', date: new Date().toISOString().split('T')[0] });
  const [prepList, setPrepList] = useState([]);

  // Modals
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);

  const [menuForm, setMenuForm] = useState({
    name: '', description: '', cafeteriaId: '', mealType: 'lunch', menuType: 'regular',
    startDate: new Date().toISOString().split('T')[0], endDate: '', isActive: true, isHighlighted: false
  });
  const [itemForm, setItemForm] = useState({
    name: '', description: '', price: '', category: 'main', dietaryTags: [], ingredients: '',
    isVegan: false, isVegetarian: false, isGlutenFree: false, isDoneToOrder: false, isAvailable: true
  });
  const [issueResponse, setIssueResponse] = useState('');

  useEffect(() => { loadData(); }, []);
  useEffect(() => { generatePrepList(); }, [orders, filters.date]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, menusRes, itemsRes, issuesRes, companiesRes, cafeteriasRes] = await Promise.all([
        orderAPI.getOrders({ limit: 200, date: filters.date }).catch(() => ({ data: { data: { orders: [] } } })),
        menuAPI.getMenus().catch(() => ({ data: { data: { menus: [] } } })),
        menuAPI.getMenuItems().catch(() => ({ data: { data: { items: [] } } })),
        messageAPI.getFeedback({ type: 'complaint' }).catch(() => ({ data: { data: { feedback: [] } } })),
        companyAPI.getCompanies().catch(() => ({ data: { data: { companies: [] } } })),
        companyAPI.getCafeterias().catch(() => ({ data: { data: { cafeterias: [] } } }))
      ]);

      const ordersList = ordersRes.data?.data?.orders || [];
      const issuesList = issuesRes.data?.data?.feedback || [];

      setOrders(ordersList);
      setMenus(menusRes.data?.data?.menus || []);
      setMenuItems(itemsRes.data?.data?.items || []);
      setIssues(issuesList);
      setCompanies(companiesRes.data?.data?.companies || []);
      setCafeterias(cafeteriasRes.data?.data?.cafeterias || []);

      // Load saved templates from localStorage
      const templates = JSON.parse(localStorage.getItem('menuTemplates') || '[]');
      setSavedTemplates(templates);

      // Load delivery notifications
      const deliveryTracking = JSON.parse(localStorage.getItem('deliveryTracking') || '{}');
      const recentDeliveries = Object.entries(deliveryTracking)
        .filter(([_, t]) => t.deliveryTime && new Date(t.deliveryTime).toDateString() === new Date().toDateString())
        .map(([orderId, t]) => ({ orderId, ...t }))
        .sort((a, b) => new Date(b.deliveryTime) - new Date(a.deliveryTime));
      setDeliveryNotifications(recentDeliveries);

      setStats({
        pendingOrders: ordersList.filter(o => o.status === 'pending').length,
        preparingOrders: ordersList.filter(o => o.status === 'preparing').length,
        readyOrders: ordersList.filter(o => o.status === 'ready').length,
        completedToday: ordersList.filter(o => o.status === 'completed').length,
        openIssues: issuesList.filter(i => i.status !== 'resolved').length,
        deliveryUpdates: recentDeliveries.length
      });
    } catch (error) { console.error('Failed to load data:', error); }
    finally { setLoading(false); }
  };

  const generatePrepList = () => {
    const todayOrders = orders.filter(o => o.order_date === filters.date && ['pending', 'preparing'].includes(o.status));
    const itemCounts = {};
    todayOrders.forEach(order => {
      if (order.items) {
        order.items.forEach(item => {
          const key = item.name || item.menu_item_name;
          if (key) {
            itemCounts[key] = (itemCounts[key] || 0) + (item.quantity || 1);
          }
        });
      }
    });
    setPrepList(Object.entries(itemCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));
  };

  // Order Management
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await orderAPI.updateOrderStatus(orderId, newStatus);
      toast.success(`Order marked as ${newStatus}`);
      loadData();
    } catch { toast.error('Failed to update order'); }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'preparing': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'ready': return 'bg-green-100 text-green-800 border-green-300';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Menu Management
  const handleSaveMenu = async (e) => {
    e.preventDefault();
    try {
      if (selectedMenu) {
        await menuAPI.updateMenu(selectedMenu.id, { ...menuForm, isHighlighted: true });
        toast.success('Menu updated (highlighted for employees)');
      } else {
        await menuAPI.createMenu(menuForm);
        toast.success('Menu created');
      }
      setShowMenuModal(false);
      resetMenuForm();
      loadData();
    } catch (error) { toast.error(error.response?.data?.error?.message || 'Failed to save menu'); }
  };

  const handleEditMenu = (menu) => {
    setSelectedMenu(menu);
    setMenuForm({
      name: menu.name || '', description: menu.description || '', cafeteriaId: menu.cafeteria_id || '',
      mealType: menu.meal_type || 'lunch', menuType: menu.menu_type || 'regular',
      startDate: menu.start_date?.split('T')[0] || '', endDate: menu.end_date?.split('T')[0] || '',
      isActive: menu.is_active !== false, isHighlighted: menu.is_highlighted || false
    });
    setShowMenuModal(true);
  };

  const handleDeleteMenu = async (id) => {
    if (!confirm('Delete this menu?')) return;
    try { await menuAPI.deleteMenu(id); toast.success('Menu deleted'); loadData(); }
    catch { toast.error('Failed to delete'); }
  };

  const resetMenuForm = () => {
    setMenuForm({ name: '', description: '', cafeteriaId: '', mealType: 'lunch', menuType: 'regular', startDate: new Date().toISOString().split('T')[0], endDate: '', isActive: true, isHighlighted: false });
    setSelectedMenu(null);
  };

  // Menu Item Management
  const handleSaveItem = async (e) => {
    e.preventDefault();
    const dietaryTags = [];
    if (itemForm.isVegan) dietaryTags.push('vegan');
    if (itemForm.isVegetarian) dietaryTags.push('vegetarian');
    if (itemForm.isGlutenFree) dietaryTags.push('gluten-free');

    try {
      const payload = { ...itemForm, dietaryTags, price: parseFloat(itemForm.price) || 0 };
      if (selectedItem) {
        await menuAPI.updateMenuItem(selectedItem.id, payload);
        toast.success('Item updated');
      } else {
        await menuAPI.createMenuItem(payload);
        toast.success('Item created');
      }
      setShowItemModal(false);
      resetItemForm();
      loadData();
    } catch (error) { toast.error(error.response?.data?.error?.message || 'Failed to save item'); }
  };

  const handleEditItem = (item) => {
    setSelectedItem(item);
    const tags = item.dietary_tags || [];
    setItemForm({
      name: item.name || '', description: item.description || '', price: item.price || '',
      category: item.category || 'main', ingredients: item.ingredients || '',
      isVegan: tags.includes('vegan'), isVegetarian: tags.includes('vegetarian'),
      isGlutenFree: tags.includes('gluten-free'), isDoneToOrder: item.is_done_to_order || false,
      isAvailable: item.is_available !== false
    });
    setShowItemModal(true);
  };

  const handleDeleteItem = async (id) => {
    if (!confirm('Delete this item?')) return;
    try { await menuAPI.deleteMenuItem(id); toast.success('Item deleted'); loadData(); }
    catch { toast.error('Failed to delete'); }
  };

  const resetItemForm = () => {
    setItemForm({ name: '', description: '', price: '', category: 'main', dietaryTags: [], ingredients: '', isVegan: false, isVegetarian: false, isGlutenFree: false, isDoneToOrder: false, isAvailable: true });
    setSelectedItem(null);
  };

  // Template Management
  const handleSaveTemplate = () => {
    const templateName = prompt('Enter template name:');
    if (!templateName) return;
    const template = { id: Date.now(), name: templateName, menus: menus.filter(m => m.is_active), createdAt: new Date().toISOString() };
    const updated = [...savedTemplates, template];
    setSavedTemplates(updated);
    localStorage.setItem('menuTemplates', JSON.stringify(updated));
    toast.success('Template saved');
  };

  const handleLoadTemplate = async (template) => {
    if (!confirm(`Load template "${template.name}"? This will create new menus.`)) return;
    try {
      for (const menu of template.menus) {
        await menuAPI.createMenu({ ...menu, startDate: new Date().toISOString().split('T')[0], isHighlighted: true });
      }
      toast.success('Template loaded');
      loadData();
    } catch { toast.error('Failed to load template'); }
  };

  const handleDeleteTemplate = (id) => {
    const updated = savedTemplates.filter(t => t.id !== id);
    setSavedTemplates(updated);
    localStorage.setItem('menuTemplates', JSON.stringify(updated));
    toast.success('Template deleted');
  };

  // Issue Management
  const handleRespondToIssue = async (e) => {
    e.preventDefault();
    try {
      await messageAPI.respondToFeedback(selectedIssue.id, issueResponse, 'resolved');
      toast.success('Response sent');
      setShowIssueModal(false);
      setIssueResponse('');
      setSelectedIssue(null);
      loadData();
    } catch { toast.error('Failed to respond'); }
  };

  // Filtered orders
  const filteredOrders = orders.filter(o => {
    if (filters.status && o.status !== filters.status) return false;
    if (filters.company && o.company_id !== filters.company) return false;
    if (filters.date && o.order_date !== filters.date) return false;
    return true;
  });

  // Group orders by company/department
  const ordersByCompany = filteredOrders.reduce((acc, order) => {
    const key = order.company_name || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(order);
    return acc;
  }, {});

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-gray-800">Kitchen Dashboard</h1><p className="text-gray-500">Manage menus, orders, and kitchen operations</p></div>
        <div className="flex gap-3">
          <button onClick={() => { resetMenuForm(); setShowMenuModal(true); }} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">+ New Menu</button>
          <button onClick={() => { resetItemForm(); setShowItemModal(true); }} className="px-4 py-2 border border-orange-600 text-orange-600 rounded-lg hover:bg-orange-50">+ New Item</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-yellow-50 rounded-xl p-4 border-l-4 border-yellow-500 cursor-pointer hover:shadow-md" onClick={() => setFilters({ ...filters, status: 'pending' })}>
          <p className="text-sm text-yellow-600">Pending</p><p className="text-2xl font-bold text-yellow-700">{stats.pendingOrders}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500 cursor-pointer hover:shadow-md" onClick={() => setFilters({ ...filters, status: 'preparing' })}>
          <p className="text-sm text-blue-600">Preparing</p><p className="text-2xl font-bold text-blue-700">{stats.preparingOrders}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500 cursor-pointer hover:shadow-md" onClick={() => setFilters({ ...filters, status: 'ready' })}>
          <p className="text-sm text-green-600">Ready</p><p className="text-2xl font-bold text-green-700">{stats.readyOrders}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-gray-500 cursor-pointer hover:shadow-md" onClick={() => setFilters({ ...filters, status: 'completed' })}>
          <p className="text-sm text-gray-600">Completed</p><p className="text-2xl font-bold text-gray-700">{stats.completedToday}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border-l-4 border-red-500 cursor-pointer hover:shadow-md" onClick={() => setActiveTab('issues')}>
          <p className="text-sm text-red-600">Open Issues</p><p className="text-2xl font-bold text-red-700">{stats.openIssues}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b flex overflow-x-auto">
          {[
            { id: 'orders', label: '📦 Orders' },
            { id: 'prep', label: '📋 Prep List' },
            { id: 'deliveries', label: '🚚 Deliveries' },
            { id: 'menus', label: '🍽️ Menus' },
            { id: 'items', label: '🥗 Menu Items' },
            { id: 'templates', label: '📑 Templates' },
            { id: 'issues', label: '⚠️ Issues' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === tab.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'}`}>{tab.label}</button>
          ))}
        </div>

        <div className="p-6">
          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 mb-4">
                <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="px-4 py-2 border rounded-lg">
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="preparing">Preparing</option>
                  <option value="ready">Ready</option>
                  <option value="completed">Completed</option>
                </select>
                <select value={filters.company} onChange={(e) => setFilters({ ...filters, company: e.target.value })} className="px-4 py-2 border rounded-lg">
                  <option value="">All Companies</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} className="px-4 py-2 border rounded-lg" />
              </div>

              {Object.keys(ordersByCompany).length > 0 ? (
                Object.entries(ordersByCompany).map(([company, companyOrders]) => (
                  <div key={company} className="mb-6">
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">🏢 {company} <span className="text-sm font-normal text-gray-500">({companyOrders.length} orders)</span></h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {companyOrders.map(order => (
                        <div key={order.id} className={`border-2 rounded-xl p-4 ${getStatusColor(order.status)}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-mono font-bold">#{order.order_number || order.id?.slice(0,8)}</p>
                              <p className="text-sm">{order.user_first_name} {order.user_last_name}</p>
                              <p className="text-xs text-gray-500">{order.department_name || 'No Dept'}</p>
                            </div>
                            <span className="px-2 py-1 text-xs rounded-full bg-white">{order.meal_type}</span>
                          </div>
                          {order.items && order.items.length > 0 && (
                            <div className="text-sm mb-2">
                              {order.items.map((item, i) => <p key={i}>• {item.quantity}x {item.name || item.menu_item_name}</p>)}
                            </div>
                          )}
                          {order.notes && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-2">
                              <p className="text-xs font-semibold text-yellow-800">📝 Note:</p>
                              <p className="text-sm text-yellow-700">{order.notes}</p>
                            </div>
                          )}
                          <div className="flex gap-2 mt-3">
                            {order.status === 'pending' && <button onClick={() => handleUpdateOrderStatus(order.id, 'preparing')} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm">Start Prep</button>}
                            {order.status === 'preparing' && <button onClick={() => handleUpdateOrderStatus(order.id, 'ready')} className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-sm">Mark Ready</button>}
                            {order.status === 'ready' && <button onClick={() => handleUpdateOrderStatus(order.id, 'completed')} className="flex-1 px-3 py-2 bg-gray-600 text-white rounded text-sm">Complete</button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-12">No orders found for selected filters</p>
              )}
            </div>
          )}

          {/* Prep List Tab */}
          {activeTab === 'prep' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Prep List for {new Date(filters.date).toLocaleDateString()}</h3>
                <input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} className="px-4 py-2 border rounded-lg" />
              </div>
              {prepList.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {prepList.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-orange-50 rounded-xl border-l-4 border-orange-500">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-2xl font-bold text-orange-600">{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-12">No items to prepare</p>
              )}
            </div>
          )}

          {/* Deliveries Tab */}
          {activeTab === 'deliveries' && (
            <div>
              <h3 className="font-semibold mb-4">Today's Delivery Updates</h3>
              {deliveryNotifications.length > 0 ? (
                <div className="space-y-3">
                  {deliveryNotifications.map((delivery, idx) => (
                    <div key={idx} className={`border rounded-lg p-4 ${delivery.confirmed ? 'bg-green-50 border-green-200' : 'bg-cyan-50 border-cyan-200'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-mono font-bold">Order #{delivery.orderId?.slice(0,8)}</p>
                          <p className="text-sm text-gray-600">{delivery.companyName || 'Customer'}</p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 text-xs rounded-full ${delivery.confirmed ? 'bg-green-200 text-green-800' : 'bg-cyan-200 text-cyan-800'}`}>
                            {delivery.confirmed ? '✓ Confirmed' : '🚚 Delivered'}
                          </span>
                          <p className="text-xs text-gray-500 mt-1">{delivery.deliveryTime ? new Date(delivery.deliveryTime).toLocaleTimeString() : 'N/A'}</p>
                        </div>
                      </div>
                      {delivery.notes && <p className="text-sm text-gray-600 mt-2">📝 {delivery.notes}</p>}
                      {delivery.confirmed && delivery.confirmedAt && (
                        <p className="text-xs text-green-600 mt-2">Confirmed at {new Date(delivery.confirmedAt).toLocaleTimeString()} by {delivery.confirmedBy}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-2">🚚</p>
                  <p className="text-gray-500">No delivery updates today</p>
                  <p className="text-sm text-gray-400 mt-1">Updates will appear when orders are delivered</p>
                </div>
              )}
            </div>
          )}

          {/* Menus Tab */}
          {activeTab === 'menus' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-2">
                  <button onClick={handleSaveTemplate} className="px-4 py-2 border border-purple-600 text-purple-600 rounded-lg text-sm">💾 Save as Template</button>
                </div>
              </div>
              {menus.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {menus.map(menu => (
                    <div key={menu.id} className={`border rounded-xl p-4 ${menu.is_highlighted ? 'border-yellow-400 bg-yellow-50' : ''} ${menu.is_active ? '' : 'opacity-60'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{menu.name}</h3>
                            {menu.is_highlighted && <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs rounded">UPDATED</span>}
                          </div>
                          <p className="text-sm text-gray-500">{menu.cafeteria_name}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${menu.meal_type === 'breakfast' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>{menu.meal_type}</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{menu.description}</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {menu.menu_type && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{menu.menu_type}</span>}
                        {menu.is_active && <span className="px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded">Active</span>}
                      </div>
                      <p className="text-xs text-gray-500 mb-3">📅 {new Date(menu.start_date).toLocaleDateString()} - {menu.end_date ? new Date(menu.end_date).toLocaleDateString() : 'Ongoing'}</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleEditMenu(menu)} className="flex-1 px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm">Edit</button>
                        <button onClick={() => handleDeleteMenu(menu.id)} className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12"><p className="text-4xl mb-2">🍽️</p><p className="text-gray-500">No menus created yet</p><button onClick={() => setShowMenuModal(true)} className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg">Create First Menu</button></div>
              )}
            </div>
          )}

          {/* Menu Items Tab */}
          {activeTab === 'items' && (
            <div>
              <div className="flex gap-2 mb-4">
                {['all', 'soup', 'main', 'side', 'dessert', 'beverage', 'special'].map(cat => (
                  <button key={cat} onClick={() => setFilters({ ...filters, category: cat === 'all' ? '' : cat })} className={`px-3 py-1 rounded-full text-sm ${filters.category === cat || (cat === 'all' && !filters.category) ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</button>
                ))}
              </div>
              {menuItems.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {menuItems.filter(item => !filters.category || item.category === filters.category).map(item => (
                    <div key={item.id} className={`border rounded-xl p-4 ${!item.is_available ? 'opacity-60' : ''}`}>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold">{item.name}</h3>
                        <span className="font-bold text-green-600">${parseFloat(item.price || 0).toFixed(2)}</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{item.category}</span>
                        {item.is_vegan && <span className="px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded">🌱 Vegan</span>}
                        {item.is_vegetarian && <span className="px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded">🥬 Vegetarian</span>}
                        {item.is_gluten_free && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-600 text-xs rounded">GF</span>}
                        {item.is_done_to_order && <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded">🔥 Made Fresh</span>}
                      </div>
                      {item.ingredients && (
                        <p className="text-xs text-gray-500 mb-2">📝 {item.ingredients}</p>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => handleEditItem(item)} className="flex-1 px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm">Edit</button>
                        <button onClick={() => handleDeleteItem(item.id)} className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12"><p className="text-4xl mb-2">🥗</p><p className="text-gray-500">No menu items yet</p><button onClick={() => setShowItemModal(true)} className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg">Create First Item</button></div>
              )}
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div>
              {savedTemplates.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedTemplates.map(template => (
                    <div key={template.id} className="border rounded-xl p-4">
                      <h3 className="font-semibold mb-2">{template.name}</h3>
                      <p className="text-sm text-gray-500 mb-2">📅 Created: {new Date(template.createdAt).toLocaleDateString()}</p>
                      <p className="text-sm text-gray-600 mb-3">{template.menus?.length || 0} menus included</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleLoadTemplate(template)} className="flex-1 px-3 py-2 bg-purple-600 text-white rounded text-sm">Load Template</button>
                        <button onClick={() => handleDeleteTemplate(template.id)} className="px-3 py-2 bg-red-100 text-red-700 rounded text-sm">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12"><p className="text-4xl mb-2">📑</p><p className="text-gray-500">No saved templates</p><p className="text-sm text-gray-400 mt-2">Save your current menus as a template for quick reuse</p></div>
              )}
            </div>
          )}

          {/* Issues Tab */}
          {activeTab === 'issues' && (
            <div className="space-y-4">
              {issues.length > 0 ? issues.map(issue => (
                <div key={issue.id} className={`border rounded-lg p-4 ${issue.status !== 'resolved' ? 'border-red-200 bg-red-50' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">{issue.subject || 'Issue Report'}</h3>
                      <p className="text-sm text-gray-500">{issue.user_name} • {issue.company_name || 'N/A'} • {new Date(issue.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${issue.status === 'resolved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{issue.status}</span>
                  </div>
                  <p className="text-gray-600 mb-3">{issue.message}</p>
                  {issue.status !== 'resolved' && (
                    <button onClick={() => { setSelectedIssue(issue); setShowIssueModal(true); }} className="px-4 py-2 bg-orange-600 text-white rounded text-sm">Respond & Resolve</button>
                  )}
                </div>
              )) : <p className="text-gray-500 text-center py-12">No issues to review 🎉</p>}
            </div>
          )}
        </div>
      </div>

      {/* Menu Modal */}
      {showMenuModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{selectedMenu ? 'Edit Menu' : 'Create Menu'}</h2>
            <form onSubmit={handleSaveMenu} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Menu Name *</label><input type="text" value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required placeholder="e.g., Friday Special" /></div>
              <div><label className="block text-sm font-medium mb-1">Description</label><textarea value={menuForm.description} onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })} className="w-full px-4 py-2 border rounded-lg" rows="2" placeholder="What's included..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Meal Type *</label>
                  <select value={menuForm.mealType} onChange={(e) => setMenuForm({ ...menuForm, mealType: e.target.value })} className="w-full px-4 py-2 border rounded-lg">
                    <option value="breakfast">Breakfast</option><option value="lunch">Lunch</option>
                  </select>
                </div>
                <div><label className="block text-sm font-medium mb-1">Menu Type *</label>
                  <select value={menuForm.menuType} onChange={(e) => setMenuForm({ ...menuForm, menuType: e.target.value })} className="w-full px-4 py-2 border rounded-lg">
                    <option value="regular">Regular</option><option value="soup">Soup</option><option value="vegan">Vegan</option><option value="special">Special</option><option value="done-to-order">Done To Order</option>
                  </select>
                </div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Cafeteria</label>
                <select value={menuForm.cafeteriaId} onChange={(e) => setMenuForm({ ...menuForm, cafeteriaId: e.target.value })} className="w-full px-4 py-2 border rounded-lg">
                  <option value="">All Cafeterias</option>{cafeterias.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Start Date *</label><input type="date" value={menuForm.startDate} onChange={(e) => setMenuForm({ ...menuForm, startDate: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required /></div>
                <div><label className="block text-sm font-medium mb-1">End Date</label><input type="date" value={menuForm.endDate} onChange={(e) => setMenuForm({ ...menuForm, endDate: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2"><input type="checkbox" checked={menuForm.isActive} onChange={(e) => setMenuForm({ ...menuForm, isActive: e.target.checked })} /> Active</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={menuForm.isHighlighted} onChange={(e) => setMenuForm({ ...menuForm, isHighlighted: e.target.checked })} /> Highlight (show as updated)</label>
              </div>
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowMenuModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded-lg">{selectedMenu ? 'Update' : 'Create'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{selectedItem ? 'Edit Item' : 'Create Menu Item'}</h2>
            <form onSubmit={handleSaveItem} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Item Name *</label><input type="text" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required placeholder="e.g., Chicken Soup" /></div>
              <div><label className="block text-sm font-medium mb-1">Description</label><textarea value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} className="w-full px-4 py-2 border rounded-lg" rows="2" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Price *</label><input type="number" step="0.01" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required placeholder="0.00" /></div>
                <div><label className="block text-sm font-medium mb-1">Category *</label>
                  <select value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })} className="w-full px-4 py-2 border rounded-lg">
                    <option value="main">Main Course</option><option value="soup">Soup</option><option value="side">Side Dish</option><option value="dessert">Dessert</option><option value="beverage">Beverage</option><option value="special">Special</option>
                  </select>
                </div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Ingredients (for soups, etc.)</label><textarea value={itemForm.ingredients} onChange={(e) => setItemForm({ ...itemForm, ingredients: e.target.value })} className="w-full px-4 py-2 border rounded-lg" rows="2" placeholder="Chicken, carrots, celery, noodles..." /></div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2"><input type="checkbox" checked={itemForm.isVegan} onChange={(e) => setItemForm({ ...itemForm, isVegan: e.target.checked })} /> 🌱 Vegan</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={itemForm.isVegetarian} onChange={(e) => setItemForm({ ...itemForm, isVegetarian: e.target.checked })} /> 🥬 Vegetarian</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={itemForm.isGlutenFree} onChange={(e) => setItemForm({ ...itemForm, isGlutenFree: e.target.checked })} /> Gluten-Free</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={itemForm.isDoneToOrder} onChange={(e) => setItemForm({ ...itemForm, isDoneToOrder: e.target.checked })} /> 🔥 Done To Order</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={itemForm.isAvailable} onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })} /> Available</label>
              </div>
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowItemModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded-lg">{selectedItem ? 'Update' : 'Create'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Issue Response Modal */}
      {showIssueModal && selectedIssue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Respond to Issue</h2>
            <div className="mb-4 p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-500">From: {selectedIssue.user_name}</p>
              <p className="mt-2">{selectedIssue.message}</p>
            </div>
            <form onSubmit={handleRespondToIssue}>
              <textarea value={issueResponse} onChange={(e) => setIssueResponse(e.target.value)} placeholder="Your response..." className="w-full px-4 py-2 border rounded-lg mb-4" rows="4" required />
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowIssueModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg">Respond & Resolve</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
