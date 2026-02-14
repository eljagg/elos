import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { orderAPI, menuAPI, messageAPI, companyAPI, deliveryAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function ReceptionistDashboard() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'codes');
  const [loading, setLoading] = useState(true);
  
  // Core data
  const [guestCodes, setGuestCodes] = useState([]);
  const [menus, setMenus] = useState([]);
  const [orders, setOrders] = useState([]);
  const [issues, setIssues] = useState([]);
  const [cafeterias, setCafeterias] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pendingDeliveries, setPendingDeliveries] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({ activeCodes: 0, usedToday: 0, totalOrders: 0, pendingDeliveries: 0, openIssues: 0, todayOrders: 0 });

  // Filters
  const [orderFilters, setOrderFilters] = useState({ 
    companyId: '', 
    departmentId: '', 
    status: '', 
    dateFrom: new Date().toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0]
  });

  // Reports
  const [reportForm, setReportForm] = useState({ 
    type: 'orders', 
    groupBy: 'company', 
    dateFrom: new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0]
  });
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Modals
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedCode, setSelectedCode] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Forms
  const [codeForm, setCodeForm] = useState({ cafeteriaId: '', validDate: '', guestName: '', guestEmail: '' });
  const [issueForm, setIssueForm] = useState({ orderId: '', subject: '', description: '', priority: 'medium' });

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => { 
    loadData(); 
    // Poll for notifications every 30 seconds
    const interval = setInterval(checkNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load departments when company filter changes
  useEffect(() => {
    if (orderFilters.companyId) {
      loadDepartments(orderFilters.companyId);
    } else {
      setDepartments([]);
    }
  }, [orderFilters.companyId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [codesRes, menusRes, ordersRes, issuesRes, cafeteriasRes, companiesRes, pendingRes] = await Promise.all([
        orderAPI.getGuestCodes().catch(() => ({ data: { data: { codes: [] } } })),
        menuAPI.getMenus().catch(() => ({ data: { data: { menus: [] } } })),
        orderAPI.getOrders({ limit: 500 }).catch(() => ({ data: { data: { orders: [] } } })),
        messageAPI.getFeedback().catch(() => ({ data: { data: { feedback: [] } } })),
        companyAPI.getCafeterias().catch(() => ({ data: { data: { cafeterias: [] } } })),
        companyAPI.getCompanies().catch(() => ({ data: { data: { companies: [] } } })),
        deliveryAPI.getPendingConfirmations().catch(() => ({ data: { data: { pendingConfirmations: [] } } }))
      ]);
      
      const codes = codesRes.data?.data?.codes || [];
      const allOrders = ordersRes.data?.data?.orders || [];
      const allFeedback = issuesRes.data?.data?.feedback || [];
      
      setGuestCodes(codes);
      setMenus(menusRes.data?.data?.menus || []);
      setOrders(allOrders);
      setIssues(allFeedback.filter(f => f.type === 'issue'));
      setCafeterias(cafeteriasRes.data?.data?.cafeterias || []);
      setCompanies(companiesRes.data?.data?.companies || []);
      
      const apiPending = pendingRes.data?.data?.pendingConfirmations || [];
      const localPending = JSON.parse(localStorage.getItem('pendingDeliveryConfirmations') || '[]');
      const pending = apiPending.length > 0 ? apiPending : localPending;
      setPendingDeliveries(pending);
      
      const today = new Date().toDateString();
      const todayOrders = allOrders.filter(o => new Date(o.order_date || o.created_at).toDateString() === today);
      
      setStats({ 
        activeCodes: codes.filter(c => !c.is_used).length, 
        usedToday: codes.filter(c => c.is_used && c.used_at && new Date(c.used_at).toDateString() === today).length, 
        totalOrders: allOrders.length,
        todayOrders: todayOrders.length,
        openIssues: allFeedback.filter(f => f.status !== 'resolved').length, 
        pendingDeliveries: pending.length 
      });

      checkNotifications();
    } catch (e) { 
      console.error('Error loading data:', e); 
    } finally { 
      setLoading(false); 
    }
  };

  const loadDepartments = async (companyId) => {
    try {
      const res = await companyAPI.getDepartments(companyId);
      setDepartments(res.data?.data?.departments || []);
    } catch (e) {
      console.error('Error loading departments:', e);
    }
  };

  const checkNotifications = async () => {
    try {
      const codesRes = await orderAPI.getGuestCodes().catch(() => ({ data: { data: { codes: [] } } }));
      const codes = codesRes.data?.data?.codes || [];
      
      // Find codes used in the last hour
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentlyUsed = codes.filter(c => {
        if (!c.is_used || !c.used_at) return false;
        return new Date(c.used_at) > hourAgo;
      });

      const newNotifs = recentlyUsed.map(c => ({
        id: c.id,
        message: `Guest code ${c.code} was used${c.guestName ? ` by ${c.guestName}` : ''}`,
        time: c.used_at,
        read: localStorage.getItem(`notif_read_${c.id}`) === 'true'
      }));

      setNotifications(newNotifs);
    } catch (e) {
      console.error('Error checking notifications:', e);
    }
  };

  const markNotificationRead = (id) => {
    localStorage.setItem(`notif_read_${id}`, 'true');
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  // Guest Code Handlers
  const handleGenerateCode = async (e) => { 
    e.preventDefault(); 
    if (!codeForm.cafeteriaId) {
      toast.error('Please select a cafeteria');
      return;
    }
    try {
      const response = await orderAPI.createGuestCode({
        cafeteriaId: codeForm.cafeteriaId,
        validDate: codeForm.validDate || new Date().toISOString().split('T')[0],
        guestName: codeForm.guestName,
        guestEmail: codeForm.guestEmail,
        sendEmail: true
      });
      const guestCode = response.data?.data?.guestCode;
      const code = guestCode?.code || response.data?.data?.code;
      if (guestCode?.emailSent) {
        toast.success(`Code ${code} generated and emailed!`);
      } else {
        toast.success(`Code generated: ${code}`);
      }
      setShowGenerateModal(false); 
      setCodeForm({ cafeteriaId: '', validDate: '', guestName: '', guestEmail: '' }); 
      loadData();
    } catch (error) {
      console.error('Failed to generate code:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to generate code');
    }
  };

  const handleEmailCode = () => { 
    const subject = encodeURIComponent(`Your Guest Lunch Code: ${selectedCode.code}`);
    const body = encodeURIComponent(`Hello,\n\nYour guest code: ${selectedCode.code}\nValid: ${selectedCode.validDate || 'Today'}\n\nVisit: ${window.location.origin}/guest`);
    window.location.href = `mailto:${selectedCode.guestEmail}?subject=${subject}&body=${body}`; 
    setShowEmailModal(false); 
  };

  // Delivery Handlers
  const handleConfirmDelivery = async (delivery) => { 
    try {
      await deliveryAPI.confirmDelivery(delivery.orderId);
      toast.success('Delivery confirmed');
    } catch (error) {
      console.error('Confirm failed:', error);
    }
    const pending = JSON.parse(localStorage.getItem('pendingDeliveryConfirmations') || '[]').filter(p => p.orderId !== delivery.orderId); 
    localStorage.setItem('pendingDeliveryConfirmations', JSON.stringify(pending)); 
    loadData(); 
  };

  const handleConfirmAllByCompany = async (companyName) => {
    const companyDeliveries = pendingDeliveries.filter(d => d.companyName === companyName);
    for (const delivery of companyDeliveries) {
      try {
        await deliveryAPI.confirmDelivery(delivery.orderId);
      } catch (e) {
        console.error('Failed to confirm:', e);
      }
    }
    toast.success(`All ${companyDeliveries.length} deliveries for ${companyName} confirmed!`);
    loadData();
  };

  // Issue Handlers
  const handleCreateIssue = async (e) => {
    e.preventDefault();
    try {
      await messageAPI.submitFeedback({
        type: 'issue',
        subject: issueForm.subject,
        message: issueForm.description,
        orderId: issueForm.orderId || null,
        priority: issueForm.priority
      });
      toast.success('Issue logged');
      setShowIssueModal(false);
      setIssueForm({ orderId: '', subject: '', description: '', priority: 'medium' });
      setSelectedOrder(null);
      loadData();
    } catch (error) {
      toast.error('Failed to log issue');
    }
  };

  const handleResolve = async (issue) => { 
    try { 
      await messageAPI.updateFeedbackStatus(issue.id, 'resolved'); 
      toast.success('Resolved'); 
      loadData(); 
    } catch (e) { 
      toast.error('Failed'); 
    } 
  };

  // Report Handlers
  const handleGenerateReport = async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams({
        dateFrom: reportForm.dateFrom,
        dateTo: reportForm.dateTo,
        groupBy: reportForm.groupBy
      });
      
      const response = await fetch(`/api/reports/orders/summary?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setReportData(data.data.report);
        toast.success('Report generated');
      } else {
        toast.error('Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setReportLoading(false);
    }
  };

  const exportReportCSV = () => {
    if (!reportData || !reportData.data) return;
    
    const headers = ['Name', 'Orders', 'Total Value', 'Completed', 'Cancelled'];
    const rows = reportData.data.map(r => [
      r.name || 'N/A',
      r.orderCount || 0,
      (r.totalValue || 0).toFixed(2),
      r.completedCount || 0,
      r.cancelledCount || 0
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${reportForm.type}_${reportForm.dateFrom}_${reportForm.dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter orders
  const filteredOrders = orders.filter(o => {
    if (orderFilters.companyId && o.company_id !== orderFilters.companyId) return false;
    if (orderFilters.departmentId && o.department_id !== orderFilters.departmentId) return false;
    if (orderFilters.status && o.status !== orderFilters.status) return false;
    const orderDate = new Date(o.order_date || o.created_at).toISOString().split('T')[0];
    if (orderFilters.dateFrom && orderDate < orderFilters.dateFrom) return false;
    if (orderFilters.dateTo && orderDate > orderFilters.dateTo) return false;
    return true;
  });

  // Group deliveries by company
  const deliveriesByCompany = pendingDeliveries.reduce((acc, d) => {
    const company = d.companyName || 'Unknown';
    if (!acc[company]) acc[company] = [];
    acc[company].push(d);
    return acc;
  }, {});

  const unreadNotifications = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reception Dashboard</h1>
          <p className="text-gray-500">Guest codes, deliveries, orders, and reports</p>
        </div>
        <button 
          onClick={() => setActiveTab('notifications')}
          className="p-3 rounded-lg bg-gray-100 relative hover:bg-gray-200"
        >
          🔔
          {unreadNotifications > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadNotifications}
            </span>
          )}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-indigo-50 rounded-xl p-4 border-l-4 border-indigo-400">
          <p className="text-sm text-indigo-700 opacity-80">🎟️ Active Codes</p>
          <p className="text-2xl font-bold text-indigo-700">{stats.activeCodes}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-400">
          <p className="text-sm text-green-700 opacity-80">✅ Used Today</p>
          <p className="text-2xl font-bold text-green-700">{stats.usedToday}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-400">
          <p className="text-sm text-blue-700 opacity-80">📦 Today's Orders</p>
          <p className="text-2xl font-bold text-blue-700">{stats.todayOrders}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 border-l-4 border-purple-400">
          <p className="text-sm text-purple-700 opacity-80">📋 Total Orders</p>
          <p className="text-2xl font-bold text-purple-700">{stats.totalOrders}</p>
        </div>
        <div className="bg-cyan-50 rounded-xl p-4 border-l-4 border-cyan-400">
          <p className="text-sm text-cyan-700 opacity-80">🚚 Deliveries</p>
          <p className="text-2xl font-bold text-cyan-700">{stats.pendingDeliveries}</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-4 border-l-4 border-orange-400">
          <p className="text-sm text-orange-700 opacity-80">⚠️ Issues</p>
          <p className="text-2xl font-bold text-orange-700">{stats.openIssues}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 flex overflow-x-auto">
          {[
            { id: 'codes', label: '🎟️ Guest Codes' },
            { id: 'deliveries', label: '📦 Deliveries' },
            { id: 'orders', label: '📋 Orders' },
            { id: 'issues', label: '⚠️ Issues' },
            { id: 'reports', label: '📊 Reports' },
            { id: 'menus', label: '🍽️ Menus' },
            { id: 'notifications', label: `🔔 Alerts${unreadNotifications > 0 ? ` (${unreadNotifications})` : ''}` }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)} 
              className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 ${
                activeTab === tab.id 
                  ? 'border-indigo-500 text-indigo-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* GUEST CODES TAB */}
          {activeTab === 'codes' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">Guest Codes</h3>
                <button 
                  onClick={() => setShowGenerateModal(true)} 
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  + Generate Code
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {guestCodes.length > 0 ? guestCodes.map(code => (
                  <div key={code.id} className={`border border-gray-200 rounded-xl p-4 ${code.is_used ? 'opacity-60 bg-gray-50' : 'bg-white'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-mono text-2xl font-bold text-gray-900">{code.code}</p>
                      <span className={`px-2 py-1 text-xs rounded-full ${code.is_used ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-700'}`}>
                        {code.is_used ? 'Used' : 'Active'}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-700">{code.guestName || 'Guest'}</p>
                    <p className="text-sm text-gray-500">Valid: {code.validDate || 'Today'}</p>
                    {code.is_used && code.used_at && (
                      <p className="text-xs text-gray-400 mt-1">Used: {new Date(code.used_at).toLocaleString()}</p>
                    )}
                    {!code.is_used && code.guestEmail && (
                      <button 
                        onClick={() => { setSelectedCode(code); setShowEmailModal(true); }} 
                        className="mt-2 text-blue-600 text-sm hover:underline"
                      >
                        📧 Resend Email
                      </button>
                    )}
                  </div>
                )) : (
                  <p className="col-span-3 text-center py-8 text-gray-500">No guest codes yet</p>
                )}
              </div>
            </div>
          )}

          {/* DELIVERIES TAB */}
          {activeTab === 'deliveries' && (
            <div className="space-y-6">
              <h3 className="font-semibold text-gray-900">Pending Deliveries by Company</h3>
              {Object.keys(deliveriesByCompany).length > 0 ? (
                Object.entries(deliveriesByCompany).map(([companyName, companyDeliveries]) => (
                  <div key={companyName} className="border-2 border-cyan-200 bg-cyan-50 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h4 className="font-semibold text-lg text-gray-900">{companyName}</h4>
                        <p className="text-sm text-gray-500">{companyDeliveries.length} order(s) pending</p>
                      </div>
                      <button
                        onClick={() => handleConfirmAllByCompany(companyName)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        ✅ Mark All Received
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {companyDeliveries.map((d, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-white rounded-lg border">
                          <div>
                            <p className="font-mono font-bold">#{d.orderNumber}</p>
                            <p className="text-sm text-gray-500">{d.employeeName || 'Employee'}</p>
                          </div>
                          <button
                            onClick={() => handleConfirmDelivery(d)}
                            className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            Confirm
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-2">📦</p>
                  <p className="text-gray-500">No pending deliveries</p>
                </div>
              )}
            </div>
          )}

          {/* ORDERS TAB */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <select
                  value={orderFilters.companyId}
                  onChange={e => setOrderFilters({ ...orderFilters, companyId: e.target.value, departmentId: '' })}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">All Companies</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select
                  value={orderFilters.departmentId}
                  onChange={e => setOrderFilters({ ...orderFilters, departmentId: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                  disabled={!orderFilters.companyId}
                >
                  <option value="">All Departments</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select
                  value={orderFilters.status}
                  onChange={e => setOrderFilters({ ...orderFilters, status: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="preparing">Preparing</option>
                  <option value="ready">Ready</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <input
                  type="date"
                  value={orderFilters.dateFrom}
                  onChange={e => setOrderFilters({ ...orderFilters, dateFrom: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="date"
                  value={orderFilters.dateTo}
                  onChange={e => setOrderFilters({ ...orderFilters, dateTo: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <p className="text-sm text-gray-500">Showing {filteredOrders.length} order(s)</p>
              
              {/* Orders Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Order</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Customer</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Company</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Department</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredOrders.slice(0, 50).map(o => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-gray-900">#{o.order_number || o.id?.slice(0, 8)}</td>
                        <td className="px-4 py-3 text-gray-600">{o.user_first_name} {o.user_last_name}</td>
                        <td className="px-4 py-3 text-gray-600">{o.company_name || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">{o.department_name || '-'}</td>
                        <td className="px-4 py-3 text-gray-500">{new Date(o.order_date || o.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            o.status === 'completed' ? 'bg-green-100 text-green-700' : 
                            o.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 
                            o.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              setSelectedOrder(o);
                              setIssueForm({ ...issueForm, orderId: o.id });
                              setShowIssueModal(true);
                            }}
                            className="text-orange-600 text-sm hover:underline"
                          >
                            🚨 Log Issue
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ISSUES TAB */}
          {activeTab === 'issues' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">Order Issues</h3>
                <button 
                  onClick={() => setShowIssueModal(true)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  + Log New Issue
                </button>
              </div>
              {issues.length > 0 ? issues.map(issue => (
                <div key={issue.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                  <div className="flex justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-gray-900">{issue.subject}</h4>
                      <p className="text-sm text-gray-500">{issue.user_name} • {issue.company_name || 'N/A'}</p>
                    </div>
                    <span className={`px-2 py-1 h-fit text-xs rounded-full ${
                      issue.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {issue.status}
                    </span>
                  </div>
                  <p className="text-gray-600">{issue.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(issue.created_at).toLocaleString()}</p>
                  {issue.status !== 'resolved' && (
                    <button 
                      onClick={() => handleResolve(issue)} 
                      className="mt-2 px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
                    >
                      ✅ Mark Resolved
                    </button>
                  )}
                </div>
              )) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-2">✅</p>
                  <p className="text-gray-500">No issues reported</p>
                </div>
              )}
            </div>
          )}

          {/* REPORTS TAB */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <h3 className="font-semibold text-gray-900">Generate Reports</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-xl">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Report Type</label>
                  <select
                    value={reportForm.type}
                    onChange={e => setReportForm({ ...reportForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="orders">Orders Report</option>
                    <option value="issues">Issues Report</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Group By</label>
                  <select
                    value={reportForm.groupBy}
                    onChange={e => setReportForm({ ...reportForm, groupBy: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="company">By Company</option>
                    <option value="department">By Department</option>
                    <option value="date">By Date</option>
                    <option value="meal_type">By Meal Type</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                  <input
                    type="date"
                    value={reportForm.dateFrom}
                    onChange={e => setReportForm({ ...reportForm, dateFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                  <input
                    type="date"
                    value={reportForm.dateTo}
                    onChange={e => setReportForm({ ...reportForm, dateTo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleGenerateReport}
                    disabled={reportLoading}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {reportLoading ? 'Loading...' : '📊 Generate'}
                  </button>
                </div>
              </div>

              {reportData && reportData.data && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex justify-between items-center p-4 bg-gray-50">
                    <h4 className="font-semibold text-gray-900">
                      {reportForm.type === 'orders' ? 'Orders' : 'Issues'} Report
                      <span className="font-normal text-gray-500 ml-2">({reportForm.dateFrom} to {reportForm.dateTo})</span>
                    </h4>
                    <button
                      onClick={exportReportCSV}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      📥 Export CSV
                    </button>
                  </div>
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">
                          {reportForm.groupBy === 'company' ? 'Company' : 
                           reportForm.groupBy === 'department' ? 'Department' :
                           reportForm.groupBy === 'date' ? 'Date' : 'Meal Type'}
                        </th>
                        <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase">Orders</th>
                        <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase">Total Value</th>
                        <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase">Completed</th>
                        <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase">Cancelled</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {reportData.data.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{row.name || 'N/A'}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{row.orderCount || 0}</td>
                          <td className="px-4 py-3 text-right text-gray-600">${(row.totalValue || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-green-600">{row.completedCount || 0}</td>
                          <td className="px-4 py-3 text-right text-red-600">{row.cancelledCount || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100">
                      <tr>
                        <td className="px-4 py-3 font-bold text-gray-900">TOTAL</td>
                        <td className="px-4 py-3 text-right font-bold">{reportData.data.reduce((s, r) => s + (r.orderCount || 0), 0)}</td>
                        <td className="px-4 py-3 text-right font-bold">${reportData.data.reduce((s, r) => s + (r.totalValue || 0), 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-bold text-green-600">{reportData.data.reduce((s, r) => s + (r.completedCount || 0), 0)}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">{reportData.data.reduce((s, r) => s + (r.cancelledCount || 0), 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* MENUS TAB */}
          {activeTab === 'menus' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {menus.length > 0 ? menus.map(m => (
                <div key={m.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                  <h3 className="font-semibold text-gray-900">{m.name}</h3>
                  <p className="text-sm text-gray-500">{m.meal_type || 'Lunch'} • {m.menu_type || 'Regular'}</p>
                  <span className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${
                    m.status === 'published' || m.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {m.status || (m.is_active ? 'Active' : 'Inactive')}
                  </span>
                </div>
              )) : (
                <p className="col-span-3 text-center py-8 text-gray-500">No menus available</p>
              )}
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">Code Usage Notifications</h3>
                <p className="text-sm text-gray-500">Codes used in the last hour</p>
              </div>
              {notifications.length > 0 ? notifications.map(notif => (
                <div 
                  key={notif.id}
                  className={`border rounded-xl p-4 ${notif.read ? 'border-gray-200 opacity-60' : 'border-blue-300 bg-blue-50'}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">🎟️ {notif.message}</p>
                      <p className="text-sm text-gray-500">{new Date(notif.time).toLocaleString()}</p>
                    </div>
                    {!notif.read && (
                      <button
                        onClick={() => markNotificationRead(notif.id)}
                        className="text-blue-600 text-sm hover:underline"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              )) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-2">🔔</p>
                  <p className="text-gray-500">No recent notifications</p>
                  <p className="text-sm text-gray-400">You'll see alerts here when guest codes are used</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== MODALS ===== */}

      {/* Generate Code Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Generate Guest Code</h2>
            <form onSubmit={handleGenerateCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Guest Name</label>
                <input 
                  placeholder="John Doe" 
                  value={codeForm.guestName} 
                  onChange={e => setCodeForm({ ...codeForm, guestName: e.target.value })} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Guest Email</label>
                <input 
                  type="email" 
                  placeholder="guest@example.com" 
                  value={codeForm.guestEmail} 
                  onChange={e => setCodeForm({ ...codeForm, guestEmail: e.target.value })} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg" 
                />
                <p className="text-xs text-gray-500 mt-1">Code will be emailed automatically</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valid Date</label>
                <input 
                  type="date" 
                  value={codeForm.validDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setCodeForm({ ...codeForm, validDate: e.target.value })} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cafeteria *</label>
                <select 
                  value={codeForm.cafeteriaId} 
                  onChange={e => setCodeForm({ ...codeForm, cafeteriaId: e.target.value })} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select Cafeteria</option>
                  {cafeterias.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowGenerateModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Generate</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && selectedCode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Email Guest Code</h2>
            <div className="text-center mb-4">
              <p className="font-mono text-3xl font-bold text-gray-900">{selectedCode.code}</p>
              <p className="text-gray-600 mt-2">Send to: {selectedCode.guestEmail}</p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowEmailModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleEmailCode} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">📧 Open Email</button>
            </div>
          </div>
        </div>
      )}

      {/* Log Issue Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Log Order Issue</h2>
            {selectedOrder && (
              <div className="p-3 bg-gray-50 rounded-lg mb-4">
                <p className="font-medium">Order #{selectedOrder.order_number || selectedOrder.id?.slice(0, 8)}</p>
                <p className="text-sm text-gray-500">{selectedOrder.user_first_name} {selectedOrder.user_last_name}</p>
              </div>
            )}
            <form onSubmit={handleCreateIssue} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                <input 
                  placeholder="e.g., Wrong item delivered" 
                  value={issueForm.subject} 
                  onChange={e => setIssueForm({ ...issueForm, subject: e.target.value })} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea 
                  placeholder="Describe the issue..." 
                  value={issueForm.description} 
                  onChange={e => setIssueForm({ ...issueForm, description: e.target.value })} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg h-24"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select 
                  value={issueForm.priority} 
                  onChange={e => setIssueForm({ ...issueForm, priority: e.target.value })} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="low">🟢 Low</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="high">🔴 High</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => { setShowIssueModal(false); setSelectedOrder(null); setIssueForm({ orderId: '', subject: '', description: '', priority: 'medium' }); }} 
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">🚨 Log Issue</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
