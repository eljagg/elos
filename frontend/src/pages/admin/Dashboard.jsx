import { useState, useEffect } from 'react';
import { userAPI, companyAPI, orderAPI, menuAPI, messageAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import LicenseManager from '../../components/LicenseManager';
import toast from 'react-hot-toast';

// Theme definitions for the theme selector
const themeOptions = [
  { id: 'soft-blue', name: 'Soft Blue', desc: 'Professional corporate look', colors: { sidebar: 'from-indigo-800 to-blue-900', accent: 'bg-indigo-600' } },
  { id: 'dark-mode', name: 'Dark Mode', desc: 'Easy on the eyes', colors: { sidebar: 'from-slate-900 to-slate-800', accent: 'bg-cyan-600' } },
  { id: 'warm-neutral', name: 'Warm Neutral', desc: 'Food-friendly tones', colors: { sidebar: 'from-orange-800 to-amber-900', accent: 'bg-orange-600' } },
  { id: 'green-fresh', name: 'Green Fresh', desc: 'Health & wellness', colors: { sidebar: 'from-emerald-800 to-teal-900', accent: 'bg-emerald-600' } }
];

export default function AdminDashboard() {
  const { colors, currentTheme, changeTheme, getStatCardColors } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [cafeterias, setCafeterias] = useState([]);
  const [domains, setDomains] = useState([]);
  const [orders, setOrders] = useState([]);
  const [roles, setRoles] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState({});
  const [filters, setFilters] = useState({ search: '', role: '', company: '', status: '' });

  const [showUserModal, setShowUserModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showCafeteriaModal, setShowCafeteriaModal] = useState(false);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedCafeteria, setSelectedCafeteria] = useState(null);
  const [userForm, setUserForm] = useState({ firstName: '', lastName: '', email: '', phone: '', roleId: '', companyId: '', departmentId: '' });
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [companyForm, setCompanyForm] = useState({ name: '', code: '', address: '', phone: '', email: '', contactPerson: '' });
  const [departmentForm, setDepartmentForm] = useState({ name: '', companyId: '', managerId: '' });
  const [cafeteriaForm, setCafeteriaForm] = useState({ name: '', location: '', capacity: '', companyId: '' });
  const [domainForm, setDomainForm] = useState({ domain: '', companyId: '' });
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', type: 'info' });
  const [orderSettings, setOrderSettings] = useState({ cutoffTime: '10:00', advanceOrderDays: 1 });

  // Check if user is SYSTEM_OWNER
  const isSystemOwner = user?.role === 'SYSTEM_OWNER' || user?.role_code === 'SYSTEM_OWNER';

  useEffect(() => { loadAllData(); }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [usersRes, companiesRes, ordersRes, rolesRes] = await Promise.all([
        userAPI.getUsers({ limit: 500 }).catch(() => ({ data: { data: { users: [] } } })),
        companyAPI.getCompanies().catch(() => ({ data: { data: { companies: [] } } })),
        orderAPI.getOrders({ limit: 100 }).catch(() => ({ data: { data: { orders: [] } } })),
        userAPI.getRoles().catch(() => ({ data: { data: { roles: [] } } }))
      ]);
      const usersList = usersRes.data?.data?.users || [];
      const companiesList = companiesRes.data?.data?.companies || [];
      const ordersList = ordersRes.data?.data?.orders || [];
      setUsers(usersList);
      setCompanies(companiesList);
      setOrders(ordersList);
      setRoles(rolesRes.data?.data?.roles || []);
      const allDepts = [], allDomains = [];
      // Get all cafeterias directly
      const allCafesRes = await companyAPI.getCafeterias().catch(() => ({ data: { data: { cafeterias: [] } } }));
      const allCafes = allCafesRes.data?.data?.cafeterias || [];
      
      for (const c of companiesList) {
        const [dRes, domRes] = await Promise.all([
          companyAPI.getDepartments(c.id).catch(() => ({ data: { data: { departments: [] } } })),
          adminAPI.getDomains(c.id).catch(() => ({ data: { data: { domains: [] } } }))
        ]);
        allDepts.push(...(dRes.data?.data?.departments || []).map(d => ({ ...d, company_name: c.name })));
        allDomains.push(...(domRes.data?.data?.domains || []).map(dm => ({ ...dm, company_name: c.name })));
      }
      setDepartments(allDepts); setCafeterias(allCafes); setDomains(allDomains);
      const today = new Date().toISOString().split('T')[0];
      setStats({ totalUsers: usersList.length, activeUsers: usersList.filter(u => u.is_active).length, companies: companiesList.length, ordersToday: ordersList.filter(o => o.order_date === today).length, lockedUsers: usersList.filter(u => u.locked_until && new Date(u.locked_until) > new Date()).length });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      if (selectedUser) {
        // Update existing user - only send fields that are editable
        const updateData = {
          firstName: userForm.firstName,
          lastName: userForm.lastName,
          phone: userForm.phone,
          roleId: userForm.roleId || undefined,
          companyId: userForm.companyId || undefined,
          departmentId: userForm.departmentId || undefined
        };
        // Remove undefined/empty values
        Object.keys(updateData).forEach(key => {
          if (updateData[key] === undefined || updateData[key] === '') {
            delete updateData[key];
          }
        });
        await userAPI.updateUser(selectedUser.id, updateData);
        toast.success('User updated successfully');
      } else {
        // Create new user
        await userAPI.createUser({ ...userForm, password: 'TempPass123!' });
        toast.success('User created with temporary password: TempPass123!');
      }
      setShowUserModal(false);
      loadAllData();
    } catch (err) {
      console.error('Save user error:', err);
      toast.error(err.response?.data?.error?.message || 'Failed to save user');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      await userAPI.resetPassword(selectedUser.id, passwordForm.newPassword);
      toast.success('Password reset successfully');
      setShowPasswordModal(false);
      setPasswordForm({ newPassword: '', confirmPassword: '' });
    } catch (err) {
      console.error('Reset password error:', err);
      toast.error(err.response?.data?.error?.message || 'Failed to reset password');
    }
  };

  const handleDeleteUser = async (id) => { if (!confirm('Delete this user?')) return; try { await userAPI.deleteUser(id); toast.success('Deleted'); loadAllData(); } catch { toast.error('Failed'); } };
  const handleUnlockUser = async (id) => { try { await userAPI.enableUser(id); toast.success('Unlocked'); loadAllData(); } catch { toast.error('Failed'); } };
  const handleSaveCompany = async (e) => { e.preventDefault(); try { if (selectedCompany) { await companyAPI.updateCompany(selectedCompany.id, companyForm); toast.success('Updated'); } else { await companyAPI.createCompany(companyForm); toast.success('Created'); } setShowCompanyModal(false); loadAllData(); } catch { toast.error('Failed'); } };
  const handleDeleteCompany = async (id) => { if (!confirm('Delete this company?')) return; try { await companyAPI.deleteCompany(id); toast.success('Deleted'); loadAllData(); } catch { toast.error('Failed'); } };
  const handleDeleteDepartment = async (companyId, deptId) => { if (!confirm("Delete this department?")) return; try { await companyAPI.deleteDepartment(companyId, deptId); toast.success("Deleted"); loadAllData(); } catch { toast.error("Failed"); } };
  const handleDeleteCafeteria = async (id) => { if (!confirm("Delete this cafeteria?")) return; try { await companyAPI.deleteCafeteria(id); toast.success("Deleted"); loadAllData(); } catch { toast.error("Failed"); } };
  const handleSaveDepartment = async (e) => { e.preventDefault(); try { if (selectedDepartment) { await companyAPI.updateDepartment(selectedDepartment.company_id, selectedDepartment.id, departmentForm); toast.success('Updated'); } else { await companyAPI.createDepartment(departmentForm.companyId, departmentForm); toast.success('Created'); } setShowDepartmentModal(false); loadAllData(); } catch { toast.error('Failed'); } };
  const handleSaveCafeteria = async (e) => { e.preventDefault(); try { if (selectedCafeteria) { await companyAPI.updateCafeteria(selectedCafeteria.company_id, selectedCafeteria.id, cafeteriaForm); toast.success('Updated'); } else { await companyAPI.createCafeteria(cafeteriaForm); toast.success('Created'); } setShowCafeteriaModal(false); loadAllData(); } catch { toast.error('Failed'); } };
  const handleSaveDomain = async (e) => { e.preventDefault(); try { await adminAPI.addDomain(domainForm.companyId, domainForm.domain); toast.success('Added'); setShowDomainModal(false); loadAllData(); } catch { toast.error('Failed'); } };
  const handleDeleteDomain = async (companyId, domain) => { if (!confirm('Delete this domain?')) return; try { await adminAPI.removeDomain(companyId, domain); toast.success('Deleted'); loadAllData(); } catch { toast.error('Failed'); } };
  const handleSaveAnnouncement = async (e) => { e.preventDefault(); try { await messageAPI.createAnnouncement(announcementForm); toast.success('Created'); setShowAnnouncementModal(false); setAnnouncements([...announcements, { id: Date.now(), ...announcementForm }]); } catch { toast.error('Failed'); } };
  const handleThemeChange = (themeId) => { changeTheme(themeId); toast.success(`Theme changed to ${themeOptions.find(t => t.id === themeId)?.name}`); };

  const openPasswordModal = (user) => {
    setSelectedUser(user);
    setPasswordForm({ newPassword: '', confirmPassword: '' });
    setShowPasswordModal(true);
  };

  const filteredUsers = users.filter(u => { const s = filters.search.toLowerCase(); if (s && !`${u.firstName} ${u.lastName} ${u.email} ${u.employeeCode || ""} ${u.roleName || ""} ${u.companyName || ""}`.toLowerCase().includes(s)) return false; if (filters.role && u.role_id !== filters.role) return false; if (filters.company && u.company_id !== filters.company) return false; if (filters.status === 'active' && !u.is_active) return false; if (filters.status === 'locked' && (!u.locked_until || new Date(u.locked_until) <= new Date())) return false; return true; });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  // Tabs - License tab only shown to SYSTEM_OWNER
  const baseTabs = [
    { id: 'overview', label: '📊 Overview' }, { id: 'users', label: '👥 Users' }, { id: 'companies', label: '🏢 Companies' },
    { id: 'departments', label: '🏛️ Departments' }, { id: 'cafeterias', label: '🍽️ Cafeterias' }, { id: 'domains', label: '🌐 Domains' },
    { id: 'settings', label: '⚙️ Settings' }, { id: 'announcements', label: '📢 Announcements' }, { id: 'audit', label: '📜 Audit' }
  ];
  
  const tabs = isSystemOwner 
    ? [...baseTabs.slice(0, 7), { id: 'license', label: '🔑 License' }, ...baseTabs.slice(7)]
    : baseTabs;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-2xl font-bold ${colors.textPrimary}`}>
            {isSystemOwner ? 'System Owner Dashboard' : 'Super Admin Dashboard'}
          </h1>
          <p className={colors.textMuted}>
            {isSystemOwner ? 'Full system control & license management' : 'System management & settings'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[{ l: 'Total Users', v: stats.totalUsers }, { l: 'Active', v: stats.activeUsers }, { l: 'Companies', v: stats.companies }, { l: 'Orders Today', v: stats.ordersToday }, { l: 'Locked', v: stats.lockedUsers }].map((s, i) => {
          const c = getStatCardColors(i);
          return <div key={i} className={`${c.bg} rounded-xl p-4 border-l-4 ${c.border}`}><p className={`text-sm ${c.text} opacity-80`}>{s.l}</p><p className={`text-2xl font-bold ${c.text}`}>{s.v}</p></div>;
        })}
      </div>

      <div className={`${colors.bgCard} rounded-xl shadow-sm border ${colors.border}`}>
        <div className={`border-b ${colors.border} flex overflow-x-auto`}>{tabs.map(t => <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === t.id ? 'border-indigo-500 text-indigo-600' : `border-transparent ${colors.textMuted}`}`}>{t.label}</button>)}</div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className={`${colors.bgSecondary} rounded-xl p-6`}><h3 className={`font-semibold mb-4 ${colors.textPrimary}`}>Quick Stats</h3><div className="space-y-3">{[{ l: 'Departments', v: departments.length }, { l: 'Cafeterias', v: cafeterias.length }, { l: 'Menus', v: '-' }].map((s, i) => <div key={i} className={`flex justify-between p-3 ${colors.bgCard} rounded-lg`}><span className={colors.textSecondary}>{s.l}</span><span className={`font-bold ${colors.textPrimary}`}>{s.v}</span></div>)}</div></div>
              <div className={`${colors.bgSecondary} rounded-xl p-6`}><h3 className={`font-semibold mb-4 ${colors.textPrimary}`}>Recent Activity</h3><p className={colors.textMuted}>Activity log coming soon...</p></div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 justify-between">
                <div className="flex flex-wrap gap-2">
                  <input placeholder="Search..." className={`px-4 py-2 border ${colors.border} rounded-lg ${colors.bgInput}`} value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} />
                  <select className={`px-4 py-2 border ${colors.border} rounded-lg`} value={filters.role} onChange={e => setFilters({ ...filters, role: e.target.value })}><option value="">All Roles</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
                  <select className={`px-4 py-2 border ${colors.border} rounded-lg`} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option value="">All Status</option><option value="active">Active</option><option value="locked">Locked</option></select>
                </div>
                <button onClick={() => { setSelectedUser(null); setUserForm({ firstName: '', lastName: '', email: '', phone: '', roleId: '', companyId: '', departmentId: '' }); setShowUserModal(true); }} className={`px-4 py-2 ${colors.btnPrimary} rounded-lg`}>+ Add User</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={colors.bgSecondary}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-xs font-medium ${colors.textMuted} uppercase`}>User</th>
                      <th className={`px-4 py-3 text-left text-xs font-medium ${colors.textMuted} uppercase`}>Role</th>
                      <th className={`px-4 py-3 text-left text-xs font-medium ${colors.textMuted} uppercase`}>Company</th>
                      <th className={`px-4 py-3 text-left text-xs font-medium ${colors.textMuted} uppercase`}>Status</th>
                      <th className={`px-4 py-3 text-right text-xs font-medium ${colors.textMuted} uppercase`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${colors.border}`}>
                    {filteredUsers.map(u => (
                      <tr key={u.id} className={colors.bgHover}>
                        <td className="px-4 py-3">
                          <p className={`font-medium ${colors.textPrimary}`}>{u.first_name} {u.last_name}</p>
                          <p className={`text-sm ${colors.textMuted}`}>{u.email}</p>
                        </td>
                        <td className={`px-4 py-3 text-sm ${colors.textSecondary}`}>{u.roleName || '-'}</td>
                        <td className={`px-4 py-3 text-sm ${colors.textSecondary}`}>{u.companyName || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded-full ${u.locked_until && new Date(u.locked_until) > new Date() ? 'bg-red-100 text-red-800' : u.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {u.locked_until && new Date(u.locked_until) > new Date() ? 'Locked' : u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {u.locked_until && new Date(u.locked_until) > new Date() && (
                              <button onClick={() => handleUnlockUser(u.id)} className="text-green-600 text-sm hover:underline">Unlock</button>
                            )}
                            <button onClick={() => openPasswordModal(u)} className="text-amber-600 text-sm hover:underline">Reset Password</button>
                            <button onClick={() => { setSelectedUser(u); setUserForm({ firstName: u.first_name, lastName: u.last_name, email: u.email, phone: u.phone || '', roleId: u.role_id || '', companyId: u.company_id || '', departmentId: u.department_id || '' }); setShowUserModal(true); }} className="text-blue-600 text-sm hover:underline">Edit</button>
                            <button onClick={() => handleDeleteUser(u.id)} className="text-red-600 text-sm hover:underline">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'companies' && (
            <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => { setSelectedCompany(null); setCompanyForm({ name: '', code: '', address: '', phone: '', email: '', contactPerson: '' }); setShowCompanyModal(true); }} className={`px-4 py-2 ${colors.btnPrimary} rounded-lg`}>+ Add Company</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{companies.map(c => <div key={c.id} className={`border ${colors.border} rounded-xl p-4 ${colors.bgCard}`}><h3 className={`font-semibold ${colors.textPrimary}`}>{c.name}</h3><p className={`text-sm ${colors.textMuted}`}>{c.code}</p><p className={`text-sm ${colors.textSecondary} mt-2`}>{c.address || 'No address'}</p><div className="flex gap-2 mt-3"><button onClick={() => { setSelectedCompany(c); setCompanyForm({ name: c.name, code: c.code, address: c.address || '', phone: c.phone || '', email: c.email || '', contactPerson: c.contact_person || '' }); setShowCompanyModal(true); }} className="text-blue-600 text-sm">Edit</button><button onClick={() => handleDeleteCompany(c.id)} className="text-red-600 text-sm">Delete</button></div></div>)}</div>
            </div>
          )}

          {activeTab === 'departments' && (
            <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => { setSelectedDepartment(null); setDepartmentForm({ name: '', companyId: '', managerId: '' }); setShowDepartmentModal(true); }} className={`px-4 py-2 ${colors.btnPrimary} rounded-lg`}>+ Add Department</button></div>
              <table className="w-full"><thead className={colors.bgSecondary}><tr><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Name</th><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Company</th><th className={`px-4 py-3 text-right text-xs ${colors.textMuted}`}>Actions</th></tr></thead><tbody className={`divide-y ${colors.border}`}>{departments.map(d => <tr key={d.id}><td className={`px-4 py-3 ${colors.textPrimary}`}>{d.name}</td><td className={`px-4 py-3 ${colors.textSecondary}`}>{d.company_name}</td><td className="px-4 py-3 text-right"><button onClick={() => { setSelectedDepartment(d); setDepartmentForm({ name: d.name, companyId: d.company_id, managerId: d.manager_id || '' }); setShowDepartmentModal(true); }} className="text-blue-600 text-sm">Edit</button><button onClick={() => handleDeleteDepartment(d.company_id, d.id)} className="text-red-600 text-sm ml-3">Delete</button></td></tr>)}</tbody></table>
            </div>
          )}

          {activeTab === 'cafeterias' && (
            <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => { setSelectedCafeteria(null); setCafeteriaForm({ name: '', location: '', capacity: '', companyId: '' }); setShowCafeteriaModal(true); }} className={`px-4 py-2 ${colors.btnPrimary} rounded-lg`}>+ Add Cafeteria</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{cafeterias.map(c => <div key={c.id} className={`border ${colors.border} rounded-xl p-4 ${colors.bgCard}`}><h3 className={`font-semibold ${colors.textPrimary}`}>{c.name}</h3><p className={`text-sm ${colors.textMuted}`}>{c.company_name}</p><p className={`text-sm ${colors.textSecondary}`}>{c.location}</p><button onClick={() => { setSelectedCafeteria(c); setCafeteriaForm({ name: c.name, location: c.location || '', capacity: c.capacity || '', companyId: c.company_id }); setShowCafeteriaModal(true); }} className="text-blue-600 text-sm mt-2">Edit</button><button onClick={() => handleDeleteCafeteria(c.id)} className="text-red-600 text-sm mt-2 ml-2">Delete</button></div>)}</div>
            </div>
          )}

          {activeTab === 'domains' && (
            <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => { setDomainForm({ domain: '', companyId: '' }); setShowDomainModal(true); }} className={`px-4 py-2 ${colors.btnPrimary} rounded-lg`}>+ Add Domain</button></div>
              <table className="w-full"><thead className={colors.bgSecondary}><tr><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Domain</th><th className={`px-4 py-3 text-left text-xs ${colors.textMuted}`}>Company</th><th className={`px-4 py-3 text-right text-xs ${colors.textMuted}`}>Actions</th></tr></thead><tbody className={`divide-y ${colors.border}`}>{domains.map((d, i) => <tr key={i}><td className={`px-4 py-3 ${colors.textPrimary}`}>{d.domain}</td><td className={`px-4 py-3 ${colors.textSecondary}`}>{d.company_name}</td><td className="px-4 py-3 text-right"><button onClick={() => handleDeleteDomain(d.company_id, d.domain)} className="text-red-600 text-sm">Delete</button></td></tr>)}</tbody></table>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className={`${colors.bgSecondary} rounded-xl p-6`}>
                <h3 className={`font-semibold mb-4 ${colors.textPrimary}`}>🎨 Theme Settings</h3>
                <p className={`text-sm ${colors.textMuted} mb-4`}>Choose a color theme for the application</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {themeOptions.map(theme => (
                    <button key={theme.id} onClick={() => handleThemeChange(theme.id)} className={`relative p-4 rounded-xl border-2 transition-all ${currentTheme === theme.id ? 'border-indigo-500 ring-2 ring-indigo-200' : `${colors.border} hover:border-indigo-300`}`}>
                      <div className={`h-12 rounded-lg bg-gradient-to-r ${theme.colors.sidebar} mb-3`}></div>
                      <div className={`h-2 w-1/2 rounded ${theme.colors.accent} mb-2`}></div>
                      <p className={`font-medium text-sm ${colors.textPrimary}`}>{theme.name}</p>
                      <p className={`text-xs ${colors.textMuted}`}>{theme.desc}</p>
                      {currentTheme === theme.id && <div className="absolute top-2 right-2 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center"><span className="text-white text-xs">✓</span></div>}
                    </button>
                  ))}
                </div>
              </div>
              <div className={`${colors.bgSecondary} rounded-xl p-6`}>
                <h3 className={`font-semibold mb-4 ${colors.textPrimary}`}>🕐 Order Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={`block text-sm ${colors.textSecondary} mb-1`}>Order Cutoff Time</label><input type="time" value={orderSettings.cutoffTime} onChange={e => setOrderSettings({ ...orderSettings, cutoffTime: e.target.value })} className={`px-4 py-2 border ${colors.border} rounded-lg w-full`} /></div>
                  <div><label className={`block text-sm ${colors.textSecondary} mb-1`}>Advance Order Days</label><input type="number" min="0" max="7" value={orderSettings.advanceOrderDays} onChange={e => setOrderSettings({ ...orderSettings, advanceOrderDays: parseInt(e.target.value) })} className={`px-4 py-2 border ${colors.border} rounded-lg w-full`} /></div>
                </div>
                <button className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg">Save Settings</button>
              </div>
            </div>
          )}

          {activeTab === 'license' && isSystemOwner && (
            <LicenseManager />
          )}

          {activeTab === 'announcements' && (
            <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => setShowAnnouncementModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">+ New Announcement</button></div>
              {announcements.map(a => <div key={a.id} className={`border rounded-lg p-4 ${a.type === 'warning' ? 'border-yellow-300 bg-yellow-50' : a.type === 'urgent' ? 'border-red-300 bg-red-50' : 'border-blue-300 bg-blue-50'}`}><h3 className="font-semibold">{a.title}</h3><p className="mt-1">{a.message}</p></div>)}
            </div>
          )}

          {activeTab === 'audit' && (
            <div><p className={colors.textMuted}>Audit log feature coming soon...</p></div>
          )}
        </div>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto`}>
            <h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>{selectedUser ? 'Edit' : 'Add'} User</h2>
            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input placeholder="First Name" value={userForm.firstName} onChange={e => setUserForm({ ...userForm, firstName: e.target.value })} className={`px-4 py-2 border ${colors.border} rounded-lg`} required />
                <input placeholder="Last Name" value={userForm.lastName} onChange={e => setUserForm({ ...userForm, lastName: e.target.value })} className={`px-4 py-2 border ${colors.border} rounded-lg`} required />
              </div>
              <input type="email" placeholder="Email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} required disabled={!!selectedUser} />
              {selectedUser && <p className={`text-xs ${colors.textMuted}`}>Email cannot be changed. Use "Reset Password" to change password.</p>}
              <input placeholder="Phone" value={userForm.phone} onChange={e => setUserForm({ ...userForm, phone: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} />
              <select value={userForm.roleId} onChange={e => setUserForm({ ...userForm, roleId: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`}>
                <option value="">Select Role</option>
                {roles.filter(r => r.code !== 'SYSTEM_OWNER').map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <select value={userForm.companyId} onChange={e => setUserForm({ ...userForm, companyId: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`}>
                <option value="">Select Company</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowUserModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{selectedUser ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-md`}>
            <h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>🔐 Reset Password</h2>
            <p className={`mb-4 ${colors.textSecondary}`}>
              Reset password for: <strong>{selectedUser?.first_name} {selectedUser?.last_name}</strong>
              <br /><span className={colors.textMuted}>{selectedUser?.email}</span>
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${colors.textSecondary}`}>New Password</label>
                <input 
                  type="password" 
                  placeholder="Enter new password" 
                  value={passwordForm.newPassword} 
                  onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} 
                  className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} 
                  required 
                  minLength={6}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${colors.textSecondary}`}>Confirm Password</label>
                <input 
                  type="password" 
                  placeholder="Confirm new password" 
                  value={passwordForm.confirmPassword} 
                  onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} 
                  className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} 
                  required 
                  minLength={6}
                />
              </div>
              {passwordForm.newPassword && passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                <p className="text-red-500 text-sm">Passwords do not match</p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowPasswordModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button>
                <button type="submit" className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg">Reset Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Company Modal */}
      {showCompanyModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-lg`}><h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>{selectedCompany ? 'Edit' : 'Add'} Company</h2><form onSubmit={handleSaveCompany} className="space-y-4"><input placeholder="Company Name" value={companyForm.name} onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} required /><input placeholder="Code" value={companyForm.code} onChange={e => setCompanyForm({ ...companyForm, code: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} required /><input placeholder="Address" value={companyForm.address} onChange={e => setCompanyForm({ ...companyForm, address: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} /><div className="grid grid-cols-2 gap-4"><input placeholder="Phone" value={companyForm.phone} onChange={e => setCompanyForm({ ...companyForm, phone: e.target.value })} className={`px-4 py-2 border ${colors.border} rounded-lg`} /><input placeholder="Email" value={companyForm.email} onChange={e => setCompanyForm({ ...companyForm, email: e.target.value })} className={`px-4 py-2 border ${colors.border} rounded-lg`} /></div><input placeholder="Contact Person" value={companyForm.contactPerson} onChange={e => setCompanyForm({ ...companyForm, contactPerson: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} /><div className="flex justify-end gap-3"><button type="button" onClick={() => setShowCompanyModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{selectedCompany ? 'Update' : 'Create'}</button></div></form></div></div>}

      {/* Department Modal */}
      {showDepartmentModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-md`}><h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>{selectedDepartment ? 'Edit' : 'Add'} Department</h2><form onSubmit={handleSaveDepartment} className="space-y-4"><input placeholder="Department Name" value={departmentForm.name} onChange={e => setDepartmentForm({ ...departmentForm, name: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} required /><select value={departmentForm.companyId} onChange={e => setDepartmentForm({ ...departmentForm, companyId: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} required><option value="">Select Company</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="flex justify-end gap-3"><button type="button" onClick={() => setShowDepartmentModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{selectedDepartment ? 'Update' : 'Create'}</button></div></form></div></div>}

      {/* Cafeteria Modal */}
      {showCafeteriaModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-md`}><h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>{selectedCafeteria ? 'Edit' : 'Add'} Cafeteria</h2><form onSubmit={handleSaveCafeteria} className="space-y-4"><input placeholder="Cafeteria Name" value={cafeteriaForm.name} onChange={e => setCafeteriaForm({ ...cafeteriaForm, name: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} required /><input placeholder="Location" value={cafeteriaForm.location} onChange={e => setCafeteriaForm({ ...cafeteriaForm, location: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} /><input type="number" placeholder="Capacity" value={cafeteriaForm.capacity} onChange={e => setCafeteriaForm({ ...cafeteriaForm, capacity: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} /><select value={cafeteriaForm.companyId} onChange={e => setCafeteriaForm({ ...cafeteriaForm, companyId: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} required><option value="">Select Company</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="flex justify-end gap-3"><button type="button" onClick={() => setShowCafeteriaModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{selectedCafeteria ? 'Update' : 'Create'}</button></div></form></div></div>}

      {/* Domain Modal */}
      {showDomainModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-md`}><h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>Add Allowed Domain</h2><form onSubmit={handleSaveDomain} className="space-y-4"><input placeholder="Domain (e.g. company.com)" value={domainForm.domain} onChange={e => setDomainForm({ ...domainForm, domain: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} required /><select value={domainForm.companyId} onChange={e => setDomainForm({ ...domainForm, companyId: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} required><option value="">Select Company</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="flex justify-end gap-3"><button type="button" onClick={() => setShowDomainModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Add Domain</button></div></form></div></div>}

      {/* Announcement Modal */}
      {showAnnouncementModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-lg`}><h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>New Announcement</h2><form onSubmit={handleSaveAnnouncement} className="space-y-4"><input placeholder="Title" value={announcementForm.title} onChange={e => setAnnouncementForm({ ...announcementForm, title: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} required /><textarea placeholder="Message" value={announcementForm.message} onChange={e => setAnnouncementForm({ ...announcementForm, message: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`} rows="4" required /><select value={announcementForm.type} onChange={e => setAnnouncementForm({ ...announcementForm, type: e.target.value })} className={`w-full px-4 py-2 border ${colors.border} rounded-lg`}><option value="info">Info</option><option value="warning">Warning</option><option value="urgent">Urgent</option></select><div className="flex justify-end gap-3"><button type="button" onClick={() => setShowAnnouncementModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Publish</button></div></form></div></div>}
    </div>
  );
}
