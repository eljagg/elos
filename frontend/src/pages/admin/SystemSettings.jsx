/**
 * Admin - System Settings
 * Manage email domains, system configuration, and audit logs
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState('domains');
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState([]);
  const [settings, setSettings] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newDomain, setNewDomain] = useState({ domain: '', companyId: '' });
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'domains':
          const domainsRes = await adminAPI.getDomains().catch(() => ({ data: { data: { domains: [] } } }));
          setDomains(domainsRes.data?.data?.domains || []);
          break;
        case 'settings':
          const settingsRes = await adminAPI.getSettings().catch(() => ({ data: { data: { settings: {} } } }));
          setSettings(settingsRes.data?.data?.settings || {});
          break;
        case 'audit':
          const auditRes = await adminAPI.getAuditLogs({ limit: 50 }).catch(() => ({ data: { data: { logs: [] } } }));
          setAuditLogs(auditRes.data?.data?.logs || []);
          break;
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDomain = async (e) => {
    e.preventDefault();
    try {
      await adminAPI.addDomain(newDomain.domain, newDomain.companyId || null);
      toast.success('Domain added successfully');
      setShowAddDomain(false);
      setNewDomain({ domain: '', companyId: '' });
      loadData();
    } catch (error) {
      toast.error('Failed to add domain');
    }
  };

  const handleRemoveDomain = async (id) => {
    if (!confirm('Are you sure you want to remove this domain?')) return;
    try {
      await adminAPI.removeDomain(id);
      toast.success('Domain removed');
      loadData();
    } catch (error) {
      toast.error('Failed to remove domain');
    }
  };

  const handleUpdateSettings = async () => {
    try {
      await adminAPI.updateSettings(settings);
      toast.success('Settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const tabs = [
    { id: 'domains', label: 'Email Domains', icon: '📧' },
    { id: 'settings', label: 'General Settings', icon: '⚙️' },
    { id: 'audit', label: 'Audit Logs', icon: '📋' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">System Settings</h1>
        <p className="text-gray-500">Configure system-wide settings and view audit logs</p>
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
              {/* Email Domains Tab */}
              {activeTab === 'domains' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-lg font-semibold">Allowed Email Domains</h2>
                      <p className="text-sm text-gray-500">Users can only register with these email domains</p>
                    </div>
                    <button
                      onClick={() => setShowAddDomain(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      + Add Domain
                    </button>
                  </div>

                  <div className="space-y-3">
                    {domains.length > 0 ? domains.map(domain => (
                      <div key={domain.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">📧</span>
                          <div>
                            <p className="font-medium text-gray-800">@{domain.domain}</p>
                            <p className="text-sm text-gray-500">{domain.company_name || 'All Companies'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 text-xs rounded-full ${domain.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {domain.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <button
                            onClick={() => handleRemoveDomain(domain.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )) : (
                      <p className="text-center text-gray-500 py-8">No domains configured. Add a domain to allow user registration.</p>
                    )}
                  </div>
                </div>
              )}

              {/* General Settings Tab */}
              {activeTab === 'settings' && (
                <div className="max-w-2xl">
                  <h2 className="text-lg font-semibold mb-6">General Settings</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">System Name</label>
                      <input
                        type="text"
                        value={settings.systemName || 'ELOS'}
                        onChange={(e) => setSettings({ ...settings, systemName: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Default Language</label>
                      <select
                        value={settings.defaultLanguage || 'en'}
                        onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg"
                      >
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Default Breakfast Cutoff</label>
                      <input
                        type="time"
                        value={settings.breakfastCutoff || '08:00'}
                        onChange={(e) => setSettings({ ...settings, breakfastCutoff: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Default Lunch Cutoff</label>
                      <input
                        type="time"
                        value={settings.lunchCutoff || '10:00'}
                        onChange={(e) => setSettings({ ...settings, lunchCutoff: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-800">Allow Guest Orders</p>
                        <p className="text-sm text-gray-500">Enable guest code ordering for visitors</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.allowGuestOrders !== false}
                          onChange={(e) => setSettings({ ...settings, allowGuestOrders: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-800">Require Email Verification</p>
                        <p className="text-sm text-gray-500">Users must verify email before ordering</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.requireEmailVerification !== false}
                          onChange={(e) => setSettings({ ...settings, requireEmailVerification: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <button
                      onClick={handleUpdateSettings}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Save Settings
                    </button>
                  </div>
                </div>
              )}

              {/* Audit Logs Tab */}
              {activeTab === 'audit' && (
                <div>
                  <h2 className="text-lg font-semibold mb-6">Audit Logs</h2>
                  
                  {auditLogs.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {auditLogs.map(log => (
                            <tr key={log.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {new Date(log.created_at).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-800">
                                {log.user_email || 'System'}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  log.action?.includes('LOGIN') ? 'bg-blue-100 text-blue-800' :
                                  log.action?.includes('CREATE') ? 'bg-green-100 text-green-800' :
                                  log.action?.includes('UPDATE') ? 'bg-yellow-100 text-yellow-800' :
                                  log.action?.includes('DELETE') ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {log.action}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                                {log.entity_type && `${log.entity_type}: ${log.entity_id?.slice(0, 8) || '-'}`}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {log.ip_address || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-8">No audit logs found</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Domain Modal */}
      {showAddDomain && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Email Domain</h2>
            <form onSubmit={handleAddDomain} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Domain *</label>
                <div className="flex items-center">
                  <span className="text-gray-500 mr-2">@</span>
                  <input
                    type="text"
                    value={newDomain.domain}
                    onChange={(e) => setNewDomain({ ...newDomain, domain: e.target.value })}
                    placeholder="example.com"
                    className="flex-1 px-4 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Users with email addresses from this domain will be able to register.
              </p>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowAddDomain(false)} className="px-4 py-2 border rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                  Add Domain
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
