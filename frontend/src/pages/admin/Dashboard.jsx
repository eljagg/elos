import { useState, useEffect } from 'react';
import { userAPI, companyAPI, orderAPI, menuAPI, messageAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import toast from 'react-hot-toast';

// Theme Selector Component
const ThemeSelector = ({ themes, currentTheme, changeTheme, colors }) => {
  const previews = {
    softBlue: { sidebar: 'bg-gradient-to-b from-indigo-900 to-blue-900', accent: 'bg-indigo-600', bg: 'bg-slate-100' },
    darkMode: { sidebar: 'bg-slate-950', accent: 'bg-cyan-600', bg: 'bg-slate-800' },
    warmNeutral: { sidebar: 'bg-gradient-to-b from-orange-600 to-amber-700', accent: 'bg-orange-500', bg: 'bg-orange-50' },
    greenFresh: { sidebar: 'bg-gradient-to-b from-emerald-700 to-teal-800', accent: 'bg-emerald-600', bg: 'bg-emerald-50' }
  };
  return (
    <div className={`${colors.bgCard} rounded-xl shadow-sm border ${colors.border} p-6 mb-6`}>
      <h3 className={`text-lg font-semibold ${colors.textPrimary} mb-1`}>🎨 App Theme</h3>
      <p className={`text-sm ${colors.textMuted} mb-4`}>Choose a color scheme for the entire application</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(themes).map(([key, theme]) => (
          <button key={key} onClick={() => { changeTheme(key); toast.success(`Theme changed to ${theme.name}`); }} className={`rounded-xl overflow-hidden border-2 transition-all ${currentTheme === key ? 'border-blue-500 ring-2 ring-blue-500/30' : `${colors.border} hover:border-blue-300`}`}>
            <div className={`${previews[key]?.bg || 'bg-gray-100'} p-2 h-20`}>
              <div className="flex h-full rounded-lg overflow-hidden shadow-sm">
                <div className={`w-5 ${previews[key]?.sidebar || 'bg-gray-800'}`}></div>
                <div className="flex-1 bg-white/80 p-1"><div className={`h-2 ${previews[key]?.accent || 'bg-blue-500'} rounded mb-1`}></div><div className="h-1 bg-gray-200 rounded"></div></div>
              </div>
            </div>
            <div className={`p-2 text-center ${currentTheme === key ? 'bg-blue-600 text-white' : colors.bgSecondary}`}>
              <p className={`font-medium text-sm ${currentTheme !== key && colors.textPrimary}`}>{theme.name}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  const { colors, themes, currentTheme, changeTheme, getStatCardColors } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [cafeterias, setCafeterias] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menus, setMenus] = useState([]);
  const [roles, setRoles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [allowedDomains, setAllowedDomains] = useState([]);
  const [systemSettings, setSystemSettings] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [filters, setFilters] = useState({ search: '', company: '', status: '' });

  const [showUserModal, setShowUserModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showCafeteriaModal, setShowCafeteriaModal] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedDept, setSelectedDept] = useState(null);
  const [userForm, setUserForm] = useState({ firstName: '', lastName: '', email: '', phone: '', companyId: '', departmentId: '', roleId: '', password: '' });
  const [companyForm, setCompanyForm] = useState({ name: '', code: '', address: '', phone: '', email: '' });
  const [deptForm, setDeptForm] = useState({ name: '', code: '', companyId: '', parentId: '' });
  const [cafeteriaForm, setCafeteriaForm] = useState({ name: '', location: '', capacity: '' });
  const [lockReason, setLockReason] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', type: 'info' });

  useEffect(() => { loadAllData(); }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [usersRes, companiesRes, cafeteriasRes, ordersRes, menusRes, rolesRes] = await Promise.all([
        userAPI.getUsers({ limit: 500 }).catch(() => ({ data: { data: { users: [] } } })),
        companyAPI.getCompanies().catch(() => ({ data: { data: { companies: [] } } })),
        companyAPI.getCafeterias().catch(() => ({ data: { data: { cafeterias: [] } } })),
        orderAPI.getOrders({ limit: 100 }).catch(() => ({ data: { data: { orders: [] } } })),
        menuAPI.getMenus().catch(() => ({ data: { data: { menus: [] } } })),
        userAPI.getRoles().catch(() => ({ data: { data: { roles: [] } } }))
      ]);
      const usersList = usersRes.data?.data?.users || [];
      const companiesList = companiesRes.data?.data?.companies || [];
      setUsers(usersList); setCompanies(companiesList); setCafeterias(cafeteriasRes.data?.data?.cafeterias || []);
      setOrders(ordersRes.data?.data?.orders || []); setMenus(menusRes.data?.data?.menus || []); setRoles(rolesRes.data?.data?.roles || []);
      
      const allDepts = [];
      for (const c of companiesList) {
        const d = await companyAPI.getDepartments(c.id).catch(() => ({ data: { data: { departments: [] } } }));
        allDepts.push(...(d.data?.data?.departments || []).map(dept => ({ ...dept, company_name: c.name })));
      }
      setDepartments(allDepts);
      setAllowedDomains(JSON.parse(localStorage.getItem('allowedDomains') || '["faceycommodity.com","seprod.com","mussongroup.com","tgeddesgrant.com","pbs.group","elos.com"]'));
      setSystemSettings(JSON.parse(localStorage.getItem('systemSettings') || '{"orderCutoffTime":"10:00","maxOrdersPerDay":500}'));
      setAnnouncements(JSON.parse(localStorage.getItem('announcements') || '[]'));
      setAuditLogs(JSON.parse(localStorage.getItem('auditLogs') || '[]').slice(0, 100));
      const today = new Date().toISOString().split('T')[0];
      setStats({ totalUsers: usersList.length, activeUsers: usersList.filter(u => u.is_active).length, totalCompanies: companiesList.length, totalDepts: allDepts.length, todayOrders: ordersRes.data?.data?.orders?.filter(o => o.order_date === today).length || 0, lockedAccounts: usersList.filter(u => !u.is_active).length });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const logAudit = (action, details) => {
    const logs = [{ id: Date.now(), action, details, timestamp: new Date().toISOString() }, ...auditLogs].slice(0, 500);
    setAuditLogs(logs); localStorage.setItem('auditLogs', JSON.stringify(logs));
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      if (selectedUser) { await userAPI.updateUser(selectedUser.id, userForm); logAudit('UPDATE_USER', userForm.email); toast.success('Updated'); }
      else { await userAPI.createUser({ ...userForm, password: userForm.password || 'TempPass123!' }); logAudit('CREATE_USER', userForm.email); toast.success('Created'); }
      setShowUserModal(false); setUserForm({ firstName: '', lastName: '', email: '', phone: '', companyId: '', departmentId: '', roleId: '', password: '' }); setSelectedUser(null); loadAllData();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
  };

  const handleLockUser = async () => {
    try { await userAPI.disableUser(selectedUser.id, lockReason); logAudit('LOCK_USER', selectedUser.email); toast.success('Locked'); setShowLockModal(false); loadAllData(); }
    catch { toast.error('Failed'); }
  };

  const handleUnlock = async (user) => {
    try { await userAPI.enableUser(user.id); logAudit('UNLOCK_USER', user.email); toast.success('Unlocked'); loadAllData(); } catch { toast.error('Failed'); }
  };

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    try {
      if (selectedCompany) { await companyAPI.updateCompany(selectedCompany.id, companyForm); toast.success('Updated'); }
      else { await companyAPI.createCompany(companyForm); toast.success('Created'); }
      setShowCompanyModal(false); setCompanyForm({ name: '', code: '', address: '', phone: '', email: '' }); setSelectedCompany(null); loadAllData();
    } catch { toast.error('Failed'); }
  };

  const handleSaveDept = async (e) => {
    e.preventDefault();
    try {
      if (selectedDept) { await companyAPI.updateDepartment(deptForm.companyId, selectedDept.id, deptForm); toast.success('Updated'); }
      else { await companyAPI.createDepartment(deptForm.companyId, deptForm); toast.success('Created'); }
      setShowDeptModal(false); setDeptForm({ name: '', code: '', companyId: '', parentId: '' }); setSelectedDept(null); loadAllData();
    } catch { toast.error('Failed'); }
  };

  const handleAddDomain = () => {
    if (!newDomain.includes('.')) { toast.error('Invalid domain'); return; }
    const d = newDomain.toLowerCase().trim();
    if (allowedDomains.includes(d)) { toast.error('Exists'); return; }
    const updated = [...allowedDomains, d]; setAllowedDomains(updated); localStorage.setItem('allowedDomains', JSON.stringify(updated));
    logAudit('ADD_DOMAIN', d); toast.success('Added'); setNewDomain('');
  };

  const handleRemoveDomain = (d) => {
    const updated = allowedDomains.filter(x => x !== d); setAllowedDomains(updated); localStorage.setItem('allowedDomains', JSON.stringify(updated)); toast.success('Removed');
  };

  const handleSaveSettings = () => { localStorage.setItem('systemSettings', JSON.stringify(systemSettings)); toast.success('Saved'); };

  const handleSaveAnnouncement = (e) => {
    e.preventDefault();
    const a = { ...announcementForm, id: Date.now(), createdAt: new Date().toISOString() };
    const updated = [a, ...announcements]; setAnnouncements(updated); localStorage.setItem('announcements', JSON.stringify(updated));
    toast.success('Posted'); setShowAnnouncementModal(false); setAnnouncementForm({ title: '', message: '', type: 'info' });
  };

  const filteredUsers = users.filter(u => {
    const s = filters.search.toLowerCase();
    if (s && !`${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(s)) return false;
    if (filters.company && u.company_id !== filters.company) return false;
    if (filters.status === 'active' && !u.is_active) return false;
    if (filters.status === 'locked' && u.is_active) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  const tabs = [
    { id: 'overview', label: '📊 Overview' }, { id: 'users', label: '👥 Users' }, { id: 'companies', label: '🏢 Companies' },
    { id: 'departments', label: '🏛️ Departments' }, { id: 'cafeterias', label: '🍽️ Cafeterias' }, { id: 'domains', label: '🌐 Domains' },
    { id: 'settings', label: '⚙️ Settings' }, { id: 'announcements', label: '📢 Announcements' }, { id: 'audit', label: '📜 Audit' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className={`text-2xl font-bold ${colors.textPrimary}`}>Super Admin Dashboard</h1><p className={colors.textMuted}>System management & settings</p></div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[{ l: 'Total Users', v: stats.totalUsers }, { l: 'Active', v: stats.activeUsers }, { l: 'Companies', v: stats.totalCompanies }, { l: 'Orders Today', v: stats.todayOrders }, { l: 'Locked', v: stats.lockedAccounts }].map((s, i) => {
          const c = getStatCardColors(i);
          return <div key={i} className={`${c.bg} rounded-xl p-4 border-l-4 ${c.border}`}><p className={`text-sm ${c.text} opacity-80`}>{s.l}</p><p className={`text-2xl font-bold ${c.text}`}>{s.v}</p></div>;
        })}
      </div>

      {/* Tabs */}
      <div className={`${colors.bgCard} rounded-xl shadow-sm border ${colors.border}`}>
        <div className={`border-b ${colors.border} flex overflow-x-auto`}>
          {tabs.map(t => <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === t.id ? 'border-indigo-500 text-indigo-600' : `border-transparent ${colors.textMuted}`}`}>{t.label}</button>)}
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className={`${colors.bgSecondary} rounded-xl p-6`}>
                <h3 className={`font-semibold mb-4 ${colors.textPrimary}`}>Quick Stats</h3>
                {[{ l: 'Departments', v: stats.totalDepts }, { l: 'Cafeterias', v: cafeterias.length }, { l: 'Menus', v: menus.length }].map((s, i) => (
                  <div key={i} className={`flex justify-between p-3 ${colors.bgCard} rounded-lg mb-2`}><span className={colors.textSecondary}>{s.l}</span><span className={`font-bold ${colors.textPrimary}`}>{s.v}</span></div>
                ))}
              </div>
              <div className={`${colors.bgSecondary} rounded-xl p-6`}>
                <h3 className={`font-semibold mb-4 ${colors.textPrimary}`}>Recent Activity</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {auditLogs.slice(0, 8).map(l => <div key={l.id} className={`p-2 ${colors.bgCard} rounded text-sm`}><span className={colors.textPrimary}>{l.action}</span> <span className={`text-xs ${colors.textMuted}`}>{l.details}</span></div>)}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 justify-between">
                <div className="flex gap-2">
                  <input placeholder="Search..." className={`px-4 py-2 border ${colors.border} rounded-lg ${colors.bgInput}`} value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} />
                  <select className={`px-4 py-2 border ${colors.border} rounded-lg`} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option value="">All</option><option value="active">Active</option><option value="locked">Locked</option></select>
                </div>
                <button onClick={() => { setSelectedUser(null); setUserForm({ firstName: '', lastName: '', email: '', phone: '', companyId: '', departmentId: '', roleId: '', password: '' }); setShowUserModal(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">+ Add User</button>
              </div>
              <table className="w-full"><thead className={colors.bgSecondary}><tr><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>User</th><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Role</th><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Status</th><th className={`px-4 py-3 text-right text-xs ${colors.textMuted}`}>Actions</th></tr></thead>
                <tbody className={`divide-y ${colors.border}`}>{filteredUsers.map(u => (
                  <tr key={u.id} className={colors.bgHover}>
                    <td className="px-4 py-3"><p className={`font-medium ${colors.textPrimary}`}>{u.first_name} {u.last_name}</p><p className={`text-sm ${colors.textMuted}`}>{u.email}</p></td>
                    <td className={`px-4 py-3 text-sm ${colors.textSecondary}`}>{u.role_code || '-'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 text-xs rounded-full ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{u.is_active ? 'Active' : 'Locked'}</span></td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => { setSelectedUser(u); setUserForm({ firstName: u.first_name || '', lastName: u.last_name || '', email: u.email || '', phone: u.phone || '', companyId: u.company_id || '', departmentId: u.department_id || '', roleId: u.role_id || '', password: '' }); setShowUserModal(true); }} className="text-blue-600 text-sm">Edit</button>
                      {u.is_active ? <button onClick={() => { setSelectedUser(u); setLockReason(''); setShowLockModal(true); }} className="text-orange-600 text-sm">Lock</button> : <button onClick={() => handleUnlock(u)} className="text-green-600 text-sm">Unlock</button>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {activeTab === 'companies' && (
            <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => { setSelectedCompany(null); setCompanyForm({ name: '', code: '', address: '', phone: '', email: '' }); setShowCompanyModal(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">+ Add Company</button></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {companies.map(c => (
                  <div key={c.id} className={`border ${colors.border} rounded-xl p-4 ${colors.bgCard}`}>
                    <h3 className={`font-semibold ${colors.textPrimary}`}>{c.name}</h3><p className={`text-sm ${colors.textMuted} mb-2`}>{c.code}</p>
                    <button onClick={() => { setSelectedCompany(c); setCompanyForm({ name: c.name, code: c.code || '', address: c.address || '', phone: c.phone || '', email: c.email || '' }); setShowCompanyModal(true); }} className="text-blue-600 text-sm">Edit</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'departments' && (
            <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => { setSelectedDept(null); setDeptForm({ name: '', code: '', companyId: '', parentId: '' }); setShowDeptModal(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">+ Add Department</button></div>
              <table className="w-full"><thead className={colors.bgSecondary}><tr><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Department</th><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Code</th><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Company</th><th className={`px-4 py-3 text-right text-xs ${colors.textMuted}`}>Actions</th></tr></thead>
                <tbody className={`divide-y ${colors.border}`}>{departments.map(d => (
                  <tr key={d.id}><td className={`px-4 py-3 ${colors.textPrimary}`}>{d.parent_id ? '↳ ' : ''}{d.name}</td><td className={`px-4 py-3 ${colors.textMuted}`}>{d.code || '-'}</td><td className={`px-4 py-3 ${colors.textSecondary}`}>{d.company_name}</td>
                    <td className="px-4 py-3 text-right"><button onClick={() => { setSelectedDept(d); setDeptForm({ name: d.name, code: d.code || '', companyId: d.company_id, parentId: d.parent_id || '' }); setShowDeptModal(true); }} className="text-blue-600 text-sm">Edit</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {activeTab === 'cafeterias' && (
            <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => { setCafeteriaForm({ name: '', location: '', capacity: '' }); setShowCafeteriaModal(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">+ Add Cafeteria</button></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {cafeterias.map(c => <div key={c.id} className={`border ${colors.border} rounded-xl p-4 ${colors.bgCard}`}><h3 className={`font-semibold ${colors.textPrimary}`}>{c.name}</h3><p className={`text-sm ${colors.textMuted}`}>📍 {c.location || 'N/A'}</p></div>)}
              </div>
            </div>
          )}

          {activeTab === 'domains' && (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4"><p className="text-yellow-800">⚠️ Only users with these email domains can register/login.</p></div>
              <div className="flex gap-4"><input placeholder="company.com" value={newDomain} onChange={e => setNewDomain(e.target.value)} className={`flex-1 px-4 py-2 border ${colors.border} rounded-lg`} /><button onClick={handleAddDomain} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">+ Add</button></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{allowedDomains.map(d => <div key={d} className={`flex justify-between items-center p-3 ${colors.bgSecondary} rounded-lg`}><span className="font-mono">{d}</span><button onClick={() => handleRemoveDomain(d)} className="text-red-600">✕</button></div>)}</div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <ThemeSelector themes={themes} currentTheme={currentTheme} changeTheme={changeTheme} colors={colors} />
              <div className={`${colors.bgSecondary} rounded-xl p-6`}>
                <h3 className={`font-semibold mb-4 ${colors.textPrimary}`}>Order Settings</h3>
                <div className="space-y-4 max-w-md">
                  <div><label className={`block text-sm font-medium mb-1 ${colors.textSecondary}`}>Order Cutoff Time</label><input type="time" value={systemSettings.orderCutoffTime || '10:00'} onChange={e => setSystemSettings({ ...systemSettings, orderCutoffTime: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} /></div>
                  <div><label className={`block text-sm font-medium mb-1 ${colors.textSecondary}`}>Max Orders/Day</label><input type="number" value={systemSettings.maxOrdersPerDay || 500} onChange={e => setSystemSettings({ ...systemSettings, maxOrdersPerDay: parseInt(e.target.value) })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} /></div>
                  <button onClick={handleSaveSettings} className="px-6 py-2 bg-indigo-600 text-white rounded-lg">Save Settings</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'announcements' && (
            <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => setShowAnnouncementModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">+ New Announcement</button></div>
              {announcements.map(a => <div key={a.id} className={`border rounded-lg p-4 ${a.type === 'warning' ? 'border-yellow-300 bg-yellow-50' : a.type === 'urgent' ? 'border-red-300 bg-red-50' : 'border-blue-300 bg-blue-50'}`}><h3 className="font-semibold">{a.title}</h3><p className="mt-1">{a.message}</p></div>)}
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="overflow-x-auto">
              <table className="w-full"><thead className={colors.bgSecondary}><tr><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Time</th><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Action</th><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Details</th></tr></thead>
                <tbody className={`divide-y ${colors.border}`}>{auditLogs.map(l => <tr key={l.id}><td className={`px-4 py-3 text-sm ${colors.textMuted}`}>{new Date(l.timestamp).toLocaleString()}</td><td className={`px-4 py-3 ${colors.textPrimary}`}>{l.action}</td><td className={`px-4 py-3 ${colors.textSecondary}`}>{l.details}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* User Modal */}
      {showUserModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto`}>
        <h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>{selectedUser ? 'Edit' : 'Add'} User</h2>
        <form onSubmit={handleSaveUser} className="space-y-4">
          <div className="grid grid-cols-2 gap-4"><input placeholder="First Name" value={userForm.firstName} onChange={e => setUserForm({ ...userForm, firstName: e.target.value })} className={`px-4 py-2 border ${colors.border} rounded-lg`} required /><input placeholder="Last Name" value={userForm.lastName} onChange={e => setUserForm({ ...userForm, lastName: e.target.value })} className={`px-4 py-2 border ${colors.border} rounded-lg`} required /></div>
          <input type="email" placeholder="Email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} required />
          <input placeholder="Phone" value={userForm.phone} onChange={e => setUserForm({ ...userForm, phone: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} />
          <select value={userForm.companyId} onChange={e => setUserForm({ ...userForm, companyId: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`}><option value="">Select Company</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select value={userForm.roleId} onChange={e => setUserForm({ ...userForm, roleId: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`}><option value="">Select Role</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
          {!selectedUser && <input type="password" placeholder="Password (optional)" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} />}
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowUserModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{selectedUser ? 'Update' : 'Create'}</button></div>
        </form>
      </div></div>}

      {/* Lock Modal */}
      {showLockModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-md`}>
        <h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>🔒 Lock Account</h2>
        <p className={`mb-4 ${colors.textSecondary}`}>Lock {selectedUser?.first_name} {selectedUser?.last_name}?</p>
        <textarea placeholder="Reason (optional)" value={lockReason} onChange={e => setLockReason(e.target.value)} className={`w-full px-4 py-2 border ${colors.border} rounded-lg mb-4`} rows="2" />
        <div className="flex justify-end gap-3"><button onClick={() => setShowLockModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button onClick={handleLockUser} className="px-4 py-2 bg-red-600 text-white rounded-lg">Lock</button></div>
      </div></div>}

      {/* Company Modal */}
      {showCompanyModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-lg`}>
        <h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>{selectedCompany ? 'Edit' : 'Add'} Company</h2>
        <form onSubmit={handleSaveCompany} className="space-y-4">
          <input placeholder="Company Name" value={companyForm.name} onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} required />
          <input placeholder="Code (e.g., PBS)" value={companyForm.code} onChange={e => setCompanyForm({ ...companyForm, code: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} />
          <input placeholder="Address" value={companyForm.address} onChange={e => setCompanyForm({ ...companyForm, address: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} />
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowCompanyModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{selectedCompany ? 'Update' : 'Create'}</button></div>
        </form>
      </div></div>}

      {/* Department Modal */}
      {showDeptModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-lg`}>
        <h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>{selectedDept ? 'Edit' : 'Add'} Department</h2>
        <form onSubmit={handleSaveDept} className="space-y-4">
          <select value={deptForm.companyId} onChange={e => setDeptForm({ ...deptForm, companyId: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} required><option value="">Select Company</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input placeholder="Department Name" value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} required />
          <input placeholder="Code (e.g., HR-001)" value={deptForm.code} onChange={e => setDeptForm({ ...deptForm, code: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} />
          <select value={deptForm.parentId} onChange={e => setDeptForm({ ...deptForm, parentId: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`}><option value="">No Parent (Top Level)</option>{departments.filter(d => d.company_id === deptForm.companyId).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowDeptModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{selectedDept ? 'Update' : 'Create'}</button></div>
        </form>
      </div></div>}

      {/* Announcement Modal */}
      {showAnnouncementModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-lg`}>
        <h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>New Announcement</h2>
        <form onSubmit={handleSaveAnnouncement} className="space-y-4">
          <input placeholder="Title" value={announcementForm.title} onChange={e => setAnnouncementForm({ ...announcementForm, title: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} required />
          <select value={announcementForm.type} onChange={e => setAnnouncementForm({ ...announcementForm, type: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`}><option value="info">ℹ️ Info</option><option value="warning">⚠️ Warning</option><option value="urgent">🚨 Urgent</option></select>
          <textarea placeholder="Message" value={announcementForm.message} onChange={e => setAnnouncementForm({ ...announcementForm, message: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} rows="4" required />
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowAnnouncementModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Post</button></div>
        </form>
      </div></div>}
    </div>
  );
}
