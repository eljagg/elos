/**
 * HR Dashboard - Employee Management & Feedback
 */

import { useState, useEffect } from 'react';
import { userAPI, messageAPI, companyAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function HRDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    newThisMonth: 0,
    pendingFeedback: 0
  });
  const [filters, setFilters] = useState({ search: '', department: '', status: '' });
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedFeedback, setSelectedFeedback] = useState(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [employeesRes, feedbackRes, deptsRes] = await Promise.all([
        userAPI.getUsers({ limit: 100 }).catch(() => ({ data: { data: { users: [] } } })),
        messageAPI.getFeedback({ status: 'pending' }).catch(() => ({ data: { data: { feedback: [] } } })),
        companyAPI.getCompanies().catch(() => ({ data: { data: { companies: [] } } }))
      ]);

      const emps = employeesRes.data?.data?.users || [];
      const fb = feedbackRes.data?.data?.feedback || [];
      
      setEmployees(emps);
      setFeedback(fb);
      setDepartments(deptsRes.data?.data?.companies?.[0]?.departments || []);
      
      setStats({
        totalEmployees: emps.length,
        activeEmployees: emps.filter(e => e.is_active).length,
        newThisMonth: emps.filter(e => {
          const created = new Date(e.created_at);
          const now = new Date();
          return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
        }).length,
        pendingFeedback: fb.length
      });
    } catch (error) {
      console.error('Failed to load HR data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisableEmployee = async (id) => {
    if (!confirm('Are you sure you want to disable this employee?')) return;
    try {
      await userAPI.disableUser(id, 'Disabled by HR');
      toast.success('Employee disabled');
      loadData();
    } catch (error) {
      toast.error('Failed to disable employee');
    }
  };

  const handleEnableEmployee = async (id) => {
    try {
      await userAPI.enableUser(id);
      toast.success('Employee enabled');
      loadData();
    } catch (error) {
      toast.error('Failed to enable employee');
    }
  };

  const handleRespondToFeedback = async (feedbackId, response) => {
    try {
      await messageAPI.respondToFeedback(feedbackId, response, 'resolved');
      toast.success('Response sent');
      setSelectedFeedback(null);
      loadData();
    } catch (error) {
      toast.error('Failed to send response');
    }
  };

  const filteredEmployees = employees.filter(emp => {
    if (filters.search) {
      const search = filters.search.toLowerCase();
      if (!emp.first_name?.toLowerCase().includes(search) && 
          !emp.last_name?.toLowerCase().includes(search) && 
          !emp.email?.toLowerCase().includes(search)) return false;
    }
    if (filters.department && emp.department_id !== filters.department) return false;
    if (filters.status === 'active' && !emp.is_active) return false;
    if (filters.status === 'inactive' && emp.is_active) return false;
    return true;
  });

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'employees', label: 'Employees', icon: '👥' },
    { id: 'feedback', label: 'Feedback', icon: '💬' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">HR Dashboard</h1>
        <p className="text-gray-500">Manage employees and handle feedback</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b">
          <div className="flex">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>{tab.label}
                {tab.id === 'feedback' && stats.pendingFeedback > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">{stats.pendingFeedback}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-purple-50 rounded-xl p-6 border-l-4 border-purple-500">
                  <p className="text-sm text-purple-600">Total Employees</p>
                  <p className="text-3xl font-bold text-purple-700">{stats.totalEmployees}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-6 border-l-4 border-green-500">
                  <p className="text-sm text-green-600">Active</p>
                  <p className="text-3xl font-bold text-green-700">{stats.activeEmployees}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500">
                  <p className="text-sm text-blue-600">New This Month</p>
                  <p className="text-3xl font-bold text-blue-700">{stats.newThisMonth}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-6 border-l-4 border-orange-500">
                  <p className="text-sm text-orange-600">Pending Feedback</p>
                  <p className="text-3xl font-bold text-orange-700">{stats.pendingFeedback}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="font-semibold text-gray-800 mb-4">Recent Employees</h3>
                  <div className="space-y-3">
                    {employees.slice(0, 5).map(emp => (
                      <div key={emp.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-semibold mr-3">
                            {emp.first_name?.[0]}{emp.last_name?.[0]}
                          </div>
                          <div>
                            <p className="font-medium">{emp.first_name} {emp.last_name}</p>
                            <p className="text-sm text-gray-500">{emp.department_name || 'No Department'}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${emp.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {emp.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="font-semibold text-gray-800 mb-4">Recent Feedback</h3>
                  {feedback.length > 0 ? (
                    <div className="space-y-3">
                      {feedback.slice(0, 5).map(fb => (
                        <div key={fb.id} className="p-3 bg-white rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-800">{fb.subject || 'Feedback'}</p>
                              <p className="text-sm text-gray-500">{fb.user_name}</p>
                            </div>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              fb.type === 'complaint' ? 'bg-red-100 text-red-800' :
                              fb.type === 'suggestion' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'
                            }`}>{fb.type}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{fb.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No pending feedback</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Employees Tab */}
          {activeTab === 'employees' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  className="flex-1 min-w-64 px-4 py-2 border rounded-lg"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
                <select
                  className="px-4 py-2 border rounded-lg"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredEmployees.map(emp => (
                      <tr key={emp.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-semibold mr-3">
                              {emp.first_name?.[0]}{emp.last_name?.[0]}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">{emp.first_name} {emp.last_name}</p>
                              <p className="text-sm text-gray-500">{emp.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{emp.department_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{emp.role_name || emp.role_code}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded-full ${emp.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {emp.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(emp.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setSelectedEmployee(emp)} className="text-blue-600 hover:text-blue-800 text-sm mr-3">View</button>
                          {emp.is_active ? (
                            <button onClick={() => handleDisableEmployee(emp.id)} className="text-red-600 hover:text-red-800 text-sm">Disable</button>
                          ) : (
                            <button onClick={() => handleEnableEmployee(emp.id)} className="text-green-600 hover:text-green-800 text-sm">Enable</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Feedback Tab */}
          {activeTab === 'feedback' && (
            <div className="space-y-4">
              {feedback.length > 0 ? (
                feedback.map(fb => (
                  <div key={fb.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-800">{fb.subject || 'Feedback'}</h3>
                        <p className="text-sm text-gray-500">{fb.user_name} • {new Date(fb.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          fb.type === 'complaint' ? 'bg-red-100 text-red-800' :
                          fb.type === 'suggestion' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>{fb.type}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          fb.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          fb.status === 'resolved' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>{fb.status}</span>
                      </div>
                    </div>
                    <p className="text-gray-600 mb-3">{fb.message}</p>
                    <button
                      onClick={() => setSelectedFeedback(fb)}
                      className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                    >
                      Respond →
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-12">No feedback to review</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Employee Detail Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Employee Details</h2>
              <button onClick={() => setSelectedEmployee(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-2xl font-semibold mr-4">
                  {selectedEmployee.first_name?.[0]}{selectedEmployee.last_name?.[0]}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedEmployee.first_name} {selectedEmployee.last_name}</h3>
                  <p className="text-gray-500">{selectedEmployee.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Department:</span><br/><span className="font-medium">{selectedEmployee.department_name || '-'}</span></div>
                <div><span className="text-gray-500">Role:</span><br/><span className="font-medium">{selectedEmployee.role_name || selectedEmployee.role_code}</span></div>
                <div><span className="text-gray-500">Phone:</span><br/><span className="font-medium">{selectedEmployee.phone || '-'}</span></div>
                <div><span className="text-gray-500">Status:</span><br/><span className={`font-medium ${selectedEmployee.is_active ? 'text-green-600' : 'text-red-600'}`}>{selectedEmployee.is_active ? 'Active' : 'Inactive'}</span></div>
                <div><span className="text-gray-500">Joined:</span><br/><span className="font-medium">{new Date(selectedEmployee.created_at).toLocaleDateString()}</span></div>
                <div><span className="text-gray-500">Last Login:</span><br/><span className="font-medium">{selectedEmployee.last_login_at ? new Date(selectedEmployee.last_login_at).toLocaleDateString() : 'Never'}</span></div>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setSelectedEmployee(null)} className="px-4 py-2 border rounded-lg">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Response Modal */}
      {selectedFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Respond to Feedback</h2>
              <button onClick={() => setSelectedFeedback(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-500">From: {selectedFeedback.user_name}</p>
              <p className="text-sm text-gray-500">Type: {selectedFeedback.type}</p>
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <p className="text-gray-700">{selectedFeedback.message}</p>
              </div>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const response = e.target.response.value;
              handleRespondToFeedback(selectedFeedback.id, response);
            }}>
              <textarea
                name="response"
                placeholder="Type your response..."
                className="w-full px-4 py-2 border rounded-lg mb-4"
                rows="4"
                required
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setSelectedFeedback(null)} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg">Send Response</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
