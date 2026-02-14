import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { orderAPI, menuAPI, messageAPI, companyAPI, deliveryAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import toast from 'react-hot-toast';

export default function ReceptionistDashboard() {
  const { colors, getStatCardColors } = useTheme();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'codes');
  
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);
  const [loading, setLoading] = useState(true);
  const [guestCodes, setGuestCodes] = useState([]);
  const [menus, setMenus] = useState([]);
  const [orders, setOrders] = useState([]);
  const [issues, setIssues] = useState([]);
  const [cafeterias, setCafeterias] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState({});
  const [pendingDeliveries, setPendingDeliveries] = useState([]);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedCode, setSelectedCode] = useState(null);
  const [codeForm, setCodeForm] = useState({ cafeteriaId: '', validDate: '', guestName: '', guestEmail: '' });

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
      const codes = codesRes.data?.data?.codes || JSON.parse(localStorage.getItem('guestCodes') || '[]');
      setGuestCodes(codes);
      setMenus(menusRes.data?.data?.menus || []);
      setOrders(ordersRes.data?.data?.orders || []);
      setIssues((issuesRes.data?.data?.feedback || []).filter(f => f.type === 'issue'));
      setCafeterias(cafeteriasRes.data?.data?.cafeterias || []);
      setCompanies(companiesRes.data?.data?.companies || []);
      
      // Get pending deliveries from API, fallback to localStorage
      const apiPending = pendingRes.data?.data?.pendingConfirmations || [];
      const localPending = JSON.parse(localStorage.getItem('pendingDeliveryConfirmations') || '[]');
      const pending = apiPending.length > 0 ? apiPending : localPending;
      setPendingDeliveries(pending);
      
      const today = new Date().toDateString();
      setStats({ activeCodes: codes.filter(c => !c.is_used).length, usedToday: codes.filter(c => c.is_used && c.used_at && new Date(c.used_at).toDateString() === today).length, totalOrders: (ordersRes.data?.data?.orders || []).length, openIssues: (issuesRes.data?.data?.feedback || []).filter(f => f.status !== 'resolved').length, pendingDeliveries: pending.length });
    } catch (e) { console.error(e); } finally { setLoading(false); }
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
      const code = guestCode?.code || response.data?.data?.code || response.data?.code;
      
      if (guestCode?.emailSent) {
        toast.success(`Code ${code} generated and emailed to ${codeForm.guestEmail}!`);
      } else if (codeForm.guestEmail) {
        toast.success(`Code ${code} generated! Email could not be sent - you can email manually.`);
      } else {
        toast.success(`Code generated: ${code}`);
      }
      
      setShowGenerateModal(false); 
      setCodeForm({ cafeteriaId: '', validDate: '', guestName: '', guestEmail: '' }); 
      loadData();
    } catch (error) {
      console.error('Failed to generate code:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to generate code. Please try again.');
    }
  };
  
  const handleEmailCode = async () => { 
    // This is now a fallback - server should have sent email already
    // But keep it for manual re-send
    const subject = encodeURIComponent(`Your Guest Lunch Code: ${selectedCode.code}`);
    const body = encodeURIComponent(
      `Hello ${selectedCode.guestName || ''},\n\n` +
      `Your guest code for lunch ordering is: ${selectedCode.code}\n\n` +
      `Valid Date: ${selectedCode.validDate || 'Today'}\n` +
      `This code can only be used once and expires at end of day.\n\n` +
      `To order, visit: ${window.location.origin}/guest\n\n` +
      `Regards,\nELOS System`
    );
    window.location.href = `mailto:${selectedCode.guestEmail}?subject=${subject}&body=${body}`; 
    setShowEmailModal(false); 
  };
  const handleConfirmDelivery = async (delivery) => { 
    try {
      // Try API first
      await deliveryAPI.confirmDelivery(delivery.orderId);
    } catch (error) {
      console.error('API confirm failed, using localStorage:', error);
    }
    // Also update localStorage as backup
    const tracking = JSON.parse(localStorage.getItem('deliveryTracking') || '{}'); 
    if (tracking[delivery.orderId]) { 
      tracking[delivery.orderId].confirmed = true; 
      tracking[delivery.orderId].confirmedAt = new Date().toISOString(); 
      localStorage.setItem('deliveryTracking', JSON.stringify(tracking)); 
    } 
    const pending = JSON.parse(localStorage.getItem('pendingDeliveryConfirmations') || '[]').filter(p => p.orderId !== delivery.orderId); 
    localStorage.setItem('pendingDeliveryConfirmations', JSON.stringify(pending)); 
    toast.success('Confirmed'); 
    loadData(); 
  };
  const handleResolve = async (issue) => { try { await messageAPI.updateFeedbackStatus(issue.id, 'resolved'); toast.success('Resolved'); loadData(); } catch { toast.error('Failed'); } };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><div><h1 className={`text-2xl font-bold ${colors.textPrimary}`}>Reception Dashboard</h1><p className={colors.textMuted}>Guest codes and deliveries</p></div></div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[{ l: 'Active Codes', v: stats.activeCodes }, { l: 'Used Today', v: stats.usedToday }, { l: 'Orders', v: stats.totalOrders }, { l: 'Deliveries', v: stats.pendingDeliveries }, { l: 'Issues', v: stats.openIssues }].map((s, i) => { const c = getStatCardColors(i); return <div key={i} className={`${c.bg} rounded-xl p-4 border-l-4 ${c.border}`}><p className={`text-sm ${c.text} opacity-80`}>{s.l}</p><p className={`text-2xl font-bold ${c.text}`}>{s.v}</p></div>; })}
      </div>

      <div className={`${colors.bgCard} rounded-xl shadow-sm border ${colors.border}`}>
        <div className={`border-b ${colors.border} flex overflow-x-auto`}>{[{ id: 'codes', l: '🎟️ Guest Codes' }, { id: 'deliveries', l: '📦 Deliveries' }, { id: 'menus', l: '📋 Menus' }, { id: 'orders', l: '📦 Orders' }, { id: 'issues', l: '⚠️ Issues' }].map(t => <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === t.id ? 'border-indigo-500 text-indigo-600' : `border-transparent ${colors.textMuted}`}`}>{t.l}</button>)}</div>

        <div className="p-6">
          {activeTab === 'codes' && (
            <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => setShowGenerateModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">+ Generate Code</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {guestCodes.map(code => (
                  <div key={code.id} className={`border ${colors.border} rounded-xl p-4 ${code.is_used ? 'opacity-60' : colors.bgCard}`}>
                    <div className="flex justify-between items-start mb-2"><p className={`font-mono text-2xl font-bold ${colors.textPrimary}`}>{code.code}</p><span className={`px-2 py-1 text-xs rounded-full ${code.is_used ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>{code.is_used ? 'Used' : 'Active'}</span></div>
                    <p className={`text-sm ${colors.textSecondary}`}>{code.guestName || 'Guest'}</p>
                    <p className={`text-sm ${colors.textMuted}`}>{code.validDate || 'Today'}</p>
                    {!code.is_used && code.guestEmail && <button onClick={() => { setSelectedCode(code); setShowEmailModal(true); }} className="mt-2 text-blue-600 text-sm">📧 Email Code</button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'deliveries' && (
            <div className="space-y-4">
              <h3 className={`font-semibold ${colors.textPrimary}`}>Pending Confirmations</h3>
              {pendingDeliveries.length > 0 ? pendingDeliveries.map((d, i) => (
                <div key={i} className="border-2 border-cyan-200 bg-cyan-50 rounded-xl p-4">
                  <div className="flex justify-between mb-2"><div><p className="font-mono font-bold">#{d.orderNumber}</p><p className={`text-sm ${colors.textMuted}`}>{d.companyName}</p></div><span className="px-2 py-1 text-xs rounded-full bg-cyan-200 text-cyan-800">Awaiting</span></div>
                  <p className={`text-sm ${colors.textSecondary} mb-2`}>🚗 {d.deliveryPersonPlate || 'N/A'}</p>
                  <button onClick={() => handleConfirmDelivery(d)} className="w-full px-4 py-2 bg-green-600 text-white rounded-lg">✅ Confirm Delivery</button>
                </div>
              )) : <p className={colors.textMuted}>No pending deliveries</p>}
            </div>
          )}

          {activeTab === 'menus' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {menus.map(m => <div key={m.id} className={`border ${colors.border} rounded-xl p-4 ${colors.bgCard}`}><h3 className={`font-semibold ${colors.textPrimary}`}>{m.name}</h3><p className={`text-sm ${colors.textMuted}`}>{m.meal_type} • {m.menu_type || 'Regular'}</p><span className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{m.is_active ? 'Active' : 'Inactive'}</span></div>)}
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="overflow-x-auto">
              <table className="w-full"><thead className={colors.bgSecondary}><tr><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Order</th><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Customer</th><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Company</th><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Status</th></tr></thead>
                <tbody className={`divide-y ${colors.border}`}>{orders.slice(0, 20).map(o => <tr key={o.id}><td className={`px-4 py-3 font-mono ${colors.textPrimary}`}>#{o.order_number || o.id?.slice(0, 8)}</td><td className={`px-4 py-3 ${colors.textSecondary}`}>{o.user_first_name} {o.user_last_name}</td><td className={`px-4 py-3 ${colors.textSecondary}`}>{o.company_name || '-'}</td><td className="px-4 py-3"><span className={`px-2 py-1 text-xs rounded-full ${o.status === 'completed' ? 'bg-green-100 text-green-700' : o.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{o.status}</span></td></tr>)}</tbody>
              </table>
            </div>
          )}

          {activeTab === 'issues' && (
            <div className="space-y-4">
              {issues.length > 0 ? issues.map(issue => <div key={issue.id} className={`border ${colors.border} rounded-xl p-4 ${colors.bgCard}`}><div className="flex justify-between mb-2"><div><h3 className={`font-semibold ${colors.textPrimary}`}>{issue.subject}</h3><p className={`text-sm ${colors.textMuted}`}>{issue.user_name}</p></div><span className={`px-2 py-1 text-xs rounded-full ${issue.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{issue.status}</span></div><p className={colors.textSecondary}>{issue.message}</p>{issue.status !== 'resolved' && <button onClick={() => handleResolve(issue)} className="mt-2 px-3 py-1 bg-green-100 text-green-700 rounded text-sm">Resolve</button>}</div>) : <p className={colors.textMuted}>No issues</p>}
            </div>
          )}
        </div>
      </div>

      {showGenerateModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-md`}><h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>Generate Guest Code</h2><form onSubmit={handleGenerateCode} className="space-y-4"><input placeholder="Guest Name" value={codeForm.guestName} onChange={e => setCodeForm({ ...codeForm, guestName: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} /><input type="email" placeholder="Guest Email" value={codeForm.guestEmail} onChange={e => setCodeForm({ ...codeForm, guestEmail: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} /><input type="date" value={codeForm.validDate} onChange={e => setCodeForm({ ...codeForm, validDate: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} /><select value={codeForm.cafeteriaId} onChange={e => setCodeForm({ ...codeForm, cafeteriaId: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`}><option value="">Select Cafeteria</option>{cafeterias.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="flex justify-end gap-3"><button type="button" onClick={() => setShowGenerateModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Generate</button></div></form></div></div>}

      {showEmailModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-md`}><h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>Email Code</h2><p className={colors.textSecondary}>Send code <strong>{selectedCode?.code}</strong> to {selectedCode?.guestEmail}?</p><div className="flex justify-end gap-3 mt-4"><button onClick={() => setShowEmailModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button onClick={handleEmailCode} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Open Email</button></div></div></div>}
    </div>
  );
}
