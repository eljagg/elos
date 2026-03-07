/**
 * HR Dashboard - Mobile-first responsive design
 * Manage employees and handle feedback
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userAPI, companyAPI, messageAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function HRDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [roles, setRoles] = useState([]);
  const [stats, setStats] = useState({});
  const [filters, setFilters] = useState({ search: '', company: '', status: '' });

  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [employeeForm, setEmployeeForm] = useState({ firstName: '', lastName: '', email: '', phone: '', companyId: '', departmentId: '', roleCode: 'EMPLOYEE' });
  const [disableForm, setDisableForm] = useState({ reason: '', endDate: '' });
  const [feedbackResponse, setFeedbackResponse] = useState('');
  const [kitchenMessage, setKitchenMessage] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, companiesRes, feedbackRes, rolesRes] = await Promise.all([
        userAPI.getUsers({ limit: 500 }).catch(() => ({ data: { data: { users: [] } } })),
        companyAPI.getCompanies().catch(() => ({ data: { data: { companies: [] } } })),
        messageAPI.getFeedback().catch(() => ({ data: { data: { feedback: [] } } })),
        userAPI.getRoles().catch(() => ({ data: { data: { roles: [] } } }))
      ]);
      const usersList = usersRes.data?.data?.users || [];
      const companiesList = companiesRes.data?.data?.companies || [];
      setEmployees(usersList.filter(u => ['EMPLOYEE', 'HR_ADMIN', 'RECEPTIONIST'].includes(u.role_code) || !u.role_code));
      setCompanies(companiesList);
      setFeedback(feedbackRes.data?.data?.feedback || []);
      setRoles(rolesRes.data?.data?.roles || []);
      
      const allDepts = [];
      companiesList.forEach(c => { if (c.departments) allDepts.push(...c.departments); });
      setDepartments(allDepts);
      
      const active = usersList.filter(u => u.is_active);
      const thisMonth = usersList.filter(u => {
        if (!u.created_at) return false;
        const created = new Date(u.created_at);
        const now = new Date();
        return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
      });
      const pendingFb = (feedbackRes.data?.data?.feedback || []).filter(f => f.status === 'pending');
      const openIssues = (feedbackRes.data?.data?.feedback || []).filter(f => f.type === 'issue' && f.status !== 'resolved');
      
      setStats({
        totalEmployees: usersList.length,
        activeEmployees: active.length,
        newThisMonth: thisMonth.length,
        pendingFeedback: pendingFb.length,
        openIssues: openIssues.length
      });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    try {
      if (selectedEmployee) {
        await userAPI.updateUser(selectedEmployee.id, employeeForm);
        toast.success('Employee updated');
      } else {
        await userAPI.createUser(employeeForm);
        toast.success('Employee added');
      }
      setShowEmployeeModal(false);
      setEmployeeForm({ firstName: '', lastName: '', email: '', phone: '', companyId: '', departmentId: '', roleCode: 'EMPLOYEE' });
      setSelectedEmployee(null);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to save employee');
    }
  };

  const handleDisableEmployee = async () => {
    try {
      await userAPI.updateUser(selectedEmployee.id, { isActive: false, disableReason: disableForm.reason });
      toast.success('Employee disabled');
      setShowDisableModal(false);
      loadData();
    } catch { toast.error('Failed'); }
  };

  const handleEnableEmployee = async (emp) => {
    try {
      await userAPI.updateUser(emp.id, { isActive: true });
      toast.success('Employee enabled');
      loadData();
    } catch { toast.error('Failed'); }
  };

  const handleRespondFeedback = async () => {
    try {
      await messageAPI.respondToFeedback(selectedFeedback.id, feedbackResponse);
      toast.success('Response sent');
      setShowFeedbackModal(false);
      loadData();
    } catch { toast.error('Failed'); }
  };

  const handleEscalate = async (fb) => {
    try {
      await messageAPI.updateFeedbackStatus(fb.id, 'escalated');
      toast.success('Escalated');
      loadData();
    } catch { toast.error('Failed'); }
  };

  const handleResolve = async (fb) => {
    try {
      await messageAPI.updateFeedbackStatus(fb.id, 'resolved');
      toast.success('Resolved');
      loadData();
    } catch { toast.error('Failed'); }
  };

  const handleSendToKitchen = async () => {
    try {
      await messageAPI.sendMessage({ recipientRole: 'KITCHEN_HEAD', subject: 'Message from HR', message: kitchenMessage });
      toast.success('Sent');
      setShowMessageModal(false);
      setKitchenMessage('');
    } catch { toast.error('Failed'); }
  };

  const handleExport = () => {
    const csv = [
      ['Name', 'Email', 'Company', 'Status'],
      ...employees.map(e => [`${e.first_name} ${e.last_name}`, e.email, e.company_name || '', e.is_active ? 'Active' : 'Disabled'])
    ].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'employees.csv';
    a.click();
  };

  const filteredEmployees = employees.filter(e => {
    const s = filters.search.toLowerCase();
    if (s && !`${e.first_name} ${e.last_name} ${e.email}`.toLowerCase().includes(s)) return false;
    if (filters.company && e.company_id !== filters.company) return false;
    if (filters.status === 'active' && !e.is_active) return false;
    if (filters.status === 'disabled' && e.is_active) return false;
    return true;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">HR Dashboard</h1>
          <p className="text-gray-500 text-sm">Manage employees and feedback</p>
        </div>
        <button 
          onClick={() => setShowMessageModal(true)} 
          className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          📨 Message Kitchen
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4">
        {[
          { l: 'Total', v: stats.totalEmployees, icon: '👥', bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-700' },
          { l: 'Active', v: stats.activeEmployees, icon: '✅', bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700' },
          { l: 'New', v: stats.newThisMonth, icon: '🆕', bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700' },
          { l: 'Feedback', v: stats.pendingFeedback, icon: '💬', bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-700' },
          { l: 'Issues', v: stats.openIssues, icon: '⚠️', bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-700' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-xl p-3 sm:p-4 border-l-4 ${s.border}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base sm:text-lg">{s.icon}</span>
              <p className={`text-xs ${s.text} opacity-80`}>{s.l}</p>
            </div>
            <p className={`text-xl sm:text-2xl font-bold ${s.text}`}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 flex overflow-x-auto">
          {[
            { id: 'overview', l: '📊 Overview', short: '📊' },
            { id: 'employees', l: '👥 Employees', short: '👥' },
            { id: 'feedback', l: '💬 Feedback', short: '💬' },
            { id: 'reports', l: '📈 Reports', short: '📈' }
          ].map(t => (
            <button 
              key={t.id} 
              onClick={() => setActiveTab(t.id)} 
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === t.id 
                  ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="hidden sm:inline">{t.l}</span>
              <span className="sm:hidden">{t.short}</span>
            </button>
          ))}
        </div>

        <div className="p-3 sm:p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* By Company */}
              <div className="bg-gray-50 rounded-xl p-4 sm:p-6">
                <h3 className="font-semibold text-gray-900 mb-4">By Company</h3>
                <div className="space-y-2">
                  {companies.map(c => (
                    <div key={c.id} className="flex justify-between p-3 bg-white rounded-lg">
                      <span className="text-gray-600">{c.name}</span>
                      <span className="font-bold text-gray-900">{employees.filter(e => e.company_id === c.id).length}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Recent Feedback */}
              <div className="bg-gray-50 rounded-xl p-4 sm:p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Recent Feedback</h3>
                <div className="space-y-2">
                  {feedback.slice(0, 5).map(f => (
                    <div key={f.id} className="p-3 bg-white rounded-lg">
                      <div className="flex justify-between items-start">
                        <span className="text-gray-900 font-medium">{f.subject}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          f.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {f.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{f.user_name}</p>
                    </div>
                  ))}
                  {feedback.length === 0 && (
                    <p className="text-center py-8 text-gray-500">No feedback yet</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Employees Tab */}
          {activeTab === 'employees' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                <div className="flex flex-col sm:flex-row gap-2 flex-1">
                  <input 
                    placeholder="Search employees..." 
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg" 
                    value={filters.search} 
                    onChange={e => setFilters({ ...filters, search: e.target.value })} 
                  />
                  <select 
                    className="px-4 py-2 border border-gray-200 rounded-lg bg-white" 
                    value={filters.status} 
                    onChange={e => setFilters({ ...filters, status: e.target.value })}
                  >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleExport} className="px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 text-sm font-medium">
                    📤 Export
                  </button>
                  <button onClick={() => navigate('/hr/users/new')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
                    + Add
                  </button>
                </div>
              </div>

              {/* Employee List - Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Employee</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Company</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredEmployees.map(e => (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{e.first_name} {e.last_name}</p>
                          <p className="text-sm text-gray-500">{e.email}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{e.company_name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded-full ${e.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {e.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button onClick={() => navigate('/hr/users/' + e.id)} className="text-blue-600 text-sm font-medium">Edit</button>
                          {e.is_active ? (
                            <button onClick={() => { setSelectedEmployee(e); setShowDisableModal(true); }} className="text-orange-600 text-sm font-medium">Disable</button>
                          ) : (
                            <button onClick={() => handleEnableEmployee(e)} className="text-green-600 text-sm font-medium">Enable</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Employee List - Mobile Cards */}
              <div className="sm:hidden space-y-3">
                {filteredEmployees.map(e => (
                  <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-gray-900">{e.first_name} {e.last_name}</p>
                        <p className="text-sm text-gray-500">{e.email}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${e.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {e.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{e.company_name || 'No company'}</p>
                    <div className="flex gap-3">
                      <button onClick={() => navigate('/hr/users/' + e.id)} className="text-blue-600 text-sm font-medium">Edit</button>
                      {e.is_active ? (
                        <button onClick={() => { setSelectedEmployee(e); setShowDisableModal(true); }} className="text-orange-600 text-sm font-medium">Disable</button>
                      ) : (
                        <button onClick={() => handleEnableEmployee(e)} className="text-green-600 text-sm font-medium">Enable</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feedback Tab */}
          {activeTab === 'feedback' && (
            <div className="space-y-3">
              {feedback.length > 0 ? feedback.map(f => (
                <div key={f.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{f.subject}</h3>
                      <p className="text-sm text-gray-500">{f.user_name}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      f.status === 'resolved' ? 'bg-green-100 text-green-700' : 
                      f.status === 'escalated' ? 'bg-orange-100 text-orange-700' : 
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {f.status}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-3">{f.message}</p>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => { setSelectedFeedback(f); setFeedbackResponse(''); setShowFeedbackModal(true); }} 
                      className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium"
                    >
                      Respond
                    </button>
                    {f.status !== 'escalated' && (
                      <button onClick={() => handleEscalate(f)} className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium">
                        Escalate
                      </button>
                    )}
                    {f.status !== 'resolved' && (
                      <button onClick={() => handleResolve(f)} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              )) : (
                <div className="text-center py-12">
                  <p className="text-5xl mb-3">💬</p>
                  <p className="text-gray-600 font-medium">No feedback</p>
                  <p className="text-sm text-gray-400 mt-1">Employee feedback will appear here</p>
                </div>
              )}
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="bg-gray-50 rounded-xl p-4 sm:p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Employee Distribution</h3>
              {companies.map(c => {
                const cnt = employees.filter(e => e.company_id === c.id).length;
                const pct = stats.totalEmployees ? (cnt / stats.totalEmployees * 100).toFixed(0) : 0;
                return (
                  <div key={c.id} className="mb-4">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-600">{c.name}</span>
                      <span className="text-gray-900 font-medium">{cnt} ({pct}%)</span>
                    </div>
                    <div className="w-full h-3 bg-white rounded-full overflow-hidden">
                      <div className="h-3 bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Employee Modal */}
      {showEmployeeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">{selectedEmployee ? 'Edit' : 'Add'} Employee</h2>
            </div>
            <form onSubmit={handleSaveEmployee} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input placeholder="First Name" value={employeeForm.firstName} onChange={e => setEmployeeForm({ ...employeeForm, firstName: e.target.value })} className="px-4 py-2 border border-gray-200 rounded-lg" required />
                <input placeholder="Last Name" value={employeeForm.lastName} onChange={e => setEmployeeForm({ ...employeeForm, lastName: e.target.value })} className="px-4 py-2 border border-gray-200 rounded-lg" required />
              </div>
              <input type="email" placeholder="Email" value={employeeForm.email} onChange={e => setEmployeeForm({ ...employeeForm, email: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg" required />
              <select value={employeeForm.companyId} onChange={e => setEmployeeForm({ ...employeeForm, companyId: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white">
                <option value="">Select Company</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowEmployeeModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disable Modal */}
      {showDisableModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Disable Employee</h2>
              <p className="text-sm text-gray-500 mt-1">{selectedEmployee?.first_name} {selectedEmployee?.last_name}</p>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <textarea placeholder="Reason for disabling" value={disableForm.reason} onChange={e => setDisableForm({ ...disableForm, reason: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg" rows="3" />
              <input type="date" value={disableForm.endDate} onChange={e => setDisableForm({ ...disableForm, endDate: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg" placeholder="End Date (optional)" />
              <div className="flex gap-3">
                <button onClick={() => setShowDisableModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg">Cancel</button>
                <button onClick={handleDisableEmployee} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg">Disable</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Response Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Respond to Feedback</h2>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900">{selectedFeedback?.subject}</h3>
                <p className="text-sm text-gray-600 mt-1">{selectedFeedback?.message}</p>
              </div>
              <textarea placeholder="Your response..." value={feedbackResponse} onChange={e => setFeedbackResponse(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-lg" rows="4" />
              <div className="flex gap-3">
                <button onClick={() => setShowFeedbackModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg">Cancel</button>
                <button onClick={handleRespondFeedback} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg">Send</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Kitchen Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">📨 Message Kitchen</h2>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <textarea placeholder="Your message to the kitchen..." value={kitchenMessage} onChange={e => setKitchenMessage(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-lg" rows="4" />
              <div className="flex gap-3">
                <button onClick={() => setShowMessageModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg">Cancel</button>
                <button onClick={handleSendToKitchen} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg">Send</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
