import React from 'react';
import { useTranslation } from 'react-i18next';

const OrderHistoryPage = () => {
  const { t } = useTranslation();
  const orders = [
    { id: 1, orderNumber: 'ORD-001', date: '2025-12-25', total: 15.00, status: 'completed' },
    { id: 2, orderNumber: 'ORD-002', date: '2025-12-24', total: 12.50, status: 'completed' },
  ];

  return (
    <div className="animate-fade-in">
      <div className="page-header"><h1 className="page-title">{t('nav.orderHistory')}</h1></div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Order #</th><th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th><th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Total</th><th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th></tr></thead>
          <tbody className="divide-y">{orders.map(order => (<tr key={order.id} className="hover:bg-gray-50"><td className="px-4 py-3 font-mono text-sm">{order.orderNumber}</td><td className="px-4 py-3">{order.date}</td><td className="px-4 py-3">${order.total.toFixed(2)}</td><td className="px-4 py-3"><span className="badge badge-success">{order.status}</span></td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
};

export default OrderHistoryPage;
