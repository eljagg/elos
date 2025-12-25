/**
 * ELOS - API Service
 * 
 * Centralized API communication with automatic token handling
 */

import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - add auth token
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

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post('/api/auth/refresh', { refreshToken });
          const { accessToken } = response.data.data;
          
          localStorage.setItem('accessToken', accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - logout user
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// ============================================================================
// AUTH API
// ============================================================================

export const authAPI = {
  login: (email, password) => 
    api.post('/auth/login', { email, password }),
  
  register: (data) => 
    api.post('/auth/register', data),
  
  logout: () => 
    api.post('/auth/logout'),
  
  refreshToken: (refreshToken) => 
    api.post('/auth/refresh', { refreshToken }),
  
  forgotPassword: (email) => 
    api.post('/auth/forgot-password', { email }),
  
  resetPassword: (token, password, confirmPassword) => 
    api.post('/auth/reset-password', { token, password, confirmPassword }),
  
  changePassword: (currentPassword, newPassword, confirmPassword) => 
    api.post('/auth/change-password', { currentPassword, newPassword, confirmPassword }),
  
  getMe: () => 
    api.get('/auth/me'),
  
  // 2FA
  setup2FA: () => 
    api.post('/auth/2fa/setup'),
  
  verify2FASetup: (code) => 
    api.post('/auth/2fa/verify-setup', { code }),
  
  verify2FA: (tempToken, code) => 
    api.post('/auth/2fa/verify', { tempToken, code }),
  
  // Guest
  guestLogin: (code) => 
    api.post('/auth/guest/login', { code })
};

// ============================================================================
// MENU API
// ============================================================================

export const menuAPI = {
  getCurrentMenu: (cafeteriaId, mealType, dietaryFilter) => 
    api.get('/menus/current', { params: { cafeteriaId, mealType, dietaryFilter } }),
  
  getMenus: (params) => 
    api.get('/menus', { params }),
  
  getMenuById: (id) => 
    api.get(`/menus/${id}`),
  
  createMenu: (data) => 
    api.post('/menus', data),
  
  updateMenu: (id, data) => 
    api.put(`/menus/${id}`, data),
  
  publishMenu: (id) => 
    api.post(`/menus/${id}/publish`),
  
  unpublishMenu: (id) => 
    api.post(`/menus/${id}/unpublish`),
  
  deleteMenu: (id) => 
    api.delete(`/menus/${id}`),
  
  // Menu items
  addMenuItem: (menuId, data) => 
    api.post(`/menus/${menuId}/items`, data),
  
  updateMenuItem: (menuId, itemId, data) => 
    api.put(`/menus/${menuId}/items/${itemId}`, data),
  
  deleteMenuItem: (menuId, itemId) => 
    api.delete(`/menus/${menuId}/items/${itemId}`),
  
  // Reference data
  getCategories: () => 
    api.get('/menus/categories'),
  
  getDietaryTags: () => 
    api.get('/menus/dietary-tags'),
  
  getAllergens: () => 
    api.get('/menus/allergens')
};

// ============================================================================
// ORDER API
// ============================================================================

export const orderAPI = {
  createOrder: (data) => 
    api.post('/orders', data),
  
  createWeekOrders: (data) => 
    api.post('/orders/week', data),
  
  getOrders: (params) => 
    api.get('/orders', { params }),
  
  getOrderById: (id) => 
    api.get(`/orders/${id}`),
  
  getMyHistory: (params) => 
    api.get('/orders/my-history', { params }),
  
  updateOrder: (id, data) => 
    api.put(`/orders/${id}`, data),
  
  cancelOrder: (id, reason) => 
    api.post(`/orders/${id}/cancel`, { reason }),
  
  updateOrderStatus: (id, status, notes) => 
    api.put(`/orders/${id}/status`, { status, notes }),
  
  // Kitchen
  getKitchenOrders: (params) => 
    api.get('/orders/kitchen/today', { params }),
  
  // Favorites
  getFavorites: () => 
    api.get('/orders/favorites'),
  
  saveFavorite: (data) => 
    api.post('/orders/favorites', data),
  
  deleteFavorite: (id) => 
    api.delete(`/orders/favorites/${id}`)
};

// ============================================================================
// USER API
// ============================================================================

export const userAPI = {
  getUsers: (params) => 
    api.get('/users', { params }),
  
  getUserById: (id) => 
    api.get(`/users/${id}`),
  
  createUser: (data) => 
    api.post('/users', data),
  
  updateUser: (id, data) => 
    api.put(`/users/${id}`, data),
  
  updateProfile: (data) => 
    api.put('/users/profile', data),
  
  disableUser: (id, reason) => 
    api.post(`/users/${id}/disable`, { reason }),
  
  enableUser: (id) => 
    api.post(`/users/${id}/enable`),
  
  getRoles: () => 
    api.get('/users/roles'),
  
  importUsers: (users) => 
    api.post('/users/import', { users }),
  
  exportUsers: (params) => 
    api.get('/users/export', { params })
};

// ============================================================================
// COMPANY API
// ============================================================================

export const companyAPI = {
  getCompanies: () => 
    api.get('/companies'),
  
  getCompanyById: (id) => 
    api.get(`/companies/${id}`),
  
  createCompany: (data) => 
    api.post('/companies', data),
  
  updateCompany: (id, data) => 
    api.put(`/companies/${id}`, data),
  
  getDepartments: (companyId) => 
    api.get(`/companies/${companyId}/departments`),
  
  createDepartment: (companyId, data) => 
    api.post(`/companies/${companyId}/departments`, data),
  
  getCafeterias: () => 
    api.get('/companies/cafeterias'),
  
  getBuildings: () => 
    api.get('/companies/buildings')
};

// ============================================================================
// GUEST API
// ============================================================================

export const guestAPI = {
  // Visitors
  createVisitor: (data) => 
    api.post('/guests/visitors', data),
  
  getVisitors: (params) => 
    api.get('/guests/visitors', { params }),
  
  checkoutVisitor: (id) => 
    api.put(`/guests/visitors/${id}/checkout`),
  
  // Codes
  generateCode: (data) => 
    api.post('/guests/codes', data),
  
  getCodes: (params) => 
    api.get('/guests/codes', { params }),
  
  revokeCode: (id) => 
    api.delete(`/guests/codes/${id}`),
  
  // Guest ordering
  getGuestMenu: () => 
    api.get('/guests/menu'),
  
  placeGuestOrder: (data) => 
    api.post('/guests/orders', data)
};

// ============================================================================
// ADMIN API
// ============================================================================

export const adminAPI = {
  getDashboard: () => 
    api.get('/admin/dashboard'),
  
  // Domains
  getDomains: () => 
    api.get('/admin/domains'),
  
  addDomain: (domain, companyId) => 
    api.post('/admin/domains', { domain, companyId }),
  
  removeDomain: (id) => 
    api.delete(`/admin/domains/${id}`),
  
  // Audit
  getAuditLogs: (params) => 
    api.get('/admin/audit-logs', { params }),
  
  // Settings
  getSettings: () => 
    api.get('/admin/settings'),
  
  updateSettings: (settings) => 
    api.put('/admin/settings', { settings })
};

// ============================================================================
// MESSAGE API
// ============================================================================

export const messageAPI = {
  sendMessage: (data) => 
    api.post('/messages', data),
  
  getInbox: (unreadOnly) => 
    api.get('/messages/inbox', { params: { unreadOnly } }),
  
  getSent: () => 
    api.get('/messages/sent'),
  
  markAsRead: (id) => 
    api.put(`/messages/${id}/read`),
  
  // Feedback
  submitFeedback: (data) => 
    api.post('/messages/feedback', data),
  
  getFeedback: (params) => 
    api.get('/messages/feedback', { params }),
  
  respondToFeedback: (id, response, status) => 
    api.put(`/messages/feedback/${id}/respond`, { response, status })
};

// ============================================================================
// REPORT API
// ============================================================================

export const reportAPI = {
  getOrderSummary: (params) => 
    api.get('/reports/orders/summary', { params }),
  
  getPopularItems: (params) => 
    api.get('/reports/orders/popular-items', { params }),
  
  getDailyCounts: (params) => 
    api.get('/reports/orders/daily-counts', { params }),
  
  getIssueSummary: (params) => 
    api.get('/reports/issues/summary', { params })
};

export default api;
