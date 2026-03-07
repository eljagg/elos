/**
 * User Form - Add/Edit User
 * Mobile-first responsive design
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { userAPI, companyAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function UserForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    employeeCode: '',
    roleId: '',
    companyId: '',
    departmentId: '',
    languagePreference: 'en'
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadInitialData();
    if (isEditing) loadUser();
  }, [id]);

  useEffect(() => {
    if (formData.companyId) loadDepartments(formData.companyId);
  }, [formData.companyId]);

  const loadInitialData = async () => {
    try {
      const [rolesRes, companiesRes] = await Promise.all([
        userAPI.getRoles(),
        companyAPI.getCompanies()
      ]);
      setRoles(rolesRes.data?.data?.roles || []);
      setCompanies(companiesRes.data?.data?.companies || []);
    } catch (error) {
      console.error('Failed to load initial data:', error);
      toast.error('Failed to load form data');
    }
  };

  const loadUser = async () => {
    setLoading(true);
    try {
      const response = await userAPI.getUser(id);
      const user = response.data?.data?.user;
      if (user) {
        setFormData({
          email: user.email || '',
          password: '',
          firstName: user.first_name || user.firstName || '',
          lastName: user.last_name || user.lastName || '',
          phone: user.phone || '',
          employeeCode: user.employee_code || user.employeeCode || '',
          roleId: user.role_id || user.roleId || '',
          companyId: user.company_id || user.companyId || '',
          departmentId: user.department_id || user.departmentId || '',
          languagePreference: user.preferred_language || user.languagePreference || 'en'
        });
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      toast.error('Failed to load user');
      navigate('/admin/users');
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async (companyId) => {
    try {
      const response = await companyAPI.getDepartments(companyId);
      setDepartments(response.data?.data?.departments || []);
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (!isEditing && !formData.password) newErrors.password = 'Password is required';
    if (formData.password && formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (!formData.firstName) newErrors.firstName = 'First name is required';
    if (!formData.lastName) newErrors.lastName = 'Last name is required';
    if (!formData.roleId) newErrors.roleId = 'Role is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const cleanedData = {
        ...formData,
        roleId: formData.roleId || null,
        companyId: formData.companyId || null,
        departmentId: formData.departmentId || null,
      };

      // Don't send password if empty (for editing)
      if (!cleanedData.password) delete cleanedData.password;

      if (isEditing) {
        await userAPI.updateUser(id, cleanedData);
        toast.success('User updated successfully');
      } else {
        await userAPI.createUser(cleanedData);
        toast.success('User created successfully');
      }
      navigate('/admin/users');
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to save user';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link to="/admin/users" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium mb-2 inline-block">
          ← Back to Users
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          {isEditing ? 'Edit User' : 'Add New User'}
        </h1>
        <p className="text-gray-500 text-sm">
          {isEditing ? 'Update user account details' : 'Create a new employee account'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
        {/* Personal Information */}
        <div className="p-4 sm:p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-sm">👤</span>
            Personal Information
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="John"
                className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.firstName ? 'border-red-500' : 'border-slate-300'}`}
              />
              {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Doe"
                className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.lastName ? 'border-red-500' : 'border-slate-300'}`}
              />
              {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="john.doe@company.com"
                className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.email ? 'border-red-500' : 'border-slate-300'}`}
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="876-555-1234"
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee Code</label>
              <input
                type="text"
                name="employeeCode"
                value={formData.employeeCode}
                onChange={handleChange}
                placeholder="EMP001"
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="p-4 sm:p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-sm">🔐</span>
            Security
          </h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password {isEditing && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}
              {!isEditing && <span className="text-red-500">*</span>}
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={isEditing ? '••••••••' : 'Enter password'}
              className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.password ? 'border-red-500' : 'border-slate-300'}`}
            />
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
            {!isEditing && <p className="text-gray-400 text-sm mt-1">Minimum 6 characters</p>}
          </div>
        </div>

        {/* Role & Organization */}
        <div className="p-4 sm:p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-sm">🏢</span>
            Role & Organization
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <select
                name="roleId"
                value={formData.roleId}
                onChange={handleChange}
                className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.roleId ? 'border-red-500' : 'border-slate-300'}`}
              >
                <option value="">Select a role</option>
                {roles.map(role => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
              {errors.roleId && <p className="text-red-500 text-sm mt-1">{errors.roleId}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <select
                name="companyId"
                value={formData.companyId}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a company</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                name="departmentId"
                value={formData.departmentId}
                onChange={handleChange}
                disabled={!formData.companyId}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Select a department</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
              {!formData.companyId && (
                <p className="text-gray-400 text-sm mt-1">Select a company first</p>
              )}
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="p-4 sm:p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-sm">⚙️</span>
            Preferences
          </h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
            <select
              name="languagePreference"
              value={formData.languagePreference}
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="en">🇬🇧 English</option>
              <option value="es">🇪🇸 Spanish</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 sm:p-6 bg-slate-100 flex flex-col sm:flex-row justify-end gap-3">
          <Link
            to="/admin/users"
            className="w-full sm:w-auto px-6 py-2.5 border border-slate-300 text-gray-700 rounded-lg hover:bg-white font-medium text-center"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <span className="animate-spin">⏳</span>
                Saving...
              </>
            ) : (
              <>
                {isEditing ? '✓ Update User' : '+ Create User'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
