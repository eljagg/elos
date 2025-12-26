/**
 * Receptionist Dashboard - Guest & Visitor Management
 */

import { useState, useEffect } from 'react';
import { guestAPI, companyAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function ReceptionistDashboard() {
  const [activeTab, setActiveTab] = useState('visitors');
  const [loading, setLoading] = useState(true);
  const [visitors, setVisitors] = useState([]);
  const [guestCodes, setGuestCodes] = useState([]);
  const [cafeterias, setCafeterias] = useState([]);
  const [stats, setStats] = useState({ todayVisitors: 0, checkedIn: 0, activeCodes: 0 });

  const [showAddVisitor, setShowAddVisitor] = useState(false);
  const [showGenerateCode, setShowGenerateCode] = useState(false);
  const [visitorForm, setVisitorForm] = useState({ name: '', company: '', hostName: '', purpose: '', phone: '', email: '' });
  const [codeForm, setCodeForm] = useState({ cafeteriaId: '', validDate: new Date().toISOString().split('T')[0], quantity: 1 });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [visitorsRes, codesRes, cafeteriasRes] = await Promise.all([
        guestAPI.getVisitors({ date: new Date().toISOString().split('T')[0] }).catch(() => ({ data: { data: { visitors: [] } } })),
        guestAPI.getCodes({ status: 'active' }).catch(() => ({ data: { data: { codes: [] } } })),
        companyAPI.getCafeterias().catch(() => ({ data: { data: { cafeterias: [] } } }))
      ]);
      const vis = visitorsRes.data?.data?.visitors || [];
      const codes = codesRes.data?.data?.codes || [];
      setVisitors(vis);
      setGuestCodes(codes);
      setCafeterias(cafeteriasRes.data?.data?.cafeterias || []);
      setStats({
        todayVisitors: vis.length,
        checkedIn: vis.filter(v => !v.checkout_time).length,
        activeCodes: codes.filter(c => c.status === 'active' && !c.is_used).length
      });
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVisitor = async (e) => {
    e.preventDefault();
    try {
      await guestAPI.createVisitor(visitorForm);
      toast.success('Visitor checked in');
      setShowAddVisitor(false);
      setVisitorForm({ name: '', company: '', hostName: '', purpose: '', phone: '', email: '' });
      loadData();
    } catch (error) { toast.error('Failed to add visitor'); }
  };

  const handleCheckout = async (visitorId) => {
    try {
      await guestAPI.checkoutVisitor(visitorId);
      toast.success('Visitor checked out');
      loadData();
    } catch (error) { toast.error('Failed to checkout visitor'); }
  };

  const handleGenerateCode = async (e) => {
    e.preventDefault();
    try {
      const response = await guestAPI.generateCode(codeForm);
      toast.success(`Guest code generated: ${response.data?.data?.code || 'Success'}`);
      setShowGenerateCode(false);
      setCodeForm({ cafeteriaId: '', validDate: new Date().toISOString().split('T')[0], quantity: 1 });
      loadData();
    } catch (error) { toast.error('Failed to generate code'); }
  };

  const handleRevokeCode = async (codeId) => {
    if (!confirm('Revoke this code?')) return;
    try {
      await guestAPI.revokeCode(codeId);
      toast.success('Code revoked');
      loadData();
    } catch (error) { toast.error('Failed to revoke code'); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reception Dashboard</h1>
          <p className="text-gray-500">Manage visitors and guest meal codes</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowAddVisitor(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Check In Visitor</button>
          <button onClick={() => setShowGenerateCode(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">+ Generate Code</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500">
          <p className="text-sm text-blue-600">Today's Visitors</p>
          <p className="text-3xl font-bold text-blue-700">{stats.todayVisitors}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-6 border-l-4 border-green-500">
          <p className="text-sm text-green-600">Currently Checked In</p>
          <p className="text-3xl font-bold text-green-700">{stats.checkedIn}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-6 border-l-4 border-purple-500">
          <p className="text-sm text-purple-600">Active Guest Codes</p>
          <p className="text-3xl font-bold text-purple-700">{stats.activeCodes}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b flex">
          <button onClick={() => setActiveTab('visitors')} className={`px-6 py-4 text-sm font-medium border-b-2 ${activeTab === 'visitors' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
            👥 Visitors
          </button>
          <button onClick={() => setActiveTab('codes')} className={`px-6 py-4 text-sm font-medium border-b-2 ${activeTab === 'codes' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
            🎟️ Guest Codes
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'visitors' && (
            <div>
              {visitors.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Visitor</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Host</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check In</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {visitors.map(visitor => (
                        <tr key={visitor.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3"><p className="font-medium">{visitor.name}</p></td>
                          <td className="px-4 py-3 text-sm text-gray-600">{visitor.company || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{visitor.host_name || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{new Date(visitor.checkin_time || visitor.created_at).toLocaleTimeString()}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs rounded-full ${visitor.checkout_time ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'}`}>
                              {visitor.checkout_time ? 'Checked Out' : 'Checked In'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!visitor.checkout_time && <button onClick={() => handleCheckout(visitor.id)} className="text-blue-600 hover:text-blue-800 text-sm">Check Out</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-2">👋</p>
                  <p className="text-gray-500">No visitors today</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'codes' && (
            <div>
              {guestCodes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {guestCodes.map(code => (
                    <div key={code.id} className={`border rounded-xl p-4 ${code.is_used ? 'bg-gray-50' : 'bg-white border-green-200'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <p className="text-2xl font-mono font-bold">{code.code}</p>
                        <span className={`px-2 py-1 text-xs rounded-full ${code.is_used ? 'bg-gray-100' : 'bg-green-100 text-green-800'}`}>
                          {code.is_used ? 'Used' : 'Active'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">📅 {new Date(code.valid_date).toLocaleDateString()}</p>
                      {!code.is_used && (
                        <button onClick={() => handleRevokeCode(code.id)} className="mt-3 w-full px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50">Revoke</button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-2">🎟️</p>
                  <p className="text-gray-500">No active guest codes</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showAddVisitor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Check In Visitor</h2>
              <button onClick={() => setShowAddVisitor(false)} className="text-gray-500">✕</button>
            </div>
            <form onSubmit={handleAddVisitor} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" value={visitorForm.name} onChange={(e) => setVisitorForm({ ...visitorForm, name: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input type="text" value={visitorForm.company} onChange={(e) => setVisitorForm({ ...visitorForm, company: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Host Name</label>
                <input type="text" value={visitorForm.hostName} onChange={(e) => setVisitorForm({ ...visitorForm, hostName: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
                <input type="text" value={visitorForm.purpose} onChange={(e) => setVisitorForm({ ...visitorForm, purpose: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddVisitor(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Check In</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showGenerateCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Generate Guest Code</h2>
              <button onClick={() => setShowGenerateCode(false)} className="text-gray-500">✕</button>
            </div>
            <form onSubmit={handleGenerateCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cafeteria *</label>
                <select value={codeForm.cafeteriaId} onChange={(e) => setCodeForm({ ...codeForm, cafeteriaId: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required>
                  <option value="">Select cafeteria</option>
                  {cafeterias.map(caf => <option key={caf.id} value={caf.id}>{caf.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valid Date *</label>
                <input type="date" value={codeForm.validDate} onChange={(e) => setCodeForm({ ...codeForm, validDate: e.target.value })} className="w-full px-4 py-2 border rounded-lg" min={new Date().toISOString().split('T')[0]} required />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowGenerateCode(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg">Generate</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
