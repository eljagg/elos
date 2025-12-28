/**
 * API Service - Updated with password reset functionality
 * 
 * Add this resetPassword function to your existing api.js file
 * in the userAPI object
 */

// Add this to your userAPI object in frontend/src/services/api.js:

/*
export const userAPI = {
  // ... existing methods ...
  
  // Add this new method:
  resetPassword: (userId, newPassword) => api.post(`/users/${userId}/reset-password`, { password: newPassword }),
};
*/

// ============================================
// FULL userAPI OBJECT FOR REFERENCE:
// ============================================

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  verifyEmail: (token) => api.post('/auth/verify-email', { token }),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
};

// User API
export const userAPI = {
  getUsers: (params) => api.get('/users', { params }),
  getUser: (id) => api.get(`/users/${id}`),
  createUser: (data) => api.post('/users', data),
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  deleteUser: (id) => api.delete(`/users/${id}`),
  enableUser: (id) => api.post(`/users/${id}/enable`),
  disableUser: (id, reason, endDate) => api.post(`/users/${id}/disable`, { reason, endDate }),
  getRoles: () => api.get('/roles'),
  // NEW: Admin password reset for users
  resetPassword: (userId, newPassword) => api.post(`/users/${userId}/reset-password`, { password: newPassword }),
};

// Company API
export const companyAPI = {
  getCompanies: () => api.get('/companies'),
  getCompany: (id) => api.get(`/companies/${id}`),
  createCompany: (data) => api.post('/companies', data),
  updateCompany: (id, data) => api.put(`/companies/${id}`, data),
  deleteCompany: (id) => api.delete(`/companies/${id}`),
  getDepartments: (companyId) => api.get(`/companies/${companyId}/departments`),
  createDepartment: (companyId, data) => api.post(`/companies/${companyId}/departments`, data),
  updateDepartment: (companyId, deptId, data) => api.put(`/companies/${companyId}/departments/${deptId}`, data),
  deleteDepartment: (companyId, deptId) => api.delete(`/companies/${companyId}/departments/${deptId}`),
  getCafeterias: (companyId) => api.get(companyId ? `/companies/${companyId}/cafeterias` : '/companies/cafeterias'),
  createCafeteria: (companyId, data) => api.post(`/companies/${companyId}/cafeterias`, data),
  updateCafeteria: (companyId, cafeId, data) => api.put(`/companies/${companyId}/cafeterias/${cafeId}`, data),
  deleteCafeteria: (companyId, cafeId) => api.delete(`/companies/${companyId}/cafeterias/${cafeId}`),
  getDomains: (companyId) => api.get(`/companies/${companyId}/domains`),
  addDomain: (companyId, domain) => api.post(`/companies/${companyId}/domains`, { domain }),
  removeDomain: (companyId, domain) => api.delete(`/companies/${companyId}/domains/${domain}`),
};

// Menu API
export const menuAPI = {
  getCategories: () => api.get('/menus/categories'),
  getDietaryTags: () => api.get('/menus/dietary-tags'),
  getAllergens: () => api.get('/menus/allergens'),
  getMenus: (params) => api.get('/menus', { params }),
  getMenu: (id) => api.get(`/menus/${id}`),
  createMenu: (data) => api.post('/menus', data),
  updateMenu: (id, data) => api.put(`/menus/${id}`, data),
  deleteMenu: (id) => api.delete(`/menus/${id}`),
  getMenuItems: (params) => api.get('/menu-items', { params }),
  getMenuItem: (id) => api.get(`/menu-items/${id}`),
  createMenuItem: (data) => api.post('/menu-items', data),
  updateMenuItem: (id, data) => api.put(`/menu-items/${id}`, data),
  deleteMenuItem: (id) => api.delete(`/menu-items/${id}`),
};

// Order API
export const orderAPI = {
  getOrders: (params) => api.get('/orders', { params }),
  getOrder: (id) => api.get(`/orders/${id}`),
  getMyOrders: () => api.get('/orders/my'),
  createOrder: (data) => api.post('/orders', data),
  updateOrder: (id, data) => api.put(`/orders/${id}`, data),
  updateOrderStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
  cancelOrder: (id) => api.post(`/orders/${id}/cancel`),
  getGuestCodes: () => api.get('/guest-codes'),
  createGuestCode: (data) => api.post('/guest-codes', data),
};

// Message API
export const messageAPI = {
  getMessages: () => api.get('/messages'),
  sendMessage: (data) => api.post('/messages', data),
  getFeedback: () => api.get('/feedback'),
  submitFeedback: (data) => api.post('/feedback', data),
  respondToFeedback: (id, response) => api.post(`/feedback/${id}/respond`, { response }),
  updateFeedbackStatus: (id, status) => api.patch(`/feedback/${id}/status`, { status }),
  createAnnouncement: (data) => api.post('/announcements', data),
  getAnnouncements: () => api.get('/announcements'),
};

// License API
export const licenseAPI = {
  getStatus: () => api.get('/license/status'),
  checkValid: () => api.get('/license/check'),
  getDetails: () => api.get('/license/details'),
  extend: (days) => api.post('/license/extend', { days }),
  update: (data) => api.put('/license', data),
  activate: (licenseKey) => api.post('/license/activate', { licenseKey }),
};

// Report API
export const reportAPI = {
  getOrderStats: (params) => api.get('/reports/orders', { params }),
  getRevenueStats: (params) => api.get('/reports/revenue', { params }),
  getUserStats: (params) => api.get('/reports/users', { params }),
  getMenuStats: (params) => api.get('/reports/menus', { params }),
  getDailyReport: (date) => api.get(`/reports/daily/${date}`),
  getWeeklyReport: (startDate) => api.get(`/reports/weekly/${startDate}`),
  getMonthlyReport: (year, month) => api.get(`/reports/monthly/${year}/${month}`),
  exportReport: (type, params) => api.get(`/reports/export/${type}`, { params, responseType: 'blob' }),
};

// Admin API
export const adminAPI = {
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data) => api.put('/admin/settings', data),
  getSystemInfo: () => api.get('/admin/system-info'),
  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),
  clearCache: () => api.post('/admin/clear-cache'),
  backupDatabase: () => api.post('/admin/backup'),
  getEmailSettings: () => api.get('/admin/email-settings'),
  updateEmailSettings: (data) => api.put('/admin/email-settings', data),
  testEmail: (email) => api.post('/admin/test-email', { email }),
};

export default api;
