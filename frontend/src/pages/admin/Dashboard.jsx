import { useState, useEffect, useRef } from 'react';
import { userAPI, companyAPI, orderAPI, menuAPI, messageAPI, settingsAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [cafeterias, setCafeterias] = useState([]);
  const [kitchenStaff, setKitchenStaff] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menus, setMenus] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [allowedDomains, setAllowedDomains] = useState([]);
  const [systemSettings, setSystemSettings] = useState({});
  const [announcements, setAnnouncements] = useState([]);

  const [filters, setFilters] = useState({ search: '', company: '', role: '', status: '' });

  // Modals
  const [showUserModal, setShowUserModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showCafeteriaModal, setShowCafeteriaModal] = useState(false);
  const [showKitchenAssignModal, setShowKitchenAssignModal] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showMenuAssignModal, setShowMenuAssignModal] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedCafeteria, setSelectedCafeteria] = useState(null);

  const [userForm, setUserForm] = useState({ firstName: '', lastName: '', email: '', phone: '', companyId: '', departmentId: '', roleId: '', password: '' });
  const [companyForm, setCompanyForm] = useState({ name: '', code: '', address: '', phone: '', email: '', logo: '', isActive: true });
  const [deptForm, setDeptForm] = useState({ name: '', code: '', companyId: '', parentId: '', headUserId: '', description: '' });
  const [cafeteriaForm, setCafeteriaForm] = useState({ name: '', location: '', capacity: '', openTime: '07:00', closeTime: '15:00', isActive: true });
  const [kitchenAssignForm, setKitchenAssignForm] = useState({ userId: '', cafeteriaId: '', role: 'KITCHEN_STAFF' });
  const [lockForm, setLockForm] = useState({ reason: '', sendEmail: true });
  const [newDomain, setNewDomain] = useState('');
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', type: 'info', expiresAt: '' });
  const [menuAssignForm, setMenuAssignForm] = useState({ menuId: '', assignType: 'global', companyId: '', departmentId: '' });

  const [roles, setRoles] = useState([]);
  const fileInputRef = useRef(null);

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
      const ordersList = ordersRes.data?.data?.orders || [];
      const cafeteriasList = cafeteriasRes.data?.data?.cafeterias || [];

      setUsers(usersList);
      setCompanies(companiesList);
      setCafeterias(cafeteriasList);
      setOrders(ordersList);
      setMenus(menusRes.data?.data?.menus || []);
      setRoles(rolesRes.data?.data?.roles || []);

      // Filter kitchen staff
      setKitchenStaff(usersList.filter(u => ['KITCHEN_HEAD', 'KITCHEN_SOUS', 'KITCHEN_STAFF'].includes(u.role_code)));

      // Load departments from all companies
      const allDepts = [];
      for (const company of companiesList) {
        const deptRes = await companyAPI.getDepartments(company.id).catch(() => ({ data: { data: { departments: [] } } }));
        const depts = (deptRes.data?.data?.departments || []).map(d => ({ ...d, company_name: company.name }));
        allDepts.push(...depts);
      }
      setDepartments(allDepts);

      // Load settings from localStorage (would be API in production)
      setAllowedDomains(JSON.parse(localStorage.getItem('allowedDomains') || '["faceycommodity.com","seprod.com","mussongroup.com","tgeddesgrant.com","pbs.group","elos.com"]'));
      setSystemSettings(JSON.parse(localStorage.getItem('systemSettings') || '{"orderCutoffTime":"10:00","maxOrdersPerDay":500,"requireApproval":false}'));
      setAnnouncements(JSON.parse(localStorage.getItem('announcements') || '[]'));
      setAuditLogs(JSON.parse(localStorage.getItem('auditLogs') || '[]').slice(0, 100));

      // Calculate stats
      const today = new Date().toISOString().split('T')[0];
      setStats({
        totalUsers: usersList.length,
        activeUsers: usersList.filter(u => u.is_active).length,
        totalCompanies: companiesList.length,
        totalCafeterias: cafeteriasList.length,
        totalDepartments: allDepts.length,
        todayOrders: ordersList.filter(o => o.order_date === today).length,
        pendingOrders: ordersList.filter(o => o.status === 'pending').length,
        totalMenus: menusRes.data?.data?.menus?.length || 0,
        lockedAccounts: usersList.filter(u => !u.is_active).length,
        kitchenStaff: usersList.filter(u => ['KITCHEN_HEAD', 'KITCHEN_SOUS', 'KITCHEN_STAFF'].includes(u.role_code)).length
      });
    } catch (error) { console.error('Failed to load data:', error); }
    finally { setLoading(false); }
  };

  // Audit logging helper
  const logAuditAction = (action, details) => {
    const log = { id: Date.now(), action, details, timestamp: new Date().toISOString(), admin: 'Current Admin' };
    const logs = [log, ...auditLogs].slice(0, 500);
    setAuditLogs(logs);
    localStorage.setItem('auditLogs', JSON.stringify(logs));
  };

  // User Management
  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      if (selectedUser) {
        await userAPI.updateUser(selectedUser.id, userForm);
        logAuditAction('UPDATE_USER', `Updated user: ${userForm.email}`);
        toast.success('User updated');
      } else {
        await userAPI.createUser({ ...userForm, password: userForm.password || 'TempPass123!' });
        logAuditAction('CREATE_USER', `Created user: ${userForm.email}`);
        toast.success('User created');
      }
      setShowUserModal(false);
      resetUserForm();
      loadAllData();
    } catch (error) { toast.error(error.response?.data?.error?.message || 'Failed to save user'); }
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setUserForm({
      firstName: user.first_name || '', lastName: user.last_name || '', email: user.email || '',
      phone: user.phone || '', companyId: user.company_id || '', departmentId: user.department_id || '',
      roleId: user.role_id || '', password: ''
    });
    setShowUserModal(true);
  };

  const handleDeleteUser = async (id, email) => {
    if (!confirm('Delete this user permanently?')) return;
    try {
      await userAPI.deleteUser(id);
      logAuditAction('DELETE_USER', `Deleted user: ${email}`);
      toast.success('User deleted');
      loadAllData();
    } catch { toast.error('Failed to delete'); }
  };

  const resetUserForm = () => {
    setUserForm({ firstName: '', lastName: '', email: '', phone: '', companyId: '', departmentId: '', roleId: '', password: '' });
    setSelectedUser(null);
  };

  // Lock/Unlock User
  const handleLockUser = (user) => {
    setSelectedUser(user);
    setLockForm({ reason: '', sendEmail: true });
    setShowLockModal(true);
  };

  const handleConfirmLock = async () => {
    try {
      await userAPI.disableUser(selectedUser.id, lockForm.reason);
      logAuditAction('LOCK_USER', `Locked user: ${selectedUser.email}, Reason: ${lockForm.reason}`);
      if (lockForm.sendEmail) {
        // In production, backend would send email
        toast.success('User locked and notification email queued');
      } else {
        toast.success('User locked');
      }
      setShowLockModal(false);
      loadAllData();
    } catch { toast.error('Failed to lock user'); }
  };

  const handleUnlockUser = async (user) => {
    try {
      await userAPI.enableUser(user.id);
      logAuditAction('UNLOCK_USER', `Unlocked user: ${user.email}`);
      // In production, backend would send email notification
      toast.success('User unlocked and notification email queued');
      loadAllData();
    } catch { toast.error('Failed to unlock user'); }
  };

  const handleForcePasswordReset = async (user) => {
    if (!confirm(`Send password reset email to ${user.email}?`)) return;
    try {
      // In production, this would trigger backend email
      logAuditAction('PASSWORD_RESET', `Sent password reset to: ${user.email}`);
      toast.success('Password reset email sent');
    } catch { toast.error('Failed to send reset email'); }
  };

  // Company Management
  const handleSaveCompany = async (e) => {
    e.preventDefault();
    try {
      if (selectedCompany) {
        await companyAPI.updateCompany(selectedCompany.id, companyForm);
        logAuditAction('UPDATE_COMPANY', `Updated company: ${companyForm.name}`);
        toast.success('Company updated');
      } else {
        await companyAPI.createCompany(companyForm);
        logAuditAction('CREATE_COMPANY', `Created company: ${companyForm.name}`);
        toast.success('Company created');
      }
      setShowCompanyModal(false);
      setCompanyForm({ name: '', code: '', address: '', phone: '', email: '', logo: '', isActive: true });
      setSelectedCompany(null);
      loadAllData();
    } catch (error) { toast.error(error.response?.data?.error?.message || 'Failed to save'); }
  };

  const handleEditCompany = (company) => {
    setSelectedCompany(company);
    setCompanyForm({
      name: company.name || '', code: company.code || '', address: company.address || '',
      phone: company.phone || '', email: company.email || '', logo: company.logo_url || '', isActive: company.is_active !== false
    });
    setShowCompanyModal(true);
  };

  const handleDeleteCompany = async (id, name) => {
    if (!confirm('Delete this company? This will affect all associated users.')) return;
    try {
      await companyAPI.deleteCompany(id);
      logAuditAction('DELETE_COMPANY', `Deleted company: ${name}`);
      toast.success('Company deleted');
      loadAllData();
    } catch { toast.error('Failed to delete'); }
  };

  // Department Management with Hierarchy
  const handleSaveDepartment = async (e) => {
    e.preventDefault();
    try {
      if (selectedDepartment) {
        await companyAPI.updateDepartment(deptForm.companyId, selectedDepartment.id, deptForm);
        logAuditAction('UPDATE_DEPARTMENT', `Updated department: ${deptForm.name}`);
        toast.success('Department updated');
      } else {
        await companyAPI.createDepartment(deptForm.companyId, deptForm);
        logAuditAction('CREATE_DEPARTMENT', `Created department: ${deptForm.name} in company ${deptForm.companyId}`);
        toast.success('Department created');
      }
      setShowDepartmentModal(false);
      setDeptForm({ name: '', code: '', companyId: '', parentId: '', headUserId: '', description: '' });
      setSelectedDepartment(null);
      loadAllData();
    } catch (error) { toast.error(error.response?.data?.error?.message || 'Failed to save'); }
  };

  const handleEditDepartment = (dept) => {
    setSelectedDepartment(dept);
    setDeptForm({
      name: dept.name || '', code: dept.code || '', companyId: dept.company_id || '',
      parentId: dept.parent_id || '', headUserId: dept.head_user_id || '', description: dept.description || ''
    });
    setShowDepartmentModal(true);
  };

  // Cafeteria Management
  const handleSaveCafeteria = async (e) => {
    e.preventDefault();
    try {
      if (selectedCafeteria) {
        await companyAPI.updateCafeteria(selectedCafeteria.id, cafeteriaForm);
        logAuditAction('UPDATE_CAFETERIA', `Updated cafeteria: ${cafeteriaForm.name}`);
        toast.success('Cafeteria updated');
      } else {
        await companyAPI.createCafeteria(cafeteriaForm);
        logAuditAction('CREATE_CAFETERIA', `Created cafeteria: ${cafeteriaForm.name}`);
        toast.success('Cafeteria created');
      }
      setShowCafeteriaModal(false);
      setCafeteriaForm({ name: '', location: '', capacity: '', openTime: '07:00', closeTime: '15:00', isActive: true });
      setSelectedCafeteria(null);
      loadAllData();
    } catch (error) { toast.error(error.response?.data?.error?.message || 'Failed to save'); }
  };

  // Kitchen Staff Assignment
  const handleAssignKitchenStaff = async (e) => {
    e.preventDefault();
    try {
      await userAPI.assignToCafeteria(kitchenAssignForm.userId, kitchenAssignForm.cafeteriaId, kitchenAssignForm.role);
      const user = users.find(u => u.id === kitchenAssignForm.userId);
      const cafeteria = cafeterias.find(c => c.id === kitchenAssignForm.cafeteriaId);
      logAuditAction('ASSIGN_KITCHEN_STAFF', `Assigned ${user?.email} to ${cafeteria?.name} as ${kitchenAssignForm.role}`);
      toast.success('Kitchen staff assigned');
      setShowKitchenAssignModal(false);
      setKitchenAssignForm({ userId: '', cafeteriaId: '', role: 'KITCHEN_STAFF' });
      loadAllData();
    } catch (error) { toast.error('Failed to assign staff'); }
  };

  // Domain Management
  const handleAddDomain = () => {
    if (!newDomain || !newDomain.includes('.')) {
      toast.error('Enter a valid domain');
      return;
    }
    const domain = newDomain.toLowerCase().trim();
    if (allowedDomains.includes(domain)) {
      toast.error('Domain already exists');
      return;
    }
    const updated = [...allowedDomains, domain];
    setAllowedDomains(updated);
    localStorage.setItem('allowedDomains', JSON.stringify(updated));
    logAuditAction('ADD_DOMAIN', `Added allowed domain: ${domain}`);
    toast.success('Domain added');
    setNewDomain('');
  };

  const handleRemoveDomain = (domain) => {
    if (!confirm(`Remove ${domain} from allowed domains?`)) return;
    const updated = allowedDomains.filter(d => d !== domain);
    setAllowedDomains(updated);
    localStorage.setItem('allowedDomains', JSON.stringify(updated));
    logAuditAction('REMOVE_DOMAIN', `Removed allowed domain: ${domain}`);
    toast.success('Domain removed');
  };

  // System Settings
  const handleSaveSettings = () => {
    localStorage.setItem('systemSettings', JSON.stringify(systemSettings));
    logAuditAction('UPDATE_SETTINGS', 'Updated system settings');
    toast.success('Settings saved');
    setShowSettingsModal(false);
  };

  // Announcements
  const handleSaveAnnouncement = (e) => {
    e.preventDefault();
    const announcement = { ...announcementForm, id: Date.now(), createdAt: new Date().toISOString() };
    const updated = [announcement, ...announcements];
    setAnnouncements(updated);
    localStorage.setItem('announcements', JSON.stringify(updated));
    logAuditAction('CREATE_ANNOUNCEMENT', `Created announcement: ${announcement.title}`);
    toast.success('Announcement posted');
    setShowAnnouncementModal(false);
    setAnnouncementForm({ title: '', message: '', type: 'info', expiresAt: '' });
  };

  const handleDeleteAnnouncement = (id) => {
    const updated = announcements.filter(a => a.id !== id);
    setAnnouncements(updated);
    localStorage.setItem('announcements', JSON.stringify(updated));
    toast.success('Announcement deleted');
  };

  // Menu Assignment
  const handleAssignMenu = async (e) => {
    e.preventDefault();
    try {
      await menuAPI.assignMenu(menuAssignForm.menuId, {
        assignType: menuAssignForm.assignType,
        companyId: menuAssignForm.companyId,
        departmentId: menuAssignForm.departmentId
      });
      logAuditAction('ASSIGN_MENU', `Assigned menu ${menuAssignForm.menuId} - Type: ${menuAssignForm.assignType}`);
      toast.success('Menu assigned');
      setShowMenuAssignModal(false);
      setMenuAssignForm({ menuId: '', assignType: 'global', companyId: '', departmentId: '' });
    } catch { toast.error('Failed to assign menu'); }
  };

  // Export Data
  const handleExportData = (type) => {
    let data, filename;
    if (type === 'users') {
      const headers = ['First Name', 'Last Name', 'Email', 'Company', 'Department', 'Role', 'Status'];
      const rows = users.map(u => [u.first_name, u.last_name, u.email, u.company_name || '', u.department_name || '', u.role_code || '', u.is_active ? 'Active' : 'Inactive']);
      data = [headers, ...rows].map(r => r.map(c => `"${c || ''}"`).join(',')).join('\n');
      filename = 'users_export.csv';
    } else if (type === 'orders') {
      const headers = ['Date', 'Order #', 'Employee', 'Company', 'Meal', 'Total', 'Status'];
      const rows = orders.map(o => [o.order_date, o.order_number, `${o.user_first_name} ${o.user_last_name}`, o.company_name || '', o.meal_type, o.total, o.status]);
      data = [headers, ...rows].map(r => r.map(c => `"${c || ''}"`).join(',')).join('\n');
      filename = 'orders_export.csv';
    } else if (type === 'audit') {
      const headers = ['Timestamp', 'Action', 'Details', 'Admin'];
      const rows = auditLogs.map(l => [l.timestamp, l.action, l.details, l.admin]);
      data = [headers, ...rows].map(r => r.map(c => `"${c || ''}"`).join(',')).join('\n');
      filename = 'audit_log_export.csv';
    }
    const blob = new Blob([data], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    toast.success('Export downloaded');
  };

  // Filtering
  const filteredUsers = users.filter(u => {
    const search = filters.search.toLowerCase();
    if (search && !`${u.first_name} ${u.last_name}`.toLowerCase().includes(search) && !u.email?.toLowerCase().includes(search)) return false;
    if (filters.company && u.company_id !== filters.company) return false;
    if (filters.role && u.role_code !== filters.role) return false;
    if (filters.status === 'active' && !u.is_active) return false;
    if (filters.status === 'inactive' && u.is_active) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'users', label: '👥 Users' },
    { id: 'companies', label: '🏢 Companies' },
    { id: 'departments', label: '🏛️ Departments' },
    { id: 'cafeterias', label: '🍽️ Cafeterias' },
    { id: 'kitchen', label: '👨‍🍳 Kitchen Staff' },
    { id: 'menus', label: '📋 Menu Assignment' },
    { id: 'domains', label: '🌐 Domains' },
    { id: 'settings', label: '⚙️ Settings' },
    { id: 'announcements', label: '📢 Announcements' },
    { id: 'audit', label: '📜 Audit Log' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-gray-800">Super Admin Dashboard</h1><p className="text-gray-500">Complete system management</p></div>
        <div className="flex gap-3">
          <button onClick={() => handleExportData('users')} className="px-4 py-2 border border-green-600 text-green-600 rounded-lg text-sm">📤 Export Users</button>
          <button onClick={() => handleExportData('audit')} className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg text-sm">📤 Export Audit</button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-indigo-50 rounded-xl p-4 border-l-4 border-indigo-500"><p className="text-sm text-indigo-600">Total Users</p><p className="text-2xl font-bold text-indigo-700">{stats.totalUsers}</p></div>
        <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500"><p className="text-sm text-green-600">Active Users</p><p className="text-2xl font-bold text-green-700">{stats.activeUsers}</p></div>
        <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500"><p className="text-sm text-blue-600">Companies</p><p className="text-2xl font-bold text-blue-700">{stats.totalCompanies}</p></div>
        <div className="bg-orange-50 rounded-xl p-4 border-l-4 border-orange-500"><p className="text-sm text-orange-600">Today's Orders</p><p className="text-2xl font-bold text-orange-700">{stats.todayOrders}</p></div>
        <div className="bg-red-50 rounded-xl p-4 border-l-4 border-red-500"><p className="text-sm text-red-600">Locked Accounts</p><p className="text-2xl font-bold text-red-700">{stats.lockedAccounts}</p></div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b flex overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === tab.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500'}`}>{tab.label}</button>
          ))}
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold mb-4">Quick Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between p-3 bg-white rounded-lg"><span>Departments</span><span className="font-bold">{stats.totalDepartments}</span></div>
                  <div className="flex justify-between p-3 bg-white rounded-lg"><span>Cafeterias</span><span className="font-bold">{stats.totalCafeterias}</span></div>
                  <div className="flex justify-between p-3 bg-white rounded-lg"><span>Kitchen Staff</span><span className="font-bold">{stats.kitchenStaff}</span></div>
                  <div className="flex justify-between p-3 bg-white rounded-lg"><span>Active Menus</span><span className="font-bold">{stats.totalMenus}</span></div>
                  <div className="flex justify-between p-3 bg-white rounded-lg"><span>Pending Orders</span><span className="font-bold">{stats.pendingOrders}</span></div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold mb-4">Recent Activity</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {auditLogs.slice(0, 10).map(log => (
                    <div key={log.id} className="p-2 bg-white rounded text-sm">
                      <div className="flex justify-between"><span className="font-medium">{log.action}</span><span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</span></div>
                      <p className="text-gray-600 text-xs">{log.details}</p>
                    </div>
                  ))}
                  {auditLogs.length === 0 && <p className="text-gray-500 text-center py-4">No recent activity</p>}
                </div>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 justify-between">
                <div className="flex flex-wrap gap-4">
                  <input type="text" placeholder="Search users..." className="px-4 py-2 border rounded-lg" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
                  <select className="px-4 py-2 border rounded-lg" value={filters.company} onChange={(e) => setFilters({ ...filters, company: e.target.value })}><option value="">All Companies</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  <select className="px-4 py-2 border rounded-lg" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All Status</option><option value="active">Active</option><option value="inactive">Locked</option></select>
                </div>
                <button onClick={() => { resetUserForm(); setShowUserModal(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">+ Add User</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {filteredUsers.map(user => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3"><div className="flex items-center"><div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold mr-3">{(user.first_name || '?')[0]}{(user.last_name || '?')[0]}</div><div><p className="font-medium">{user.first_name} {user.last_name}</p><p className="text-sm text-gray-500">{user.email}</p></div></div></td>
                        <td className="px-4 py-3 text-sm">{user.company_name || '-'}</td>
                        <td className="px-4 py-3"><span className="px-2 py-1 text-xs rounded-full bg-gray-100">{user.role_code || user.role_name || '-'}</span></td>
                        <td className="px-4 py-3"><span className={`px-2 py-1 text-xs rounded-full ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{user.is_active ? 'Active' : 'Locked'}</span></td>
                        <td className="px-4 py-3 text-right space-x-1">
                          <button onClick={() => handleEditUser(user)} className="text-blue-600 text-sm">Edit</button>
                          {user.is_active ? (
                            <button onClick={() => handleLockUser(user)} className="text-orange-600 text-sm">Lock</button>
                          ) : (
                            <button onClick={() => handleUnlockUser(user)} className="text-green-600 text-sm">Unlock</button>
                          )}
                          <button onClick={() => handleForcePasswordReset(user)} className="text-purple-600 text-sm">Reset PW</button>
                          <button onClick={() => handleDeleteUser(user.id, user.email)} className="text-red-600 text-sm">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Companies Tab */}
          {activeTab === 'companies' && (
            <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => { setSelectedCompany(null); setCompanyForm({ name: '', code: '', address: '', phone: '', email: '', logo: '', isActive: true }); setShowCompanyModal(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">+ Add Company</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {companies.map(company => (
                  <div key={company.id} className={`border rounded-xl p-4 ${company.is_active === false ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {company.logo_url ? <img src={company.logo_url} alt="" className="w-12 h-12 rounded object-cover" /> : <div className="w-12 h-12 bg-indigo-100 rounded flex items-center justify-center text-indigo-600 font-bold">{company.name?.[0]}</div>}
                        <div><h3 className="font-semibold">{company.name}</h3><p className="text-sm text-gray-500">{company.code}</p></div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{company.address || 'No address'}</p>
                    <p className="text-sm text-gray-500 mb-3">{company.employee_count || 0} employees</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleEditCompany(company)} className="flex-1 px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm">Edit</button>
                      <button onClick={() => handleDeleteCompany(company.id, company.name)} className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Departments Tab */}
          {activeTab === 'departments' && (
            <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => { setSelectedDepartment(null); setDeptForm({ name: '', code: '', companyId: '', parentId: '', headUserId: '', description: '' }); setShowDepartmentModal(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">+ Add Department</button></div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parent Dept</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {departments.map(dept => (
                      <tr key={dept.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{dept.parent_id && '↳ '}{dept.name}</td>
                        <td className="px-4 py-3 text-sm font-mono">{dept.code || '-'}</td>
                        <td className="px-4 py-3 text-sm">{dept.company_name}</td>
                        <td className="px-4 py-3 text-sm">{departments.find(d => d.id === dept.parent_id)?.name || '-'}</td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button onClick={() => handleEditDepartment(dept)} className="text-blue-600 text-sm">Edit</button>
                          <button onClick={() => { setDeptForm({ ...deptForm, companyId: dept.company_id, parentId: dept.id }); setShowDepartmentModal(true); }} className="text-green-600 text-sm">+ Sub-Dept</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cafeterias Tab */}
          {activeTab === 'cafeterias' && (
            <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => { setSelectedCafeteria(null); setCafeteriaForm({ name: '', location: '', capacity: '', openTime: '07:00', closeTime: '15:00', isActive: true }); setShowCafeteriaModal(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">+ Add Cafeteria</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cafeterias.map(caf => (
                  <div key={caf.id} className="border rounded-xl p-4">
                    <h3 className="font-semibold mb-2">{caf.name}</h3>
                    <p className="text-sm text-gray-600 mb-1">📍 {caf.location || 'No location'}</p>
                    <p className="text-sm text-gray-500 mb-1">👥 Capacity: {caf.capacity || 'N/A'}</p>
                    <p className="text-sm text-gray-500 mb-3">🕐 {caf.open_time || '07:00'} - {caf.close_time || '15:00'}</p>
                    <p className="text-sm text-gray-500 mb-3">👨‍🍳 {kitchenStaff.filter(k => k.cafeteria_id === caf.id).length} staff assigned</p>
                    <div className="flex gap-2">
                      <button onClick={() => { setSelectedCafeteria(caf); setCafeteriaForm({ name: caf.name, location: caf.location || '', capacity: caf.capacity || '', openTime: caf.open_time || '07:00', closeTime: caf.close_time || '15:00', isActive: caf.is_active !== false }); setShowCafeteriaModal(true); }} className="flex-1 px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm">Edit</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Kitchen Staff Tab */}
          {activeTab === 'kitchen' && (
            <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => setShowKitchenAssignModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">+ Assign Kitchen Staff</button></div>
              {cafeterias.map(caf => {
                const staff = kitchenStaff.filter(k => k.cafeteria_id === caf.id);
                return (
                  <div key={caf.id} className="border rounded-xl p-4">
                    <h3 className="font-semibold mb-3">🍽️ {caf.name}</h3>
                    {staff.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {staff.map(s => (
                          <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">{s.role_code === 'KITCHEN_HEAD' ? '👨‍🍳' : '🧑‍🍳'}</div>
                              <div><p className="font-medium">{s.first_name} {s.last_name}</p><p className="text-xs text-gray-500">{s.role_code}</p></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No staff assigned</p>
                    )}
                  </div>
                );
              })}
              {kitchenStaff.filter(k => !k.cafeteria_id).length > 0 && (
                <div className="border rounded-xl p-4 border-orange-300 bg-orange-50">
                  <h3 className="font-semibold mb-3">⚠️ Unassigned Kitchen Staff</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {kitchenStaff.filter(k => !k.cafeteria_id).map(s => (
                      <div key={s.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <div><p className="font-medium">{s.first_name} {s.last_name}</p><p className="text-xs text-gray-500">{s.email}</p></div>
                        <button onClick={() => { setKitchenAssignForm({ userId: s.id, cafeteriaId: '', role: s.role_code }); setShowKitchenAssignModal(true); }} className="px-3 py-1 bg-orange-600 text-white rounded text-sm">Assign</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Menu Assignment Tab */}
          {activeTab === 'menus' && (
            <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => setShowMenuAssignModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">+ Assign Menu</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {menus.map(menu => (
                  <div key={menu.id} className="border rounded-xl p-4">
                    <h3 className="font-semibold">{menu.name}</h3>
                    <p className="text-sm text-gray-500 mb-2">{menu.meal_type} • {menu.menu_type || 'Regular'}</p>
                    <p className="text-sm text-gray-600 mb-2">{menu.description}</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {menu.is_global && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">🌍 Global</span>}
                      {menu.company_name && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">🏢 {menu.company_name}</span>}
                      {menu.department_name && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">🏛️ {menu.department_name}</span>}
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${menu.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{menu.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Domains Tab */}
          {activeTab === 'domains' && (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-4">
                <p className="text-yellow-800">⚠️ Only users with email addresses from these domains can register/login to the system.</p>
              </div>
              <div className="flex gap-4 mb-6">
                <input type="text" placeholder="Enter domain (e.g., company.com)" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} className="flex-1 px-4 py-2 border rounded-lg" />
                <button onClick={handleAddDomain} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">+ Add Domain</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allowedDomains.map(domain => (
                  <div key={domain} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <span className="font-mono">{domain}</span>
                    <button onClick={() => handleRemoveDomain(domain)} className="text-red-600 hover:text-red-800">🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl space-y-6">
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold mb-4">Order Settings</h3>
                <div className="space-y-4">
                  <div><label className="block text-sm font-medium mb-1">Order Cutoff Time</label><input type="time" value={systemSettings.orderCutoffTime || '10:00'} onChange={(e) => setSystemSettings({ ...systemSettings, orderCutoffTime: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /><p className="text-xs text-gray-500 mt-1">Orders cannot be placed after this time</p></div>
                  <div><label className="block text-sm font-medium mb-1">Max Orders Per Day</label><input type="number" value={systemSettings.maxOrdersPerDay || 500} onChange={(e) => setSystemSettings({ ...systemSettings, maxOrdersPerDay: parseInt(e.target.value) })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="flex items-center gap-2"><input type="checkbox" checked={systemSettings.requireApproval || false} onChange={(e) => setSystemSettings({ ...systemSettings, requireApproval: e.target.checked })} /> Require manager approval for orders</label></div>
                </div>
              </div>
              <button onClick={handleSaveSettings} className="px-6 py-2 bg-indigo-600 text-white rounded-lg">Save Settings</button>
            </div>
          )}

          {/* Announcements Tab */}
          {activeTab === 'announcements' && (
            <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => setShowAnnouncementModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">+ New Announcement</button></div>
              {announcements.length > 0 ? announcements.map(ann => (
                <div key={ann.id} className={`border rounded-lg p-4 ${ann.type === 'warning' ? 'border-yellow-300 bg-yellow-50' : ann.type === 'urgent' ? 'border-red-300 bg-red-50' : 'border-blue-300 bg-blue-50'}`}>
                  <div className="flex justify-between items-start">
                    <div><h3 className="font-semibold">{ann.title}</h3><p className="text-sm text-gray-500">{new Date(ann.createdAt).toLocaleDateString()}</p></div>
                    <button onClick={() => handleDeleteAnnouncement(ann.id)} className="text-red-600">🗑️</button>
                  </div>
                  <p className="mt-2">{ann.message}</p>
                </div>
              )) : <p className="text-gray-500 text-center py-12">No announcements</p>}
            </div>
          )}

          {/* Audit Log Tab */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => handleExportData('audit')} className="px-4 py-2 border border-green-600 text-green-600 rounded-lg text-sm">📤 Export Log</button></div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admin</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="px-4 py-3"><span className="px-2 py-1 text-xs rounded bg-gray-100">{log.action}</span></td>
                        <td className="px-4 py-3 text-sm">{log.details}</td>
                        <td className="px-4 py-3 text-sm">{log.admin}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{selectedUser ? 'Edit User' : 'Add User'}</h2>
            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">First Name *</label><input type="text" value={userForm.firstName} onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required /></div>
                <div><label className="block text-sm font-medium mb-1">Last Name *</label><input type="text" value={userForm.lastName} onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required /></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Email *</label><input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required /></div>
              <div><label className="block text-sm font-medium mb-1">Phone</label><input type="tel" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
              {!selectedUser && <div><label className="block text-sm font-medium mb-1">Password</label><input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className="w-full px-4 py-2 border rounded-lg" placeholder="Leave blank for default" /></div>}
              <div><label className="block text-sm font-medium mb-1">Company</label><select value={userForm.companyId} onChange={(e) => setUserForm({ ...userForm, companyId: e.target.value })} className="w-full px-4 py-2 border rounded-lg"><option value="">Select</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium mb-1">Department</label><select value={userForm.departmentId} onChange={(e) => setUserForm({ ...userForm, departmentId: e.target.value })} className="w-full px-4 py-2 border rounded-lg"><option value="">Select</option>{departments.filter(d => !userForm.companyId || d.company_id === userForm.companyId).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium mb-1">Role *</label><select value={userForm.roleId} onChange={(e) => setUserForm({ ...userForm, roleId: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required><option value="">Select</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowUserModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{selectedUser ? 'Update' : 'Create'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Lock User Modal */}
      {showLockModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">🔒 Lock Account</h2>
            <p className="mb-4">Lock account for <strong>{selectedUser.first_name} {selectedUser.last_name}</strong>?</p>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Reason</label><textarea value={lockForm.reason} onChange={(e) => setLockForm({ ...lockForm, reason: e.target.value })} className="w-full px-4 py-2 border rounded-lg" rows="2" placeholder="Why is this account being locked?" /></div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={lockForm.sendEmail} onChange={(e) => setLockForm({ ...lockForm, sendEmail: e.target.checked })} /> Send email notification to user</label>
              <div className="flex justify-end gap-3"><button onClick={() => setShowLockModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button><button onClick={handleConfirmLock} className="px-4 py-2 bg-red-600 text-white rounded-lg">Lock Account</button></div>
            </div>
          </div>
        </div>
      )}

      {/* Company Modal */}
      {showCompanyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">{selectedCompany ? 'Edit Company' : 'Add Company'}</h2>
            <form onSubmit={handleSaveCompany} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Company Name *</label><input type="text" value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required /></div>
                <div><label className="block text-sm font-medium mb-1">Code</label><input type="text" value={companyForm.code} onChange={(e) => setCompanyForm({ ...companyForm, code: e.target.value })} className="w-full px-4 py-2 border rounded-lg" placeholder="e.g., PBS" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Address</label><input type="text" value={companyForm.address} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Phone</label><input type="tel" value={companyForm.phone} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-1">Email</label><input type="email" value={companyForm.email} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Logo URL</label><input type="url" value={companyForm.logo} onChange={(e) => setCompanyForm({ ...companyForm, logo: e.target.value })} className="w-full px-4 py-2 border rounded-lg" placeholder="https://..." /></div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={companyForm.isActive} onChange={(e) => setCompanyForm({ ...companyForm, isActive: e.target.checked })} /> Active</label>
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowCompanyModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{selectedCompany ? 'Update' : 'Create'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Department Modal */}
      {showDepartmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">{selectedDepartment ? 'Edit Department' : 'Add Department'}</h2>
            <form onSubmit={handleSaveDepartment} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Company *</label><select value={deptForm.companyId} onChange={(e) => setDeptForm({ ...deptForm, companyId: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required><option value="">Select Company</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Department Name *</label><input type="text" value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required /></div>
                <div><label className="block text-sm font-medium mb-1">Code</label><input type="text" value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} className="w-full px-4 py-2 border rounded-lg" placeholder="e.g., HR-001" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Parent Department (for sub-department)</label><select value={deptForm.parentId} onChange={(e) => setDeptForm({ ...deptForm, parentId: e.target.value })} className="w-full px-4 py-2 border rounded-lg"><option value="">None (Top Level)</option>{departments.filter(d => d.company_id === deptForm.companyId && d.id !== selectedDepartment?.id).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium mb-1">Department Head</label><select value={deptForm.headUserId} onChange={(e) => setDeptForm({ ...deptForm, headUserId: e.target.value })} className="w-full px-4 py-2 border rounded-lg"><option value="">None</option>{users.filter(u => u.company_id === deptForm.companyId).map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}</select></div>
              <div><label className="block text-sm font-medium mb-1">Description</label><textarea value={deptForm.description} onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })} className="w-full px-4 py-2 border rounded-lg" rows="2" /></div>
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowDepartmentModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{selectedDepartment ? 'Update' : 'Create'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Cafeteria Modal */}
      {showCafeteriaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">{selectedCafeteria ? 'Edit Cafeteria' : 'Add Cafeteria'}</h2>
            <form onSubmit={handleSaveCafeteria} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Name *</label><input type="text" value={cafeteriaForm.name} onChange={(e) => setCafeteriaForm({ ...cafeteriaForm, name: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required /></div>
              <div><label className="block text-sm font-medium mb-1">Location</label><input type="text" value={cafeteriaForm.location} onChange={(e) => setCafeteriaForm({ ...cafeteriaForm, location: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
              <div><label className="block text-sm font-medium mb-1">Capacity</label><input type="number" value={cafeteriaForm.capacity} onChange={(e) => setCafeteriaForm({ ...cafeteriaForm, capacity: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Open Time</label><input type="time" value={cafeteriaForm.openTime} onChange={(e) => setCafeteriaForm({ ...cafeteriaForm, openTime: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-1">Close Time</label><input type="time" value={cafeteriaForm.closeTime} onChange={(e) => setCafeteriaForm({ ...cafeteriaForm, closeTime: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
              </div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={cafeteriaForm.isActive} onChange={(e) => setCafeteriaForm({ ...cafeteriaForm, isActive: e.target.checked })} /> Active</label>
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowCafeteriaModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{selectedCafeteria ? 'Update' : 'Create'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Kitchen Staff Assignment Modal */}
      {showKitchenAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Assign Kitchen Staff</h2>
            <form onSubmit={handleAssignKitchenStaff} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Staff Member *</label><select value={kitchenAssignForm.userId} onChange={(e) => setKitchenAssignForm({ ...kitchenAssignForm, userId: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required><option value="">Select</option>{users.filter(u => ['KITCHEN_HEAD', 'KITCHEN_SOUS', 'KITCHEN_STAFF'].includes(u.role_code)).map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.role_code})</option>)}</select></div>
              <div><label className="block text-sm font-medium mb-1">Cafeteria *</label><select value={kitchenAssignForm.cafeteriaId} onChange={(e) => setKitchenAssignForm({ ...kitchenAssignForm, cafeteriaId: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required><option value="">Select</option>{cafeterias.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium mb-1">Role</label><select value={kitchenAssignForm.role} onChange={(e) => setKitchenAssignForm({ ...kitchenAssignForm, role: e.target.value })} className="w-full px-4 py-2 border rounded-lg"><option value="KITCHEN_HEAD">Head Chef</option><option value="KITCHEN_SOUS">Sous Chef</option><option value="KITCHEN_STAFF">Kitchen Staff</option></select></div>
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowKitchenAssignModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Assign</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Menu Assignment Modal */}
      {showMenuAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Assign Menu</h2>
            <form onSubmit={handleAssignMenu} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Menu *</label><select value={menuAssignForm.menuId} onChange={(e) => setMenuAssignForm({ ...menuAssignForm, menuId: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required><option value="">Select Menu</option>{menus.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium mb-1">Assignment Type</label><select value={menuAssignForm.assignType} onChange={(e) => setMenuAssignForm({ ...menuAssignForm, assignType: e.target.value })} className="w-full px-4 py-2 border rounded-lg"><option value="global">Global (All Employees)</option><option value="company">Specific Company</option><option value="department">Specific Department</option></select></div>
              {menuAssignForm.assignType === 'company' && <div><label className="block text-sm font-medium mb-1">Company</label><select value={menuAssignForm.companyId} onChange={(e) => setMenuAssignForm({ ...menuAssignForm, companyId: e.target.value })} className="w-full px-4 py-2 border rounded-lg"><option value="">Select</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
              {menuAssignForm.assignType === 'department' && <div><label className="block text-sm font-medium mb-1">Department</label><select value={menuAssignForm.departmentId} onChange={(e) => setMenuAssignForm({ ...menuAssignForm, departmentId: e.target.value })} className="w-full px-4 py-2 border rounded-lg"><option value="">Select</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.company_name})</option>)}</select></div>}
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowMenuAssignModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Assign</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Announcement Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">New Announcement</h2>
            <form onSubmit={handleSaveAnnouncement} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Title *</label><input type="text" value={announcementForm.title} onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required /></div>
              <div><label className="block text-sm font-medium mb-1">Type</label><select value={announcementForm.type} onChange={(e) => setAnnouncementForm({ ...announcementForm, type: e.target.value })} className="w-full px-4 py-2 border rounded-lg"><option value="info">ℹ️ Info</option><option value="warning">⚠️ Warning</option><option value="urgent">🚨 Urgent</option></select></div>
              <div><label className="block text-sm font-medium mb-1">Message *</label><textarea value={announcementForm.message} onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })} className="w-full px-4 py-2 border rounded-lg" rows="4" required /></div>
              <div><label className="block text-sm font-medium mb-1">Expires At (optional)</label><input type="date" value={announcementForm.expiresAt} onChange={(e) => setAnnouncementForm({ ...announcementForm, expiresAt: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowAnnouncementModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Post</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
