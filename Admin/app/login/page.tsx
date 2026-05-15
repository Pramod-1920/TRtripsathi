'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiArrowRight, FiLock, FiPhone } from 'react-icons/fi';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

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

    try {
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
      setError('Invalid credentials or admin access denied.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-accent to-secondary/15 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-card rounded-2xl shadow-[0_20px_40px_rgba(71,102,75,0.14)] border border-border p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary mb-4 shadow-[0_6px_14px_rgba(160,65,0,0.26)]">
              <span className="text-2xl font-bold text-white">TR</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Yatri Admin</h1>
            <p className="text-muted-foreground text-sm mt-2">Sign in to your account</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone Number */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Phone Number
              </label>
              <div className="relative">
                <FiPhone className="absolute left-3 top-3 text-muted-foreground" size={20} />
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  placeholder="+91 98765 43210"
                  className="w-full pl-10 pr-4 py-2.5 border border-border bg-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Password
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-3 text-muted-foreground" size={20} />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-4 py-2.5 border border-border bg-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-error-container border border-error rounded-lg">
                <p className="text-sm text-on-error-container">{error}</p>
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary text-primary-foreground font-medium rounded-full hover:bg-primary-container transition-colors disabled:opacity-50 shadow-[0_8px_16px_rgba(160,65,0,0.22)]"
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
        <p className="text-center text-muted-foreground text-sm mt-6">
          Connects directly to the NestJS backend at {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}
        </p>
      </div>
    </div>
  );
}
