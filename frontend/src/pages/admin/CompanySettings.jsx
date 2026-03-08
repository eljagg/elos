/**
 * Company Settings - Full CRUD for Companies, Departments, Cafeterias
 * Mobile-first responsive design with softer colors
 */
import { useState, useEffect } from 'react';
import { companyAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function CompanySettings() {
  const [activeTab, setActiveTab] = useState('companies');
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [cafeterias, setCafeterias] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);

  // Modal states
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showCafeteriaModal, setShowCafeteriaModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Selected items for editing
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedCafeteria, setSelectedCafeteria] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState({ type: '', item: null });

  // Forms
  const [companyForm, setCompanyForm] = useState({ name: '', code: '', address: '', phone: '', email: '' });
  const [departmentForm, setDepartmentForm] = useState({ name: '', code: '', companyId: '' });
  const [cafeteriaForm, setCafeteriaForm] = useState({ name: '', location: '', breakfastCutoff: '08:00', lunchCutoff: '10:00' });

  useEffect(() => { loadCompanies(); loadCafeterias(); }, []);
  useEffect(() => { if (selectedCompanyId) loadDepartments(); }, [selectedCompanyId]);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const response = await companyAPI.getCompanies();
      const list = response.data?.data?.companies || [];
      setCompanies(list);
      if (list.length > 0 && !selectedCompanyId) setSelectedCompanyId(list[0].id);
    } catch (error) {
      console.error('Failed to load companies:', error);
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    if (!selectedCompanyId) return;
    try {
      const response = await companyAPI.getDepartments(selectedCompanyId);
      setDepartments(response.data?.data?.departments || []);
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  };

  const loadCafeterias = async () => {
    try {
      const response = await companyAPI.getCafeterias();
      setCafeterias(response.data?.data?.cafeterias || []);
    } catch (error) {
      console.error('Failed to load cafeterias:', error);
    }
  };

  // Company CRUD
  const openCompanyModal = (company = null) => {
    setSelectedCompany(company);
    setCompanyForm(company ? {
      name: company.name || '',
      code: company.code || '',
      address: company.address || '',
      phone: company.phone || '',
      email: company.email_domain || company.emailDomain || ''
    } : { name: '', code: '', address: '', phone: '', email: '' });
    setShowCompanyModal(true);
  };

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    try {
      if (selectedCompany) {
        await companyAPI.updateCompany(selectedCompany.id, companyForm);
        toast.success('Company updated');
      } else {
        await companyAPI.createCompany(companyForm);
        toast.success('Company created');
      }
      setShowCompanyModal(false);
      loadCompanies();
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to save company');
    }
  };

  // Department CRUD
  const openDepartmentModal = (dept = null) => {
    setSelectedDepartment(dept);
    setDepartmentForm(dept ? {
      name: dept.name || '',
      code: dept.code || '',
      companyId: dept.company_id || selectedCompanyId
    } : { name: '', code: '', companyId: selectedCompanyId });
    setShowDepartmentModal(true);
  };

  const handleSaveDepartment = async (e) => {
    e.preventDefault();
    try {
      const companyId = departmentForm.companyId || selectedCompanyId;
      if (selectedDepartment) {
        await companyAPI.updateDepartment(companyId, selectedDepartment.id, departmentForm);
        toast.success('Department updated');
      } else {
        await companyAPI.createDepartment(companyId, departmentForm);
        toast.success('Department created');
      }
      setShowDepartmentModal(false);
      loadDepartments();
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to save department');
    }
  };

  // Cafeteria CRUD
  const openCafeteriaModal = (cafeteria = null) => {
    setSelectedCafeteria(cafeteria);
    setCafeteriaForm(cafeteria ? {
      name: cafeteria.name || '',
      location: cafeteria.location || '',
      breakfastCutoff: (cafeteria.default_breakfast_cutoff || cafeteria.defaultBreakfastCutoff || '08:00:00').substring(0, 5),
      lunchCutoff: (cafeteria.default_lunch_cutoff || cafeteria.defaultLunchCutoff || '10:00:00').substring(0, 5)
    } : { name: '', location: '', breakfastCutoff: '08:00', lunchCutoff: '10:00' });
    setShowCafeteriaModal(true);
  };

  const handleSaveCafeteria = async (e) => {
    e.preventDefault();
    try {
      const data = {
        name: cafeteriaForm.name,
        location: cafeteriaForm.location,
        defaultBreakfastCutoff: cafeteriaForm.breakfastCutoff,
        defaultLunchCutoff: cafeteriaForm.lunchCutoff
      };
      if (selectedCafeteria) {
        await companyAPI.updateCafeteria(selectedCafeteria.id, data);
        toast.success('Cafeteria updated');
      } else {
        await companyAPI.createCafeteria(data);
        toast.success('Cafeteria created');
      }
      setShowCafeteriaModal(false);
      loadCafeterias();
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to save cafeteria');
    }
  };

  // Delete handler
  const openDeleteModal = (type, item) => {
    setDeleteTarget({ type, item });
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    const { type, item } = deleteTarget;
    try {
      if (type === 'company') {
        await companyAPI.deleteCompany(item.id);
        toast.success('Company deleted');
        loadCompanies();
      } else if (type === 'department') {
        await companyAPI.deleteDepartment(item.company_id || selectedCompanyId, item.id);
        toast.success('Department deleted');
        loadDepartments();
      } else if (type === 'cafeteria') {
        await companyAPI.deleteCafeteria(item.id);
        toast.success('Cafeteria deleted');
        loadCafeterias();
      }
      setShowDeleteModal(false);
    } catch (error) {
      toast.error(error.response?.data?.error?.message || `Failed to delete ${type}`);
    }
  };

  const tabs = [
    { id: 'companies', label: 'Companies', icon: '🏢', count: companies.length },
    { id: 'departments', label: 'Departments', icon: '📁', count: departments.length },
    { id: 'cafeterias', label: 'Cafeterias', icon: '🍽️', count: cafeterias.length }
  ];

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Company Settings</h1>
        <p className="text-gray-500 text-sm">Manage organizational structure</p>
      </div>

      {/* Tabs */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-100/50">
          <div className="flex overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 sm:px-6 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === tab.id 
                    ? 'border-indigo-500 text-indigo-600 bg-white' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-slate-100'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full">{tab.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {loading && companies.length === 0 ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <>
              {/* Companies Tab */}
              {activeTab === 'companies' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900">Companies ({companies.length})</h2>
                    <button
                      onClick={() => openCompanyModal()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                    >
                      + Add Company
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {companies.map(company => (
                      <div key={company.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-xl">🏢</div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{company.name}</h3>
                              <p className="text-sm text-indigo-600 font-medium">{company.code || '—'}</p>
                            </div>
                          </div>
                        </div>
                        {company.address && (
                          <p className="text-sm text-gray-500 mb-3 line-clamp-2">📍 {company.address}</p>
                        )}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                          <button
                            onClick={() => { setSelectedCompanyId(company.id); setActiveTab('departments'); }}
                            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            View Departments →
                          </button>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openCompanyModal(company)}
                              className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => openDeleteModal('company', company)}
                              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {companies.length === 0 && (
                      <div className="col-span-full text-center py-12">
                        <p className="text-4xl mb-3">🏢</p>
                        <p className="text-gray-500">No companies found</p>
                        <button onClick={() => openCompanyModal()} className="mt-3 text-indigo-600 font-medium">
                          + Add your first company
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Departments Tab */}
              {activeTab === 'departments' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-gray-900">Departments</h2>
                      <select
                        value={selectedCompanyId || ''}
                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                      >
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => openDepartmentModal()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                    >
                      + Add Department
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {departments.map(dept => (
                      <div key={dept.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center text-lg">📁</div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                              <p className="text-sm text-gray-500">{dept.code || 'No code'}</p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => openDepartmentModal(dept)}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => openDeleteModal('department', dept)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {departments.length === 0 && (
                      <div className="col-span-full text-center py-12">
                        <p className="text-4xl mb-3">📁</p>
                        <p className="text-gray-500">No departments found</p>
                        <button onClick={() => openDepartmentModal()} className="mt-3 text-indigo-600 font-medium">
                          + Add your first department
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Cafeterias Tab */}
              {activeTab === 'cafeterias' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900">Cafeterias ({cafeterias.length})</h2>
                    <button
                      onClick={() => openCafeteriaModal()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                    >
                      + Add Cafeteria
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cafeterias.map(cafeteria => (
                      <div key={cafeteria.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-xl">🍽️</div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{cafeteria.name}</h3>
                              {cafeteria.location && <p className="text-sm text-gray-500">{cafeteria.location}</p>}
                            </div>
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Breakfast cutoff:</span>
                            <span className="font-medium text-gray-900">
                              {cafeteria.default_breakfast_cutoff || cafeteria.defaultBreakfastCutoff || '08:00'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Lunch cutoff:</span>
                            <span className="font-medium text-gray-900">
                              {cafeteria.default_lunch_cutoff || cafeteria.defaultLunchCutoff || '10:00'}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
                          <button
                            onClick={() => openCafeteriaModal(cafeteria)}
                            className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => openDeleteModal('cafeteria', cafeteria)}
                            className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                    {cafeterias.length === 0 && (
                      <div className="col-span-full text-center py-12">
                        <p className="text-4xl mb-3">🍽️</p>
                        <p className="text-gray-500">No cafeterias found</p>
                        <button onClick={() => openCafeteriaModal()} className="mt-3 text-indigo-600 font-medium">
                          + Add your first cafeteria
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Company Modal */}
      {showCompanyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedCompany ? '✏️ Edit Company' : '🏢 Add Company'}
              </h2>
            </div>
            <form onSubmit={handleSaveCompany} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                  <input
                    type="text"
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="PBS Group"
                    required
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input
                    type="text"
                    value={companyForm.code}
                    onChange={(e) => setCompanyForm({ ...companyForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="PBS"
                    maxLength={10}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows="2"
                  placeholder="123 Main Street, Kingston"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="876-555-1234"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Domain</label>
                  <input
                    type="text"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="company.com"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCompanyModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                >
                  {selectedCompany ? 'Update Company' : 'Create Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Department Modal */}
      {showDepartmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedDepartment ? '✏️ Edit Department' : '📁 Add Department'}
              </h2>
            </div>
            <form onSubmit={handleSaveDepartment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <select
                  value={departmentForm.companyId}
                  onChange={(e) => setDepartmentForm({ ...departmentForm, companyId: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department Name *</label>
                <input
                  type="text"
                  value={departmentForm.name}
                  onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Human Resources"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  type="text"
                  value={departmentForm.code}
                  onChange={(e) => setDepartmentForm({ ...departmentForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="HR"
                  maxLength={10}
                />
              </div>
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowDepartmentModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                >
                  {selectedDepartment ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cafeteria Modal */}
      {showCafeteriaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedCafeteria ? '✏️ Edit Cafeteria' : '🍽️ Add Cafeteria'}
              </h2>
            </div>
            <form onSubmit={handleSaveCafeteria} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cafeteria Name *</label>
                <input
                  type="text"
                  value={cafeteriaForm.name}
                  onChange={(e) => setCafeteriaForm({ ...cafeteriaForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Main Cafeteria"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={cafeteriaForm.location}
                  onChange={(e) => setCafeteriaForm({ ...cafeteriaForm, location: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Building A, Ground Floor"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Breakfast Cutoff</label>
                  <input
                    type="time"
                    value={cafeteriaForm.breakfastCutoff}
                    onChange={(e) => setCafeteriaForm({ ...cafeteriaForm, breakfastCutoff: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lunch Cutoff</label>
                  <input
                    type="time"
                    value={cafeteriaForm.lunchCutoff}
                    onChange={(e) => setCafeteriaForm({ ...cafeteriaForm, lunchCutoff: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCafeteriaModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                >
                  {selectedCafeteria ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget.item && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-red-600">🗑️ Delete {deleteTarget.type}</h2>
            </div>
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="font-medium text-gray-900">{deleteTarget.item.name}</p>
                {deleteTarget.item.code && <p className="text-sm text-gray-500">{deleteTarget.item.code}</p>}
              </div>
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete this {deleteTarget.type}? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
