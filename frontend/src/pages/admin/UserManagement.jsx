/**
 * User Management - Mobile-first responsive design
 * Full CRUD operations: Add, Update, Delete, Enable/Disable
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { userAPI, companyAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function UserManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [filters, setFilters] = useState({ search: '', role: '', company: '', status: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  
  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [disableReason, setDisableReason] = useState('');

  useEffect(() => { loadInitialData(); }, []);
  useEffect(() => { loadUsers(); }, [filters, pagination.page]);

  const loadInitialData = async () => {
    try {
      const [rolesRes, companiesRes] = await Promise.all([
        userAPI.getRoles().catch(() => ({ data: { data: { roles: [] } } })),
        companyAPI.getCompanies().catch(() => ({ data: { data: { companies: [] } } }))
      ]);
      setRoles(rolesRes.data?.data?.roles || []);
      setCompanies(companiesRes.data?.data?.companies || []);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (filters.search) params.search = filters.search;
      if (filters.role) params.roleCode = filters.role;
      if (filters.company) params.companyId = filters.company;
      if (filters.status) params.isActive = filters.status;
      
      const response = await userAPI.getUsers(params);
      const data = response.data?.data || {};
      setUsers(data.users || []);
      setPagination(prev => ({ ...prev, total: data.total || 0 }));
    } catch (error) {
      console.error('Failed to load users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      await userAPI.deleteUser(selectedUser.id);
      toast.success('User deleted successfully');
      setShowDeleteModal(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to delete user');
    }
  };

  const handleDisableUser = async () => {
    if (!selectedUser) return;
    try {
      await userAPI.disableUser(selectedUser.id, disableReason || 'Disabled by admin');
      toast.success('User disabled successfully');
      setShowDisableModal(false);
      setSelectedUser(null);
      setDisableReason('');
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to disable user');
    }
  };

  const handleEnableUser = async (user) => {
    try {
      await userAPI.enableUser(user.id);
      toast.success('User enabled successfully');
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to enable user');
    }
  };

  const openDisableModal = (user) => {
    setSelectedUser(user);
    setDisableReason('');
    setShowDisableModal(true);
  };

  const openDeleteModal = (user) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const getRoleBadge = (roleCode, roleName) => {
    const styles = {
      'SYSTEM_OWNER': { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
      'SUPER_ADMIN': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
      'HR_ADMIN': { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-200' },
      'KITCHEN_HEAD': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
      'KITCHEN_STAFF': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
      'RECEPTIONIST': { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-200' },
      'DELIVERY': { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-200' },
      'EMPLOYEE': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
    };
    const style = styles[roleCode] || { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' };
    return (
      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${style.bg} ${style.text} ${style.border}`}>
        {roleName || roleCode || 'Unknown'}
      </span>
    );
  };

  const stats = {
    total: users.length,
    active: users.filter(u => u.is_active || u.isActive).length,
    inactive: users.filter(u => !(u.is_active || u.isActive)).length,
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 text-sm">Manage employee accounts and access</p>
        </div>
        <Link
          to="/admin/users/new"
          className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium text-center flex items-center justify-center gap-2"
        >
          <span>+</span> Add User
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 rounded-xl p-3 sm:p-4 border border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-lg">👥</div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{pagination.total || stats.total}</p>
              <p className="text-xs text-gray-500">Total Users</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 sm:p-4 border border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-lg">✓</div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.active}</p>
              <p className="text-xs text-gray-500">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 sm:p-4 border border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-lg">⊘</div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-red-600">{stats.inactive}</p>
              <p className="text-xs text-gray-500">Inactive</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-50 rounded-xl p-3 sm:p-4 border border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <select
            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            value={filters.role}
            onChange={(e) => setFilters({ ...filters, role: e.target.value })}
          >
            <option value="">All Roles</option>
            {roles.map(role => (
              <option key={role.id} value={role.code}>{role.name}</option>
            ))}
          </select>
          <select
            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            value={filters.company}
            onChange={(e) => setFilters({ ...filters, company: e.target.value })}
          >
            <option value="">All Companies</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
          <select
            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
        {users.length > 0 ? (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Login</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {users.map((user) => {
                    const isActive = user.is_active ?? user.isActive ?? true;
                    return (
                      <tr key={user.id} className="hover:bg-slate-100/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-sm">
                              {user.first_name?.[0]}{user.last_name?.[0]}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{user.first_name} {user.last_name}</p>
                              <p className="text-sm text-gray-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {getRoleBadge(user.role_code || user.role, user.role_name || user.roleName)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {user.company_name || user.companyName || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                            isActive 
                              ? 'bg-green-100 text-green-800 border border-green-200' 
                              : 'bg-red-100 text-red-800 border border-red-200'
                          }`}>
                            {isActive ? '● Active' : '○ Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {user.last_login_at || user.lastLoginAt 
                            ? new Date(user.last_login_at || user.lastLoginAt).toLocaleDateString() 
                            : 'Never'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => navigate(`/admin/users/${user.id}`)}
                              className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg font-medium transition-colors"
                            >
                              Edit
                            </button>
                            {isActive ? (
                              <button
                                onClick={() => openDisableModal(user)}
                                className="px-3 py-1.5 text-sm text-orange-600 hover:bg-orange-50 rounded-lg font-medium transition-colors"
                              >
                                Disable
                              </button>
                            ) : (
                              <button
                                onClick={() => handleEnableUser(user)}
                                className="px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg font-medium transition-colors"
                              >
                                Enable
                              </button>
                            )}
                            <button
                              onClick={() => openDeleteModal(user)}
                              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-slate-200">
              {users.map((user) => {
                const isActive = user.is_active ?? user.isActive ?? true;
                return (
                  <div key={user.id} className="p-4 hover:bg-slate-100/50">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold shrink-0">
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-gray-900">{user.first_name} {user.last_name}</p>
                            <p className="text-sm text-gray-500 truncate">{user.email}</p>
                          </div>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full shrink-0 ${
                            isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {getRoleBadge(user.role_code || user.role, user.role_name || user.roleName)}
                          {(user.company_name || user.companyName) && (
                            <span className="text-xs text-gray-500">• {user.company_name || user.companyName}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 pl-15">
                      <button
                        onClick={() => navigate(`/admin/users/${user.id}`)}
                        className="flex-1 px-3 py-2 text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg font-medium transition-colors"
                      >
                        Edit
                      </button>
                      {isActive ? (
                        <button
                          onClick={() => openDisableModal(user)}
                          className="flex-1 px-3 py-2 text-sm text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg font-medium transition-colors"
                        >
                          Disable
                        </button>
                      ) : (
                        <button
                          onClick={() => handleEnableUser(user)}
                          className="flex-1 px-3 py-2 text-sm text-green-600 bg-green-50 hover:bg-green-100 rounded-lg font-medium transition-colors"
                        >
                          Enable
                        </button>
                      )}
                      <button
                        onClick={() => openDeleteModal(user)}
                        className="px-3 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-medium transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-5xl mb-3">👥</p>
            <p className="text-gray-600 font-medium">No users found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
          </div>
        )}

        {/* Pagination */}
        {pagination.total > pagination.limit && (
          <div className="px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-100/50">
            <p className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                ← Previous
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page * pagination.limit >= pagination.total}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Disable User Modal */}
      {showDisableModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">⚠️ Disable User</h2>
            </div>
            <div className="p-6">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                <p className="font-medium text-gray-900">{selectedUser.first_name} {selectedUser.last_name}</p>
                <p className="text-sm text-gray-500">{selectedUser.email}</p>
              </div>
              <p className="text-gray-600 mb-4">
                This user will no longer be able to log in. You can re-enable them later.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <textarea
                  value={disableReason}
                  onChange={(e) => setDisableReason(e.target.value)}
                  placeholder="Why is this user being disabled?"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  rows="3"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDisableModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisableUser}
                  className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
                >
                  Disable User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-red-600">🗑️ Delete User</h2>
            </div>
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="font-medium text-gray-900">{selectedUser.first_name} {selectedUser.last_name}</p>
                <p className="text-sm text-gray-500">{selectedUser.email}</p>
              </div>
              <p className="text-gray-600 mb-2">
                <strong className="text-red-600">Warning:</strong> This action cannot be undone!
              </p>
              <p className="text-gray-600 mb-4">
                All data associated with this user will be permanently deleted.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
