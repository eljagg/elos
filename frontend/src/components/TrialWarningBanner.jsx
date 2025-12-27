/**
 * Trial Warning Banner
 * Shows when trial is about to expire (7 days or less)
 */

import React from 'react';
import { useLicense } from '../context/LicenseContext';

export default function TrialWarningBanner() {
  const { daysRemaining, showWarning, dismissWarning, license } = useLicense();

  if (!showWarning || daysRemaining > 7 || daysRemaining <= 0) {
    return null;
  }

  const getBgColor = () => {
    if (daysRemaining <= 1) return 'bg-red-600';
    if (daysRemaining <= 3) return 'bg-orange-500';
    return 'bg-amber-500';
  };

  const getMessage = () => {
    if (daysRemaining === 1) {
      return '⚠️ Your trial expires TODAY! Contact support to continue using ELOS.';
    }
    if (daysRemaining <= 3) {
      return `⚠️ Only ${daysRemaining} days left in your trial! Renew now to avoid interruption.`;
    }
    return `📅 Your trial expires in ${daysRemaining} days. Contact support to upgrade.`;
  };

  return (
    <div className={`${getBgColor()} text-white px-4 py-2 text-center text-sm relative`}>
      <span>{getMessage()}</span>
      <button
        onClick={dismissWarning}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
