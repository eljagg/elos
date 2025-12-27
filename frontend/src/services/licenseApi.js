/**
 * License API Service
 * Handles all license/trial related API calls
 */

import api from './api';

export const licenseAPI = {
  // Get current license status
  getStatus: () => api.get('/license/status'),
  
  // Check if license is valid (lightweight check)
  checkValid: () => api.get('/license/check'),
  
  // Get license details (admin only)
  getDetails: () => api.get('/license/details'),
  
  // Extend license (admin only)
  extend: (days) => api.post('/license/extend', { days }),
  
  // Update license (admin only)
  update: (data) => api.put('/license', data),
  
  // Activate license key
  activate: (licenseKey) => api.post('/license/activate', { licenseKey }),
};

export default licenseAPI;
