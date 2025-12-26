import { useState, useEffect } from 'react';
import { guestAPI, menuAPI, orderAPI, companyAPI, messageAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function ReceptionistDashboard() {
  const [activeTab, setActiveTab] = useState('codes');
  const [loading, setLoading] = useState(true);
  const [guestCodes, setGuestCodes] = useState([]);
  const [codeUsageLog, setCodeUsageLog] = useState([]);
  const [menus, setMenus] = useState([]);
  const [orders, setOrders] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [cafeterias, setCafeterias] = useState([]);
  const [issues, setIssues] = useState([]);
  const [stats, setStats] = useState({ activeCodes: 0, usedToday: 0, totalOrders: 0, openIssues: 0, pendingDeliveries: 0 });
  const [pendingDeliveries, setPendingDeliveries] = useState([]);
  const [filters, setFilters] = useState({ company: '', department: '', date: new Date().toISOString().split('T')[0] });

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showMessageKitchenModal, setShowMessageKitchenModal] = useState(false);
  const [selectedCode, setSelectedCode] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [codeForm, setCodeForm] = useState({ cafeteriaId: '', validDate: new Date().toISOString().split('T')[0], guestName: '', guestEmail: '', quantity: 1 });
  const [emailForm, setEmailForm] = useState({ to: '', subject: '', body: '' });
  const [kitchenMessage, setKitchenMessage] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [codesRes, menusRes, ordersRes, companiesRes, cafeteriasRes, issuesRes] = await Promise.all([
        guestAPI.getCodes().catch(() => ({ data: { data: { codes: [] } } })),
        menuAPI.getMenus().catch(() => ({ data: { data: { menus: [] } } })),
        orderAPI.getOrders({ limit: 100 }).catch(() => ({ data: { data: { orders: [] } } })),
        companyAPI.getCompanies().catch(() => ({ data: { data: { companies: [] } } })),
        companyAPI.getCafeterias().catch(() => ({ data: { data: { cafeterias: [] } } })),
        messageAPI.getFeedback({ type: 'complaint' }).catch(() => ({ data: { data: { feedback: [] } } }))
      ]);

      const codes = codesRes.data?.data?.codes || [];
      const ordersList = ordersRes.data?.data?.orders || [];
      const issuesList = issuesRes.data?.data?.feedback || [];

      setGuestCodes(codes);
      setMenus(menusRes.data?.data?.menus || []);
      setOrders(ordersList);
      setCompanies(companiesRes.data?.data?.companies || []);
      setCafeterias(cafeteriasRes.data?.data?.cafeterias || []);
      setIssues(issuesList);

      // Build code usage log from codes that have been used
      setCodeUsageLog(codes.filter(c => c.is_used).map(c => ({
        code: c.code,
        usedBy: c.used_by_name || 'Guest',
        usedAt: c.used_at,
        cafeteria: c.cafeteria_name
      })));

      // Load pending delivery confirmations
      const pendingConf = JSON.parse(localStorage.getItem('pendingDeliveryConfirmations') || '[]');
      setPendingDeliveries(pendingConf);

      setStats({
        activeCodes: codes.filter(c => !c.is_used && c.status === 'active').length,
        usedToday: codes.filter(c => c.is_used && c.used_at && new Date(c.used_at).toDateString() === new Date().toDateString()).length,
        totalOrders: ordersList.length,
        openIssues: issuesList.filter(i => i.status !== 'resolved').length,
        pendingDeliveries: pendingConf.length
      });
    } catch (error) { console.error('Failed to load data:', error); }
    finally { setLoading(false); }
  };

  const handleGenerateCode = async (e) => {
    e.preventDefault();
    try {
      const response = await guestAPI.generateCode(codeForm);
      const newCode = response.data?.data?.code || response.data?.data?.codes?.[0]?.code;
      toast.success(`Code generated: ${newCode || 'Success'}`);
      
      if (codeForm.guestEmail && newCode) {
        setSelectedCode({ code: newCode, guestName: codeForm.guestName, guestEmail: codeForm.guestEmail });
        setEmailForm({
          to: codeForm.guestEmail,
          subject: 'Your Guest Meal Code',
          body: `Dear ${codeForm.guestName || 'Guest'},\n\nYour one-time meal code is: ${newCode}\n\nThis code is valid for ${codeForm.validDate}.\n\nPlease present this code at the cafeteria to order your meal.\n\nBest regards,\nReception`
        });
        setShowEmailModal(true);
      }
      
      setShowGenerateModal(false);
      setCodeForm({ cafeteriaId: '', validDate: new Date().toISOString().split('T')[0], guestName: '', guestEmail: '', quantity: 1 });
      loadData();
    } catch (error) { toast.error('Failed to generate code'); }
  };

  const handleSendEmail = () => {
    // Use mailto: to open default email client
    const mailtoLink = `mailto:${emailForm.to}?subject=${encodeURIComponent(emailForm.subject)}&body=${encodeURIComponent(emailForm.body)}`;
    window.open(mailtoLink, '_blank');
    toast.success('Email client opened');
    setShowEmailModal(false);
  };

  const handleEmailCode = (code) => {
    setSelectedCode(code);
    setEmailForm({
      to: code.guest_email || '',
      subject: 'Your Guest Meal Code',
      body: `Dear ${code.guest_name || 'Guest'},\n\nYour one-time meal code is: ${code.code}\n\nThis code is valid for ${new Date(code.valid_date).toLocaleDateString()}.\n\nPlease present this code at the cafeteria to order your meal.\n\nBest regards,\nReception`
    });
    setShowEmailModal(true);
  };

  const handleRevokeCode = async (codeId) => {
    if (!confirm('Revoke this code?')) return;
    try { await guestAPI.revokeCode(codeId); toast.success('Code revoked'); loadData(); }
    catch { toast.error('Failed to revoke'); }
  };

  const handleMessageKitchen = async (e) => {
    e.preventDefault();
    try {
      await messageAPI.sendMessage({ recipientRole: 'KITCHEN_HEAD', subject: `Issue Report: ${selectedIssue?.subject || 'From Reception'}`, message: kitchenMessage });
      toast.success('Sent to Kitchen');
      setShowMessageKitchenModal(false);
      setKitchenMessage('');
    } catch { toast.error('Failed to send'); }
  };

  const handleEscalateToKitchen = (issue) => {
    setSelectedIssue(issue);
    setKitchenMessage(`Issue reported:\n\n"${issue.message}"\n\nCompany: ${issue.company_name || 'N/A'}\nDepartment: ${issue.department_name || 'N/A'}\n\nPlease investigate and resolve.`);
    setShowMessageKitchenModal(true);
  };

  const handleMarkResolved = async (id) => {
    try { await messageAPI.updateFeedbackStatus(id, 'resolved'); toast.success('Marked resolved'); loadData(); }
    catch { toast.error('Failed'); }
  };

  const handleConfirmDelivery = async (delivery) => {
    try {
      // Update delivery tracking
      const tracking = JSON.parse(localStorage.getItem('deliveryTracking') || '{}');
      if (tracking[delivery.orderId]) {
        tracking[delivery.orderId].confirmed = true;
        tracking[delivery.orderId].confirmedAt = new Date().toISOString();
        tracking[delivery.orderId].confirmedBy = 'Receptionist';
        localStorage.setItem('deliveryTracking', JSON.stringify(tracking));
      }

      // Remove from pending confirmations
      const pending = JSON.parse(localStorage.getItem('pendingDeliveryConfirmations') || '[]');
      const updated = pending.filter(p => p.orderId !== delivery.orderId);
      localStorage.setItem('pendingDeliveryConfirmations', JSON.stringify(updated));

      // Notify kitchen that delivery is confirmed
      await messageAPI.sendMessage({
        recipientRole: 'KITCHEN_HEAD',
        subject: `📦 Delivery Confirmed - Order #${delivery.orderNumber}`,
        message: `Order #${delivery.orderNumber} delivery has been confirmed by reception. Company: ${delivery.companyName}`
      }).catch(() => {});

      toast.success('Delivery confirmed');
      loadData();
    } catch { toast.error('Failed to confirm'); }
  };

  const filteredOrders = orders.filter(o => {
    if (filters.company && o.company_id !== filters.company) return false;
    if (filters.date && o.order_date !== filters.date) return false;
    return true;
  });

  const exportOrdersCSV = () => {
    const headers = ['Date', 'Order #', 'Employee', 'Company', 'Department', 'Meal', 'Items', 'Total', 'Status'];
    const rows = filteredOrders.map(o => [
      o.order_date, o.order_number || o.id?.slice(0,8), `${o.user_first_name || ''} ${o.user_last_name || ''}`,
      o.company_name || '', o.department_name || '', o.meal_type || '', o.item_count || 0, o.total || 0, o.status
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv])); a.download = `orders_${filters.date}.csv`; a.click();
    toast.success('Exported');
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-gray-800">Reception Dashboard</h1><p className="text-gray-500">Guest codes, orders, menus, and reports</p></div>
        <button onClick={() => setShowGenerateModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Generate Guest Code</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500"><p className="text-sm text-blue-600">Active Codes</p><p className="text-2xl font-bold text-blue-700">{stats.activeCodes}</p></div>
        <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500"><p className="text-sm text-green-600">Used Today</p><p className="text-2xl font-bold text-green-700">{stats.usedToday}</p></div>
        <div className="bg-purple-50 rounded-xl p-4 border-l-4 border-purple-500"><p className="text-sm text-purple-600">Total Orders</p><p className="text-2xl font-bold text-purple-700">{stats.totalOrders}</p></div>
        <div className="bg-cyan-50 rounded-xl p-4 border-l-4 border-cyan-500"><p className="text-sm text-cyan-600">Pending Deliveries</p><p className="text-2xl font-bold text-cyan-700">{stats.pendingDeliveries}</p></div>
        <div className="bg-orange-50 rounded-xl p-4 border-l-4 border-orange-500"><p className="text-sm text-orange-600">Open Issues</p><p className="text-2xl font-bold text-orange-700">{stats.openIssues}</p></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b flex overflow-x-auto">
          {[
            { id: 'codes', label: '🎟️ Guest Codes' },
            { id: 'deliveries', label: '📦 Deliveries' },
            { id: 'notifications', label: '🔔 Code Usage Log' },
            { id: 'menus', label: '📋 Menus' },
            { id: 'orders', label: '📦 Orders' },
            { id: 'issues', label: '⚠️ Issues' },
            { id: 'reports', label: '📈 Reports' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>{tab.label}</button>
          ))}
        </div>

        <div className="p-6">
          {/* Guest Codes Tab */}
          {activeTab === 'codes' && (
            <div>
              {guestCodes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {guestCodes.filter(c => !c.is_used).map(code => (
                    <div key={code.id} className={`border rounded-xl p-4 ${code.status === 'active' ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-2xl font-mono font-bold">{code.code}</p>
                        <span className={`px-2 py-1 text-xs rounded-full ${code.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{code.status}</span>
                      </div>
                      <p className="text-sm text-gray-600">📅 Valid: {new Date(code.valid_date).toLocaleDateString()}</p>
                      <p className="text-sm text-gray-600">🏪 {code.cafeteria_name || 'Any Cafeteria'}</p>
                      {code.guest_name && <p className="text-sm text-gray-600">👤 {code.guest_name}</p>}
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => handleEmailCode(code)} className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200">📧 Email</button>
                        <button onClick={() => handleRevokeCode(code.id)} className="px-3 py-2 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200">Revoke</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12"><p className="text-4xl mb-2">🎟️</p><p className="text-gray-500">No active codes</p><button onClick={() => setShowGenerateModal(true)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">Generate First Code</button></div>
              )}
            </div>
          )}

          {/* Deliveries Tab */}
          {activeTab === 'deliveries' && (
            <div>
              <h3 className="font-semibold mb-4">Pending Delivery Confirmations</h3>
              {pendingDeliveries.length > 0 ? (
                <div className="space-y-4">
                  {pendingDeliveries.map((delivery, idx) => (
                    <div key={idx} className="border-2 border-cyan-200 bg-cyan-50 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-mono font-bold text-lg">Order #{delivery.orderNumber}</p>
                          <p className="text-sm text-gray-600">{delivery.companyName || 'Customer'}</p>
                        </div>
                        <div className="text-right">
                          <span className="px-3 py-1 bg-cyan-200 text-cyan-800 rounded-full text-sm">Awaiting Confirmation</span>
                          <p className="text-xs text-gray-500 mt-1">Delivered: {delivery.deliveryTime ? new Date(delivery.deliveryTime).toLocaleTimeString() : 'N/A'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                        <div><p className="text-gray-500">Delivery Person</p><p className="font-medium">🚗 {delivery.deliveryPersonPlate || 'N/A'}</p></div>
                        <div><p className="text-gray-500">Time</p><p className="font-medium">{delivery.deliveryTime ? new Date(delivery.deliveryTime).toLocaleString() : 'N/A'}</p></div>
                      </div>
                      {delivery.notes && <div className="bg-white border border-cyan-200 rounded p-2 mb-3"><p className="text-xs font-semibold text-cyan-800">📝 Notes:</p><p className="text-sm">{delivery.notes}</p></div>}
                      <button onClick={() => handleConfirmDelivery(delivery)} className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">✅ Confirm Delivery Received</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12"><p className="text-4xl mb-2">📦</p><p className="text-gray-500">No deliveries awaiting confirmation</p></div>
              )}
            </div>
          )}

          {/* Code Usage Log / Notifications Tab */}
          {activeTab === 'notifications' && (
            <div>
              <h3 className="font-semibold mb-4">Code Usage Notifications</h3>
              {codeUsageLog.length > 0 ? (
                <div className="space-y-3">
                  {codeUsageLog.map((log, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-l-4 border-green-500">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">✓</div>
                        <div>
                          <p className="font-medium">Code <span className="font-mono">{log.code}</span> was used</p>
                          <p className="text-sm text-gray-500">By: {log.usedBy} • At: {log.cafeteria}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{log.usedAt ? new Date(log.usedAt).toLocaleDateString() : 'N/A'}</p>
                        <p className="text-xs text-gray-500">{log.usedAt ? new Date(log.usedAt).toLocaleTimeString() : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-12">No code usage notifications yet</p>
              )}
            </div>
          )}

          {/* Menus Tab */}
          {activeTab === 'menus' && (
            <div>
              {menus.length > 0 ? (
                <div className="space-y-4">
                  {menus.map(menu => (
                    <div key={menu.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-lg">{menu.name}</h3>
                          <p className="text-sm text-gray-500">{menu.cafeteria_name} • {menu.meal_type}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${menu.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{menu.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                      <p className="text-sm text-gray-600">📅 {new Date(menu.start_date).toLocaleDateString()} - {new Date(menu.end_date).toLocaleDateString()}</p>
                      {menu.items && <p className="text-sm text-gray-500 mt-2">{menu.items.length} items</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-12">No menus available</p>
              )}
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <select value={filters.company} onChange={(e) => setFilters({ ...filters, company: e.target.value })} className="px-4 py-2 border rounded-lg">
                  <option value="">All Companies</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} className="px-4 py-2 border rounded-lg" />
                <button onClick={exportOrdersCSV} className="px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50">📤 Export CSV</button>
              </div>
              {filteredOrders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50"><tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Meal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr></thead>
                    <tbody className="divide-y">
                      {filteredOrders.map(order => (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-sm">{order.order_number || order.id?.slice(0,8)}</td>
                          <td className="px-4 py-3 text-sm">{order.user_first_name} {order.user_last_name}</td>
                          <td className="px-4 py-3 text-sm">{order.company_name || '-'}</td>
                          <td className="px-4 py-3 text-sm">{order.department_name || '-'}</td>
                          <td className="px-4 py-3 text-sm capitalize">{order.meal_type}</td>
                          <td className="px-4 py-3 text-sm">${parseFloat(order.total || 0).toFixed(2)}</td>
                          <td className="px-4 py-3"><span className={`px-2 py-1 text-xs rounded-full ${order.status === 'completed' ? 'bg-green-100 text-green-800' : order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>{order.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-12">No orders found</p>
              )}
            </div>
          )}

          {/* Issues Tab */}
          {activeTab === 'issues' && (
            <div className="space-y-4">
              {issues.length > 0 ? issues.map(issue => (
                <div key={issue.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">{issue.subject || 'Issue'}</h3>
                      <p className="text-sm text-gray-500">{issue.user_name} • {issue.company_name || 'N/A'} • {new Date(issue.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${issue.status === 'resolved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{issue.status}</span>
                  </div>
                  <p className="text-gray-600 mb-3">{issue.message}</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleEscalateToKitchen(issue)} className="px-3 py-1 bg-orange-100 text-orange-700 rounded text-sm">Send to Kitchen</button>
                    {issue.status !== 'resolved' && <button onClick={() => handleMarkResolved(issue.id)} className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm">Mark Resolved</button>}
                  </div>
                </div>
              )) : <p className="text-gray-500 text-center py-12">No issues reported</p>}
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && <ReceptionReports companies={companies} orders={orders} issues={issues} />}
        </div>
      </div>

      {/* Generate Code Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Generate Guest Code</h2>
            <form onSubmit={handleGenerateCode} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Cafeteria *</label>
                <select value={codeForm.cafeteriaId} onChange={(e) => setCodeForm({ ...codeForm, cafeteriaId: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required>
                  <option value="">Select</option>{cafeterias.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium mb-1">Valid Date *</label><input type="date" value={codeForm.validDate} onChange={(e) => setCodeForm({ ...codeForm, validDate: e.target.value })} className="w-full px-4 py-2 border rounded-lg" min={new Date().toISOString().split('T')[0]} required /></div>
              <div><label className="block text-sm font-medium mb-1">Guest Name</label><input type="text" value={codeForm.guestName} onChange={(e) => setCodeForm({ ...codeForm, guestName: e.target.value })} className="w-full px-4 py-2 border rounded-lg" placeholder="Visitor name" /></div>
              <div><label className="block text-sm font-medium mb-1">Guest Email</label><input type="email" value={codeForm.guestEmail} onChange={(e) => setCodeForm({ ...codeForm, guestEmail: e.target.value })} className="w-full px-4 py-2 border rounded-lg" placeholder="visitor@company.com" /></div>
              <p className="text-sm text-gray-500">If email is provided, you'll be prompted to send the code after generation.</p>
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowGenerateModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Generate</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Email Guest Code</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">To</label><input type="email" value={emailForm.to} onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
              <div><label className="block text-sm font-medium mb-1">Subject</label><input type="text" value={emailForm.subject} onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
              <div><label className="block text-sm font-medium mb-1">Message</label><textarea value={emailForm.body} onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })} className="w-full px-4 py-2 border rounded-lg" rows="6" /></div>
              <p className="text-sm text-gray-500">This will open your default email client with the message pre-filled.</p>
              <div className="flex justify-end gap-3"><button onClick={() => setShowEmailModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button><button onClick={handleSendEmail} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Open Email Client</button></div>
            </div>
          </div>
        </div>
      )}

      {/* Message Kitchen Modal */}
      {showMessageKitchenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Message Kitchen Staff</h2>
            <form onSubmit={handleMessageKitchen}>
              <textarea value={kitchenMessage} onChange={(e) => setKitchenMessage(e.target.value)} className="w-full px-4 py-2 border rounded-lg mb-4" rows="6" required />
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowMessageKitchenModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded-lg">Send</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ReceptionReports({ companies, orders, issues }) {
  const [reportType, setReportType] = useState('orders');
  const [filters, setFilters] = useState({ companyId: '', dateFrom: '', dateTo: '', mealType: '' });
  const [data, setData] = useState(null);

  const generate = () => {
    let filtered = [];
    if (reportType === 'orders' || reportType === 'ordersByMenu') {
      filtered = orders.filter(o => {
        if (filters.companyId && o.company_id !== filters.companyId) return false;
        if (filters.dateFrom && o.order_date < filters.dateFrom) return false;
        if (filters.dateTo && o.order_date > filters.dateTo) return false;
        if (filters.mealType && o.meal_type !== filters.mealType) return false;
        return true;
      });
    } else if (reportType === 'issues' || reportType === 'orderIssues') {
      filtered = issues.filter(i => {
        if (filters.companyId && i.company_id !== filters.companyId) return false;
        return true;
      });
    }
    setData({ type: reportType, records: filtered });
  };

  const exportCSV = () => {
    if (!data?.records?.length) return alert('No data');
    let csv = '';
    if (data.type === 'orders' || data.type === 'ordersByMenu') {
      csv = 'Date,Order #,Employee,Company,Department,Meal,Total,Status\n';
      csv += data.records.map(o => `${o.order_date},${o.order_number || ''},${o.user_first_name} ${o.user_last_name},${o.company_name || ''},${o.department_name || ''},${o.meal_type},${o.total},${o.status}`).join('\n');
    } else {
      csv = 'Date,Employee,Company,Department,Type,Status,Message\n';
      csv += data.records.map(i => `${i.created_at},${i.user_name},${i.company_name || ''},${i.department_name || ''},${i.type},${i.status},"${i.message}"`).join('\n');
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv])); a.download = `report_${data.type}.csv`; a.click();
    toast.success('Exported');
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold mb-4">Generate Report</h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="px-4 py-2 border rounded-lg">
            <option value="orders">Orders by Company/Dept</option>
            <option value="ordersByMenu">Orders by Menu</option>
            <option value="issues">Issues by Company/Dept</option>
            <option value="orderIssues">Orders with Issues</option>
          </select>
          <select value={filters.companyId} onChange={(e) => setFilters({ ...filters, companyId: e.target.value })} className="px-4 py-2 border rounded-lg">
            <option value="">All Companies</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filters.mealType} onChange={(e) => setFilters({ ...filters, mealType: e.target.value })} className="px-4 py-2 border rounded-lg">
            <option value="">All Meals</option><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option>
          </select>
          <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="px-4 py-2 border rounded-lg" />
          <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="px-4 py-2 border rounded-lg" />
          <button onClick={generate} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Generate</button>
        </div>
      </div>
      {data && (
        <div>
          <div className="flex justify-between mb-4"><h3 className="font-semibold">Results ({data.records.length})</h3><button onClick={exportCSV} className="px-4 py-2 border border-green-600 text-green-600 rounded-lg">📤 Export</button></div>
          {data.records.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50"><tr>
                  {(data.type === 'orders' || data.type === 'ordersByMenu') ? (
                    <><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Meal</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th></>
                  ) : (
                    <><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th></>
                  )}
                </tr></thead>
                <tbody className="divide-y">
                  {data.records.slice(0, 50).map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {(data.type === 'orders' || data.type === 'ordersByMenu') ? (
                        <><td className="px-4 py-3 text-sm">{r.order_date}</td><td className="px-4 py-3 text-sm font-mono">{r.order_number || r.id?.slice(0,8)}</td><td className="px-4 py-3 text-sm">{r.user_first_name} {r.user_last_name}</td><td className="px-4 py-3 text-sm">{r.company_name}</td><td className="px-4 py-3 text-sm">{r.meal_type}</td><td className="px-4 py-3 text-sm">${parseFloat(r.total || 0).toFixed(2)}</td><td className="px-4 py-3 text-sm">{r.status}</td></>
                      ) : (
                        <><td className="px-4 py-3 text-sm">{new Date(r.created_at).toLocaleDateString()}</td><td className="px-4 py-3 text-sm">{r.user_name}</td><td className="px-4 py-3 text-sm">{r.company_name}</td><td className="px-4 py-3 text-sm">{r.type}</td><td className="px-4 py-3 text-sm">{r.status}</td><td className="px-4 py-3 text-sm truncate max-w-xs">{r.message}</td></>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-gray-500 text-center py-8">No data found</p>}
        </div>
      )}
    </div>
  );
}
