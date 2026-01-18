import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { orderAPI, menuAPI, messageAPI, companyAPI, catalogAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import toast from 'react-hot-toast';

export default function KitchenDashboard() {
  const { colors, getStatCardColors } = useTheme();
  const location = useLocation();
  
  // Set active tab based on URL
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/orders')) setActiveTab('orders');
    else if (path.includes('/prep')) setActiveTab('prep');
    else if (path.includes('/deliveries')) setActiveTab('deliveries');
    else if (path.includes('/menus')) setActiveTab('menus');
    else if (path.includes('/items')) setActiveTab('items');
    else if (path.includes('/issues')) setActiveTab('issues');
    else if (path.includes('/messages')) setActiveTab('messages');
  }, [location.pathname]);
  const [activeTab, setActiveTab] = useState('orders');
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [menus, setMenus] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [issues, setIssues] = useState([]);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState({});
  const [filters, setFilters] = useState({ company: '', status: '', date: new Date().toISOString().split('T')[0] });
  const [deliveryNotifications, setDeliveryNotifications] = useState([]);

  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [menuForm, setMenuForm] = useState({ name: '', description: '', mealType: 'lunch', menuType: 'regular', isActive: true });
  const [itemForm, setItemForm] = useState({ name: '', description: '', category: 'protein', isVegan: false, isVegetarian: false, ingredients: '' });
  const [issueResponse, setIssueResponse] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, menusRes, itemsRes, issuesRes, messagesRes, companiesRes] = await Promise.all([
        orderAPI.getOrders({ limit: 200 }).catch(() => ({ data: { data: { orders: [] } } })),
        menuAPI.getMenus().catch(() => ({ data: { data: { menus: [] } } })),
        catalogAPI.getItems().catch(() => ({ data: { data: { items: [] } } })),
        messageAPI.getFeedback().catch(() => ({ data: { data: { feedback: [] } } })),
        messageAPI.getInbox().catch(() => ({ data: { data: { messages: [], unreadCount: 0 } } })),
        companyAPI.getCompanies().catch(() => ({ data: { data: { companies: [] } } }))
      ]);
      const ordersList = ordersRes.data?.data?.orders || [];
      setOrders(ordersList);
      setMenus(menusRes.data?.data?.menus || []);
      setMenuItems(itemsRes.data?.data?.items || []);
      setIssues((issuesRes.data?.data?.feedback || []).filter(f => f.type === 'issue' || f.status === 'escalated'));
      setMessages(messagesRes.data?.data?.messages || []);
      setUnreadCount(messagesRes.data?.data?.unreadCount || 0);
      setCompanies(companiesRes.data?.data?.companies || []);

      const tracking = JSON.parse(localStorage.getItem('deliveryTracking') || '{}');
      const today = new Date().toDateString();
      setDeliveryNotifications(Object.entries(tracking).filter(([_, t]) => t.deliveryTime && new Date(t.deliveryTime).toDateString() === today).map(([id, t]) => ({ orderId: id, ...t })));

      setStats({ pending: ordersList.filter(o => o.status === 'pending').length, preparing: ordersList.filter(o => o.status === 'preparing').length, ready: ordersList.filter(o => o.status === 'ready').length, completed: ordersList.filter(o => o.status === 'completed').length, issues: (issuesRes.data?.data?.feedback || []).filter(f => f.status !== 'resolved').length });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleUpdateOrderStatus = async (order, status) => {
    try { await orderAPI.updateOrderStatus(order.id, status); toast.success(`Order ${status}`); loadData(); } catch { toast.error('Failed'); }
  };

  const handleSaveMenu = async (e) => {
    e.preventDefault();
    try {
      if (selectedMenu) { await menuAPI.updateMenu(selectedMenu.id, menuForm); toast.success('Updated'); }
      else { await menuAPI.createMenu(menuForm); toast.success('Created'); }
      setShowMenuModal(false); setMenuForm({ name: '', description: '', mealType: 'lunch', menuType: 'regular', isActive: true }); setSelectedMenu(null); loadData();
    } catch { toast.error('Failed'); }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    try {
      if (selectedItem) { await catalogAPI.updateItem(selectedItem.id, itemForm); toast.success('Updated'); }
      else { await catalogAPI.createItem(itemForm); toast.success('Created'); }
      setShowItemModal(false); setItemForm({ name: '', description: '', category: 'protein', isVegan: false, isVegetarian: false, ingredients: '' }); setSelectedItem(null); loadData();
    } catch { toast.error('Failed'); }
  };

  const handleDeleteItem = async (item) => {
    if (!confirm('Are you sure you want to delete "' + item.name + '"?')) return;
    try {
      await catalogAPI.deleteItem(item.id);
      toast.success('Item deleted');
      loadData();
    } catch { toast.error('Failed to delete item'); }
  };

  const handleRespondIssue = async () => {
    try { await messageAPI.respondToFeedback(selectedIssue.id, issueResponse); await messageAPI.updateFeedbackStatus(selectedIssue.id, 'resolved'); toast.success('Responded & Resolved'); setShowIssueModal(false); loadData(); } catch { toast.error('Failed'); }
  };

  const filteredOrders = orders.filter(o => {
    if (filters.company && o.company_id !== filters.company) return false;
    if (filters.status && o.status !== filters.status) return false;
    if (filters.date) {
      const orderDate = (o.order_date || '').split('T')[0];
      if (orderDate !== filters.date) return false;
    }
    return true;
  });

  const prepList = filteredOrders.filter(o => ['pending', 'preparing'].includes(o.status)).reduce((acc, o) => {
    (o.items || []).forEach(item => { acc[item.name] = (acc[item.name] || 0) + (item.quantity || 1); });
    return acc;
  }, {});

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><div><h1 className={`text-2xl font-bold ${colors.textPrimary}`}>Kitchen Dashboard</h1><p className={colors.textMuted}>Manage orders, menus, and prep</p></div></div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[{ l: 'Pending', v: stats.pending, color: 'yellow' }, { l: 'Preparing', v: stats.preparing, color: 'blue' }, { l: 'Ready', v: stats.ready, color: 'green' }, { l: 'Completed', v: stats.completed, color: 'gray' }, { l: 'Issues', v: stats.issues, color: 'red' }].map((s, i) => {
          const c = getStatCardColors(i);
          return <div key={i} className={`${c.bg} rounded-xl p-4 border-l-4 ${c.border}`}><p className={`text-sm ${c.text} opacity-80`}>{s.l}</p><p className={`text-2xl font-bold ${c.text}`}>{s.v}</p></div>;
        })}
      </div>

      <div className={`${colors.bgCard} rounded-xl shadow-sm border ${colors.border}`}>
        <div className={`border-b ${colors.border} flex overflow-x-auto`}>
          {[{ id: 'orders', l: '📦 Orders' }, { id: 'prep', l: '📋 Prep List' }, { id: 'deliveries', l: '🚚 Deliveries' }, { id: 'menus', l: '🍽️ Menus' }, { id: 'items', l: '🥗 Items' }, { id: 'issues', l: '⚠️ Issues' }, { id: 'messages', l: '📨 Messages' }].map(t => <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === t.id ? 'border-orange-500 text-orange-600' : `border-transparent ${colors.textMuted}`}`}>{t.l}</button>)}
        </div>

        <div className="p-6">
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <select className={`px-4 py-2 border ${colors.border} rounded-lg`} value={filters.company} onChange={e => setFilters({ ...filters, company: e.target.value })}><option value="">All Companies</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <select className={`px-4 py-2 border ${colors.border} rounded-lg`} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option value="">All Status</option><option value="pending">Pending</option><option value="preparing">Preparing</option><option value="ready">Ready</option></select>
                <input type="date" className={`px-4 py-2 border ${colors.border} rounded-lg`} value={filters.date} onChange={e => setFilters({ ...filters, date: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOrders.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    <p className="text-4xl mb-2">📋</p>
                    <p>No orders found for this date</p>
                  </div>
                ) : filteredOrders.map(order => (
                  <div key={order.id} className={`border-2 rounded-xl p-4 ${order.status === 'pending' ? 'border-yellow-300 bg-yellow-50' : order.status === 'preparing' ? 'border-blue-300 bg-blue-50' : order.status === 'ready' ? 'border-green-300 bg-green-50' : `${colors.border} ${colors.bgCard}`}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div><p className="font-mono font-bold">#{order.order_number || order.id?.slice(0, 8)}</p><p className={`text-sm ${colors.textMuted}`}>{order.user_first_name} {order.user_last_name}</p></div>
                      <span className={`px-2 py-1 text-xs rounded-full ${order.status === 'pending' ? 'bg-yellow-200 text-yellow-800' : order.status === 'preparing' ? 'bg-blue-200 text-blue-800' : order.status === 'ready' ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-800'}`}>{order.status}</span>
                    </div>
                    <p className={`text-sm ${colors.textSecondary} mb-1`}>{order.company_name}</p>
                    {order.notes && <div className={`${colors.bgSecondary} rounded p-2 text-sm mb-2`}>📝 {order.notes}</div>}
                    <div className="flex gap-2 mt-3">
                      {order.status === 'pending' && <button onClick={() => handleUpdateOrderStatus(order, 'preparing')} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">Start Prep</button>}
                      {order.status === 'preparing' && <button onClick={() => handleUpdateOrderStatus(order, 'ready')} className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm">Mark Ready</button>}
                      {order.status === 'ready' && <button onClick={() => handleUpdateOrderStatus(order, 'completed')} className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg text-sm">Complete</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'prep' && (
            <div><h3 className={`font-semibold mb-4 ${colors.textPrimary}`}>Today's Prep List</h3>
              {Object.keys(prepList).length > 0 ? <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Object.entries(prepList).map(([item, qty]) => <div key={item} className={`${colors.bgSecondary} rounded-xl p-4 text-center`}><p className={`text-3xl font-bold ${colors.textPrimary}`}>{qty}</p><p className={colors.textSecondary}>{item}</p></div>)}</div> : <p className={colors.textMuted}>No items to prep</p>}
            </div>
          )}

          {activeTab === 'deliveries' && (
            <div><h3 className={`font-semibold mb-4 ${colors.textPrimary}`}>Today's Delivery Updates</h3>
              {deliveryNotifications.length > 0 ? <div className="space-y-3">{deliveryNotifications.map((d, i) => <div key={i} className={`border rounded-lg p-4 ${d.confirmed ? 'bg-green-50 border-green-200' : 'bg-cyan-50 border-cyan-200'}`}><div className="flex justify-between"><div><p className="font-mono font-bold">#{d.orderId?.slice(0, 8)}</p><p className={`text-sm ${colors.textMuted}`}>{d.companyName}</p></div><span className={`px-2 py-1 text-xs rounded-full ${d.confirmed ? 'bg-green-200 text-green-800' : 'bg-cyan-200 text-cyan-800'}`}>{d.confirmed ? '✓ Confirmed' : '🚚 Delivered'}</span></div></div>)}</div> : <p className={colors.textMuted}>No deliveries today</p>}
            </div>
          )}

          {activeTab === 'menus' && (
            <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => { setSelectedMenu(null); setMenuForm({ name: '', description: '', mealType: 'lunch', menuType: 'regular', isActive: true }); setShowMenuModal(true); }} className="px-4 py-2 bg-orange-600 text-white rounded-lg">+ Add Menu</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {menus.map(m => <div key={m.id} className={`border ${colors.border} rounded-xl p-4 ${colors.bgCard}`}><div className="flex justify-between mb-2"><h3 className={`font-semibold ${colors.textPrimary}`}>{m.name}</h3><span className={`px-2 py-1 text-xs rounded-full ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{m.is_active ? 'Active' : 'Inactive'}</span></div><p className={`text-sm ${colors.textMuted} mb-2`}>{m.meal_type} • {m.menu_type || 'Regular'}</p><button onClick={() => { setSelectedMenu(m); setMenuForm({ name: m.name, description: m.description || '', mealType: m.meal_type, menuType: m.menu_type || 'regular', isActive: m.is_active }); setShowMenuModal(true); }} className="text-blue-600 text-sm">Edit</button></div>)}
              </div>
            </div>
          )}

          {activeTab === 'items' && (
            <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => { setSelectedItem(null); setItemForm({ name: '', description: '', category: 'protein', isVegan: false, isVegetarian: false, ingredients: '' }); setShowItemModal(true); }} className="px-4 py-2 bg-orange-600 text-white rounded-lg">+ Add Item</button></div>
              <table className="w-full"><thead className={colors.bgSecondary}><tr><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Item</th><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Category</th><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Tags</th><th className={`px-4 py-3 text-right text-xs ${colors.textMuted}`}>Actions</th></tr></thead>
                <tbody className={`divide-y ${colors.border}`}>{menuItems.map(item => <tr key={item.id}><td className={`px-4 py-3 ${colors.textPrimary}`}>{item.name}</td><td className={`px-4 py-3 ${colors.textSecondary}`}>{item.category || item.category_name || '-'}</td><td className="px-4 py-3"><div className="flex gap-1">{item.is_vegan && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">Vegan</span>}{item.is_vegetarian && <span className="px-2 py-0.5 bg-lime-100 text-lime-700 text-xs rounded">Veg</span>}</div></td><td className="px-4 py-3 text-right"><button onClick={() => { setSelectedItem(item); setItemForm({ name: item.name, description: item.description || '', category: item.category || 'protein', isVegan: item.is_vegan, isVegetarian: item.is_vegetarian, ingredients: item.ingredients || '' }); setShowItemModal(true); }} className="text-blue-600 text-sm mr-3">Edit</button><button onClick={() => handleDeleteItem(item)} className="text-red-600 text-sm">Delete</button></td></tr>)}</tbody>
              </table>
            </div>
          )}

          {activeTab === 'issues' && (
            <div className="space-y-4">
              {issues.length > 0 ? issues.map(issue => <div key={issue.id} className={`border ${colors.border} rounded-xl p-4 ${colors.bgCard}`}><div className="flex justify-between mb-2"><div><h3 className={`font-semibold ${colors.textPrimary}`}>{issue.subject}</h3><p className={`text-sm ${colors.textMuted}`}>{issue.user_name}</p></div><span className={`px-2 py-1 text-xs rounded-full ${issue.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{issue.status}</span></div><p className={colors.textSecondary}>{issue.message}</p>{issue.status !== 'resolved' && <button onClick={() => { setSelectedIssue(issue); setIssueResponse(''); setShowIssueModal(true); }} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Respond & Resolve</button>}</div>) : <p className={colors.textMuted}>No issues</p>}
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className={`font-semibold ${colors.textPrimary}`}>Inbox ({unreadCount} unread)</h3>
                {messages.length > 0 && <button onClick={async () => { await messageAPI.markAllAsRead(); loadData(); toast.success('All marked as read'); }} className="text-sm text-blue-600">Mark all as read</button>}
              </div>
              {messages.length > 0 ? messages.map(msg => (
                <div key={msg.id} className={`border ${colors.border} rounded-xl p-4 ${colors.bgCard} ${!msg.isRead ? 'border-l-4 border-l-blue-500' : ''}`}>
                  <div className="flex justify-between mb-2">
                    <div>
                      <h3 className={`font-semibold ${colors.textPrimary}`}>{msg.subject}</h3>
                      <p className={`text-sm ${colors.textMuted}`}>From: {msg.sender?.name || 'Unknown'} {msg.sender?.role ? `(${msg.sender.role})` : ''}</p>
                    </div>
                    <span className={`text-xs ${colors.textMuted}`}>{new Date(msg.createdAt).toLocaleString()}</span>
                  </div>
                  <p className={colors.textSecondary}>{msg.body}</p>
                  {!msg.isRead && <button onClick={async () => { await messageAPI.markAsRead(msg.id); loadData(); }} className="mt-2 text-sm text-blue-600">Mark as read</button>}
                </div>
              )) : <p className={colors.textMuted}>No messages</p>}
            </div>
          )}
        </div>
      </div>

      {showMenuModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-lg`}><h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>{selectedMenu ? 'Edit' : 'Add'} Menu</h2><form onSubmit={handleSaveMenu} className="space-y-4"><input placeholder="Menu Name" value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} required /><textarea placeholder="Description" value={menuForm.description} onChange={e => setMenuForm({ ...menuForm, description: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} rows="2" /><div className="grid grid-cols-2 gap-4"><select value={menuForm.mealType} onChange={e => setMenuForm({ ...menuForm, mealType: e.target.value })} className={`px-4 py-2 border ${colors.border} rounded-lg`}><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option></select><select value={menuForm.menuType} onChange={e => setMenuForm({ ...menuForm, menuType: e.target.value })} className={`px-4 py-2 border ${colors.border} rounded-lg`}><option value="regular">Regular</option><option value="soup">Soup</option><option value="vegan">Vegan</option><option value="special">Special</option></select></div><label className="flex items-center gap-2"><input type="checkbox" checked={menuForm.isActive} onChange={e => setMenuForm({ ...menuForm, isActive: e.target.checked })} /> Active</label><div className="flex justify-end gap-3"><button type="button" onClick={() => setShowMenuModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded-lg">Save</button></div></form></div></div>}

      {showItemModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-lg`}><h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>{selectedItem ? 'Edit' : 'Add'} Item</h2><form onSubmit={handleSaveItem} className="space-y-4"><input placeholder="Item Name" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} required /><textarea placeholder="Description" value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} rows="2" /><div><label className="block text-sm font-medium mb-1">Category</label><select value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`}><option value="protein">Protein</option><option value="carbohydrate">Carbohydrate</option><option value="fibre">Fibre / Vegetable</option><option value="soup">Soup</option><option value="vegetarian">Vegetarian</option><option value="done_to_order">Done to Order</option><option value="beverage">Beverage</option><option value="dessert">Dessert</option><option value="specials">Specials</option></select></div><textarea placeholder="Ingredients (for soups)" value={itemForm.ingredients} onChange={e => setItemForm({ ...itemForm, ingredients: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} rows="2" /><div className="flex gap-4"><label className="flex items-center gap-2"><input type="checkbox" checked={itemForm.isVegan} onChange={e => setItemForm({ ...itemForm, isVegan: e.target.checked })} /> Vegan</label><label className="flex items-center gap-2"><input type="checkbox" checked={itemForm.isVegetarian} onChange={e => setItemForm({ ...itemForm, isVegetarian: e.target.checked })} /> Vegetarian</label></div><div className="flex justify-end gap-3"><button type="button" onClick={() => setShowItemModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded-lg">Save</button></div></form></div></div>}

      {showIssueModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-lg`}><h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>Respond to Issue</h2><div className={`${colors.bgSecondary} rounded-lg p-4 mb-4`}><h3 className={colors.textPrimary}>{selectedIssue?.subject}</h3><p className={`text-sm ${colors.textMuted}`}>{selectedIssue?.message}</p></div><textarea placeholder="Your response..." value={issueResponse} onChange={e => setIssueResponse(e.target.value)} className={`w-full px-4 py-2 border ${colors.border} rounded-lg mb-4`} rows="4" /><div className="flex justify-end gap-3"><button onClick={() => setShowIssueModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button onClick={handleRespondIssue} className="px-4 py-2 bg-green-600 text-white rounded-lg">Resolve</button></div></div></div>}
    </div>
  );
}
