/**
 * License Check Wrapper
 * Wraps the app and redirects to expired page if license is invalid
 * SYSTEM_OWNER bypasses all license checks
 */

import React from 'react';
import { useLicense } from '../context/LicenseContext';
import { useAuth } from '../context/AuthContext';
import TrialExpiredPage from '../pages/TrialExpiredPage';
import TrialWarningBanner from './TrialWarningBanner';

export default function LicenseCheck({ children }) {
  const { isValid, loading } = useLicense();
  const { user } = useAuth();

  // SYSTEM_OWNER always bypasses license check
  const isSystemOwner = user?.role === 'SYSTEM_OWNER' || user?.role_code === 'SYSTEM_OWNER';

  // Show loading while checking license (but not for system owner)
  if (loading && !isSystemOwner) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Checking license...</p>
        </div>
      </div>
    );
  }

  // SYSTEM_OWNER always gets access
  if (isSystemOwner) {
    return (
      <>
        <TrialWarningBanner />
        {children}
      </>
    );
  }

  // Show expired page if license is invalid
  if (!isValid) {
    return <TrialExpiredPage />;
  }

  // License is valid - show warning banner if needed and render children
  return (
    <>
      <TrialWarningBanner />
      {children}
    </>
  );
}
