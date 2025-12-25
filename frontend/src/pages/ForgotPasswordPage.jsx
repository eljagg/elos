import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';

const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      setSent(true);
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600">🍽️ ELOS</h1>
        </div>
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('auth.resetPassword')}</h2>
          {sent ? (
            <div className="text-center">
              <div className="text-5xl mb-4">📧</div>
              <p className="text-gray-600 mb-4">Check your email for a password reset link.</p>
              <Link to="/login" className="btn-primary">{t('auth.login')}</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-gray-600">Enter your email address and we'll send you a reset link.</p>
              <div>
                <label>{t('auth.email')}</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? <span className="spinner w-5 h-5"></span> : 'Send Reset Link'}
              </button>
            </form>
          )}
          <p className="mt-6 text-center">
            <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700">← Back to login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
