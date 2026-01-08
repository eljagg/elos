import { useState, useEffect, useRef } from 'react';
import { userAPI, companyAPI, messageAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import toast from 'react-hot-toast';

export default function HRDashboard() {
  const { colors, getStatCardColors } = useTheme();
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
      for (const c of companiesList) { const d = await companyAPI.getDepartments(c.id).catch(() => ({ data: { data: { departments: [] } } })); allDepts.push(...(d.data?.data?.departments || []).map(dept => ({ ...dept, company_name: c.name }))); }
      setDepartments(allDepts);
      const thisMonth = new Date().getMonth();
      setStats({ totalEmployees: usersList.length, activeEmployees: usersList.filter(e => e.is_active).length, newThisMonth: usersList.filter(e => new Date(e.created_at).getMonth() === thisMonth).length, pendingFeedback: (feedbackRes.data?.data?.feedback || []).filter(f => f.status === 'pending').length, openIssues: (feedbackRes.data?.data?.feedback || []).filter(f => f.type === 'issue' && f.status !== 'resolved').length });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSaveEmployee = async (e) => { e.preventDefault(); try { if (selectedEmployee) { await userAPI.updateUser(selectedEmployee.id, employeeForm); toast.success('Updated'); } else { await userAPI.createUser({ ...employeeForm, password: 'TempPass123!' }); toast.success('Created'); } setShowEmployeeModal(false); setEmployeeForm({ firstName: '', lastName: '', email: '', phone: '', companyId: '', departmentId: '', roleCode: 'EMPLOYEE' }); setSelectedEmployee(null); loadData(); } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); } };
  const handleDisableEmployee = async () => { try { await userAPI.disableUser(selectedEmployee.id, disableForm.reason); toast.success('Disabled'); setShowDisableModal(false); loadData(); } catch { toast.error('Failed'); } };
  const handleEnableEmployee = async (emp) => { try { await userAPI.enableUser(emp.id); toast.success('Enabled'); loadData(); } catch { toast.error('Failed'); } };
  const handleRespondFeedback = async () => { try { await messageAPI.respondToFeedback(selectedFeedback.id, feedbackResponse); toast.success('Sent'); setShowFeedbackModal(false); loadData(); } catch { toast.error('Failed'); } };
  const handleEscalate = async (fb) => { try { await messageAPI.updateFeedbackStatus(fb.id, 'escalated'); toast.success('Escalated'); loadData(); } catch { toast.error('Failed'); } };
  const handleResolve = async (fb) => { try { await messageAPI.updateFeedbackStatus(fb.id, 'resolved'); toast.success('Resolved'); loadData(); } catch { toast.error('Failed'); } };
  const handleSendToKitchen = async () => { try { await messageAPI.sendMessage({ recipientRole: 'KITCHEN_HEAD', subject: 'Message from HR', message: kitchenMessage }); toast.success('Sent'); setShowMessageModal(false); setKitchenMessage(''); } catch { toast.error('Failed'); } };
  const handleExport = () => { const csv = [['Name', 'Email', 'Company', 'Status'], ...employees.map(e => [`${e.first_name} ${e.last_name}`, e.email, e.company_name || '', e.is_active ? 'Active' : 'Disabled'])].map(r => r.join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'employees.csv'; a.click(); };

  const filteredEmployees = employees.filter(e => { const s = filters.search.toLowerCase(); if (s && !`${e.first_name} ${e.last_name} ${e.email}`.toLowerCase().includes(s)) return false; if (filters.company && e.company_id !== filters.company) return false; if (filters.status === 'active' && !e.is_active) return false; if (filters.status === 'disabled' && e.is_active) return false; return true; });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><div><h1 className={`text-2xl font-bold ${colors.textPrimary}`}>HR Dashboard</h1><p className={colors.textMuted}>Manage employees and feedback</p></div><button onClick={() => setShowMessageModal(true)} className={`px-4 py-2 ${colors.btnPrimary} rounded-lg`}>📨 Message Kitchen</button></div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[{ l: 'Total', v: stats.totalEmployees }, { l: 'Active', v: stats.activeEmployees }, { l: 'New', v: stats.newThisMonth }, { l: 'Feedback', v: stats.pendingFeedback }, { l: 'Issues', v: stats.openIssues }].map((s, i) => { const c = getStatCardColors(i); return <div key={i} className={`${c.bg} rounded-xl p-4 border-l-4 ${c.border}`}><p className={`text-sm ${c.text} opacity-80`}>{s.l}</p><p className={`text-2xl font-bold ${c.text}`}>{s.v}</p></div>; })}
      </div>

      <div className={`${colors.bgCard} rounded-xl shadow-sm border ${colors.border}`}>
        <div className={`border-b ${colors.border} flex`}>{[{ id: 'overview', l: '📊 Overview' }, { id: 'employees', l: '👥 Employees' }, { id: 'feedback', l: '💬 Feedback' }, { id: 'reports', l: '📈 Reports' }].map(t => <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-6 py-4 text-sm font-medium border-b-2 ${activeTab === t.id ? 'border-indigo-500 text-indigo-600' : `border-transparent ${colors.textMuted}`}`}>{t.l}</button>)}</div>

        <div className="p-6">
          {activeTab === 'overview' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><div className={`${colors.bgSecondary} rounded-xl p-6`}><h3 className={`font-semibold mb-4 ${colors.textPrimary}`}>By Company</h3>{companies.map(c => <div key={c.id} className={`flex justify-between p-3 ${colors.bgCard} rounded-lg mb-2`}><span className={colors.textSecondary}>{c.name}</span><span className={`font-bold ${colors.textPrimary}`}>{employees.filter(e => e.company_id === c.id).length}</span></div>)}</div><div className={`${colors.bgSecondary} rounded-xl p-6`}><h3 className={`font-semibold mb-4 ${colors.textPrimary}`}>Recent Feedback</h3>{feedback.slice(0, 5).map(f => <div key={f.id} className={`p-3 ${colors.bgCard} rounded-lg mb-2`}><div className="flex justify-between"><span className={colors.textPrimary}>{f.subject}</span><span className={`text-xs px-2 py-1 rounded-full ${f.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{f.status}</span></div></div>)}</div></div>}

          {activeTab === 'employees' && <div className="space-y-4"><div className="flex flex-wrap gap-4 justify-between"><div className="flex gap-2"><input placeholder="Search..." className={`px-4 py-2 border ${colors.border} rounded-lg`} value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} /><select className={`px-4 py-2 border ${colors.border} rounded-lg`} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option value="">All</option><option value="active">Active</option><option value="disabled">Disabled</option></select></div><div className="flex gap-2"><button onClick={handleExport} className="px-4 py-2 border border-green-600 text-green-600 rounded-lg">📤 Export</button><button onClick={() => { setSelectedEmployee(null); setEmployeeForm({ firstName: '', lastName: '', email: '', phone: '', companyId: '', departmentId: '' }); setShowEmployeeModal(true); }} className={`px-4 py-2 ${colors.btnPrimary} rounded-lg`}>+ Add</button></div></div><table className="w-full"><thead className={colors.bgSecondary}><tr><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Employee</th><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Company</th><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Status</th><th className={`px-4 py-3 text-right text-xs ${colors.textMuted}`}>Actions</th></tr></thead><tbody className={`divide-y ${colors.border}`}>{filteredEmployees.map(e => <tr key={e.id} className={colors.bgHover}><td className="px-4 py-3"><p className={`font-medium ${colors.textPrimary}`}>{e.first_name} {e.last_name}</p><p className={`text-sm ${colors.textMuted}`}>{e.email}</p></td><td className={`px-4 py-3 ${colors.textSecondary}`}>{e.company_name || '-'}</td><td className="px-4 py-3"><span className={`px-2 py-1 text-xs rounded-full ${e.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{e.is_active ? 'Active' : 'Disabled'}</span></td><td className="px-4 py-3 text-right space-x-2"><button onClick={() => { setSelectedEmployee(e); setEmployeeForm({ firstName: e.first_name, lastName: e.last_name, email: e.email, phone: e.phone || '', companyId: e.company_id || '', departmentId: e.department_id || '' }); setShowEmployeeModal(true); }} className="text-blue-600 text-sm">Edit</button>{e.is_active ? <button onClick={() => { setSelectedEmployee(e); setShowDisableModal(true); }} className="text-orange-600 text-sm">Disable</button> : <button onClick={() => handleEnableEmployee(e)} className="text-green-600 text-sm">Enable</button>}</td></tr>)}</tbody></table></div>}

          {activeTab === 'feedback' && <div className="space-y-4">{feedback.map(f => <div key={f.id} className={`border ${colors.border} rounded-xl p-4 ${colors.bgCard}`}><div className="flex justify-between mb-2"><div><h3 className={`font-semibold ${colors.textPrimary}`}>{f.subject}</h3><p className={`text-sm ${colors.textMuted}`}>{f.user_name}</p></div><span className={`px-2 py-1 text-xs rounded-full ${f.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{f.status}</span></div><p className={`${colors.textSecondary} mb-3`}>{f.message}</p><div className="flex gap-2"><button onClick={() => { setSelectedFeedback(f); setFeedbackResponse(''); setShowFeedbackModal(true); }} className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm">Respond</button>{f.status !== 'escalated' && <button onClick={() => handleEscalate(f)} className="px-3 py-1 bg-orange-100 text-orange-700 rounded text-sm">Escalate</button>}{f.status !== 'resolved' && <button onClick={() => handleResolve(f)} className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm">Resolve</button>}</div></div>)}</div>}

          {activeTab === 'reports' && <div className={`${colors.bgSecondary} rounded-xl p-6`}><h3 className={`font-semibold mb-4 ${colors.textPrimary}`}>Employee Distribution</h3>{companies.map(c => { const cnt = employees.filter(e => e.company_id === c.id).length; const pct = stats.totalEmployees ? (cnt / stats.totalEmployees * 100).toFixed(0) : 0; return <div key={c.id} className="mb-3"><div className="flex justify-between mb-1"><span className={colors.textSecondary}>{c.name}</span><span className={colors.textPrimary}>{cnt}</span></div><div className={`w-full h-2 ${colors.bgCard} rounded-full`}><div className="h-2 bg-indigo-500 rounded-full" style={{ width: `${pct}%` }}></div></div></div>; })}</div>}
        </div>
      </div>

      {showEmployeeModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-lg`}><h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>{selectedEmployee ? 'Edit' : 'Add'} Employee</h2><form onSubmit={handleSaveEmployee} className="space-y-4"><div className="grid grid-cols-2 gap-4"><input placeholder="First Name" value={employeeForm.firstName} onChange={e => setEmployeeForm({ ...employeeForm, firstName: e.target.value })} className={`px-4 py-2 border ${colors.border} rounded-lg`} required /><input placeholder="Last Name" value={employeeForm.lastName} onChange={e => setEmployeeForm({ ...employeeForm, lastName: e.target.value })} className={`px-4 py-2 border ${colors.border} rounded-lg`} required /></div><input type="email" placeholder="Email" value={employeeForm.email} onChange={e => setEmployeeForm({ ...employeeForm, email: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} required /><select value={employeeForm.companyId} onChange={e => setEmployeeForm({ ...employeeForm, companyId: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`}><option value="">Select Company</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="flex justify-end gap-3"><button type="button" onClick={() => setShowEmployeeModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Save</button></div></form></div></div>}

      {showDisableModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-md`}><h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>Disable Employee</h2><textarea placeholder="Reason" value={disableForm.reason} onChange={e => setDisableForm({ ...disableForm, reason: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg mb-4`} rows="2" /><input type="date" value={disableForm.endDate} onChange={e => setDisableForm({ ...disableForm, endDate: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg mb-4`} /><div className="flex justify-end gap-3"><button onClick={() => setShowDisableModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button onClick={handleDisableEmployee} className="px-4 py-2 bg-orange-600 text-white rounded-lg">Disable</button></div></div></div>}

      {showFeedbackModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-lg`}><h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>Respond</h2><div className={`${colors.bgSecondary} rounded-lg p-4 mb-4`}><h3 className={colors.textPrimary}>{selectedFeedback?.subject}</h3><p className={`text-sm ${colors.textMuted}`}>{selectedFeedback?.message}</p></div><textarea placeholder="Response..." value={feedbackResponse} onChange={e => setFeedbackResponse(e.target.value)} className={`w-full px-4 py-2 border ${colors.border} rounded-lg mb-4`} rows="4" /><div className="flex justify-end gap-3"><button onClick={() => setShowFeedbackModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button onClick={handleRespondFeedback} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Send</button></div></div></div>}

      {showMessageModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-lg`}><h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>📨 Message Kitchen</h2><textarea placeholder="Message..." value={kitchenMessage} onChange={e => setKitchenMessage(e.target.value)} className={`w-full px-4 py-2 border ${colors.border} rounded-lg mb-4`} rows="4" /><div className="flex justify-end gap-3"><button onClick={() => setShowMessageModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button onClick={handleSendToKitchen} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Send</button></div></div></div>}
    </div>
  );
}
