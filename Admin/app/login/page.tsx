'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiArrowRight, FiLock, FiPhone } from 'react-icons/fi';
import axios from 'axios';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

function normalizePhoneNumber(input: string) {
  const digitsOnly = input.replace(/\D/g, '');

  // Keep last 10 digits to support inputs like +977-98XXXXXXXX.
  if (digitsOnly.length > 10) {
    return digitsOnly.slice(-10);
  }

  return digitsOnly;
}

function getAxiosErrorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return undefined;
  }

  const data = error.response?.data as
    | { message?: string | string[] }
    | undefined;

  if (!data?.message) {
    return undefined;
  }

  if (Array.isArray(data.message)) {
    return data.message.join(', ');
  }

  return data.message;
}

function getLoginErrorMessage(error: unknown) {
  const backendMessage = getAxiosErrorMessage(error);
  if (backendMessage) {
    return backendMessage;
  }

  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Cannot reach backend server. Please verify API URL/CORS and that backend is running.';
    }

    return `Login failed with status ${error.response.status}.`;
  }

  return 'Invalid credentials or admin access denied.';
}

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    phoneNumber: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

    const normalizedPhone = normalizePhoneNumber(formData.phoneNumber);

    if (!/^\d{10}$/.test(normalizedPhone)) {
      setError('Phone number must be exactly 10 digits.');
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.post('/auth/login', {
        phoneNumber: normalizedPhone,
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
        try {
          await apiClient.post('/auth/logout');
        } catch {
          // Best-effort cleanup only.
        }
        setError('Admin access only. Please sign in with an admin account.');
        return;
      }

      setSession(data.user);
      router.push('/dashboard');
    } catch (error) {
      setError(getLoginErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-600 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-600 mb-4">
              <span className="text-2xl font-bold text-white">TR</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">TRTrips Admin</h1>
            <p className="text-slate-600 text-sm mt-2">Admin sign in only</p>
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

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : (
                <>
                  Sign In
                  <FiArrowRight size={18} />
                </>
              )}
            </button>
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
