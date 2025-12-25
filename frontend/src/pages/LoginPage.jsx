import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { login, verify2FA } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.requires2FA) {
        setTempToken(result.tempToken);
        setShow2FA(true);
      } else {
        toast.success(t('auth.loginSuccess'));
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await verify2FA(tempToken, twoFACode);
      toast.success(t('auth.loginSuccess'));
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'es' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-800 to-primary-600 p-12 flex-col justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white">🍽️ ELOS</h1>
          <p className="text-primary-200 mt-2">{t('common.appFullName')}</p>
        </div>
        <div className="text-white">
          <h2 className="text-3xl font-bold mb-4">Welcome back</h2>
          <p className="text-primary-200 text-lg">Sign in to order your lunch</p>
        </div>
        <div className="text-primary-200 text-sm">© {new Date().getFullYear()} PBS Group</div>
      </div>
      
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex justify-end mb-8">
            <button onClick={toggleLanguage} className="text-sm text-gray-500 hover:text-gray-700">
              🌐 {i18n.language === 'en' ? 'Español' : 'English'}
            </button>
          </div>
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-bold text-primary-600">🍽️ ELOS</h1>
          </div>
          <div className="card">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {show2FA ? t('auth.twoFactorAuth') : t('auth.login')}
            </h2>
            {!show2FA ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email">{t('auth.email')}</label>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required autoFocus />
                </div>
                <div>
                  <label htmlFor="password">{t('auth.password')}</label>
                  <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" required />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input type="checkbox" className="w-4 h-4 text-primary-600 rounded" />
                    <span className="ml-2 text-sm text-gray-600">{t('auth.rememberMe')}</span>
                  </label>
                  <Link to="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700">{t('auth.forgotPassword')}</Link>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? <span className="spinner w-5 h-5"></span> : t('auth.login')}
                </button>
              </form>
            ) : (
              <form onSubmit={handle2FASubmit} className="space-y-5">
                <p className="text-gray-600">{t('auth.enter2FACode')}</p>
                <input type="text" value={twoFACode} onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} className="text-center text-2xl tracking-widest" required autoFocus />
                <button type="submit" disabled={loading || twoFACode.length !== 6} className="btn-primary w-full">
                  {loading ? <span className="spinner w-5 h-5"></span> : t('common.confirm')}
                </button>
                <button type="button" onClick={() => setShow2FA(false)} className="btn-secondary w-full">{t('common.back')}</button>
              </form>
            )}
            <div className="mt-6 text-center">
              <Link to="/guest" className="text-sm text-gray-500 hover:text-gray-700">{t('auth.guestLogin')} →</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
