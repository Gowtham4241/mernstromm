// Auth.js
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function Auth({ onLoginSuccess, isRegister = false }) {
  const [isLogin, setIsLogin] = useState(!isRegister);
  const location = useLocation();

  useEffect(() => {
    setIsLogin(!isRegister);
  }, [isRegister]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(() => {
    return location.state?.role || 'user';
  });

  useEffect(() => {
    if (location.state?.role) {
      setRole(location.state.role);
    }
  }, [location.state]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const url = isLogin ? '/api/auth/login' : '/api/auth/register';
    const body = isLogin ? { email, password } : { name, email, password, role };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Identity operation failed.');
      }

      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (type) => {
    setEmail(type === 'demo' ? 'demo@autoaid.ai' : type === 'admin' ? 'admin@autoaid.ai' : 'mechanic@autoaid.ai');
    setPassword('demo123');
    setIsLogin(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden" id="auth-container">
      <div className="absolute top-0 left-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-red-600 to-rose-700 rounded-xl shadow-lg shadow-red-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A1.79 1.79 0 1115.3 18l-3.88-3.88M11.42 15.17l4.62-4.62M11.42 15.17L6 10.25M16.5 10.5h.008v.008H16.5V10.5zm-6-6h.008v.008H10.5V4.5zm0-2.25h.008v.008H10.5v-.008z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans">
              AUTOAID
            </h1>
            <p className="text-slate-400 text-xs">Automotive Diagnostics & Maintenance Engine</p>
          </div>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10" id="auth-card-wrapper">
        <div className="bg-slate-900 py-8 px-4 border border-slate-800 shadow-2xl rounded-2xl sm:px-10">
          <h2 className="text-xl font-bold font-sans text-slate-100 mb-6 text-center">
            {isLogin ? 'Sign in to your Garage' : 'Create an account'}
          </h2>

          {error && (
            <div className="bg-red-950/40 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm mb-5 text-center flex items-center gap-2 justify-center" id="error-alert">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sarah Jenkins"
                  className="w-full bg-slate-950 hover:bg-slate-950/80 focus:bg-slate-950 border border-slate-800 focus:border-red-500 rounded-lg py-2 px-3 text-slate-200 outline-none transition text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sarah@example.com"
                className="w-full bg-slate-950 hover:bg-slate-950/80 focus:bg-slate-950 border border-slate-800 focus:border-red-500 rounded-lg py-2 px-3 text-slate-200 outline-none transition text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 hover:bg-slate-950/80 focus:bg-slate-950 border border-slate-800 focus:border-red-500 rounded-lg py-2 px-3 text-slate-200 outline-none transition text-sm"
              />
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Platform Role</label>
                <div className="flex flex-col sm:flex-row gap-3 pt-1" id="role-selection">
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      checked={role === 'user'}
                      onChange={() => setRole('user')}
                      className="text-red-500 focus:ring-red-500 bg-slate-950 border-slate-800"
                    />
                    <span>Vehicle Owner (User)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      checked={role === 'mechanic'}
                      onChange={() => setRole('mechanic')}
                      className="text-red-500 focus:ring-red-500 bg-slate-950 border-slate-800"
                    />
                    <span>Shop Mechanic (Mechanic)</span>
                   </label>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 font-semibold text-white py-2 px-4 rounded-lg shadow-lg hover:shadow-red-600/20 outline-none transition duration-150 disabled:opacity-50 cursor-pointer"
              id="auth-submit-btn"
            >
              {loading ? 'Please wait...' : isLogin ? 'Access Garage' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-800 pt-6">
            <div className="text-center text-sm">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-red-400 hover:text-red-300 font-medium transition cursor-pointer"
              >
                {isLogin ? "Don't have an account yet? Sign up" : 'Already have an account? Log in'}
              </button>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-800 pt-4">
            <p className="text-center text-xs text-slate-500 mb-3">HACKATHON QUICK-LOGIN CHANNELS</p>
            <div className="grid grid-cols-2 gap-2" id="quick-links">
              <button
                type="button"
                onClick={() => handleQuickLogin('demo')}
                className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-red-600/30 transition text-center cursor-pointer"
              >
                <span className="text-red-400 font-bold text-[10px] font-sans">DEMO USER</span>
                <span className="text-[8px] text-slate-500">Sarah (Owner)</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('mechanic')}
                className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-emerald-600/30 transition text-center cursor-pointer"
              >
                <span className="text-emerald-400 font-bold text-[10px] font-sans">DEMO MECH</span>
                <span className="text-[8px] text-slate-500">Raj (Mechanic)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}