/**
 * Admin - Company Settings
 * Manage companies, departments, buildings, and cafeterias
 */

import { useState, useEffect } from 'react';
import api from '../../services/api';
import { companyAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function CompanySettings() {
  const [activeTab, setActiveTab] = useState('companies');
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [cafeterias, setCafeterias] = useState([]);
  const [selectedCafeteria, setSelectedCafeteria] = useState(null);
  const [showCafeteriaModal, setShowCafeteriaModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (activeTab === 'departments' && selectedCompany) {
      loadDepartments();
    } else if (activeTab === 'buildings') {
      loadBuildings();
    } else if (activeTab === 'cafeterias') {
      loadCafeterias();
    }
  }, [activeTab, selectedCompany]);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const response = await companyAPI.getCompanies();
      const companiesList = response.data?.data?.companies || [];
      setCompanies(companiesList);
      if (companiesList.length > 0 && !selectedCompany) {
        setSelectedCompany(companiesList[0].id);
      }
    } catch (error) {
      console.error('Failed to load companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const response = await companyAPI.getDepartments(selectedCompany);
      setDepartments(response.data?.data?.departments || []);
    } catch (error) {
      console.error('Failed to load departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBuildings = async () => {
    setLoading(true);
    try {
      const response = await companyAPI.getBuildings();
      setBuildings(response.data?.data?.buildings || []);
    } catch (error) {
      console.error('Failed to load buildings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCafeterias = async () => {
    setLoading(true);
    try {
      const response = await companyAPI.getCafeterias();
      setCafeterias(response.data?.data?.cafeterias || []);
    } catch (error) {
      console.error('Failed to load cafeterias:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalType === 'company') {
        await companyAPI.createCompany(formData);
        toast.success('Company created');
        loadCompanies();
      } else if (modalType === 'department') {
        await companyAPI.createDepartment(selectedCompany, formData);
        toast.success('Department created');
        loadDepartments();
      }
      setShowModal(false);
      setFormData({});
    } catch (error) {
      toast.error(`Failed to create ${modalType}`);
    }
  };

  const tabs = [
    { id: 'companies', label: 'Companies', icon: '🏢' },
    { id: 'departments', label: 'Departments', icon: '📁' },
    
    { id: 'cafeterias', label: 'Cafeterias', icon: '🍽️' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Company Settings</h1>
        <p className="text-gray-500">Manage organizational structure</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b">
          <div className="flex overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Companies Tab */}
              {activeTab === 'companies' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold">Companies ({companies.length})</h2>
                    <button
                      onClick={() => { setModalType('company'); setShowModal(true); }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      + Add Company
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {companies.map(company => (
                      <div key={company.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center mb-3">
                          <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-xl mr-3">🏢</div>
                          <div>
                            <h3 className="font-semibold text-gray-800">{company.name}</h3>
                            <p className="text-sm text-gray-500">{company.code}</p>
                          </div>
                        </div>
                        {company.address && <p className="text-sm text-gray-600">📍 {company.address}</p>}
                        <div className="mt-3 pt-3 border-t">
                          <button
                            onClick={() => { setSelectedCompany(company.id); setActiveTab('departments'); }}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            View Departments →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Departments Tab */}
              {activeTab === 'departments' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                      <h2 className="text-lg font-semibold">Departments</h2>
                      <select
                        value={selectedCompany || ''}
                        onChange={(e) => setSelectedCompany(e.target.value)}
                        className="px-3 py-1 border rounded-lg text-sm"
                      >
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => { setModalType('department'); setShowModal(true); }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      + Add Department
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {departments.map(dept => (
                      <div key={dept.id} className="border rounded-lg p-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center text-lg mr-3">📁</div>
                          <div>
                            <h3 className="font-semibold text-gray-800">{dept.name}</h3>
                            <p className="text-sm text-gray-500">{dept.code || 'No code'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {departments.length === 0 && (
                      <p className="text-gray-500 col-span-3 text-center py-8">No departments found</p>
                    )}
                  </div>
                </div>
              )}

              {/* Buildings Tab */}
              {activeTab === 'buildings' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold">Buildings ({buildings.length})</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {buildings.map(building => (
                      <div key={building.id} className="border rounded-lg p-4">
                        <div className="flex items-center mb-2">
                          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center text-lg mr-3">🏗️</div>
                          <div>
                            <h3 className="font-semibold text-gray-800">{building.name}</h3>
                            <p className="text-sm text-gray-500">{building.code || ''}</p>
                          </div>
                        </div>
                        {building.address && <p className="text-sm text-gray-600">📍 {building.address}</p>}
                      </div>
                    ))}
                    {buildings.length === 0 && (
                      <p className="text-gray-500 col-span-3 text-center py-8">No buildings found</p>
                    )}
                  </div>
                </div>
              )}

              {/* Cafeterias Tab */}
              {activeTab === 'cafeterias' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold">Cafeterias ({cafeterias.length})</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cafeterias.map(cafeteria => (
                      <div key={cafeteria.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center text-lg mr-3">🍽️</div>
                            <div>
                              <h3 className="font-semibold text-gray-800">{cafeteria.name}</h3>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => openCafeteriaModal(cafeteria)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >Edit</button>
                            <button 
                              onClick={() => handleDeleteCafeteria(cafeteria)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >Delete</button>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>🕐 Breakfast cutoff: {cafeteria.defaultBreakfastCutoff || cafeteria.default_breakfast_cutoff || '08:00'}</p>
                          <p>🕐 Lunch cutoff: {cafeteria.defaultLunchCutoff || cafeteria.default_lunch_cutoff || '10:00'}</p>
                        </div>
                      </div>
                    ))}
                    {cafeterias.length === 0 && (
                      <p className="text-gray-500 col-span-3 text-center py-8">No cafeterias found</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              Add {modalType === 'company' ? 'Company' : 'Department'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  type="text"
                  value={formData.code || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., PBS, HR, IT"
                />
              </div>
              {modalType === 'company' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <textarea
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    rows="2"
                  />
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Cafeteria Modal */}
      {showCafeteriaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">{selectedCafeteria ? 'Edit' : 'Add'} Cafeteria</h2>
            <form onSubmit={handleSaveCafeteria} className="space-y-4">
              <input
                type="text"
                placeholder="Cafeteria Name"
                value={cafeteriaForm.name}
                onChange={e => setCafeteriaForm({ ...cafeteriaForm, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Breakfast Cutoff</label>
                  <input
                    type="time"
                    value={cafeteriaForm.breakfastCutoff}
                    onChange={e => setCafeteriaForm({ ...cafeteriaForm, breakfastCutoff: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lunch Cutoff</label>
                  <input
                    type="time"
                    value={cafeteriaForm.lunchCutoff}
                    onChange={e => setCafeteriaForm({ ...cafeteriaForm, lunchCutoff: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCafeteriaModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}