/**
 * License Context
 * Manages license/trial state across the app
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { licenseAPI } from '../services/licenseApi';

const LicenseContext = createContext();

export const useLicense = () => {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
};

export const LicenseProvider = ({ children }) => {
  const [license, setLicense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isValid, setIsValid] = useState(true);
  const [daysRemaining, setDaysRemaining] = useState(null);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    checkLicense();
    // Check license every hour
    const interval = setInterval(checkLicense, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkLicense = async () => {
    try {
      const response = await licenseAPI.getStatus();
      const data = response.data?.data || response.data;
      
      setLicense(data);
      setIsValid(data.isValid || data.current_status === 'active');
      setDaysRemaining(data.daysRemaining || data.days_remaining);
      
      // Show warning if less than 7 days remaining
      if (data.daysRemaining <= 7 && data.daysRemaining > 0) {
        setShowWarning(true);
      }
    } catch (error) {
      console.error('License check failed:', error);
      // If API fails (404 = not implemented yet), default to valid
      // This allows the app to work while license backend is not yet built
      if (error.response?.status === 404) {
        console.log('License API not found - defaulting to valid (trial mode)');
        setIsValid(true);
        setDaysRemaining(30);
        setShowWarning(false);
      } else {
        // For other errors, check localStorage fallback
        const cachedLicense = localStorage.getItem('licenseStatus');
        if (cachedLicense) {
          const cached = JSON.parse(cachedLicense);
          const endDate = new Date(cached.endDate);
          const now = new Date();
          setIsValid(endDate > now);
          setDaysRemaining(Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
        } else {
          // No cache, default to valid
          setIsValid(true);
          setDaysRemaining(30);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const extendLicense = async (days) => {
    try {
      await licenseAPI.extend(days);
      await checkLicense();
      return true;
    } catch (error) {
      console.error('Failed to extend license:', error);
      return false;
    }
  };

  const dismissWarning = () => {
    setShowWarning(false);
    // Don't show again for 24 hours
    localStorage.setItem('licenseWarningDismissed', Date.now().toString());
  };

  return (
    <LicenseContext.Provider value={{
      license,
      loading,
      isValid,
      daysRemaining,
      showWarning,
      checkLicense,
      extendLicense,
      dismissWarning
    }}>
      {children}
    </LicenseContext.Provider>
  );
};

export default LicenseContext;
