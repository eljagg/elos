import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { orderAPI, menuAPI, messageAPI, companyAPI, deliveryAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function ReceptionistDashboard() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'codes');
  const [loading, setLoading] = useState(true);
  const [guestCodes, setGuestCodes] = useState([]);
  const [menus, setMenus] = useState([]);
  const [orders, setOrders] = useState([]);
  const [issues, setIssues] = useState([]);
  const [cafeterias, setCafeterias] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [pendingDeliveries, setPendingDeliveries] = useState([]);
  const [stats, setStats] = useState({ activeCodes: 0, usedToday: 0, totalOrders: 0, pendingDeliveries: 0, openIssues: 0 });

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedCode, setSelectedCode] = useState(null);
  const [codeForm, setCodeForm] = useState({ cafeteriaId: '', validDate: '', guestName: '', guestEmail: '' });

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => { loadData(); }, []);

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
        pendingDeliveries: pending.length 
      });
    } catch (e) { 
      console.error('Error loading data:', e); 
    } finally { 
      setLoading(false); 
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
          <p className="text-gray-500">Guest codes, deliveries, and orders</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
          {['codes', 'deliveries', 'menus', 'orders', 'issues'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)} 
              className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 ${
                activeTab === tab 
                  ? 'border-indigo-500 text-indigo-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'codes' && '🎟️ Guest Codes'}
              {tab === 'deliveries' && '📦 Deliveries'}
              {tab === 'menus' && '📋 Menus'}
              {tab === 'orders' && '📦 Orders'}
              {tab === 'issues' && '⚠️ Issues'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* GUEST CODES TAB */}
          {activeTab === 'codes' && (
            <div className="space-y-4">
              <div className="flex justify-end">
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
                    <p className="text-sm text-gray-600">{code.guestName || 'Guest'}</p>
                    <p className="text-sm text-gray-500">{code.validDate || 'Today'}</p>
                    {!code.is_used && code.guestEmail && (
                      <button 
                        onClick={() => { setSelectedCode(code); setShowEmailModal(true); }} 
                        className="mt-2 text-blue-600 text-sm hover:underline"
                      >
                        📧 Email Code
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
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Pending Confirmations</h3>
              {pendingDeliveries.length > 0 ? pendingDeliveries.map((d, i) => (
                <div key={i} className="border-2 border-cyan-200 bg-cyan-50 rounded-xl p-4">
                  <div className="flex justify-between mb-2">
                    <div>
                      <p className="font-mono font-bold">#{d.orderNumber}</p>
                      <p className="text-sm text-gray-500">{d.companyName}</p>
                    </div>
                    <span className="px-2 py-1 text-xs rounded-full bg-cyan-200 text-cyan-800">Awaiting</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">🚗 {d.deliveryPersonPlate || 'N/A'}</p>
                  <button 
                    onClick={() => handleConfirmDelivery(d)} 
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    ✅ Confirm Delivery
                  </button>
                </div>
              )) : (
                <p className="text-gray-500 text-center py-8">No pending deliveries</p>
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
                          o.status === 'completed' ? 'bg-green-100 text-green-700' : 
                          o.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 
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
