/**
 * WalletWidget Component
 * Shows wallet balance and recent transactions
 */

import { useState, useEffect } from 'react';
import { Wallet, Plus, History, ArrowUpRight, ArrowDownLeft, RefreshCw } from 'lucide-react';
import { walletAPI } from '../../services/api';

const WalletWidget = ({ onPaymentMethodSelect, selectedPaymentMethod, orderTotal }) => {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const response = await walletAPI.getMyWallet();
      if (response.data?.success) {
        setWallet(response.data.data.wallet);
        setTransactions(response.data.data.transactions || []);
      }
    } catch (error) {
      console.error('Failed to fetch wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'deposit':
      case 'payroll_credit':
      case 'refund':
      case 'bonus':
        return <ArrowDownLeft className="w-4 h-4 text-green-600" />;
      case 'payment':
        return <ArrowUpRight className="w-4 h-4 text-red-600" />;
      default:
        return <RefreshCw className="w-4 h-4 text-slate-500" />;
    }
  };

  const canPayWithWallet = wallet && 
    wallet.is_active && 
    !wallet.is_frozen && 
    parseFloat(wallet.balance) >= (orderTotal || 0);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="animate-pulse">
          <div className="h-6 w-24 bg-slate-200 rounded mb-3"></div>
          <div className="h-8 w-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
        <div className="flex items-center gap-2 text-slate-500">
          <Wallet className="w-5 h-5" />
          <span>No wallet found. Contact HR to set up your wallet.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Wallet Balance */}
      <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            <span className="font-medium">My Wallet</span>
          </div>
          <button
            onClick={fetchWallet}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        
        <div className="text-2xl font-bold">
          {formatCurrency(wallet.balance)}
        </div>
        
        {/* Status badges */}
        <div className="flex gap-2 mt-2">
          {wallet.is_frozen && (
            <span className="text-xs bg-red-500/20 text-red-100 px-2 py-0.5 rounded">
              Frozen
            </span>
          )}
          {!wallet.is_active && (
            <span className="text-xs bg-yellow-500/20 text-yellow-100 px-2 py-0.5 rounded">
              Inactive
            </span>
          )}
        </div>
      </div>

      {/* Spending Limits */}
      {(wallet.daily_limit || wallet.monthly_limit) && (
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {wallet.daily_limit && (
              <div>
                <p className="text-slate-500">Today</p>
                <p className="font-medium text-slate-700">
                  {formatCurrency(wallet.spent_today)} / {formatCurrency(wallet.daily_limit)}
                </p>
                <div className="mt-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      (wallet.spent_today / wallet.daily_limit) > 0.9 
                        ? 'bg-red-500' 
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(100, (wallet.spent_today / wallet.daily_limit) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            {wallet.monthly_limit && (
              <div>
                <p className="text-slate-500">This Month</p>
                <p className="font-medium text-slate-700">
                  {formatCurrency(wallet.spent_this_month)} / {formatCurrency(wallet.monthly_limit)}
                </p>
                <div className="mt-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      (wallet.spent_this_month / wallet.monthly_limit) > 0.9 
                        ? 'bg-red-500' 
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, (wallet.spent_this_month / wallet.monthly_limit) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Method Selection */}
      {onPaymentMethodSelect && orderTotal !== undefined && (
        <div className="p-4 border-b border-slate-200">
          <p className="text-sm font-medium text-slate-700 mb-2">Payment Method</p>
          <div className="flex gap-2">
            <button
              onClick={() => onPaymentMethodSelect('wallet')}
              disabled={!canPayWithWallet}
              className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                selectedPaymentMethod === 'wallet'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : canPayWithWallet
                    ? 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Wallet className="w-4 h-4" />
                <span>Wallet</span>
              </div>
              {!canPayWithWallet && parseFloat(wallet.balance) < orderTotal && (
                <p className="text-xs mt-1 text-red-500">Insufficient balance</p>
              )}
            </button>
            <button
              onClick={() => onPaymentMethodSelect('cash')}
              className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                selectedPaymentMethod === 'cash'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-green-400'
              }`}
            >
              Pay at Counter
            </button>
          </div>
        </div>
      )}

      {/* Transaction History Toggle */}
      <div className="p-3">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between text-sm text-slate-600 hover:text-slate-900"
        >
          <span className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Recent Transactions
          </span>
          <span className="text-xs">{showHistory ? '▲' : '▼'}</span>
        </button>

        {/* Transaction List */}
        {showHistory && (
          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
            {transactions.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-2">No transactions yet</p>
            ) : (
              transactions.slice(0, 10).map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                  {getTransactionIcon(tx.transaction_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {tx.description || tx.transaction_type.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-slate-400">{formatDate(tx.created_at)}</p>
                  </div>
                  <span className={`text-sm font-semibold ${
                    parseFloat(tx.amount) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {parseFloat(tx.amount) >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletWidget;
