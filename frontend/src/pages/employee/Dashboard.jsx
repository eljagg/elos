import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

const EmployeeDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const today = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">{t('employee.welcome')}, {user?.firstName}! 👋</h1>
        <p className="page-subtitle">{days[today.getDay()]}, {today.toLocaleDateString()}</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card bg-gradient-to-br from-primary-500 to-primary-600 text-white">
          <h3 className="text-lg font-semibold mb-2">🍽️ {t('employee.placeOrder')}</h3>
          <p className="opacity-90 mb-4">Order your lunch for today</p>
          <Link to="/menu" className="inline-block bg-white text-primary-600 px-4 py-2 rounded-lg font-medium hover:bg-primary-50">View Menu →</Link>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">⏰ {t('employee.cutoffTime')}</h3>
          <div className="space-y-3">
            <div className="flex justify-between"><span>{t('employee.breakfast')}</span><span className="font-mono">08:00</span></div>
            <div className="flex justify-between"><span>{t('employee.lunch')}</span><span className="font-mono">10:00</span></div>
          </div>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">📦 Recent Orders</h3>
          <p className="text-gray-500 text-sm">No recent orders</p>
          <Link to="/orders" className="text-primary-600 text-sm hover:underline block mt-4">View all orders →</Link>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
