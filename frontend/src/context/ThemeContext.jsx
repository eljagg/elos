/**
 * Theme Context - Manages app-wide color scheme
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

// Theme definitions with Soft Blue as default (white toned down 10%)
export const themes = {
  softBlue: {
    id: 'softBlue',
    name: 'Soft Blue',
    description: 'Corporate, professional - trustworthy and clean',
    colors: {
      // Backgrounds
      bgPrimary: 'bg-slate-100',
      bgSecondary: 'bg-slate-50',
      bgCard: 'bg-[#f8fafc]',
      bgInput: 'bg-white',
      bgHover: 'hover:bg-blue-50',
      bgActive: 'bg-blue-100',
      
      // Sidebar
      sidebar: 'bg-gradient-to-b from-indigo-900 via-indigo-800 to-blue-900',
      sidebarItem: 'hover:bg-white/10',
      sidebarItemActive: 'bg-white/20',
      sidebarText: 'text-white/80',
      sidebarTextActive: 'text-white',
      
      // Text
      textPrimary: 'text-slate-800',
      textSecondary: 'text-slate-600',
      textMuted: 'text-slate-500',
      
      // Accent
      accent: 'bg-indigo-600',
      accentHover: 'hover:bg-indigo-700',
      accentText: 'text-indigo-600',
      accentLight: 'bg-indigo-100',
      
      // Borders
      border: 'border-slate-200',
      borderFocus: 'focus:border-indigo-500',
      
      // Buttons
      btnPrimary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
      btnSecondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
      btnDanger: 'bg-red-600 hover:bg-red-700 text-white',
      btnSuccess: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      
      // Stat Cards
      statCards: [
        { bg: 'bg-indigo-50', border: 'border-indigo-400', text: 'text-indigo-700', icon: 'text-indigo-500' },
        { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-700', icon: 'text-emerald-500' },
        { bg: 'bg-sky-50', border: 'border-sky-400', text: 'text-sky-700', icon: 'text-sky-500' },
        { bg: 'bg-violet-50', border: 'border-violet-400', text: 'text-violet-700', icon: 'text-violet-500' },
        { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-700', icon: 'text-amber-500' },
      ],
      
      // Status colors
      statusPending: 'bg-yellow-100 text-yellow-800',
      statusPreparing: 'bg-blue-100 text-blue-800',
      statusReady: 'bg-green-100 text-green-800',
      statusCompleted: 'bg-gray-100 text-gray-800',
      statusCancelled: 'bg-red-100 text-red-800',
    }
  },
  
  darkMode: {
    id: 'darkMode',
    name: 'Dark Mode',
    description: 'Modern, tech-forward feel - easy on eyes in low light',
    colors: {
      bgPrimary: 'bg-slate-900',
      bgSecondary: 'bg-slate-800',
      bgCard: 'bg-slate-800',
      bgInput: 'bg-slate-700',
      bgHover: 'hover:bg-slate-700',
      bgActive: 'bg-slate-700',
      
      sidebar: 'bg-slate-950',
      sidebarItem: 'hover:bg-white/10',
      sidebarItemActive: 'bg-white/20',
      sidebarText: 'text-white/70',
      sidebarTextActive: 'text-white',
      
      textPrimary: 'text-white',
      textSecondary: 'text-slate-300',
      textMuted: 'text-slate-400',
      
      accent: 'bg-cyan-600',
      accentHover: 'hover:bg-cyan-700',
      accentText: 'text-cyan-400',
      accentLight: 'bg-cyan-900/50',
      
      border: 'border-slate-700',
      borderFocus: 'focus:border-cyan-500',
      
      btnPrimary: 'bg-cyan-600 hover:bg-cyan-700 text-white',
      btnSecondary: 'bg-slate-700 hover:bg-slate-600 text-slate-200',
      btnDanger: 'bg-red-600 hover:bg-red-700 text-white',
      btnSuccess: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      
      statCards: [
        { bg: 'bg-cyan-900/40', border: 'border-cyan-500', text: 'text-cyan-400', icon: 'text-cyan-400' },
        { bg: 'bg-emerald-900/40', border: 'border-emerald-500', text: 'text-emerald-400', icon: 'text-emerald-400' },
        { bg: 'bg-violet-900/40', border: 'border-violet-500', text: 'text-violet-400', icon: 'text-violet-400' },
        { bg: 'bg-amber-900/40', border: 'border-amber-500', text: 'text-amber-400', icon: 'text-amber-400' },
        { bg: 'bg-rose-900/40', border: 'border-rose-500', text: 'text-rose-400', icon: 'text-rose-400' },
      ],
      
      statusPending: 'bg-yellow-900/50 text-yellow-400',
      statusPreparing: 'bg-blue-900/50 text-blue-400',
      statusReady: 'bg-green-900/50 text-green-400',
      statusCompleted: 'bg-slate-700 text-slate-300',
      statusCancelled: 'bg-red-900/50 text-red-400',
    }
  },
  
  warmNeutral: {
    id: 'warmNeutral',
    name: 'Warm Neutral',
    description: 'Food-friendly, appetizing - perfect for meal ordering',
    colors: {
      bgPrimary: 'bg-orange-50',
      bgSecondary: 'bg-amber-50/50',
      bgCard: 'bg-[#fffbf7]',
      bgInput: 'bg-white',
      bgHover: 'hover:bg-orange-100',
      bgActive: 'bg-orange-100',
      
      sidebar: 'bg-gradient-to-b from-orange-600 via-orange-700 to-amber-800',
      sidebarItem: 'hover:bg-white/10',
      sidebarItemActive: 'bg-white/20',
      sidebarText: 'text-white/80',
      sidebarTextActive: 'text-white',
      
      textPrimary: 'text-stone-800',
      textSecondary: 'text-stone-600',
      textMuted: 'text-stone-500',
      
      accent: 'bg-orange-500',
      accentHover: 'hover:bg-orange-600',
      accentText: 'text-orange-600',
      accentLight: 'bg-orange-100',
      
      border: 'border-orange-200',
      borderFocus: 'focus:border-orange-500',
      
      btnPrimary: 'bg-orange-500 hover:bg-orange-600 text-white',
      btnSecondary: 'bg-amber-100 hover:bg-amber-200 text-amber-800',
      btnDanger: 'bg-red-600 hover:bg-red-700 text-white',
      btnSuccess: 'bg-teal-600 hover:bg-teal-700 text-white',
      
      statCards: [
        { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-700', icon: 'text-orange-500' },
        { bg: 'bg-teal-100', border: 'border-teal-400', text: 'text-teal-700', icon: 'text-teal-500' },
        { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-700', icon: 'text-amber-500' },
        { bg: 'bg-rose-100', border: 'border-rose-400', text: 'text-rose-700', icon: 'text-rose-500' },
        { bg: 'bg-lime-100', border: 'border-lime-400', text: 'text-lime-700', icon: 'text-lime-500' },
      ],
      
      statusPending: 'bg-yellow-100 text-yellow-800',
      statusPreparing: 'bg-blue-100 text-blue-800',
      statusReady: 'bg-green-100 text-green-800',
      statusCompleted: 'bg-stone-100 text-stone-700',
      statusCancelled: 'bg-red-100 text-red-800',
    }
  },
  
  greenFresh: {
    id: 'greenFresh',
    name: 'Green Fresh',
    description: 'Health-focused, natural - great for wellness vibe',
    colors: {
      bgPrimary: 'bg-emerald-50',
      bgSecondary: 'bg-green-50/50',
      bgCard: 'bg-[#f8fdf9]',
      bgInput: 'bg-white',
      bgHover: 'hover:bg-emerald-100',
      bgActive: 'bg-emerald-100',
      
      sidebar: 'bg-gradient-to-b from-emerald-700 via-emerald-800 to-teal-900',
      sidebarItem: 'hover:bg-white/10',
      sidebarItemActive: 'bg-white/20',
      sidebarText: 'text-white/80',
      sidebarTextActive: 'text-white',
      
      textPrimary: 'text-gray-800',
      textSecondary: 'text-gray-600',
      textMuted: 'text-gray-500',
      
      accent: 'bg-emerald-600',
      accentHover: 'hover:bg-emerald-700',
      accentText: 'text-emerald-600',
      accentLight: 'bg-emerald-100',
      
      border: 'border-emerald-200',
      borderFocus: 'focus:border-emerald-500',
      
      btnPrimary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      btnSecondary: 'bg-green-100 hover:bg-green-200 text-green-800',
      btnDanger: 'bg-red-600 hover:bg-red-700 text-white',
      btnSuccess: 'bg-teal-600 hover:bg-teal-700 text-white',
      
      statCards: [
        { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-700', icon: 'text-emerald-500' },
        { bg: 'bg-lime-100', border: 'border-lime-400', text: 'text-lime-700', icon: 'text-lime-500' },
        { bg: 'bg-teal-100', border: 'border-teal-400', text: 'text-teal-700', icon: 'text-teal-500' },
        { bg: 'bg-cyan-100', border: 'border-cyan-400', text: 'text-cyan-700', icon: 'text-cyan-500' },
        { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-700', icon: 'text-green-500' },
      ],
      
      statusPending: 'bg-yellow-100 text-yellow-800',
      statusPreparing: 'bg-blue-100 text-blue-800',
      statusReady: 'bg-green-100 text-green-800',
      statusCompleted: 'bg-gray-100 text-gray-700',
      statusCancelled: 'bg-red-100 text-red-800',
    }
  }
};

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState('softBlue');
  
  useEffect(() => {
    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme && themes[savedTheme]) {
      setCurrentTheme(savedTheme);
    }
  }, []);
  
  const changeTheme = (themeId) => {
    if (themes[themeId]) {
      setCurrentTheme(themeId);
      localStorage.setItem('appTheme', themeId);
    }
  };
  
  const theme = themes[currentTheme];
  const colors = theme.colors;
  
  return (
    <ThemeContext.Provider value={{ 
      theme, 
      colors, 
      currentTheme, 
      changeTheme, 
      themes,
      // Helper function to get stat card colors by index
      getStatCardColors: (index) => colors.statCards[index % colors.statCards.length]
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
