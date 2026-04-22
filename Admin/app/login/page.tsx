'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiArrowRight, FiLock, FiPhone } from 'react-icons/fi';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [formData, setFormData] = useState({
    phoneNumber: '',
    password: '',
    role: 'user' as 'admin' | 'user',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const setSession = useAuthStore((state) => state.setSession);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'signup') {
        await apiClient.post('/auth/signup', {
          phoneNumber: formData.phoneNumber,
          password: formData.password,
          role: formData.role,
        });

        setSuccess(`Account created as ${formData.role}. You can sign in now.`);
        setMode('signin');
        setFormData((prev) => ({ ...prev, password: '' }));
        return;
      }

      const response = await apiClient.post('/auth/login', {
        phoneNumber: formData.phoneNumber,
        password: formData.password,
      });

      const data = response.data as {
        user: {
          id: string;
          phoneNumber: string;
          role: 'admin' | 'user';
        };
      };

      if (data.user.role !== 'admin') {
        await apiClient.post('/auth/logout');
        setError('Admin access only. Please sign in with an admin account.');
        return;
      }

      setSession(data.user);
      router.push('/dashboard');
    } catch {
      if (mode === 'signup') {
        setError('Unable to create account. Check phone/password or use another number.');
      } else {
        setError('Invalid credentials or admin access denied.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-600 mb-4">
              <span className="text-2xl font-bold text-white">TR</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">TRTrips Admin</h1>
            <p className="text-slate-600 text-sm mt-2">Sign in or create account</p>

            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
                setSuccess('');
              }}
              className="mt-4 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              New admin? Create your account
            </button>
          </div>

          <div className="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError('');
                setSuccess('');
              }}
              className={`rounded-md py-2 text-sm font-medium transition-colors ${
                mode === 'signin' ? 'bg-white text-slate-900 shadow' : 'text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
                setSuccess('');
              }}
              className={`rounded-md py-2 text-sm font-medium transition-colors ${
                mode === 'signup' ? 'bg-white text-slate-900 shadow' : 'text-slate-600'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone Number */}
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <FiPhone className="absolute left-3 top-3 text-slate-400" size={20} />
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  placeholder="+91 98765 43210"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Role
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Password
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-3 text-slate-400" size={20} />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? (mode === 'signup' ? 'Creating account...' : 'Signing in...') : (
                <>
                  {mode === 'signup' ? 'Create Account' : 'Sign In'}
                  <FiArrowRight size={18} />
                </>
              )}
            </button>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
              <p className="text-sm text-slate-600">
                {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setError('');
                  setSuccess('');
                }}
                className="mt-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                {mode === 'signin' ? 'Create your account' : 'Back to sign in'}
              </button>
            </div>
          </form>

        </div>

        {/* Bottom Text */}
        <p className="text-center text-slate-400 text-sm mt-6">
          Connects directly to the NestJS backend at {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}
        </p>
      </div>
    </div>
  );
}
