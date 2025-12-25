import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const GuestLoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { guestLogin } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await guestLogin(code);
      toast.success('Welcome! You can now place your order.');
      navigate('/menu');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600">🍽️ ELOS</h1>
          <p className="text-gray-500">{t('auth.guestLogin')}</p>
        </div>
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('auth.enterGuestCode')}</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                     placeholder="ABCD1234" maxLength={8} className="text-center text-3xl tracking-widest font-mono" required autoFocus />
            </div>
            <p className="text-sm text-gray-500 text-center">Enter the 8-character code provided by reception</p>
            <button type="submit" disabled={loading || code.length !== 8} className="btn-primary w-full">
              {loading ? <span className="spinner w-5 h-5"></span> : t('auth.login')}
            </button>
          </form>
          <p className="mt-6 text-center">
            <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700">← Employee login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default GuestLoginPage;
