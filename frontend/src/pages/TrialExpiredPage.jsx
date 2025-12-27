/**
 * Trial Expired Page
 * Shown when the license/trial has expired
 */

import React, { useState } from 'react';
import { AuthFooter } from '../components/Footer';
import { useLicense } from '../context/LicenseContext';
import toast from 'react-hot-toast';

export default function TrialExpiredPage() {
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const { license, checkLicense } = useLicense();

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!licenseKey.trim()) {
      toast.error('Please enter a license key');
      return;
    }
    
    setLoading(true);
    try {
      // Call API to activate license
      const response = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: licenseKey.trim() })
      });
      
      if (response.ok) {
        toast.success('License activated successfully!');
        await checkLicense();
        window.location.reload();
      } else {
        toast.error('Invalid license key');
      }
    } catch (error) {
      toast.error('Failed to activate license');
    } finally {
      setLoading(false);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-slate-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl mb-4 shadow-xl">
            <span className="text-4xl font-bold text-white">E</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">ELOS</h1>
          <p className="text-red-200">Employee Lunch Ordering System</p>
        </div>

        {/* Expired Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
              <span className="text-5xl">⏰</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Trial Period Ended</h2>
            <p className="text-slate-500 mt-2">
              Your {license?.license_type || 'trial'} license expired on {formatDate(license?.end_date)}
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💾</span>
              <div>
                <p className="font-semibold text-amber-800">Your Data is Safe</p>
                <p className="text-sm text-amber-700">
                  All your data has been preserved. Once you renew your license, 
                  everything will be exactly as you left it.
                </p>
              </div>
            </div>
          </div>

          {/* License Key Input */}
          <form onSubmit={handleActivate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Have a License Key?
              </label>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                placeholder="ELOS-XXXX-XXXX-XXXX"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white font-mono text-center tracking-wider"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Activating...
                </>
              ) : (
                '🔑 Activate License'
              )}
            </button>
          </form>

          {/* Contact Section */}
          <div className="mt-6 pt-6 border-t border-slate-200 text-center">
            <p className="text-slate-600 mb-3">Need to renew your license?</p>
            <div className="space-y-2">
              <a
                href="mailto:support@example.com?subject=ELOS License Renewal"
                className="block w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-all"
              >
                📧 Contact Support
              </a>
              <a
                href="tel:+1234567890"
                className="block w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-all"
              >
                📞 Call Us
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <AuthFooter />
      </div>
    </div>
  );
}
