import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { orderAPI, menuAPI, messageAPI, companyAPI, catalogAPI, dailyMenuAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import DishLibrary from '../../components/kitchen/DishLibrary';
import EnhancedPrepList from '../../components/kitchen/EnhancedPrepList';
import toast from 'react-hot-toast';

export default function KitchenDashboard() {
  const { colors, getStatCardColors } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Helper function to get today's date in YYYY-MM-DD format using local timezone
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // State declarations must come before useEffect that uses them
  const [activeTab, setActiveTab] = useState('orders');
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [menus, setMenus] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [issues, setIssues] = useState([]);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState({});
  const [filters, setFilters] = useState({ 
    company: '', 
    status: '', 
    date: getTodayDate() // Use helper function for guaranteed local date
  });
  const [deliveryNotifications, setDeliveryNotifications] = useState([]);
  
  // Loading states for preventing rapid clicks
  const [updatingOrders, setUpdatingOrders] = useState(new Set()); // Track which orders are being updated
  const [bulkUpdating, setBulkUpdating] = useState(false); // Track bulk operations

  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [menuToDelete, setMenuToDelete] = useState(null);
  // Archive state
  const [menusSubTab, setMenusSubTab] = useState('active'); // 'active' or 'archived'
  const [archivedMenus, setArchivedMenus] = useState([]);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [menuToArchive, setMenuToArchive] = useState(null);
  const [cafeterias, setCafeterias] = useState([]);
  const [menuForm, setMenuForm] = useState({ 
    name: '', 
    description: '', 
    mealType: 'lunch', 
    menuType: 'regular', 
    isActive: true,
    cafeteriaId: '',
    menuScope: 'daily', // 'daily' or 'weekly'
    menuDate: '', // for daily menu
    weekStartDate: '',
    weekEndDate: ''
  });
  const [itemForm, setItemForm] = useState({ 
    name: '', 
    description: '', 
    category: 'protein', 
    isVegan: false, 
    isVegetarian: false, 
    ingredients: '',
    basePrice: '0.00',
    addOnPrice: '0.00'
  });

  // Set active tab based on URL (query params or path)
  useEffect(() => {
    // Check query parameter first (?tab=items)
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    
    if (tabParam) {
      // Query parameter takes precedence
      setActiveTab(tabParam);
    } else {
      // Fallback to path-based detection
      const path = location.pathname;
      if (path.includes('/orders')) setActiveTab('orders');
      else if (path.includes('/prep')) setActiveTab('prep');
      else if (path.includes('/deliveries')) setActiveTab('deliveries');
      else if (path.includes('/menus')) setActiveTab('menus');
      else if (path.includes('/items')) setActiveTab('items');
      else if (path.includes('/issues')) setActiveTab('issues');
      else if (path.includes('/messages')) setActiveTab('messages');
      else setActiveTab('orders'); // Default tab
    }
  }, [location.pathname, location.search]);

  // Delete menu handler - moved outside useEffect
  const handleDeleteMenu = async (menu) => {
    setMenuToDelete(menu);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteMenu = async () => {
    if (!menuToDelete) return;
    
    try {
      // Check if this is a daily menu
      const isDailyMenu = menuToDelete.isDailyMenu || menuToDelete.menu_date || menuToDelete.menuDate;
      const apiUrl = isDailyMenu 
        ? `/api/daily-menu/${menuToDelete.id}`
        : `/api/menus/${menuToDelete.id}`;
      
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to delete menu');
      }

      // Remove from state
      setMenus(menus.filter(m => m.id !== menuToDelete.id));
      
      // Close modal
      setShowDeleteConfirm(false);
      setMenuToDelete(null);
      
      toast.success('Menu deleted successfully');
    } catch (error) {
      console.error('Error deleting menu:', error);
      toast.error(error.message || 'Failed to delete menu. Please try again.');
    }
  };

  // Archive menu handlers
  const handleArchiveMenu = (menu) => {
    setMenuToArchive(menu);
    setShowArchiveConfirm(true);
  };

  const confirmArchiveMenu = async () => {
    if (!menuToArchive) return;
    
    try {
      // Check if this is a daily menu
      const isDailyMenu = menuToArchive.isDailyMenu || menuToArchive.menu_date || menuToArchive.menuDate;
      
      const apiUrl = isDailyMenu 
        ? `/api/daily-menu/${menuToArchive.id}/archive`
        : `/api/menus/${menuToArchive.id}/archive`;
      
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to archive menu');
      }

      // Remove from active menus
      setMenus(menus.filter(m => m.id !== menuToArchive.id));
      
      // Close modal
      setShowArchiveConfirm(false);
      setMenuToArchive(null);
      
      toast.success('Menu archived successfully');
    } catch (error) {
      console.error('Error archiving menu:', error);
      toast.error(error.message || 'Failed to archive menu');
    }
  };

  // Unpublish menu handler - sets status back to draft
  const handleUnpublishMenu = async (menu) => {
    if (!window.confirm(`Unpublish "${menu.name}"? Employees won't be able to order from this menu until it's republished.`)) return;
    
    try {
      const isDailyMenu = menu.isDailyMenu || menu.menu_date || menu.menuDate;
      const apiUrl = isDailyMenu 
        ? `/api/daily-menu/${menu.id}/unpublish`
        : `/api/menus/${menu.id}/unpublish`;
      
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to unpublish menu');
      }

      // Update menu status in state
      setMenus(menus.map(m => m.id === menu.id ? { ...m, status: 'draft' } : m));
      toast.success('Menu unpublished. You can now edit it and republish when ready.');
    } catch (error) {
      console.error('Error unpublishing menu:', error);
      toast.error(error.message || 'Failed to unpublish menu');
    }
  };

  const loadArchivedMenus = async () => {
    try {
      // Load both weekly and daily archived menus
      const [weeklyRes, dailyRes] = await Promise.all([
        fetch('/api/menus/archived', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        }).catch(() => ({ json: () => ({ success: true, data: { menus: [] } }) })),
        fetch('/api/daily-menu/all?status=archived', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        }).catch(() => ({ json: () => ({ success: true, data: { menus: [] } }) }))
      ]);
      
      const weeklyData = await weeklyRes.json();
      const dailyData = await dailyRes.json();
      
      const weeklyMenus = weeklyData.success ? (weeklyData.data?.menus || []).map(m => ({ ...m, isDailyMenu: false })) : [];
      const dailyMenus = dailyData.success ? (dailyData.data?.menus || []) : [];
      
      setArchivedMenus([...dailyMenus, ...weeklyMenus]);
    } catch (error) {
      console.error('Error loading archived menus:', error);
      toast.error('Failed to load archived menus');
    }
  };

  const handleRestoreMenu = async (menu) => {
    try {
      const isDailyMenu = menu.isDailyMenu || menu.menu_date || menu.menuDate;
      const apiUrl = isDailyMenu 
        ? `/api/daily-menu/${menu.id}/unpublish`  // Restore to draft
        : `/api/menus/${menu.id}/restore`;
      
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to restore menu');
      }

      // Remove from archived and reload active menus
      setArchivedMenus(archivedMenus.filter(m => m.id !== menu.id));
      loadData(); // Reload active menus
      
      toast.success('Menu restored to draft status');
    } catch (error) {
      console.error('Error restoring menu:', error);
      toast.error(error.message || 'Failed to restore menu');
    }
  };

  const [issueResponse, setIssueResponse] = useState('');
  
  // Phase 3: Menu-Catalog Item Management
  const [selectedMenuForItems, setSelectedMenuForItems] = useState(null);
  const [showAddItemsModal, setShowAddItemsModal] = useState(false);
  const [menuCatalogItems, setMenuCatalogItems] = useState([]);
  const [availableCatalogItems, setAvailableCatalogItems] = useState([]);
  const [selectedCatalogItems, setSelectedCatalogItems] = useState([]);
  const [showMenuItemsView, setShowMenuItemsView] = useState(false);
  const [loadingCatalogItems, setLoadingCatalogItems] = useState(false);

  // Load data on mount and when date changes
  useEffect(() => {
    if (filters.date) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.date]);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('[Dashboard] Loading orders for date:', filters.date);
      
      const [ordersRes, weeklyMenusRes, dailyMenusRes, itemsRes, issuesRes, messagesRes, companiesRes, cafeteriasRes] = await Promise.all([
        orderAPI.getKitchenOrders({ date: filters.date }).catch(() => ({ data: { data: { ordersByStatus: { pending: [], preparing: [], ready: [], completed: [], confirmed: [], delivered: [] }, summary: {} } } })),
        menuAPI.getMenus().catch(() => ({ data: { data: { menus: [] } } })),
        dailyMenuAPI.getAllDailyMenus().catch(() => ({ data: { data: { menus: [] } } })),
        catalogAPI.getItems().catch(() => ({ data: { data: { items: [] } } })),
        messageAPI.getFeedback().catch(() => ({ data: { data: { feedback: [] } } })),
        messageAPI.getInbox().catch(() => ({ data: { data: { messages: [], unreadCount: 0 } } })),
        companyAPI.getCompanies().catch(() => ({ data: { data: { companies: [] } } })),
        companyAPI.getCafeterias().catch(() => ({ data: { data: { cafeterias: [] } } }))
      ]);
      
      console.log('[Dashboard] API Response:', ordersRes.data);
      
      // Kitchen orders endpoint returns ordersByStatus, convert to flat array
      const ordersByStatus = ordersRes.data?.data?.ordersByStatus || {};
      const ordersList = [
        ...(ordersByStatus.pending || []),
        ...(ordersByStatus.confirmed || []),
        ...(ordersByStatus.preparing || []),
        ...(ordersByStatus.ready || []),
        ...(ordersByStatus.delivered || []),
        ...(ordersByStatus.completed || [])
      ];
      
      console.log('[Dashboard] Orders loaded:', ordersList.length);
      
      // Combine weekly and daily menus
      const weeklyMenus = (weeklyMenusRes.data?.data?.menus || []).map(m => ({ ...m, isDailyMenu: false }));
      const dailyMenus = dailyMenusRes.data?.data?.menus || [];
      const allMenus = [...dailyMenus, ...weeklyMenus];
      
      console.log('[Dashboard] Menus loaded - Weekly:', weeklyMenus.length, 'Daily:', dailyMenus.length);
      
      setOrders(ordersList);
      setMenus(allMenus);
      setMenuItems(itemsRes.data?.data?.items || []);
      setIssues((issuesRes.data?.data?.feedback || []).filter(f => f.type === 'issue' || f.status === 'escalated'));
      setMessages(messagesRes.data?.data?.messages || []);
      setUnreadCount(messagesRes.data?.data?.unreadCount || 0);
      setCompanies(companiesRes.data?.data?.companies || []);
      
      // Load cafeterias and set default if available
      const loadedCafeterias = cafeteriasRes.data?.data?.cafeterias || [];
      setCafeterias(loadedCafeterias);
      if (loadedCafeterias.length > 0 && !menuForm.cafeteriaId) {
        setMenuForm(prev => ({ ...prev, cafeteriaId: loadedCafeterias[0].id }));
      }

      // Calculate stats
      setStats({
        pending: ordersByStatus.pending?.length || 0,
        preparing: ordersByStatus.preparing?.length || 0,
        ready: ordersByStatus.ready?.length || 0,
        completed: ordersByStatus.completed?.length || 0,
        inProcess: (ordersByStatus.confirmed?.length || 0) + (ordersByStatus.preparing?.length || 0),
        issues: ((issuesRes.data?.data?.feedback || []).filter(f => f.type === 'issue' || f.status === 'escalated')).length
      });

      // Track delivery notifications
      const delivered = ordersByStatus.delivered || [];
      setDeliveryNotifications(delivered.map(o => ({ orderId: o.id, companyName: o.companyName, confirmed: o.status === 'completed' })));
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchCompany = !filters.company || order.companyId === filters.company;
    const matchStatus = !filters.status || order.status === filters.status;
    const matchDate = !filters.date || (order.orderDate && order.orderDate.toString().startsWith(filters.date));
    return matchCompany && matchStatus && matchDate;
  });

  const handleStatusUpdate = async (orderId, newStatus) => {
    // Prevent multiple simultaneous updates to the same order
    if (updatingOrders.has(orderId)) {
      console.log(`[handleStatusUpdate] Order ${orderId} is already being updated`);
      return;
    }

    try {
      // Mark order as updating
      setUpdatingOrders(prev => new Set([...prev, orderId]));
      
      await orderAPI.updateOrderStatus(orderId, newStatus);
      toast.success(`Order ${newStatus}`);
      loadData();
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    } finally {
      // Remove order from updating set
      setUpdatingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const handleBulkStatusUpdate = async (newStatus) => {
    // Prevent multiple simultaneous bulk updates
    if (bulkUpdating) {
      console.log('[handleBulkStatusUpdate] Bulk update already in progress');
      return;
    }

    try {
      const ordersToUpdate = filteredOrders.filter(order => 
        order.status === 'pending' || order.status === 'confirmed'
      );
      
      if (ordersToUpdate.length === 0) {
        toast.error('No orders to update');
        return;
      }

      const confirmMessage = `Start preparing ${ordersToUpdate.length} order${ordersToUpdate.length > 1 ? 's' : ''}?`;
      if (!window.confirm(confirmMessage)) return;

      setBulkUpdating(true);

      await Promise.all(
        ordersToUpdate.map(order => orderAPI.updateOrderStatus(order.id, newStatus))
      );
      
      toast.success(`${ordersToUpdate.length} order${ordersToUpdate.length > 1 ? 's' : ''} updated to ${newStatus}`);
      loadData();
    } catch (error) {
      console.error('Error bulk updating orders:', error);
      toast.error('Failed to update some orders');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleSaveMenu = async (e) => {
    e.preventDefault();
    try {
      // Validate required fields
      if (!menuForm.cafeteriaId) {
        toast.error('Please select a cafeteria');
        return;
      }
      
      if (menuForm.menuScope === 'daily') {
        // ===== DAILY MENU =====
        if (!menuForm.menuDate) {
          toast.error('Please select a date');
          return;
        }
        
        const dailyMenuData = {
          cafeteriaId: menuForm.cafeteriaId,
          date: menuForm.menuDate,
          mealType: menuForm.mealType,
          cutoffTime: menuForm.mealType === 'breakfast' ? '08:00' : '10:00'
        };
        
        if (selectedMenu && selectedMenu.isDailyMenu) {
          // Update existing daily menu
          await dailyMenuAPI.updateDailyMenu?.(selectedMenu.id, dailyMenuData) || 
            toast.error('Update not supported for daily menus yet');
        } else {
          await dailyMenuAPI.createDailyMenu(dailyMenuData);
          toast.success(`Daily menu created for ${menuForm.menuDate}`);
        }
      } else {
        // ===== WEEKLY MENU =====
        let weekStartDate = menuForm.weekStartDate;
        let weekEndDate = menuForm.weekEndDate;
        
        if (!weekStartDate) {
          // Default to current week (Monday to Sunday)
          const today = new Date();
          const dayOfWeek = today.getDay();
          const monday = new Date(today);
          monday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
          weekStartDate = monday.toISOString().split('T')[0];
          
          const sunday = new Date(monday);
          sunday.setDate(monday.getDate() + 6);
          weekEndDate = sunday.toISOString().split('T')[0];
        }
        
        const menuData = {
          name: menuForm.name,
          cafeteriaId: menuForm.cafeteriaId,
          weekStartDate,
          weekEndDate,
          internalNotes: menuForm.description
        };
        
        if (selectedMenu && !selectedMenu.isDailyMenu) {
          await menuAPI.updateMenu(selectedMenu.id, menuData);
          toast.success('Weekly menu updated');
        } else {
          await menuAPI.createMenu(menuData);
          toast.success('Weekly menu created');
        }
      }
      
      setShowMenuModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving menu:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to save menu');
    }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    try {
      const itemData = {
        name: itemForm.name,
        description: itemForm.description,
        category_code: itemForm.category,
        // FIXED: Use camelCase to match backend (was is_vegan, is_vegetarian)
        isVegan: itemForm.isVegan,
        isVegetarian: itemForm.isVegetarian,
        ingredients: itemForm.ingredients,
        price: parseFloat(itemForm.basePrice) || 0,
        add_on_price: parseFloat(itemForm.addOnPrice) || 0,
        // IMPORTANT: Always send dietary tags and allergens arrays
        // Even if empty, this clears them in the database
        dietaryTagIds: [],  // TODO: Connect to actual dietary tag checkboxes when implemented
        allergenIds: []     // TODO: Connect to actual allergen checkboxes when implemented
      };

      if (selectedItem) {
        await catalogAPI.updateItem(selectedItem.id, itemData);
        toast.success('Item updated');
      } else {
        await catalogAPI.createItem(itemData);
        toast.success('Item created');
      }
      setShowItemModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving item:', error);
      toast.error('Failed to save item');
    }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      // Extract ID from item object (item could be object or string)
      const itemId = typeof item === 'string' ? item : item.id;
      await catalogAPI.deleteItem(itemId);
      toast.success('Item deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item');
    }
  };

  const handleRespondIssue = async () => {
    try {
      await messageAPI.respondToFeedback(selectedIssue.id, issueResponse);
      toast.success('Issue resolved');
      setShowIssueModal(false);
      loadData();
    } catch (error) {
      console.error('Error responding to issue:', error);
      toast.error('Failed to respond');
    }
  };

  // =========================================================================
  // PHASE 3: MENU-CATALOG ITEM MANAGEMENT
  // =========================================================================
  
  const loadMenuCatalogItems = async (menuId) => {
    try {
      // Check if this is a daily menu
      const isDailyMenu = selectedMenuForItems?.menu_date || selectedMenuForItems?.menuDate;
      
      let response;
      if (isDailyMenu) {
        // For daily menus, get items from daily menu API
        response = await dailyMenuAPI.getDailyMenu({ 
          cafeteriaId: selectedMenuForItems.cafeteria_id || selectedMenuForItems.cafeteriaId,
          date: selectedMenuForItems.menu_date || selectedMenuForItems.menuDate 
        });
        const items = response.data?.data?.items || [];
        setMenuCatalogItems(items.map(item => ({
          id: item.id,
          catalog_item_id: item.catalog_item_id,
          name: item.item_name || item.name,
          description: item.description,
          price: item.price,
          category: item.category_name || item.category,
          portions_available: item.portions_available,
          portions_ordered: item.portions_ordered
        })));
        return;
      }
      
      // For weekly menus, use the menu-catalog API
      response = await fetch(`/api/menu-catalog/${menuId}/catalog-items`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setMenuCatalogItems(data.data || []);
      }
    } catch (error) {
      console.error('Error loading menu catalog items:', error);
      // Don't show error toast, just set empty array
      setMenuCatalogItems([]);
    }
  };
  
  const loadAvailableCatalogItems = async (menuId) => {
    try {
      // First try to get available items for this specific menu
      const response = await fetch(`/api/menu-catalog/${menuId}/available-catalog-items`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      const data = await response.json();
      
      if (data.success && data.data && data.data.length > 0) {
        setAvailableCatalogItems(data.data);
      } else {
        // Fallback: Load ALL catalog items from the Dish Library
        console.log('Loading all catalog items as fallback...');
        const catalogRes = await catalogAPI.getItems();
        const allItems = catalogRes.data?.data?.items || [];
        
        // Filter out items that are already in the current menu
        const existingItemIds = menuCatalogItems.map(item => item.catalog_item_id || item.id);
        const available = allItems.filter(item => !existingItemIds.includes(item.id));
        
        setAvailableCatalogItems(available.length > 0 ? available : allItems);
      }
    } catch (error) {
      console.error('Error loading available items:', error);
      // Ultimate fallback: Load ALL catalog items
      try {
        const catalogRes = await catalogAPI.getItems();
        const allItems = catalogRes.data?.data?.items || [];
        setAvailableCatalogItems(allItems);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        toast.error('Failed to load catalog items');
      }
    }
  };
  
  const handleManageMenuItems = async (menu) => {
    setSelectedMenuForItems(menu);
    setShowMenuItemsView(true);
    setMenuCatalogItems([]); // Clear previous items
    await loadMenuCatalogItemsForMenu(menu);
  };
  
  // Helper function that takes menu object directly (avoids state timing issues)
  const loadMenuCatalogItemsForMenu = async (menu) => {
    try {
      // Check if this is a daily menu (has isDailyMenu flag or menu_date)
      const isDailyMenu = menu?.isDailyMenu || menu?.menu_date || menu?.menuDate;
      
      if (isDailyMenu) {
        // For daily menus, get items from daily menu API
        const response = await dailyMenuAPI.getDailyMenu({ 
          cafeteriaId: menu.cafeteria_id || menu.cafeteriaId,
          date: menu.menu_date || menu.menuDate 
        });
        const items = response.data?.data?.items || [];
        console.log('[Dashboard] Daily menu items loaded:', items.length);
        setMenuCatalogItems(items.map(item => ({
          id: item.id,
          catalog_item_id: item.catalog_item_id,
          name: item.item_name || item.name,
          description: item.description,
          price: item.price || 0,
          add_on_price: item.add_on_price || 0,
          category: item.category_name || item.category,
          portions_available: item.portions_available,
          portions_ordered: item.portions_ordered
        })));
        return;
      }
      
      // For weekly menus, use the menu-catalog API
      const response = await fetch(`/api/menu-catalog/${menu.id}/catalog-items`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      const data = await response.json();
      console.log('[Dashboard] Weekly menu catalog items response:', data);
      
      if (data.success && data.data) {
        // Map API response fields to expected format
        const mappedItems = data.data.map(item => ({
          id: item.link_id || item.id,
          catalog_item_id: item.catalog_item_id || item.catalog_id,
          name: item.name,
          description: item.description,
          price: item.effective_price || item.price || item.catalog_price || 0,
          add_on_price: item.effective_add_on_price || item.add_on_price || item.catalog_add_on_price || 0,
          category: item.category,
          is_vegan: item.is_vegan,
          is_vegetarian: item.is_vegetarian
        }));
        setMenuCatalogItems(mappedItems);
      } else {
        console.warn('Failed to load menu items:', data);
        setMenuCatalogItems([]);
      }
    } catch (error) {
      console.error('Error loading menu catalog items:', error);
      setMenuCatalogItems([]);
    }
  };
  
  const handleAddItemsToMenu = async () => {
    if (selectedCatalogItems.length === 0) {
      toast.error('Please select at least one item');
      return;
    }
    
    try {
      // Check if this is a daily menu (has isDailyMenu flag or menu_date)
      const isDailyMenu = selectedMenuForItems.isDailyMenu || selectedMenuForItems.menu_date || selectedMenuForItems.menuDate;
      
      let response;
      if (isDailyMenu) {
        // Use daily menu API - expects catalogItemIds array
        response = await fetch(`/api/daily-menu/${selectedMenuForItems.id}/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            catalogItemIds: selectedCatalogItems,
            portionsAvailable: 50
          })
        });
      } else {
        // Use weekly menu catalog API
        response = await fetch(`/api/menu-catalog/${selectedMenuForItems.id}/catalog-items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            catalogItemIds: selectedCatalogItems
          })
        });
      }
      
      const data = await response.json();
      if (data.success) {
        toast.success(`Added ${selectedCatalogItems.length} item(s) to menu`);
        setShowAddItemsModal(false);
        setSelectedCatalogItems([]);
        await loadMenuCatalogItemsForMenu(selectedMenuForItems);
      } else {
        toast.error(data.error?.message || 'Failed to add items');
      }
    } catch (error) {
      console.error('Error adding items to menu:', error);
      toast.error('Failed to add items');
    }
  };
  
  const handleRemoveItemFromMenu = async (itemId) => {
    if (!window.confirm('Remove this item from the menu?')) return;
    
    try {
      const isDailyMenu = selectedMenuForItems?.isDailyMenu || selectedMenuForItems?.menu_date || selectedMenuForItems?.menuDate;
      
      let response;
      if (isDailyMenu) {
        // For daily menus, use the daily menu API
        response = await fetch(`/api/daily-menu/${selectedMenuForItems.id}/items/${itemId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        });
      } else {
        // For weekly menus, use the menu-catalog API
        response = await fetch(`/api/menu-catalog/${selectedMenuForItems.id}/catalog-items/${itemId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        });
      }
      
      const data = await response.json();
      if (data.success) {
        toast.success('Item removed from menu');
        await loadMenuCatalogItemsForMenu(selectedMenuForItems);
      } else {
        toast.error(data.error?.message || 'Failed to remove item');
      }
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error('Failed to remove item');
    }
  };
  
  const handleOpenAddItemsModal = async () => {
    // Show modal with loading state
    setLoadingCatalogItems(true);
    setAvailableCatalogItems([]); // Clear previous items
    setShowAddItemsModal(true);
    
    // Load items
    await loadAvailableCatalogItems(selectedMenuForItems.id);
    setLoadingCatalogItems(false);
  };
  
  const toggleCatalogItemSelection = (itemId) => {
    setSelectedCatalogItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  return (
    <div className={`min-h-screen ${colors.bgPrimary}`}>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className={`text-3xl font-bold ${colors.textPrimary}`}>Kitchen Dashboard</h1>
            <p className={colors.textMuted}>Manage orders, menus, and prep</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {[
            { label: 'Pending', value: stats.pending, color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
            { label: 'Preparing', value: stats.preparing, color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
            { label: 'Ready', value: stats.ready, color: 'bg-blue-100 text-blue-700 border-blue-200' },
            { label: 'Completed', value: stats.completed, color: 'bg-green-100 text-green-700 border-green-200' },
            { label: 'In-Process', value: stats.inProcess, color: 'bg-orange-100 text-orange-700 border-orange-200' },
            { label: 'Issues', value: stats.issues, color: 'bg-red-100 text-red-700 border-red-200' }
          ].map((stat, idx) => (
            <div key={idx} className={`border rounded-xl p-4 ${stat.color}`}>
              <p className="text-sm font-medium">{stat.label}</p>
              <p className="text-3xl font-bold">{stat.value || 0}</p>
            </div>
          ))}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'orders', label: 'Orders', icon: '📦' },
            { id: 'prep', label: 'Prep List', icon: '📋' },
            { id: 'deliveries', label: `Deliveries ${stats.ready > 0 ? `(${stats.ready})` : ''}`, icon: '🚚' },
            { id: 'menus', label: 'Menus', icon: '📝' },
            { id: 'items', label: 'Items', icon: '🍽️' },
            { id: 'issues', label: 'Issues', icon: '⚠️' },
            { id: 'messages', label: `Messages ${unreadCount > 0 ? `(${unreadCount})` : ''}`, icon: '💬' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-orange-600 text-white'
                  : `${colors.bgCard} ${colors.textSecondary} hover:bg-orange-100`
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className={`${colors.bgCard} rounded-xl p-6`}>
          {activeTab === 'orders' && (
            <div>
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <select
                  value={filters.company}
                  onChange={(e) => setFilters({ ...filters, company: e.target.value })}
                  className={`px-4 py-2 border ${colors.border} rounded-lg`}
                >
                  <option value="">All Companies</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className={`px-4 py-2 border ${colors.border} rounded-lg`}
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="preparing">Preparing</option>
                  <option value="ready">Ready</option>
                  <option value="delivered">Delivered</option>
                  <option value="completed">Completed</option>
                </select>

                <input
                  type="date"
                  value={filters.date}
                  onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                  className={`px-4 py-2 border ${colors.border} rounded-lg`}
                />
              </div>

              {/* Orders List */}
              {loading ? (
                <p className={colors.textMuted}>Loading...</p>
              ) : filteredOrders.length > 0 ? (
                <div className="space-y-4">
                  {/* Bulk Action Button */}
                  {filteredOrders.filter(o => o.status === 'pending' || o.status === 'confirmed').length > 0 && (
                    <div className="flex justify-end mb-4">
                      <button
                        onClick={() => handleBulkStatusUpdate('preparing')}
                        disabled={bulkUpdating}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          bulkUpdating
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-cyan-600 hover:bg-cyan-700'
                        } text-white`}
                      >
                        {bulkUpdating ? (
                          <>⏳ Updating...</>
                        ) : (
                          <>🔥 Start Preparing All ({filteredOrders.filter(o => o.status === 'pending' || o.status === 'confirmed').length})</>
                        )}
                      </button>
                    </div>
                  )}
                  
                  {filteredOrders.map(order => (
                    <div key={order.id} className={`border ${colors.border} rounded-xl p-4`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className={`font-semibold ${colors.textPrimary}`}>
                            Order #{order.orderNumber || order.id?.slice(0, 8)}
                          </h3>
                          <p className={`text-sm ${colors.textMuted} mt-1`}>
                            <span className="font-medium">Customer:</span> {order.userName}
                          </p>
                          <p className={`text-sm ${colors.textMuted}`}>
                            <span className="font-medium">Company:</span> {order.companyName}
                            {order.departmentName && ` • ${order.departmentName}`}
                          </p>
                          {order.orderDate && (
                            <p className={`text-xs ${colors.textMuted} mt-1`}>
                              {order.orderDate}
                            </p>
                          )}
                        </div>
                        <span className={`px-3 py-1 text-sm rounded-full ${
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          order.status === 'preparing' ? 'bg-cyan-100 text-cyan-700' :
                          order.status === 'ready' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {order.status}
                        </span>
                      </div>

                      {/* Order Items */}
                      <div className="space-y-2 mb-3">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className={`text-sm ${colors.textSecondary}`}>
                            • {item.quantity}x {item.name}
                            {item.specialInstructions && (
                              <span className="text-xs italic ml-2">({item.specialInstructions})</span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {order.status === 'pending' && (
                          <button
                            onClick={() => handleStatusUpdate(order.id, 'preparing')}
                            disabled={updatingOrders.has(order.id)}
                            className={`px-3 py-1 rounded-lg text-sm text-white ${
                              updatingOrders.has(order.id)
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-cyan-600 hover:bg-cyan-700'
                            }`}
                          >
                            {updatingOrders.has(order.id) ? '⏳ Updating...' : 'Start Preparing'}
                          </button>
                        )}
                        {order.status === 'preparing' && (
                          <button
                            onClick={() => handleStatusUpdate(order.id, 'ready')}
                            disabled={updatingOrders.has(order.id)}
                            className={`px-3 py-1 rounded-lg text-sm text-white ${
                              updatingOrders.has(order.id)
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            {updatingOrders.has(order.id) ? '⏳ Updating...' : 'Mark Ready'}
                          </button>
                        )}
                        {order.status === 'ready' && (
                          <button
                            onClick={() => handleStatusUpdate(order.id, 'delivered')}
                            disabled={updatingOrders.has(order.id)}
                            className={`px-3 py-1 rounded-lg text-sm text-white ${
                              updatingOrders.has(order.id)
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700'
                            }`}
                          >
                            {updatingOrders.has(order.id) ? '⏳ Updating...' : 'Mark Delivered'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={colors.textMuted}>No orders found for this date</p>
              )}
            </div>
          )}

          {activeTab === 'prep' && (
            <div>
              <h3 className={`font-semibold mb-4 ${colors.textPrimary}`}>📋 Today's Prep List</h3>
              <EnhancedPrepList orders={filteredOrders} />
            </div>
          )}

          {activeTab === 'deliveries' && (
            <div>
              <h3 className={`font-semibold mb-4 ${colors.textPrimary}`}>Delivery Management</h3>
              
              {(() => {
                // Group ready orders by company and department
                const readyOrders = orders.filter(o => o.status === 'ready');
                const deliveryGroups = {};
                
                readyOrders.forEach(order => {
                  const key = `${order.companyName || 'Unknown Company'}${order.departmentName ? ` - ${order.departmentName}` : ''}`;
                  if (!deliveryGroups[key]) {
                    deliveryGroups[key] = {
                      company: order.companyName,
                      department: order.departmentName,
                      companyId: order.companyId,
                      orders: []
                    };
                  }
                  deliveryGroups[key].orders.push(order);
                });

                const groupKeys = Object.keys(deliveryGroups);

                return groupKeys.length > 0 ? (
                  <div className="space-y-6">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className={`${colors.bgCard} border ${colors.border} rounded-lg p-4`}>
                        <p className={`text-sm ${colors.textMuted}`}>Ready for Delivery</p>
                        <p className={`text-2xl font-bold ${colors.textPrimary}`}>{readyOrders.length}</p>
                        <p className="text-xs text-gray-500">orders</p>
                      </div>
                      <div className={`${colors.bgCard} border ${colors.border} rounded-lg p-4`}>
                        <p className={`text-sm ${colors.textMuted}`}>Delivery Locations</p>
                        <p className={`text-2xl font-bold ${colors.textPrimary}`}>{groupKeys.length}</p>
                        <p className="text-xs text-gray-500">companies/departments</p>
                      </div>
                      <div className={`${colors.bgCard} border ${colors.border} rounded-lg p-4`}>
                        <p className={`text-sm ${colors.textMuted}`}>Total Items</p>
                        <p className={`text-2xl font-bold ${colors.textPrimary}`}>
                          {readyOrders.reduce((sum, o) => sum + (o.items?.length || 0), 0)}
                        </p>
                        <p className="text-xs text-gray-500">food items</p>
                      </div>
                    </div>

                    {/* Delivery Groups */}
                    <div className="space-y-4">
                      {groupKeys.map(groupKey => {
                        const group = deliveryGroups[groupKey];
                        return (
                          <div key={groupKey} className={`border ${colors.border} rounded-xl p-4 ${colors.bgCard}`}>
                            {/* Group Header */}
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h4 className={`font-bold text-lg ${colors.textPrimary}`}>
                                  🏢 {group.company}
                                </h4>
                                {group.department && (
                                  <p className={`text-sm ${colors.textMuted}`}>
                                    📍 {group.department} Department
                                  </p>
                                )}
                                <p className={`text-xs ${colors.textMuted} mt-1`}>
                                  {group.orders.length} order{group.orders.length > 1 ? 's' : ''} ready
                                </p>
                              </div>
                              <button
                                onClick={async () => {
                                  // Prevent multiple clicks
                                  if (bulkUpdating) return;
                                  
                                  if (window.confirm(`Mark ${group.orders.length} order(s) for ${group.company} as delivered?`)) {
                                    try {
                                      setBulkUpdating(true);
                                      await Promise.all(
                                        group.orders.map(order => orderAPI.updateOrderStatus(order.id, 'delivered'))
                                      );
                                      toast.success(`${group.orders.length} order(s) marked as delivered`);
                                      loadData();
                                    } catch (error) {
                                      toast.error('Failed to update delivery status');
                                    } finally {
                                      setBulkUpdating(false);
                                    }
                                  }
                                }}
                                disabled={bulkUpdating}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  bulkUpdating
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700'
                                } text-white`}
                              >
                                {bulkUpdating ? '⏳ Updating...' : '🚚 Mark All as Delivered'}
                              </button>
                            </div>

                            {/* Orders in this group */}
                            <div className="space-y-2">
                              {group.orders.map(order => (
                                <div key={order.id} className={`border ${colors.border} rounded-lg p-3 bg-white`}>
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <p className={`font-semibold ${colors.textPrimary}`}>
                                        Order #{order.orderNumber}
                                      </p>
                                      <p className={`text-sm ${colors.textMuted}`}>
                                        For: {order.userName}
                                      </p>
                                      <div className="mt-2 space-y-1">
                                        {order.items?.map((item, idx) => (
                                          <p key={idx} className="text-sm text-gray-600">
                                            • {item.quantity}x {item.name}
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleStatusUpdate(order.id, 'delivered')}
                                      disabled={updatingOrders.has(order.id)}
                                      className={`px-3 py-1 rounded text-xs text-white ${
                                        updatingOrders.has(order.id)
                                          ? 'bg-gray-400 cursor-not-allowed'
                                          : 'bg-blue-500 hover:bg-blue-600'
                                      }`}
                                    >
                                      {updatingOrders.has(order.id) ? '⏳...' : '✓ Delivered'}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className={`text-lg ${colors.textMuted}`}>No orders ready for delivery</p>
                    <p className={`text-sm ${colors.textMuted} mt-2`}>Orders will appear here when marked as "Ready"</p>
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === 'menus' && !showMenuItemsView && (
            <div className="space-y-4">
              {/* Sub-tabs for Active/Archived */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => setMenusSubTab('active')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      menusSubTab === 'active' 
                        ? 'bg-orange-600 text-white' 
                        : `${colors.bgSecondary} ${colors.textSecondary} hover:bg-orange-100`
                    }`}
                  >
                    Active Menus ({menus.filter(m => m.status !== 'archived').length})
                  </button>
                  <button
                    onClick={() => {
                      setMenusSubTab('archived');
                      loadArchivedMenus();
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      menusSubTab === 'archived' 
                        ? 'bg-gray-600 text-white' 
                        : `${colors.bgSecondary} ${colors.textSecondary} hover:bg-gray-100`
                    }`}
                  >
                    📦 Archived ({archivedMenus.length})
                  </button>
                </div>
                {menusSubTab === 'active' && (
                  <button 
                    onClick={() => { 
                      setSelectedMenu(null);
                      // Calculate default dates
                      const today = new Date();
                      const todayStr = today.toISOString().split('T')[0];
                      const dayOfWeek = today.getDay();
                      const monday = new Date(today);
                      monday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
                      const sunday = new Date(monday);
                      sunday.setDate(monday.getDate() + 6);
                      
                      setMenuForm({ 
                        name: '', 
                        description: '', 
                        mealType: 'lunch', 
                        menuType: 'regular', 
                        isActive: true,
                        cafeteriaId: cafeterias.length > 0 ? cafeterias[0].id : '',
                        menuScope: 'daily', // Default to daily menu
                        menuDate: todayStr,
                        weekStartDate: monday.toISOString().split('T')[0],
                        weekEndDate: sunday.toISOString().split('T')[0]
                      }); 
                      setShowMenuModal(true); 
                    }} 
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    + Add Menu
                  </button>
                )}
              </div>

              {/* Active Menus */}
              {menusSubTab === 'active' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {menus.filter(m => m.status !== 'archived').length > 0 ? menus.filter(m => m.status !== 'archived').map(m => (
                    <div key={m.id} className={`border ${colors.border} rounded-xl p-4 ${colors.bgCard}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h3 className={`font-semibold ${colors.textPrimary}`}>{m.name}</h3>
                          {m.isDailyMenu && (
                            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">📅 Daily Menu</span>
                          )}
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          m.status === 'published' ? 'bg-green-100 text-green-700' : 
                          m.status === 'draft' ? 'bg-yellow-100 text-yellow-700' : 
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {m.status || (m.is_active ? 'Active' : 'Draft')}
                        </span>
                      </div>
                      <p className={`text-sm ${colors.textMuted} mb-1`}>
                        {m.meal_type || 'lunch'} • {m.menu_type || 'daily'}
                      </p>
                      {m.item_count !== undefined && (
                        <p className={`text-xs ${colors.textMuted} mb-3`}>
                          🍽️ {m.item_count} item{m.item_count !== 1 ? 's' : ''}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => { 
                            setSelectedMenu(m); 
                            setMenuForm({ 
                              name: m.name, 
                              description: m.description || m.internalNotes || '', 
                              mealType: m.meal_type || m.mealType || 'lunch', 
                              menuType: m.menu_type || m.menuType || 'regular', 
                              isActive: m.is_active !== undefined ? m.is_active : true,
                              cafeteriaId: m.cafeteria_id || m.cafeteriaId || '',
                              weekStartDate: m.week_start_date || m.weekStartDate || '',
                              weekEndDate: m.week_end_date || m.weekEndDate || ''
                            }); 
                            setShowMenuModal(true); 
                          }} 
                          className="text-blue-600 text-sm hover:underline"
                        >
                          Edit
                        </button>
                        <span className={`text-sm ${colors.textMuted}`}>•</span>
                        <button 
                          onClick={() => handleManageMenuItems(m)} 
                          className="text-orange-600 text-sm hover:underline font-medium"
                        >
                          📋 Manage Items
                        </button>
                        <span className={`text-sm ${colors.textMuted}`}>•</span>
                        {/* Published menus: Unpublish + Archive. Draft menus: Delete */}
                        {m.status === 'published' ? (
                          <>
                            <button 
                              onClick={() => handleUnpublishMenu(m)} 
                              className="text-amber-600 text-sm hover:underline font-medium"
                            >
                              ⏸️ Unpublish
                            </button>
                            <span className={`text-sm ${colors.textMuted}`}>•</span>
                            <button 
                              onClick={() => handleArchiveMenu(m)} 
                              className="text-gray-500 text-sm hover:underline"
                            >
                              📦 Archive
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => handleDeleteMenu(m)} 
                            className="text-red-600 text-sm hover:underline font-medium"
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="col-span-3 text-center py-8">
                      <p className={colors.textMuted}>No active menus. Click "+ Add Menu" to create one.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Archived Menus */}
              {menusSubTab === 'archived' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {archivedMenus.length > 0 ? archivedMenus.map(m => (
                    <div key={m.id} className={`border ${colors.border} rounded-xl p-4 ${colors.bgCard} opacity-75`}>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className={`font-semibold ${colors.textPrimary}`}>{m.name}</h3>
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-600">
                          Archived
                        </span>
                      </div>
                      <p className={`text-sm ${colors.textMuted} mb-1`}>
                        {m.itemCount || 0} items
                      </p>
                      <p className={`text-xs ${colors.textMuted} mb-3`}>
                        Archived: {m.updatedAt ? new Date(m.updatedAt).toLocaleDateString() : 'N/A'}
                      </p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleRestoreMenu(m)} 
                          className="text-green-600 text-sm hover:underline font-medium"
                        >
                          ↩️ Restore to Draft
                        </button>
                      </div>
                    </div>
                  )) : (
                    <div className="col-span-3 text-center py-8">
                      <p className={colors.textMuted}>No archived menus.</p>
                      <p className={`text-sm ${colors.textMuted} mt-1`}>
                        Published menus that are no longer needed can be archived here for historical reference.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* PHASE 3: Menu Items View */}
          {activeTab === 'menus' && showMenuItemsView && selectedMenuForItems && (
            <div className="space-y-4">
              {/* Header with Back Button */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      setShowMenuItemsView(false);
                      setSelectedMenuForItems(null);
                      setMenuCatalogItems([]);
                    }}
                    className={`px-3 py-2 border ${colors.border} rounded-lg hover:bg-gray-50`}
                  >
                    ← Back to Menus
                  </button>
                  <div>
                    <h2 className={`text-2xl font-bold ${colors.textPrimary}`}>
                      {selectedMenuForItems.name}
                    </h2>
                    <p className={`text-sm ${colors.textMuted}`}>
                      {selectedMenuForItems.meal_type} • {selectedMenuForItems.menu_type || 'Regular'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={handleOpenAddItemsModal}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  + Add Items from Catalog
                </button>
              </div>
              
              {/* Menu Items Grid */}
              {menuCatalogItems.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {menuCatalogItems.map(item => (
                    <div key={item.id} className={`border ${colors.border} rounded-xl p-4 ${colors.bgCard}`}>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className={`font-semibold ${colors.textPrimary}`}>{item.name}</h3>
                        <button 
                          onClick={() => handleRemoveItemFromMenu(item.catalog_item_id)}
                          className="text-red-600 text-sm hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                      {item.description && (
                        <p className={`text-sm ${colors.textMuted} mb-2`}>{item.description}</p>
                      )}
                      <div className="flex gap-4 text-sm">
                        <div>
                          <span className={`font-medium ${colors.textPrimary}`}>Base: </span>
                          <span className="text-green-600 font-semibold">${parseFloat(item.price || 0).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className={`font-medium ${colors.textPrimary}`}>Extra: </span>
                          <span className="text-blue-600 font-semibold">${parseFloat(item.add_on_price || 0).toFixed(2)}</span>
                        </div>
                      </div>
                      {item.category && (
                        <p className={`text-xs ${colors.textMuted} mt-2`}>
                          Category: {item.category}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`text-center py-12 border ${colors.border} rounded-xl ${colors.bgCard}`}>
                  <p className={`text-lg ${colors.textMuted} mb-2`}>No items in this menu yet</p>
                  <p className={`text-sm ${colors.textMuted} mb-4`}>Add items from your catalog to get started</p>
                  <button 
                    onClick={handleOpenAddItemsModal}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    + Add Items from Catalog
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'items' && (
            <DishLibrary
              menuItems={menuItems}
              onEdit={(item) => {
                setSelectedItem(item);
                setItemForm({
                  name: item.name,
                  description: item.description || '',
                  category: item.category_code || item.category || 'protein',
                  isVegan: item.is_vegan,
                  isVegetarian: item.is_vegetarian,
                  ingredients: item.ingredients || '',
                  basePrice: item.price || item.base_price || '0.00',
                  addOnPrice: item.add_on_price || '0.00'
                });
                setShowItemModal(true);
              }}
              onDelete={handleDeleteItem}
              onAdd={() => {
                setSelectedItem(null);
                setItemForm({
                  name: '',
                  description: '',
                  category: 'protein',
                  isVegan: false,
                  isVegetarian: false,
                  ingredients: '',
                  basePrice: '0.00',
                  addOnPrice: '0.00'
                });
                setShowItemModal(true);
              }}
            />
          )}


          {activeTab === 'issues' && (
            <div className="space-y-4">
              {issues.length > 0 ? issues.map(issue => <div key={issue.id} className={`border ${colors.border} rounded-xl p-4 ${colors.bgCard}`}><div className="flex justify-between mb-2"><div><h3 className={`font-semibold ${colors.textPrimary}`}>{issue.subject}</h3><p className={`text-sm ${colors.textMuted}`}>{issue.user_name}</p></div><span className={`px-2 py-1 text-xs rounded-full ${issue.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{issue.status}</span></div><p className={colors.textSecondary}>{issue.message}</p>{issue.status !== 'resolved' && <button onClick={() => { setSelectedIssue(issue); setIssueResponse(''); setShowIssueModal(true); }} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Respond & Resolve</button>}</div>) : <p className={colors.textMuted}>No issues</p>}
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className={`font-semibold ${colors.textPrimary}`}>Inbox ({unreadCount} unread)</h3>
                {messages.length > 0 && <button onClick={async () => { await messageAPI.markAllAsRead(); loadData(); toast.success('All marked as read'); }} className="text-sm text-blue-600">Mark all as read</button>}
              </div>
              {messages.length > 0 ? messages.map(msg => (
                <div key={msg.id} className={`border ${colors.border} rounded-xl p-4 ${colors.bgCard} ${!msg.isRead ? 'border-l-4 border-l-blue-500' : ''}`}>
                  <div className="flex justify-between mb-2">
                    <div>
                      <h3 className={`font-semibold ${colors.textPrimary}`}>{msg.subject}</h3>
                      <p className={`text-sm ${colors.textMuted}`}>From: {msg.sender?.name || 'Unknown'} {msg.sender?.role ? `(${msg.sender.role})` : ''}</p>
                    </div>
                    <span className={`text-xs ${colors.textMuted}`}>{new Date(msg.createdAt).toLocaleString()}</span>
                  </div>
                  <p className={colors.textSecondary}>{msg.body}</p>
                  {!msg.isRead && <button onClick={async () => { await messageAPI.markAsRead(msg.id); loadData(); }} className="mt-2 text-sm text-blue-600">Mark as read</button>}
                </div>
              )) : <p className={colors.textMuted}>No messages</p>}
            </div>
          )}
        </div>
      </div>

      {/* Menu Modal */}
      {showMenuModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto`}>
            <h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>
              {selectedMenu ? 'Edit' : 'Add'} Menu
            </h2>
            <form onSubmit={handleSaveMenu} className="space-y-4">
              
              {/* Daily vs Weekly Toggle */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${colors.textMuted}`}>Menu Type</label>
                <div className="flex rounded-lg overflow-hidden border ${colors.border}">
                  <button
                    type="button"
                    onClick={() => setMenuForm({ ...menuForm, menuScope: 'daily' })}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                      menuForm.menuScope === 'daily' 
                        ? 'bg-orange-600 text-white' 
                        : `${colors.bgSecondary} ${colors.textPrimary} hover:bg-gray-100`
                    }`}
                  >
                    📅 Daily Menu
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuForm({ ...menuForm, menuScope: 'weekly' })}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                      menuForm.menuScope === 'weekly' 
                        ? 'bg-orange-600 text-white' 
                        : `${colors.bgSecondary} ${colors.textPrimary} hover:bg-gray-100`
                    }`}
                  >
                    📆 Weekly Menu
                  </button>
                </div>
                <p className={`text-xs mt-1 ${colors.textMuted}`}>
                  {menuForm.menuScope === 'daily' 
                    ? 'Create a menu for a specific day with unique items' 
                    : 'Create a template menu that spans multiple days'}
                </p>
              </div>
              
              {/* Menu Name - only required for weekly */}
              {menuForm.menuScope === 'weekly' && (
                <input 
                  placeholder="Menu Name (e.g., Week of Feb 10-16)" 
                  value={menuForm.name} 
                  onChange={e => setMenuForm({ ...menuForm, name: e.target.value })} 
                  className={`w-full px-4 py-2 border ${colors.border} rounded-lg ${colors.bgSecondary} ${colors.textPrimary}`} 
                  required 
                />
              )}
              
              {/* Cafeteria Selector */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${colors.textMuted}`}>Cafeteria *</label>
                <select 
                  value={menuForm.cafeteriaId} 
                  onChange={e => setMenuForm({ ...menuForm, cafeteriaId: e.target.value })} 
                  className={`w-full px-4 py-2 border ${colors.border} rounded-lg ${colors.bgSecondary} ${colors.textPrimary}`}
                  required
                >
                  <option value="">Select Cafeteria</option>
                  {cafeterias.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Date Selection - Different for Daily vs Weekly */}
              {menuForm.menuScope === 'daily' ? (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${colors.textMuted}`}>Menu Date *</label>
                  <input 
                    type="date" 
                    value={menuForm.menuDate} 
                    onChange={e => setMenuForm({ ...menuForm, menuDate: e.target.value })} 
                    className={`w-full px-4 py-2 border ${colors.border} rounded-lg ${colors.bgSecondary} ${colors.textPrimary}`}
                    required
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${colors.textMuted}`}>Week Start</label>
                    <input 
                      type="date" 
                      value={menuForm.weekStartDate} 
                      onChange={e => {
                        const start = new Date(e.target.value);
                        const end = new Date(start);
                        end.setDate(start.getDate() + 6);
                        setMenuForm({ 
                          ...menuForm, 
                          weekStartDate: e.target.value,
                          weekEndDate: end.toISOString().split('T')[0]
                        });
                      }} 
                      className={`w-full px-4 py-2 border ${colors.border} rounded-lg ${colors.bgSecondary} ${colors.textPrimary}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${colors.textMuted}`}>Week End</label>
                    <input 
                      type="date" 
                      value={menuForm.weekEndDate} 
                      onChange={e => setMenuForm({ ...menuForm, weekEndDate: e.target.value })} 
                      className={`w-full px-4 py-2 border ${colors.border} rounded-lg ${colors.bgSecondary} ${colors.textPrimary}`}
                    />
                  </div>
                </div>
              )}
              
              {/* Meal Type */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${colors.textMuted}`}>Meal Type</label>
                <select 
                  value={menuForm.mealType} 
                  onChange={e => setMenuForm({ ...menuForm, mealType: e.target.value })} 
                  className={`w-full px-4 py-2 border ${colors.border} rounded-lg ${colors.bgSecondary} ${colors.textPrimary}`}
                >
                  <option value="breakfast">🌅 Breakfast</option>
                  <option value="lunch">🍽️ Lunch</option>
                </select>
              </div>
              
              {/* Description/Notes */}
              <textarea 
                placeholder="Notes (optional)" 
                value={menuForm.description} 
                onChange={e => setMenuForm({ ...menuForm, description: e.target.value })} 
                className={`w-full px-4 py-2 border ${colors.border} rounded-lg ${colors.bgSecondary} ${colors.textPrimary}`} 
                rows="2" 
              />
              
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowMenuModal(false)} 
                  className={`px-4 py-2 border ${colors.border} rounded-lg ${colors.textPrimary}`}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  {menuForm.menuScope === 'daily' ? 'Create Daily Menu' : 'Create Weekly Menu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto`}>
            <h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>
              {selectedItem ? 'Edit' : 'Add'} Item
            </h2>
            
            <form onSubmit={handleSaveItem} className="space-y-4">
              {/* Item Name */}
              <input
                placeholder="Item Name"
                value={itemForm.name}
                onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                className={`w-full px-4 py-2 border ${colors.border} rounded-lg`}
                required
              />
              
              {/* Description */}
              <textarea
                placeholder="Description"
                value={itemForm.description}
                onChange={e => setItemForm({ ...itemForm, description: e.target.value })}
                className={`w-full px-4 py-2 border ${colors.border} rounded-lg`}
                rows="2"
              />
              
              {/* Category */}
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={itemForm.category}
                  onChange={e => setItemForm({ ...itemForm, category: e.target.value })}
                  className={`w-full px-4 py-2 border ${colors.border} rounded-lg`}
                >
                  <option value="protein">Protein</option>
                  <option value="carbohydrate">Carbohydrate</option>
                  <option value="fibre">Fibre / Vegetable</option>
                  <option value="soup">Soup</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="done_to_order">Done to Order</option>
                  <option value="beverage">Beverage</option>
                  <option value="dessert">Dessert</option>
                  <option value="specials">Specials</option>
                </select>
              </div>
              
              {/* PRICING SECTION */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-sm mb-3 text-gray-700">💰 Centralized Pricing</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">
                      Base Price ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={itemForm.basePrice}
                      onChange={e => setItemForm({ ...itemForm, basePrice: e.target.value })}
                      className={`w-full px-4 py-2 border ${colors.border} rounded-lg`}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-gray-500 mt-1">Price when included in meal</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-orange-700">
                      As Extra (+$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={itemForm.addOnPrice}
                      onChange={e => setItemForm({ ...itemForm, addOnPrice: e.target.value })}
                      className={`w-full px-4 py-2 border border-orange-300 rounded-lg`}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-gray-500 mt-1">Price when added as extra</p>
                  </div>
                </div>
                <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-gray-600">
                  ℹ️ These prices will be used across all menus and orders
                </div>
              </div>
              
              {/* Ingredients */}
              <textarea
                placeholder="Ingredients (for soups)"
                value={itemForm.ingredients}
                onChange={e => setItemForm({ ...itemForm, ingredients: e.target.value })}
                className={`w-full px-4 py-2 border ${colors.border} rounded-lg`}
                rows="2"
              />
              
              {/* Checkboxes */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={itemForm.isVegan}
                    onChange={e => setItemForm({ ...itemForm, isVegan: e.target.checked })}
                  />
                  Vegan
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={itemForm.isVegetarian}
                    onChange={e => setItemForm({ ...itemForm, isVegetarian: e.target.checked })}
                  />
                  Vegetarian
                </label>
              </div>
              
              {/* Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className={`px-4 py-2 border ${colors.border} rounded-lg`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PHASE 3: Add Items from Catalog Modal */}
      {showAddItemsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto`}>
            <h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>
              Add Items to {selectedMenuForItems?.name}
            </h2>
            
            <p className={`text-sm ${colors.textMuted} mb-4`}>
              Select items from your catalog to add to this menu. Prices will be inherited from the catalog.
            </p>
            
            {/* Selected Count */}
            {selectedCatalogItems.length > 0 && (
              <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-700 font-medium">
                  {selectedCatalogItems.length} item(s) selected
                </p>
              </div>
            )}
            
            {/* Loading State */}
            {loadingCatalogItems ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
                <p className={`mt-4 ${colors.textMuted}`}>Loading catalog items...</p>
              </div>
            ) : availableCatalogItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {availableCatalogItems.map(item => {
                  const isSelected = selectedCatalogItems.includes(item.id);
                  return (
                    <div 
                      key={item.id} 
                      onClick={() => toggleCatalogItemSelection(item.id)}
                      className={`border ${isSelected ? 'border-orange-500 bg-orange-50' : colors.border} rounded-xl p-4 cursor-pointer hover:shadow-md transition-all ${isSelected ? 'ring-2 ring-orange-200' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className={`font-semibold ${colors.textPrimary} flex-1`}>
                          {item.name}
                        </h3>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'border-orange-500 bg-orange-500' : 'border-gray-300'}`}>
                          {isSelected && <span className="text-white text-xs">✓</span>}
                        </div>
                      </div>
                      {item.description && (
                        <p className={`text-sm ${colors.textMuted} mb-3`}>{item.description}</p>
                      )}
                      <div className="flex gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">Base:</span>
                          <span className="text-green-600 font-semibold ml-1">
                            ${parseFloat(item.price || 0).toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Extra:</span>
                          <span className="text-blue-600 font-semibold ml-1">
                            ${parseFloat(item.add_on_price || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      {item.category && (
                        <p className={`text-xs ${colors.textMuted} mt-2`}>
                          📦 {item.category}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-4xl mb-2">📦</p>
                <p className={`${colors.textMuted}`}>No catalog items available</p>
                <p className={`text-sm ${colors.textMuted}`}>Add items to your Dish Library first</p>
              </div>
            )}
            {/* Modal Buttons */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowAddItemsModal(false); setSelectedCatalogItems([]); setAvailableCatalogItems([]); }}
                className={`px-4 py-2 border ${colors.border} rounded-lg`}
              >
                Close
              </button>
              <button
                onClick={handleAddItemsToMenu}
                disabled={selectedCatalogItems.length === 0}
                className={`px-4 py-2 rounded-lg ${selectedCatalogItems.length > 0 ? "bg-orange-600 text-white hover:bg-orange-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}
              >
                Add Selected Items
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-md`}>
            <h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>Delete Menu</h2>
            <p className={`mb-6 ${colors.textSecondary}`}>
              Are you sure you want to delete <strong>{menuToDelete?.name}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setMenuToDelete(null);
                }}
                className={`px-4 py-2 border ${colors.border} rounded-lg`}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteMenu}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-md`}>
            <h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>📦 Archive Menu</h2>
            <p className={`mb-4 ${colors.textSecondary}`}>
              Are you sure you want to archive <strong>{menuToArchive?.name}</strong>?
            </p>
            <p className={`mb-6 text-sm ${colors.textMuted}`}>
              Archived menus are preserved for historical records and can be restored later if needed.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowArchiveConfirm(false);
                  setMenuToArchive(null);
                }}
                className={`px-4 py-2 border ${colors.border} rounded-lg`}
              >
                Cancel
              </button>
              <button
                onClick={confirmArchiveMenu}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                Archive Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {showIssueModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={`${colors.bgCard} rounded-xl p-6 w-full max-w-lg`}><h2 className={`text-xl font-bold mb-4 ${colors.textPrimary}`}>Respond to Issue</h2><div className={`${colors.bgSecondary} rounded-lg p-4 mb-4`}><h3 className={colors.textPrimary}>{selectedIssue?.subject}</h3><p className={`text-sm ${colors.textMuted}`}>{selectedIssue?.message}</p></div><textarea placeholder="Your response..." value={issueResponse} onChange={e => setIssueResponse(e.target.value)} className={`w-full px-4 py-2 border ${colors.border} rounded-lg mb-4`} rows="4" /><div className="flex justify-end gap-3"><button onClick={() => setShowIssueModal(false)} className={`px-4 py-2 border ${colors.border} rounded-lg`}>Cancel</button><button onClick={handleRespondIssue} className="px-4 py-2 bg-green-600 text-white rounded-lg">Resolve</button></div></div></div>}
    </div>
  );
}
