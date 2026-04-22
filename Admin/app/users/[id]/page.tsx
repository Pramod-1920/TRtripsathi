'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiSave, FiTrash2 } from 'react-icons/fi';
import { apiClient } from '@/lib/api';

type Profile = {
  _id: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  age?: number | null;
  profilePhoto?: string | null;
  bio?: string | null;
  location?: string | null;
  province?: string | null;
  district?: string | null;
  landmark?: string | null;
  experienceLevel?: string | null;
  xp?: number;
  badge?: string;
  isProfilePublic?: boolean;
  profileCompleted?: boolean;
  createdAt?: string;
};

export default function UserDetailPage() {
  const params = useParams();
  const userId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [formData, setFormData] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await apiClient.get(`/user/admin/profiles/${userId}`);

        if (active) {
          setFormData(response.data as Profile);
        }
      } catch {
        if (active) {
          setError('Unable to load the selected profile from the backend.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (userId) {
      void loadProfile();
    }

    return () => {
      active = false;
    };
  }, [userId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (!formData) {
      return;
    }

    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    });
  };

  const handleSave = async () => {
    if (!formData || !userId) {
      return;
    }

    await apiClient.patch(`/user/admin/profiles/${userId}`, {
      firstName: formData.firstName,
      middleName: formData.middleName,
      lastName: formData.lastName,
      age: formData.age,
      profilePhoto: formData.profilePhoto,
      bio: formData.bio,
      location: formData.location,
      province: formData.province,
      district: formData.district,
      landmark: formData.landmark,
      experienceLevel: formData.experienceLevel,
      isProfilePublic: formData.isProfilePublic,
      profileCompleted: formData.profileCompleted,
    });

    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      await apiClient.delete(`/user/admin/profiles/${userId}`);
      window.location.href = '/users';
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Loading profile from the backend...
        </div>
      </div>
    );
  }

  if (error || !formData) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error || 'Profile not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/users"
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <FiArrowLeft size={24} className="text-slate-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {formData.firstName} {formData.lastName}
            </h1>
            <p className="text-sm text-slate-500">{formData.location || 'No location provided'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FiSave size={20} />
                Save Changes
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Edit User
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <FiTrash2 size={20} />
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-6">Personal Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Age</label>
                <input
                  type="number"
                  name="age"
                  value={formData.age ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Experience Level</label>
                <select
                  name="experienceLevel"
                  value={formData.experienceLevel ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                >
                  <option value="">Select level</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Profile Photo URL</label>
                <input
                  type="text"
                  name="profilePhoto"
                  value={formData.profilePhoto ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Landmark</label>
                <input
                  type="text"
                  name="landmark"
                  value={formData.landmark ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Bio</label>
              <textarea
                name="bio"
                value={formData.bio ?? ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                rows={4}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Location</label>
              <input
                type="text"
                name="location"
                value={formData.location ?? ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Province</label>
                <input
                  type="text"
                  name="province"
                  value={formData.province ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">District</label>
                <input
                  type="text"
                  name="district"
                  value={formData.district ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="isProfilePublic"
                checked={formData.isProfilePublic ?? false}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="w-4 h-4 rounded border-slate-300"
              />
              <label className="ml-3 text-sm font-medium text-slate-700">Make profile public</label>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div>
          {/* Stats Card */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Account Stats</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Experience Points</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formData.xp ?? 0}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Badge</p>
                <p className="text-lg font-semibold text-purple-600 mt-1">{formData.badge || 'No badge'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Profile Status</p>
                <div className="mt-1">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    formData.profileCompleted
                      ? 'bg-green-50 text-green-700'
                      : 'bg-yellow-50 text-yellow-700'
                  }`}>
                    {formData.profileCompleted ? 'Complete' : 'Incomplete'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-xs text-slate-600">
              <span className="font-semibold">User ID:</span> {userId}
            </p>
            <p className="text-xs text-slate-600 mt-2">
              <span className="font-semibold">Created:</span> {formData.createdAt ? new Date(formData.createdAt).toLocaleString() : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
