import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthFooter } from '../components/Footer';
import toast from 'react-hot-toast';

export default function GuestLoginPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { guestLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code || code.length < 6) {
      toast.error('Please enter a valid 6-character code');
      return;
    }
    setLoading(true);
    try {
      await guestLogin(code.toUpperCase());
      toast.success('Welcome, Guest!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (e) => {
    // Only allow alphanumeric, auto uppercase
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl mb-4 shadow-xl">
            <span className="text-4xl font-bold text-white">E</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">ELOS</h1>
          <p className="text-indigo-200">Employee Lunch Ordering System</p>
        </div>

        {/* Guest Login Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
              <span className="text-3xl">🎟️</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Guest Access</h2>
            <p className="text-slate-500 mt-2">
              Enter your 6-character guest code to order lunch
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Guest Code
              </label>
              <input
                type="text"
                value={code}
                onChange={handleCodeChange}
                placeholder="ABC123"
                className="w-full px-4 py-4 text-center text-2xl font-mono font-bold tracking-widest border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white uppercase"
                maxLength={6}
                required
              />
              <p className="text-xs text-slate-500 mt-2 text-center">
                Code provided by your host or receptionist
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Verifying...
                </>
              ) : (
                'Access Menu'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-center text-slate-500 text-sm mb-4">
              Have a company account?
            </p>
            <Link
              to="/login"
              className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
            >
              ← Sign in with Email
            </Link>
          </div>
        </div>

        {/* Footer */}
        <AuthFooter />
      </div>
    </div>
  );
}
