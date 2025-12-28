/**
 * ELOS - Authentication Context
 * 
 * Manages user authentication state across the application
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      const savedUser = localStorage.getItem('user');
      
      if (token && savedUser) {
        try {
          // Verify token is still valid
          const response = await authAPI.getMe();
          const userData = response.data.data?.user || response.data.user || response.data.data;
          if (userData) {
            setUser(userData);
            // Update saved user with fresh data
            localStorage.setItem('user', JSON.stringify(userData));
          } else {
            // Fallback to saved user
            setUser(JSON.parse(savedUser));
          }
        } catch (err) {
          console.log('Token verification failed:', err.message);
          // If token verification fails but we have saved user, use it
          // This handles cases where token just expired
          try {
            const parsedUser = JSON.parse(savedUser);
            if (parsedUser && parsedUser.id) {
              // Use saved user - they may need to re-login soon but don't kick them out immediately
              setUser(parsedUser);
              console.log('Using cached user data');
            } else {
              throw new Error('Invalid saved user');
            }
          } catch (parseErr) {
            // Invalid saved user, clear everything
            console.log('Clearing invalid session');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
          }
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Login function
  const login = async (email, password) => {
    setError(null);
    try {
      const response = await authAPI.login(email, password);
      const { data } = response.data;
      
      // Check if 2FA is required
      if (response.data.requires2FA) {
        return { requires2FA: true, tempToken: data.tempToken };
      }
      
      // Store tokens
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Login failed';
      setError(message);
      throw new Error(message);
    }
  };

  // Complete 2FA login
  const verify2FA = async (tempToken, code) => {
    try {
      const response = await authAPI.verify2FA(tempToken, code);
      const { data } = response.data;
      
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      const message = err.response?.data?.error?.message || '2FA verification failed';
      setError(message);
      throw new Error(message);
    }
  };

  // Register function
  const register = async (userData) => {
    setError(null);
    try {
      const response = await authAPI.register(userData);
      return response.data;
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Registration failed';
      setError(message);
      throw new Error(message);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      // Ignore errors during logout
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  // Guest login
  const guestLogin = async (code) => {
    setError(null);
    try {
      const response = await authAPI.guestLogin(code);
      const { data } = response.data;
      
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('user', JSON.stringify({ 
        type: 'guest', 
        ...data.guestInfo 
      }));
      
      setUser({ type: 'guest', ...data.guestInfo });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Invalid guest code';
      setError(message);
      throw new Error(message);
    }
  };

  // Update user profile in state
  const updateUser = (updates) => {
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  // Check if user has a specific role
  const hasRole = (...roles) => {
    return user && roles.includes(user.role);
  };

  // Check if user is authenticated
  const isAuthenticated = !!user;

  const value = {
    user,
    loading,
    error,
    isAuthenticated,
    login,
    verify2FA,
    register,
    logout,
    guestLogin,
    updateUser,
    hasRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
