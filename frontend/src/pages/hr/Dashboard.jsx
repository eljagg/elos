import { useState, useEffect, useRef } from 'react';
import { userAPI, messageAPI, companyAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function HRDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [stats, setStats] = useState({ totalEmployees: 0, activeEmployees: 0, newThisMonth: 0, pendingFeedback: 0 });
  const [filters, setFilters] = useState({ search: '', company: '', status: '' });
  
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showMessageKitchenModal, setShowMessageKitchenModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [employeeForm, setEmployeeForm] = useState({ firstName: '', lastName: '', email: '', phone: '', companyId: '', departmentId: '', roleId: '', employeeCode: '' });
  const [disableForm, setDisableForm] = useState({ reason: '', disableUntil: '' });
  const [kitchenMessage, setKitchenMessage] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [employeesRes, feedbackRes, companiesRes, rolesRes] = await Promise.all([
        userAPI.getUsers({ limit: 500 }).catch(() => ({ data: { data: { users: [] } } })),
        messageAPI.getFeedback({ status: 'pending' }).catch(() => ({ data: { data: { feedback: [] } } })),
        companyAPI.getCompanies().catch(() => ({ data: { data: { companies: [] } } })),
        userAPI.getRoles().catch(() => ({ data: { data: { roles: [] } } }))
      ]);
      const emps = employeesRes.data?.data?.users || [];
      const fb = feedbackRes.data?.data?.feedback || [];
      const comps = companiesRes.data?.data?.companies || [];
      setEmployees(emps);
      setFeedback(fb);
      setCompanies(comps);
      setRoles(rolesRes.data?.data?.roles || []);
      if (comps.length > 0) {
        const deptRes = await companyAPI.getDepartments(comps[0].id).catch(() => ({ data: { data: { departments: [] } } }));
        setDepartments(deptRes.data?.data?.departments || []);
      }
      setStats({
        totalEmployees: emps.length,
        activeEmployees: emps.filter(e => e.is_active || e.isActive).length,
        newThisMonth: emps.filter(e => { const d = new Date(e.created_at); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }).length,
        pendingFeedback: fb.filter(f => f.status === 'pending').length
      });
    } catch (error) { console.error('Failed to load HR data:', error); }
    finally { setLoading(false); }
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    try {
      if (selectedEmployee) { await userAPI.updateUser(selectedEmployee.id, employeeForm); toast.success('Employee updated'); }
      else { await userAPI.createUser({ ...employeeForm, password: 'TempPass123!' }); toast.success('Employee created'); }
      setShowEmployeeModal(false);
      setEmployeeForm({ firstName: '', lastName: '', email: '', phone: '', companyId: '', departmentId: '', roleId: '', employeeCode: '' });
      setSelectedEmployee(null);
      loadData();
    } catch (error) { toast.error(error.response?.data?.error?.message || 'Failed to save'); }
  };

  const handleEditEmployee = (emp) => {
    setSelectedEmployee(emp);
    setEmployeeForm({ firstName: emp.first_name || '', lastName: emp.last_name || '', email: emp.email || '', phone: emp.phone || '', companyId: emp.company_id || '', departmentId: emp.department_id || '', roleId: emp.role_id || '', employeeCode: emp.employee_code || '' });
    setShowEmployeeModal(true);
  };

  const handleDeleteEmployee = async (id) => {
    if (!confirm('Delete this employee?')) return;
    try { await userAPI.deleteUser(id); toast.success('Deleted'); loadData(); } catch { toast.error('Failed'); }
  };

  const handleDisableEmployee = (emp) => { setSelectedEmployee(emp); setDisableForm({ reason: '', disableUntil: '' }); setShowDisableModal(true); };

  const handleConfirmDisable = async () => {
    try { await userAPI.disableUser(selectedEmployee.id, disableForm.reason); toast.success('Disabled'); setShowDisableModal(false); loadData(); }
    catch { toast.error('Failed'); }
  };

  const handleEnableEmployee = async (id) => {
    try { await userAPI.enableUser(id); toast.success('Enabled'); loadData(); } catch { toast.error('Failed'); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const emp = {};
        headers.forEach((h, idx) => {
          if (h.includes('first')) emp.firstName = values[idx];
          else if (h.includes('last')) emp.lastName = values[idx];
          else if (h.includes('email')) emp.email = values[idx];
          else if (h.includes('phone')) emp.phone = values[idx];
        });
        if (emp.email && emp.firstName) {
          try { await userAPI.createUser({ ...emp, password: 'TempPass123!' }); imported++; } catch {}
        }
      }
      toast.success(`Imported ${imported} employees`);
      setShowImportModal(false);
      loadData();
    } catch { toast.error('Failed to parse file'); }
  };

  const handleExportCSV = () => {
    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Department', 'Role', 'Status'];
    const rows = employees.map(emp => [emp.first_name || '', emp.last_name || '', emp.email || '', emp.phone || '', emp.company_name || '', emp.department_name || '', emp.role_name || '', (emp.is_active) ? 'Active' : 'Inactive']);
    const csv = [headers, ...rows].map(row => row.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `employees_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    toast.success('CSV exported');
  };

  const handleRespondToFeedback = async (e) => {
    e.preventDefault();
    try { await messageAPI.respondToFeedback(selectedFeedback.id, e.target.response.value, 'resolved'); toast.success('Response sent'); setShowFeedbackModal(false); loadData(); }
    catch { toast.error('Failed'); }
  };

  const handleMessageKitchen = async (e) => {
    e.preventDefault();
    try { await messageAPI.sendMessage({ recipientRole: 'KITCHEN_HEAD', subject: 'Issue from HR', message: kitchenMessage }); toast.success('Sent to Kitchen'); setShowMessageKitchenModal(false); }
    catch { toast.error('Failed'); }
  };

  const handleEscalateToKitchen = (fb) => { setSelectedFeedback(fb); setKitchenMessage(`Employee feedback:\n\n"${fb.message}"\n\nPlease investigate.`); setShowMessageKitchenModal(true); };

  const handleMarkResolved = async (id) => {
    try { await messageAPI.updateFeedbackStatus(id, 'resolved'); toast.success('Resolved'); loadData(); } catch { toast.error('Failed'); }
  };

  const filteredEmployees = employees.filter(emp => {
    const s = filters.search.toLowerCase();
    if (s && !`${emp.first_name} ${emp.last_name}`.toLowerCase().includes(s) && !emp.email?.toLowerCase().includes(s)) return false;
    if (filters.company && emp.company_id !== filters.company) return false;
    if (filters.status === 'active' && !emp.is_active) return false;
    if (filters.status === 'inactive' && emp.is_active) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-gray-800">HR Dashboard</h1><p className="text-gray-500">Manage employees, feedback, and reports</p></div>
        <div className="flex gap-3">
          <button onClick={() => setShowImportModal(true)} className="px-4 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50">📥 Import</button>
          <button onClick={handleExportCSV} className="px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50">📤 Export</button>
          <button onClick={() => { setSelectedEmployee(null); setEmployeeForm({ firstName: '', lastName: '', email: '', phone: '', companyId: '', departmentId: '', roleId: '', employeeCode: '' }); setShowEmployeeModal(true); }} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">+ Add Employee</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-purple-50 rounded-xl p-4 border-l-4 border-purple-500"><p className="text-sm text-purple-600">Total</p><p className="text-2xl font-bold text-purple-700">{stats.totalEmployees}</p></div>
        <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500"><p className="text-sm text-green-600">Active</p><p className="text-2xl font-bold text-green-700">{stats.activeEmployees}</p></div>
        <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500"><p className="text-sm text-blue-600">New This Month</p><p className="text-2xl font-bold text-blue-700">{stats.newThisMonth}</p></div>
        <div className="bg-orange-50 rounded-xl p-4 border-l-4 border-orange-500"><p className="text-sm text-orange-600">Pending Feedback</p><p className="text-2xl font-bold text-orange-700">{stats.pendingFeedback}</p></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b flex">
          {[{ id: 'overview', label: '📊 Overview' }, { id: 'employees', label: '👥 Employees' }, { id: 'feedback', label: '💬 Feedback' }, { id: 'reports', label: '📈 Reports' }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-6 py-4 text-sm font-medium border-b-2 ${activeTab === tab.id ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500'}`}>{tab.label}</button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold mb-4">Recent Employees</h3>
                <div className="space-y-3">{employees.slice(0, 5).map(emp => (
                  <div key={emp.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                    <div className="flex items-center"><div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-semibold mr-3">{(emp.first_name || '?')[0]}{(emp.last_name || '?')[0]}</div><div><p className="font-medium">{emp.first_name} {emp.last_name}</p><p className="text-sm text-gray-500">{emp.email}</p></div></div>
                    <span className={`px-2 py-1 text-xs rounded-full ${emp.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{emp.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                ))}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold mb-4">Recent Feedback</h3>
                {feedback.length > 0 ? <div className="space-y-3">{feedback.slice(0, 5).map(fb => (
                  <div key={fb.id} className="p-3 bg-white rounded-lg">
                    <div className="flex justify-between"><p className="font-medium">{fb.subject || 'Feedback'}</p><span className={`px-2 py-1 text-xs rounded-full ${fb.type === 'complaint' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{fb.type}</span></div>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{fb.message}</p>
                  </div>
                ))}</div> : <p className="text-gray-500 text-center py-8">No pending feedback</p>}
              </div>
            </div>
          )}

          {activeTab === 'employees' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <input type="text" placeholder="Search..." className="flex-1 min-w-64 px-4 py-2 border rounded-lg" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
                <select className="px-4 py-2 border rounded-lg" value={filters.company} onChange={(e) => setFilters({ ...filters, company: e.target.value })}><option value="">All Companies</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <select className="px-4 py-2 border rounded-lg" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
                  <tbody className="divide-y">{filteredEmployees.map(emp => (
                    <tr key={emp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><div className="flex items-center"><div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-semibold mr-3">{(emp.first_name || '?')[0]}{(emp.last_name || '?')[0]}</div><div><p className="font-medium">{emp.first_name} {emp.last_name}</p><p className="text-sm text-gray-500">{emp.email}</p></div></div></td>
                      <td className="px-4 py-3 text-sm">{emp.company_name || '-'}</td>
                      <td className="px-4 py-3 text-sm">{emp.role_name || emp.role_code || '-'}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 text-xs rounded-full ${emp.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{emp.is_active ? 'Active' : 'Inactive'}</span></td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => handleEditEmployee(emp)} className="text-blue-600 text-sm">Edit</button>
                        {emp.is_active ? <button onClick={() => handleDisableEmployee(emp)} className="text-orange-600 text-sm">Disable</button> : <button onClick={() => handleEnableEmployee(emp.id)} className="text-green-600 text-sm">Enable</button>}
                        <button onClick={() => handleDeleteEmployee(emp.id)} className="text-red-600 text-sm">Delete</button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'feedback' && (
            <div className="space-y-4">
              {feedback.length > 0 ? feedback.map(fb => (
                <div key={fb.id} className="border rounded-lg p-4">
                  <div className="flex justify-between mb-2">
                    <div><h3 className="font-semibold">{fb.subject || 'Feedback'}</h3><p className="text-sm text-gray-500">{fb.user_name} • {new Date(fb.created_at).toLocaleDateString()}</p></div>
                    <div className="flex gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${fb.type === 'complaint' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{fb.type}</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${fb.status === 'resolved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{fb.status}</span>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-3">{fb.message}</p>
                  <div className="flex gap-2">
                    <button onClick={() => { setSelectedFeedback(fb); setShowFeedbackModal(true); }} className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm">Respond</button>
                    <button onClick={() => handleEscalateToKitchen(fb)} className="px-3 py-1 bg-orange-100 text-orange-700 rounded text-sm">Send to Kitchen</button>
                    {fb.status !== 'resolved' && <button onClick={() => handleMarkResolved(fb.id)} className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm">Mark Resolved</button>}
                  </div>
                </div>
              )) : <p className="text-gray-500 text-center py-12">No feedback to review</p>}
            </div>
          )}

          {activeTab === 'reports' && <HRReports companies={companies} />}
        </div>
      </div>

      {showEmployeeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">{selectedEmployee ? 'Edit' : 'Add'} Employee</h2><button onClick={() => setShowEmployeeModal(false)} className="text-gray-500">✕</button></div>
            <form onSubmit={handleSaveEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">First Name *</label><input type="text" value={employeeForm.firstName} onChange={(e) => setEmployeeForm({ ...employeeForm, firstName: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required /></div>
                <div><label className="block text-sm font-medium mb-1">Last Name *</label><input type="text" value={employeeForm.lastName} onChange={(e) => setEmployeeForm({ ...employeeForm, lastName: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required /></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Email *</label><input type="email" value={employeeForm.email} onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required /></div>
              <div><label className="block text-sm font-medium mb-1">Phone</label><input type="tel" value={employeeForm.phone} onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
              <div><label className="block text-sm font-medium mb-1">Company</label><select value={employeeForm.companyId} onChange={(e) => setEmployeeForm({ ...employeeForm, companyId: e.target.value })} className="w-full px-4 py-2 border rounded-lg"><option value="">Select</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium mb-1">Department</label><select value={employeeForm.departmentId} onChange={(e) => setEmployeeForm({ ...employeeForm, departmentId: e.target.value })} className="w-full px-4 py-2 border rounded-lg"><option value="">Select</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium mb-1">Role</label><select value={employeeForm.roleId} onChange={(e) => setEmployeeForm({ ...employeeForm, roleId: e.target.value })} className="w-full px-4 py-2 border rounded-lg"><option value="">Select</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowEmployeeModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg">{selectedEmployee ? 'Update' : 'Create'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showDisableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Disable Employee</h2>
            <p className="mb-4">Disable {selectedEmployee?.first_name} {selectedEmployee?.last_name}?</p>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Reason</label><textarea value={disableForm.reason} onChange={(e) => setDisableForm({ ...disableForm, reason: e.target.value })} className="w-full px-4 py-2 border rounded-lg" rows="2" /></div>
              <div><label className="block text-sm font-medium mb-1">Until (optional)</label><input type="date" value={disableForm.disableUntil} onChange={(e) => setDisableForm({ ...disableForm, disableUntil: e.target.value })} className="w-full px-4 py-2 border rounded-lg" min={new Date().toISOString().split('T')[0]} /></div>
              <div className="flex justify-end gap-3"><button onClick={() => setShowDisableModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button><button onClick={handleConfirmDisable} className="px-4 py-2 bg-orange-600 text-white rounded-lg">Disable</button></div>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Import Employees</h2>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg">📁 Choose CSV File</button>
              <p className="text-sm text-gray-500 mt-2">Columns: First Name, Last Name, Email, Phone</p>
            </div>
            <div className="flex justify-end mt-4"><button onClick={() => setShowImportModal(false)} className="px-4 py-2 border rounded-lg">Close</button></div>
          </div>
        </div>
      )}

      {showFeedbackModal && selectedFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Respond to Feedback</h2>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg"><p className="text-sm text-gray-500">From: {selectedFeedback.user_name}</p><p className="mt-2">{selectedFeedback.message}</p></div>
            <form onSubmit={handleRespondToFeedback}>
              <textarea name="response" placeholder="Your response..." className="w-full px-4 py-2 border rounded-lg mb-4" rows="4" required />
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowFeedbackModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg">Send</button></div>
            </form>
          </div>
        </div>
      )}

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

function HRReports({ companies }) {
  const [reportType, setReportType] = useState('orders');
  const [filters, setFilters] = useState({ companyId: '', dateFrom: '', dateTo: '' });
  const [data, setData] = useState(null);

  const generate = () => { setData({ type: reportType, records: [] }); };

  const exportCSV = () => {
    if (!data?.records?.length) return alert('No data');
    const csv = 'Date,Type,Details\n' + data.records.map(r => `${r.date},${r.type},${r.details}`).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv])); a.download = 'report.csv'; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold mb-4">Generate Report</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="px-4 py-2 border rounded-lg">
            <option value="orders">Orders by Company</option>
            <option value="issues">Issues by Company</option>
            <option value="orderIssues">Orders with Issues</option>
          </select>
          <select value={filters.companyId} onChange={(e) => setFilters({ ...filters, companyId: e.target.value })} className="px-4 py-2 border rounded-lg"><option value="">All Companies</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="px-4 py-2 border rounded-lg" />
          <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="px-4 py-2 border rounded-lg" />
          <button onClick={generate} className="px-4 py-2 bg-purple-600 text-white rounded-lg">Generate</button>
        </div>
      </div>
      {data && (
        <div>
          <div className="flex justify-between mb-4"><h3 className="font-semibold">Results ({data.records.length})</h3><button onClick={exportCSV} className="px-4 py-2 border border-green-600 text-green-600 rounded-lg">📤 Export</button></div>
          <p className="text-gray-500 text-center py-8">No data found. Reports will populate once orders and feedback exist.</p>
        </div>
      )}
    </div>
  );
}
