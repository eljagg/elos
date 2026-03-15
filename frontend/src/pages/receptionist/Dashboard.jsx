import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { orderAPI, menuAPI, messageAPI, companyAPI, deliveryAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function ReceptionistDashboard() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'verify');
  const [loading, setLoading] = useState(true);
  const [guestCodes, setGuestCodes] = useState([]);
  const [menus, setMenus] = useState([]);
  const [orders, setOrders] = useState([]);
  const [issues, setIssues] = useState([]);
  const [cafeterias, setCafeterias] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [pendingDeliveries, setPendingDeliveries] = useState([]);
  const [stats, setStats] = useState({ activeCodes: 0, usedToday: 0, totalOrders: 0, pendingDeliveries: 0, openIssues: 0, pendingVerification: 0 });

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedCode, setSelectedCode] = useState(null);
  const [codeForm, setCodeForm] = useState({ cafeteriaId: '', validDate: '', guestName: '', guestEmail: '' });

  // Delivery verification state
  const [verificationOrders, setVerificationOrders] = useState([]);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [checkedOrders, setCheckedOrders] = useState(new Set());
  const [missingOrders, setMissingOrders] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [verificationComplete, setVerificationComplete] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => { loadData(); }, []);

  // Load verification orders when tab is active
  useEffect(() => {
    if (activeTab === 'verify') {
      loadVerificationOrders();
    }
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [codesRes, menusRes, ordersRes, issuesRes, cafeteriasRes, companiesRes, pendingRes] = await Promise.all([
        orderAPI.getGuestCodes().catch(() => ({ data: { data: { codes: [] } } })),
        menuAPI.getMenus().catch(() => ({ data: { data: { menus: [] } } })),
        orderAPI.getOrders({ limit: 200 }).catch(() => ({ data: { data: { orders: [] } } })),
        messageAPI.getFeedback().catch(() => ({ data: { data: { feedback: [] } } })),
        companyAPI.getCafeterias().catch(() => ({ data: { data: { cafeterias: [] } } })),
        companyAPI.getCompanies().catch(() => ({ data: { data: { companies: [] } } })),
        deliveryAPI.getPendingConfirmations().catch(() => ({ data: { data: { pendingConfirmations: [] } } }))
      ]);
      
      const codes = codesRes.data?.data?.codes || [];
      setGuestCodes(codes);
      setMenus(menusRes.data?.data?.menus || []);
      setOrders(ordersRes.data?.data?.orders || []);
      setIssues((issuesRes.data?.data?.feedback || []).filter(f => f.type === 'issue'));
      setCafeterias(cafeteriasRes.data?.data?.cafeterias || []);
      setCompanies(companiesRes.data?.data?.companies || []);
      
      const apiPending = pendingRes.data?.data?.pendingConfirmations || [];
      const localPending = JSON.parse(localStorage.getItem('pendingDeliveryConfirmations') || '[]');
      const pending = apiPending.length > 0 ? apiPending : localPending;
      setPendingDeliveries(pending);
      
      const today = new Date().toDateString();
      setStats({ 
        activeCodes: codes.filter(c => !c.is_used).length, 
        usedToday: codes.filter(c => c.is_used && c.used_at && new Date(c.used_at).toDateString() === today).length, 
        totalOrders: (ordersRes.data?.data?.orders || []).length, 
        openIssues: (issuesRes.data?.data?.feedback || []).filter(f => f.status !== 'resolved').length, 
        pendingDeliveries: pending.length,
        pendingVerification: 0 // Updated after verification load
      });
    } catch (e) { 
      console.error('Error loading data:', e); 
    } finally { 
      setLoading(false); 
    }
  };

  const loadVerificationOrders = async () => {
    setVerificationLoading(true);
    try {
      const response = await deliveryAPI.getPendingVerification();
      const orders = response.data?.data?.orders || [];
      setVerificationOrders(orders);
      setCheckedOrders(new Set());
      setMissingOrders(new Set());
      setVerificationComplete(false);
      setStats(prev => ({ ...prev, pendingVerification: orders.length }));
    } catch (error) {
      console.error('Failed to load verification orders:', error);
      // Don't show error toast - endpoint may not exist yet
      setVerificationOrders([]);
    } finally {
      setVerificationLoading(false);
    }
  };

  const toggleOrderChecked = (orderId) => {
    setCheckedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
        // Remove from missing if it was there
        setMissingOrders(p => {
          const n = new Set(p);
          n.delete(orderId);
          return n;
        });
      }
      return next;
    });
  };

  const toggleOrderMissing = (orderId) => {
    setMissingOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
        // Remove from checked if it was there
        setCheckedOrders(p => {
          const n = new Set(p);
          n.delete(orderId);
          return n;
        });
      }
      return next;
    });
  };

  const selectAllArrived = () => {
    const allIds = new Set(verificationOrders.map(o => o.id));
    setCheckedOrders(allIds);
    setMissingOrders(new Set());
  };

  const clearAllSelections = () => {
    setCheckedOrders(new Set());
    setMissingOrders(new Set());
  };

  const handleVerifyAndNotify = async () => {
    if (checkedOrders.size === 0 && missingOrders.size === 0) {
      toast.error('Please check off arrived orders or flag missing ones first');
      return;
    }

    const unprocessed = verificationOrders.filter(
      o => !checkedOrders.has(o.id) && !missingOrders.has(o.id)
    );

    if (unprocessed.length > 0) {
      const proceed = window.confirm(
        `${unprocessed.length} order(s) haven't been checked or flagged. They will NOT be processed.\n\nContinue with ${checkedOrders.size} arrived + ${missingOrders.size} missing?`
      );
      if (!proceed) return;
    }

    setSubmitting(true);
    try {
      const response = await deliveryAPI.verifyAndNotify(
        Array.from(checkedOrders),
        Array.from(missingOrders)
      );
      
      const data = response.data?.data || {};
      toast.success(
        `✅ ${data.notifiedCount || 0} employees notified! ${data.issueCount ? `⚠️ ${data.issueCount} issues flagged.` : ''}`,
        { duration: 5000 }
      );
      
      setVerificationComplete(true);
      // Refresh data
      loadVerificationOrders();
      loadData();
    } catch (error) {
      console.error('Verification failed:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to verify deliveries');
    } finally {
      setSubmitting(false);
    }
  };

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

  const handleResolve = async (issue) => { 
    try { 
      await messageAPI.updateFeedbackStatus(issue.id, 'resolved'); 
      toast.success('Resolved'); 
      loadData(); 
    } catch (e) { 
      toast.error('Failed'); 
    } 
  };

  // Group verification orders by company
  const groupedVerificationOrders = verificationOrders.reduce((acc, order) => {
    const company = order.company_name || 'Other';
    if (!acc[company]) acc[company] = [];
    acc[company].push(order);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reception Dashboard</h1>
          <p className="text-gray-500">Delivery verification, guest codes, and orders</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-emerald-50 rounded-xl p-4 border-l-4 border-emerald-400 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('verify')}>
          <p className="text-sm text-emerald-700 opacity-80">📋 Verify Delivery</p>
          <p className="text-2xl font-bold text-emerald-700">{stats.pendingVerification}</p>
        </div>
        <div className="bg-indigo-50 rounded-xl p-4 border-l-4 border-indigo-400">
          <p className="text-sm text-indigo-700 opacity-80">🎟️ Active Codes</p>
          <p className="text-2xl font-bold text-indigo-700">{stats.activeCodes}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-400">
          <p className="text-sm text-green-700 opacity-80">✅ Used Today</p>
          <p className="text-2xl font-bold text-green-700">{stats.usedToday}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-400">
          <p className="text-sm text-blue-700 opacity-80">📦 Orders</p>
          <p className="text-2xl font-bold text-blue-700">{stats.totalOrders}</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-4 border-l-4 border-orange-400">
          <p className="text-sm text-orange-700 opacity-80">⚠️ Issues</p>
          <p className="text-2xl font-bold text-orange-700">{stats.openIssues}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 flex overflow-x-auto">
          {['verify', 'codes', 'deliveries', 'orders', 'issues'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)} 
              className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 ${
                activeTab === tab 
                  ? 'border-indigo-600 text-indigo-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'verify' && '📋 Verify Delivery'}
              {tab === 'codes' && '🎟️ Guest Codes'}
              {tab === 'deliveries' && '🚚 Deliveries'}
              {tab === 'orders' && '📦 Orders'}
              {tab === 'issues' && '⚠️ Issues'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* VERIFY DELIVERY TAB */}
          {activeTab === 'verify' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Delivery Verification Checklist</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Check off each order that arrived, flag any missing orders, then notify employees.
                  </p>
                </div>
                <button 
                  onClick={loadVerificationOrders} 
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  🔄 Refresh
                </button>
              </div>

              {verificationLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <span className="ml-3 text-gray-500">Loading orders...</span>
                </div>
              ) : verificationOrders.length === 0 ? (
                <div className="text-center py-16">
                  <span className="text-5xl">✅</span>
                  <h3 className="text-lg font-semibold text-gray-900 mt-4">No Orders Pending Verification</h3>
                  <p className="text-gray-500 mt-2">
                    {verificationComplete 
                      ? "All deliveries have been verified and employees notified!"
                      : "There are no confirmed/ready orders for today that need verification."}
                  </p>
                </div>
              ) : (
                <>
                  {/* Quick actions */}
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
                    <button 
                      onClick={selectAllArrived}
                      className="px-3 py-1.5 text-sm bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
                    >
                      ✅ Select All Arrived
                    </button>
                    <button 
                      onClick={clearAllSelections}
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Clear All
                    </button>
                    <div className="flex-1" />
                    <span className="text-sm text-gray-500">
                      {checkedOrders.size} arrived · {missingOrders.size} missing · {verificationOrders.length - checkedOrders.size - missingOrders.size} unchecked
                    </span>
                  </div>

                  {/* Orders grouped by company */}
                  <div className="space-y-6">
                    {Object.entries(groupedVerificationOrders).map(([company, companyOrders]) => (
                      <div key={company}>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                          🏢 {company} ({companyOrders.length})
                        </h3>
                        <div className="space-y-2">
                          {companyOrders.map(order => {
                            const isChecked = checkedOrders.has(order.id);
                            const isMissing = missingOrders.has(order.id);
                            
                            return (
                              <div 
                                key={order.id}
                                className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                                  isChecked 
                                    ? 'border-emerald-300 bg-emerald-50' 
                                    : isMissing 
                                    ? 'border-red-300 bg-red-50' 
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                              >
                                {/* Arrived checkbox */}
                                <button 
                                  onClick={() => toggleOrderChecked(order.id)}
                                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all flex-shrink-0 ${
                                    isChecked 
                                      ? 'bg-emerald-500 text-white shadow-md' 
                                      : 'bg-gray-100 text-gray-400 hover:bg-emerald-100 hover:text-emerald-600'
                                  }`}
                                  title="Mark as arrived"
                                >
                                  {isChecked ? '✓' : '○'}
                                </button>

                                {/* Order details */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-900">
                                      {order.first_name} {order.last_name}
                                    </span>
                                    <span className="text-xs font-mono text-gray-400">
                                      #{order.order_number}
                                    </span>
                                    {order.department_name && (
                                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                        {order.department_name}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-500 mt-1">
                                    {order.items && Array.isArray(order.items) ? (
                                      order.items.map((item, i) => (
                                        <span key={i}>
                                          {i > 0 && ' · '}
                                          {item.quantity > 1 ? `${item.quantity}× ` : ''}{item.name}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="italic">Order items</span>
                                    )}
                                  </div>
                                  {order.notes && (
                                    <p className="text-xs text-amber-600 mt-1">📝 {order.notes}</p>
                                  )}
                                </div>

                                {/* Status badge */}
                                <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                                  order.status === 'ready' ? 'bg-green-100 text-green-700' :
                                  order.status === 'preparing' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {order.status}
                                </span>

                                {/* Missing button */}
                                <button 
                                  onClick={() => toggleOrderMissing(order.id)}
                                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${
                                    isMissing 
                                      ? 'bg-red-500 text-white shadow-md' 
                                      : 'bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600'
                                  }`}
                                  title="Flag as missing"
                                >
                                  {isMissing ? '⚠️ Missing' : 'Flag'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Submit bar */}
                  <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        <strong className="text-emerald-600">{checkedOrders.size}</strong> orders arrived
                        {missingOrders.size > 0 && (
                          <> · <strong className="text-red-600">{missingOrders.size}</strong> missing</>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Employees will receive an in-app notification and email
                      </p>
                    </div>
                    <button
                      onClick={handleVerifyAndNotify}
                      disabled={submitting || (checkedOrders.size === 0 && missingOrders.size === 0)}
                      className={`px-6 py-3 rounded-xl font-semibold text-white transition-all ${
                        submitting || (checkedOrders.size === 0 && missingOrders.size === 0)
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg hover:shadow-xl'
                      }`}
                    >
                      {submitting ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin">⏳</span> Notifying...
                        </span>
                      ) : (
                        `✅ Verify & Notify Employees`
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* GUEST CODES TAB */}
          {activeTab === 'codes' && (
            <div>
              <div className="flex justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Guest Codes</h2>
                <button onClick={() => setShowGenerateModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">+ Generate Code</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {guestCodes.length > 0 ? guestCodes.map(code => (
                  <div key={code.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                    <div className="flex justify-between items-start mb-2">
                      <code className="text-xl font-bold text-indigo-600">{code.code}</code>
                      <span className={`px-2 py-1 text-xs rounded-full ${code.is_used ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>
                        {code.is_used ? 'Used' : 'Active'}
                      </span>
                    </div>
                    {code.guest_name && <p className="text-sm text-gray-600">👤 {code.guest_name}</p>}
                    {code.guest_email && (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-500">✉️ {code.guest_email}</p>
                        <button onClick={() => { setSelectedCode(code); setShowEmailModal(true); }} className="text-xs text-indigo-600 hover:underline">Send</button>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-2">Valid: {code.valid_date || code.validDate || 'Today'}</p>
                  </div>
                )) : (
                  <p className="col-span-3 text-center py-8 text-gray-500">No guest codes yet</p>
                )}
              </div>
            </div>
          )}

          {/* DELIVERIES TAB */}
          {activeTab === 'deliveries' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Pending Delivery Confirmations</h2>
              {pendingDeliveries.length > 0 ? pendingDeliveries.map((delivery, i) => (
                <div key={i} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-white">
                  <div>
                    <p className="font-semibold text-gray-900">Order #{delivery.orderNumber || delivery.orderId?.slice(0, 8)}</p>
                    <p className="text-sm text-gray-500">{delivery.customerName || 'Customer'} • {delivery.company || ''}</p>
                  </div>
                  <button 
                    onClick={() => handleConfirmDelivery(delivery)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    ✅ Confirm Delivery
                  </button>
                </div>
              )) : (
                <p className="text-gray-500 text-center py-8">No pending deliveries</p>
              )}
            </div>
          )}

          {/* ORDERS TAB */}
          {activeTab === 'orders' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Order</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Company</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.slice(0, 20).map(o => (
                    <tr key={o.id}>
                      <td className="px-4 py-3 font-mono text-gray-900">#{o.order_number || o.id?.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-gray-600">{o.user_first_name} {o.user_last_name}</td>
                      <td className="px-4 py-3 text-gray-600">{o.company_name || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          o.status === 'completed' || o.status === 'delivered' ? 'bg-green-100 text-green-700' : 
                          o.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 
                          o.status === 'issue_reported' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ISSUES TAB */}
          {activeTab === 'issues' && (
            <div className="space-y-4">
              {issues.length > 0 ? issues.map(issue => (
                <div key={issue.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                  <div className="flex justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{issue.subject}</h3>
                      <p className="text-sm text-gray-500">{issue.user_name}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      issue.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {issue.status}
                    </span>
                  </div>
                  <p className="text-gray-600">{issue.message}</p>
                  {issue.status !== 'resolved' && (
                    <button 
                      onClick={() => handleResolve(issue)} 
                      className="mt-2 px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              )) : (
                <p className="text-gray-500 text-center py-8">No issues</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Generate Code Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Generate Guest Code</h2>
            <form onSubmit={handleGenerateCode} className="space-y-4">
              <input 
                placeholder="Guest Name" 
                value={codeForm.guestName} 
                onChange={e => setCodeForm({ ...codeForm, guestName: e.target.value })} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg" 
              />
              <input 
                type="email" 
                placeholder="Guest Email" 
                value={codeForm.guestEmail} 
                onChange={e => setCodeForm({ ...codeForm, guestEmail: e.target.value })} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg" 
              />
              <input 
                type="date" 
                value={codeForm.validDate} 
                onChange={e => setCodeForm({ ...codeForm, validDate: e.target.value })} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg" 
              />
              <select 
                value={codeForm.cafeteriaId} 
                onChange={e => setCodeForm({ ...codeForm, cafeteriaId: e.target.value })} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                required
              >
                <option value="">Select Cafeteria</option>
                {cafeterias.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowGenerateModal(false)} 
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
                >
                  Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && selectedCode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Email Code</h2>
            <p className="text-gray-600">
              Send code <strong>{selectedCode.code}</strong> to {selectedCode.guestEmail}?
            </p>
            <div className="flex justify-end gap-3 mt-4">
              <button 
                onClick={() => setShowEmailModal(false)} 
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                Cancel
              </button>
              <button 
                onClick={handleEmailCode} 
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
              >
                Open Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
