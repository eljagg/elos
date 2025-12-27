/**
 * License Manager Component
 * For Super Admin to manage and extend licenses
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { licenseAPI } from '../services/licenseApi';
import toast from 'react-hot-toast';

export default function LicenseManager() {
  const { colors } = useTheme();
  const [license, setLicense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [extending, setExtending] = useState(false);
  const [extensionDays, setExtensionDays] = useState(30);
  const [showExtendModal, setShowExtendModal] = useState(false);

  useEffect(() => {
    loadLicense();
  }, []);

  const loadLicense = async () => {
    setLoading(true);
    try {
      const response = await licenseAPI.getStatus();
      setLicense(response.data?.data || response.data);
    } catch (error) {
      console.error('Failed to load license:', error);
      // Fallback to localStorage for demo
      const cached = localStorage.getItem('systemLicense');
      if (cached) {
        setLicense(JSON.parse(cached));
      } else {
        // Create default trial license
        const defaultLicense = {
          license_type: 'trial',
          status: 'active',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          licensed_to: 'Trial Customer',
          max_users: 100,
          days_remaining: 30
        };
        setLicense(defaultLicense);
        localStorage.setItem('systemLicense', JSON.stringify(defaultLicense));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExtend = async () => {
    setExtending(true);
    try {
      await licenseAPI.extend(extensionDays);
      toast.success(`License extended by ${extensionDays} days!`);
      await loadLicense();
      setShowExtendModal(false);
    } catch (error) {
      // Fallback: update localStorage
      const cached = localStorage.getItem('systemLicense');
      if (cached) {
        const lic = JSON.parse(cached);
        const currentEnd = new Date(lic.end_date);
        const newEnd = new Date(Math.max(currentEnd.getTime(), Date.now()) + extensionDays * 24 * 60 * 60 * 1000);
        lic.end_date = newEnd.toISOString();
        lic.status = 'active';
        lic.days_remaining = Math.ceil((newEnd - Date.now()) / (1000 * 60 * 60 * 24));
        localStorage.setItem('systemLicense', JSON.stringify(lic));
        setLicense(lic);
        toast.success(`License extended by ${extensionDays} days!`);
        setShowExtendModal(false);
      } else {
        toast.error('Failed to extend license');
      }
    } finally {
      setExtending(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = () => {
    if (!license) return 'bg-gray-100 text-gray-700';
    const days = license.days_remaining;
    if (license.status === 'expired' || days <= 0) return 'bg-red-100 text-red-700';
    if (days <= 7) return 'bg-orange-100 text-orange-700';
    if (days <= 14) return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  const getStatusText = () => {
    if (!license) return 'Unknown';
    if (license.status === 'expired' || license.days_remaining <= 0) return 'Expired';
    if (license.status === 'suspended') return 'Suspended';
    return 'Active';
  };

  if (loading) {
    return (
      <div className={`${colors.bgCard} rounded-xl shadow-sm border ${colors.border} p-6`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`${colors.bgCard} rounded-xl shadow-sm border ${colors.border} p-6`}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className={`text-lg font-semibold ${colors.textPrimary}`}>📜 License Management</h3>
            <p className={`text-sm ${colors.textMuted}`}>Manage your ELOS license and subscription</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>

        {/* License Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className={`${colors.bgSecondary} rounded-xl p-4`}>
            <p className={`text-sm ${colors.textMuted}`}>License Type</p>
            <p className={`text-lg font-semibold ${colors.textPrimary} capitalize`}>
              {license?.license_type || 'Trial'}
            </p>
          </div>
          <div className={`${colors.bgSecondary} rounded-xl p-4`}>
            <p className={`text-sm ${colors.textMuted}`}>Days Remaining</p>
            <p className={`text-lg font-semibold ${license?.days_remaining <= 7 ? 'text-red-600' : colors.textPrimary}`}>
              {license?.days_remaining || 0} days
            </p>
          </div>
          <div className={`${colors.bgSecondary} rounded-xl p-4`}>
            <p className={`text-sm ${colors.textMuted}`}>Start Date</p>
            <p className={`text-lg font-semibold ${colors.textPrimary}`}>
              {formatDate(license?.start_date)}
            </p>
          </div>
          <div className={`${colors.bgSecondary} rounded-xl p-4`}>
            <p className={`text-sm ${colors.textMuted}`}>End Date</p>
            <p className={`text-lg font-semibold ${colors.textPrimary}`}>
              {formatDate(license?.end_date)}
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className={`${colors.bgSecondary} rounded-xl p-4 mb-6`}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={`text-sm ${colors.textMuted}`}>Licensed To</p>
              <p className={`font-medium ${colors.textPrimary}`}>{license?.licensed_to || 'N/A'}</p>
            </div>
            <div>
              <p className={`text-sm ${colors.textMuted}`}>Max Users</p>
              <p className={`font-medium ${colors.textPrimary}`}>{license?.max_users || 'Unlimited'}</p>
            </div>
          </div>
        </div>

        {/* Warning if expiring soon */}
        {license?.days_remaining <= 7 && license?.days_remaining > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold text-amber-800">License Expiring Soon</p>
                <p className="text-sm text-amber-700">
                  Your license will expire in {license.days_remaining} days. Extend now to avoid service interruption.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Expired Warning */}
        {(license?.status === 'expired' || license?.days_remaining <= 0) && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚫</span>
              <div>
                <p className="font-semibold text-red-800">License Expired</p>
                <p className="text-sm text-red-700">
                  Your license has expired. Users cannot access the system. Extend the license to restore access.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowExtendModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            ➕ Extend License
          </button>
          <button
            onClick={loadLicense}
            className={`px-4 py-2 border ${colors.border} rounded-lg ${colors.bgHover} transition-colors`}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Extend License Modal */}
      {showExtendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-md`}>
            <h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>➕ Extend License</h2>
            
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${colors.textSecondary}`}>
                  Extension Period
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[7, 14, 30, 90].map(days => (
                    <button
                      key={days}
                      onClick={() => setExtensionDays(days)}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                        extensionDays === days
                          ? 'bg-indigo-600 text-white'
                          : `${colors.bgSecondary} ${colors.textSecondary} hover:bg-indigo-100`
                      }`}
                    >
                      {days} days
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${colors.textSecondary}`}>
                  Custom Days
                </label>
                <input
                  type="number"
                  value={extensionDays}
                  onChange={(e) => setExtensionDays(parseInt(e.target.value) || 0)}
                  min="1"
                  max="365"
                  className={`w-full px-4 py-2 border ${colors.border} rounded-lg`}
                />
              </div>

              <div className={`${colors.bgSecondary} rounded-lg p-4`}>
                <p className={`text-sm ${colors.textMuted}`}>New End Date</p>
                <p className={`font-semibold ${colors.textPrimary}`}>
                  {formatDate(new Date(Math.max(new Date(license?.end_date || Date.now()).getTime(), Date.now()) + extensionDays * 24 * 60 * 60 * 1000))}
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowExtendModal(false)}
                  className={`px-4 py-2 border ${colors.border} rounded-lg`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleExtend}
                  disabled={extending || extensionDays <= 0}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"
                >
                  {extending ? 'Extending...' : `Extend ${extensionDays} Days`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
