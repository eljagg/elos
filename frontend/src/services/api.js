/**
 * ELOS API Service
 * 
 * Centralized API client for all backend communication.
 * Uses axios with interceptors for authentication and error handling.
 */

import axios from 'axios';

// API base URL from environment or default to relative path
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - Add auth token to all requests
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

// Response interceptor - Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth data and redirect to login
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============================================================================
// Authentication API
// ============================================================================
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  verifyEmail: (token) => api.post('/auth/verify-email', { token }),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  // Guest login with single-use code
  guestLogin: (code) => api.post('/auth/guest/login', { code })
};

// ============================================================================
// User Management API
// ============================================================================
export const userAPI = {
  getUsers: (params) => api.get('/users', { params }),
  getUser: (id) => api.get(`/users/${id}`),
  createUser: (data) => api.post('/users', data),
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  deleteUser: (id) => api.delete(`/users/${id}`),
  enableUser: (id) => api.post(`/users/${id}/enable`),
  disableUser: (id, reason, endDate) => api.post(`/users/${id}/disable`, { reason, endDate }),
  getRoles: () => api.get('/users/roles'),
  resetPassword: (userId, newPassword) => api.post(`/users/${userId}/reset-password`, { password: newPassword })
};

// ============================================================================
// Company Management API
// ============================================================================
export const companyAPI = {
  // Companies
  getCompanies: () => api.get('/companies'),
  getCompany: (id) => api.get(`/companies/${id}`),
  createCompany: (data) => api.post('/companies', data),
  updateCompany: (id, data) => api.put(`/companies/${id}`, data),
  deleteCompany: (id) => api.delete(`/companies/${id}`),
  
  // Departments
  getDepartments: (companyId) => api.get(`/companies/${companyId}/departments`),
  createDepartment: (companyId, data) => api.post(`/companies/${companyId}/departments`, data),
  updateDepartment: (companyId, deptId, data) => api.put(`/companies/${companyId}/departments/${deptId}`, data),
  deleteDepartment: (companyId, deptId) => api.delete(`/companies/${companyId}/departments/${deptId}`),
  
  // Cafeterias
  getCafeterias: (companyId) => api.get(companyId ? `/companies/${companyId}/cafeterias` : '/companies/cafeterias'),
  createCafeteria: (data) => api.post('/companies/cafeterias', data),
  updateCafeteria: (id, data) => api.put(`/companies/cafeterias/${id}`, data),
  deleteCafeteria: (id) => api.delete(`/companies/cafeterias/${id}`),
  
  // Domains
  getDomains: (companyId) => api.get(`/companies/${companyId}/domains`),
  addDomain: (companyId, domain) => api.post(`/companies/${companyId}/domains`, { domain }),
  removeDomain: (companyId, domain) => api.delete(`/companies/${companyId}/domains/${domain}`)
};

// ============================================================================
// Menu API
// ============================================================================
export const menuAPI = {
  // Reference data
  getCategories: () => api.get('/menus/categories'),
  getDietaryTags: () => api.get('/menus/dietary-tags'),
  getAllergens: () => api.get('/menus/allergens'),
  
  // Menus
  getMenus: (params) => api.get('/menus', { params }),
  getMenu: (id) => api.get(`/menus/${id}`),
  createMenu: (data) => api.post('/menus', data),
  updateMenu: (id, data) => api.put(`/menus/${id}`, data),
  deleteMenu: (id) => api.delete(`/menus/${id}`),
  
  // Menu Items (accessed via menu routes)
  getMenuItems: (menuId) => api.get(`/menus/${menuId}`),
  addMenuItem: (menuId, data) => api.post(`/menus/${menuId}/items`, data),
  updateMenuItem: (menuId, itemId, data) => api.put(`/menus/${menuId}/items/${itemId}`, data),
  deleteMenuItem: (menuId, itemId) => api.delete(`/menus/${menuId}/items/${itemId}`)
};

// ============================================================================
// Order API
// ============================================================================
export const orderAPI = {
  // Orders
  getOrders: (params) => api.get('/orders', { params }),
  getOrder: (id) => api.get(`/orders/${id}`),
  getMyOrders: () => api.get('/orders/my'),
  getMyOrderHistory: () => api.get('/orders/my-history'),
  getKitchenOrders: (params) => api.get('/orders/kitchen/today', { params }),
  
  // Order creation
  createOrder: (data) => api.post('/orders', data),
  createDailyOrder: (data) => api.post('/orders/daily', data),
  
  // Order management
  updateOrder: (id, data) => api.put(`/orders/${id}`, data),
  updateOrderStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
  cancelOrder: (id) => api.post(`/orders/${id}/cancel`),
  
  // Guest codes - uses /guests/codes route
  getGuestCodes: () => api.get('/guests/codes'),
  createGuestCode: (data) => api.post('/guests/codes', data)
};

// ============================================================================
// Message API
// ============================================================================
export const messageAPI = {
  // Messages
  sendMessage: (data) => api.post('/messages', data),
  getInbox: (params) => api.get('/messages/inbox', { params }),
  getSent: (params) => api.get('/messages/sent', { params }),
  getUnreadCount: () => api.get('/messages/unread-count'),
  markAsRead: (id) => api.put(`/messages/${id}/read`),
  markAllAsRead: () => api.put('/messages/mark-all-read'),
  deleteMessage: (id) => api.delete(`/messages/${id}`),
  
  // Feedback
  submitFeedback: (data) => api.post('/messages/feedback', data),
  getFeedback: (params) => api.get('/messages/feedback', { params }),
  respondToFeedback: (id, response) => api.put(`/messages/feedback/${id}/respond`, { response }),
  updateFeedbackStatus: (id, status) => api.patch(`/messages/feedback/${id}/status`, { status })
};

// ============================================================================
// Delivery API
// ============================================================================
export const deliveryAPI = {
  // Profile
  getProfile: () => api.get('/delivery/profile'),
  updateProfile: (data) => api.put('/delivery/profile', data),
  
  // Tracking
  getTracking: () => api.get('/delivery/tracking'),
  updateTracking: (orderId, data) => api.post(`/delivery/tracking/${orderId}`, data),
  
  // Confirmations (for receptionist - legacy)
  getPendingConfirmations: () => api.get('/delivery/pending-confirmations'),
  confirmDelivery: (orderId) => api.post(`/delivery/confirm/${orderId}`),
  
  // Delivery verification (receptionist checklist flow)
  getPendingVerification: () => api.get('/delivery/pending-verification'),
  verifyAndNotify: (arrivedOrderIds, missingOrderIds) => api.post('/delivery/verify-and-notify', { arrivedOrderIds, missingOrderIds }),
  
  // Drivers & Routes
  getDrivers: () => api.get('/delivery/drivers'),
  addDriver: (data) => api.post('/delivery/drivers', data),
  getTodayRoutes: () => api.get('/delivery/routes/today'),
  createRoute: (data) => api.post('/delivery/routes', data),
  startDelivery: (routeId) => api.post(`/delivery/routes/${routeId}/start`),
  completeStop: (stopId, notes) => api.post(`/delivery/stops/${stopId}/complete`, { notes }),
  getMyDeliveries: () => api.get('/delivery/my-deliveries')
};

// ============================================================================
// License API (Temporarily disabled - see licenseApi.js for dedicated service)
// ============================================================================
// export const licenseAPI = {
//   getStatus: () => api.get('/license/status'),
//   checkValid: () => api.get('/license/check'),
//   getDetails: () => api.get('/license/details'),
//   extend: (days) => api.post('/license/extend', { days }),
//   update: (data) => api.put('/license', data),
//   activate: (licenseKey) => api.post('/license/activate', { licenseKey })
// };

// ============================================================================
// Report API
// ============================================================================
export const reportAPI = {
  getOrderStats: (params) => api.get('/reports/orders', { params }),
  getRevenueStats: (params) => api.get('/reports/revenue', { params }),
  getUserStats: (params) => api.get('/reports/users', { params }),
  getMenuStats: (params) => api.get('/reports/menus', { params }),
  getDailyReport: (date) => api.get(`/reports/daily/${date}`),
  getWeeklyReport: (startDate) => api.get(`/reports/weekly/${startDate}`),
  getMonthlyReport: (year, month) => api.get(`/reports/monthly/${year}/${month}`),
  exportReport: (type, params) => api.get(`/reports/export/${type}`, { params, responseType: 'blob' })
};

// ============================================================================
// Admin API
// ============================================================================
export const adminAPI = {
  // Settings
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data) => api.put('/admin/settings', data),
  
  // System
  getSystemInfo: () => api.get('/admin/system-info'),
  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),
  clearCache: () => api.post('/admin/clear-cache'),
  backupDatabase: () => api.post('/admin/backup'),
  
  // Email
  getEmailSettings: () => api.get('/admin/email-settings'),
  updateEmailSettings: (data) => api.put('/admin/email-settings', data),
  testEmail: (email) => api.post('/admin/test-email', { email }),
  
  // Domains
  getDomains: () => api.get('/admin/domains'),
  addDomain: (data) => api.post('/admin/domains', data),
  removeDomain: (id) => api.delete(`/admin/domains/${id}`)
};

// ============================================================================
// Catalog API (Dish Library)
// ============================================================================
export const catalogAPI = {
  // Items
  getItems: (params) => api.get('/catalog/items', { params }),
  getItem: (id) => api.get(`/catalog/items/${id}`),
  createItem: (data) => api.post('/catalog/items', data),
  updateItem: (id, data) => api.put(`/catalog/items/${id}`, data),
  deleteItem: (id) => api.delete(`/catalog/items/${id}`),
  getPriceHistory: (id) => api.get(`/catalog/items/${id}/price-history`),
  
  // Categories
  getCategories: (params) => api.get('/catalog/categories', { params }),
  createCategory: (data) => api.post('/catalog/categories', data),
  updateCategory: (id, data) => api.put(`/catalog/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/catalog/categories/${id}`),
  
  // Dietary tags & allergens
  getDietaryTags: () => api.get('/catalog/dietary-tags'),
  createDietaryTag: (data) => api.post('/catalog/dietary-tags', data),
  getAllergens: () => api.get('/catalog/allergens'),
  createAllergen: (data) => api.post('/catalog/allergens', data)
};

// ============================================================================
// Daily Menu API
// ============================================================================
export const dailyMenuAPI = {
  getDailyMenu: (params) => api.get('/daily-menu', { params }),
  getAllDailyMenus: (params) => api.get('/daily-menu/all', { params }),
  createDailyMenu: (data) => api.post('/daily-menu', data),
  updateMenu: (id, data) => api.put(`/daily-menu/${id}`, data),
  deleteDailyMenu: (id) => api.delete(`/daily-menu/${id}`),
  addItemsToMenu: (id, data) => api.post(`/daily-menu/${id}/items`, data),
  updateMenuItem: (menuId, itemId, data) => api.put(`/daily-menu/${menuId}/items/${itemId}`, data),
  removeMenuItem: (menuId, itemId) => api.delete(`/daily-menu/${menuId}/items/${itemId}`),
  publishDailyMenu: (id, data) => api.post(`/daily-menu/${id}/publish`, data),
  unpublishDailyMenu: (id) => api.put(`/daily-menu/${id}/unpublish`),
  archiveDailyMenu: (id) => api.put(`/daily-menu/${id}/archive`),
  markItemSoldOut: (dailyMenuItemId, data) => api.post(`/daily-menu/items/${dailyMenuItemId}/sold-out`, data),
  updatePortions: (dailyMenuItemId, data) => api.patch(`/daily-menu/items/${dailyMenuItemId}/portions`, data),
  getCatalogItemsGrouped: () => api.get('/daily-menu/catalog/items/grouped'),
  
  // Notifications
  getNotifications: (params) => api.get('/daily-menu/notifications', { params }),
  markNotificationRead: (id) => api.patch(`/daily-menu/notifications/${id}/read`),
  markAllNotificationsRead: () => api.patch('/daily-menu/notifications/read-all')
};

// ============================================================================
// Wallet API (Cashless Payments)
// ============================================================================
export const walletAPI = {
  // Employee routes
  getMyWallet: () => api.get('/wallet'),
  getTransactions: (params) => api.get('/wallet/transactions', { params }),
  payForOrder: (orderId, amount) => api.post('/wallet/pay', { orderId, amount }),
  
  // HR/Admin routes
  getAllWallets: (params) => api.get('/wallet/all', { params }),
  depositFunds: (userId, data) => api.post(`/wallet/${userId}/deposit`, data),
  updateWalletSettings: (userId, data) => api.patch(`/wallet/${userId}/settings`, data),
  refundToWallet: (data) => api.post('/wallet/refund', data),
  bulkDeposit: (deposits, description) => api.post('/wallet/bulk-deposit', { deposits, description })
};

// ============================================================================
// Notifications API
// ============================================================================
export const notificationAPI = {
  getNotifications: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/read-all'),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
  getPreferences: () => api.get('/notifications/preferences'),
  updatePreferences: (data) => api.patch('/notifications/preferences', data)
};

// ============================================================================
// QR Code API
// ============================================================================
export const qrCodeAPI = {
  getQRCodes: (params) => api.get('/qr-codes', { params }),
  createQRCode: (data) => api.post('/qr-codes', data),
  scanQRCode: (code) => api.get(`/qr-codes/scan/${code}`),
  updateQRCode: (id, data) => api.patch(`/qr-codes/${id}`, data),
  deleteQRCode: (id) => api.delete(`/qr-codes/${id}`),
  bulkCreateQRCodes: (data) => api.post('/qr-codes/bulk', data),
  getQRCodeStats: (params) => api.get('/qr-codes/stats', { params })
};

// ============================================================================
// Ingredient API (Nutrition System)
// ============================================================================
export const ingredientAPI = {
  // Ingredients
  getIngredients: (params) => api.get('/ingredients', { params }),
  getIngredient: (id) => api.get(`/ingredients/${id}`),
  createIngredient: (data) => api.post('/ingredients', data),
  updateIngredient: (id, data) => api.put(`/ingredients/${id}`, data),
  deleteIngredient: (id) => api.delete(`/ingredients/${id}`),
  
  // Categories
  getCategories: () => api.get('/ingredients/categories'),
  
  // Dish ingredients
  getDishIngredients: (dishId) => api.get(`/ingredients/dish/${dishId}`),
  updateDishIngredients: (dishId, ingredients) => api.put(`/ingredients/dish/${dishId}`, { ingredients }),
  
  // Nutrition calculation
  calculateNutrition: (dishId) => api.get(`/ingredients/dish/${dishId}/nutrition`),
  syncNutrition: (dishId) => api.post(`/ingredients/dish/${dishId}/sync-nutrition`)
};

// Export default api instance for custom requests
export default api;
