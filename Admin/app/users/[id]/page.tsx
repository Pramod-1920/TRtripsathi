'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { FiArrowLeft, FiSave, FiTrash2, FiX } from 'react-icons/fi';
import { apiClient } from '@/lib/api';

type Gender = 'male' | 'female' | 'non_binary' | 'other' | 'prefer_not_to_say';

const GENDER_OPTIONS: Array<{ label: string; value: Gender }> = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Non-binary', value: 'non_binary' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

const LANGUAGE_OPTIONS = [
  'English',
  'Nepali',
  'Hindi',
  'Maithili',
  'Bhojpuri',
  'Tamang',
  'Newari',
  'Tharu',
  'Urdu',
  'Other',
];

const OTHER_LANGUAGE_VALUE = 'Other';

type Profile = {
  _id: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  age?: number | null;
  profilePhoto?: string | null;
  profilePhotoPublicId?: string | null;
  bio?: string | null;
  location?: string | null;
  province?: string | null;
  district?: string | null;
  landmark?: string | null;
  experienceLevel?: string | null;
  gender?: Gender | null;
  languagesKnown?: string[] | null;
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
  const [customOtherLanguage, setCustomOtherLanguage] = useState('');

  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await apiClient.get(`/user/admin/profiles/${userId}`);

        if (active) {
          const profile = response.data as Profile;
          const loadedLanguages = Array.isArray(profile.languagesKnown) ? profile.languagesKnown : [];
          const knownOptionValues = new Set(LANGUAGE_OPTIONS);
          const customLoadedLanguages = loadedLanguages.filter((language) => !knownOptionValues.has(language));
          const optionLoadedLanguages = loadedLanguages.filter((language) => knownOptionValues.has(language));

          if (customLoadedLanguages.length > 0) {
            setCustomOtherLanguage(customLoadedLanguages.join(', '));
          }

          setFormData({
            ...profile,
            languagesKnown:
              customLoadedLanguages.length > 0
                ? Array.from(new Set([...optionLoadedLanguages, OTHER_LANGUAGE_VALUE]))
                : optionLoadedLanguages,
          });
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

    const normalizedValue =
      name === 'phoneNumber' ? value.replace(/\D/g, '').slice(0, 10) : value;

    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : normalizedValue,
    });
  };

  const toggleLanguage = (language: string) => {
    if (!isEditing) {
      return;
    }

    setFormData((current) => {
      if (!current) {
        return current;
      }

      const currentLanguages = current.languagesKnown ?? [];
      const nextLanguages = currentLanguages.includes(language)
        ? currentLanguages.filter((item) => item !== language)
        : [...currentLanguages, language];

      if (language === OTHER_LANGUAGE_VALUE && !nextLanguages.includes(OTHER_LANGUAGE_VALUE)) {
        setCustomOtherLanguage('');
      }

      return {
        ...current,
        languagesKnown: nextLanguages,
      };
    });
  };

  const removeLanguage = (language: string) => {
    if (!isEditing) {
      return;
    }

    const optionValues = new Set(LANGUAGE_OPTIONS);

    if (optionValues.has(language)) {
      setFormData((current) => {
        if (!current) {
          return current;
        }

        const filteredLanguages = (current.languagesKnown ?? []).filter((item) => item !== language);

        return {
          ...current,
          languagesKnown: filteredLanguages,
        };
      });

      if (language === OTHER_LANGUAGE_VALUE) {
        setCustomOtherLanguage('');
      }

      return;
    }

    const nextCustomLanguages = customOtherLanguage
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && item !== language);

    setCustomOtherLanguage(nextCustomLanguages.join(', '));
  };

  const getLanguagesForSave = (languages: string[]) => {
    const selectedWithoutOther = languages.filter((language) => language !== OTHER_LANGUAGE_VALUE);
    const parsedCustomLanguages = customOtherLanguage
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (languages.includes(OTHER_LANGUAGE_VALUE)) {
      return [...selectedWithoutOther, ...parsedCustomLanguages];
    }

    return selectedWithoutOther;
  };

  const handleSave = async () => {
    if (!formData || !userId) {
      return;
    }

    setError('');

    if (!formData.phoneNumber || !/^\d{10}$/.test(formData.phoneNumber)) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }

    if (!formData.email?.trim()) {
      setError('Email is required.');
      return;
    }

    const selectedLanguages = formData.languagesKnown ?? [];
    const isOtherSelected = selectedLanguages.includes(OTHER_LANGUAGE_VALUE);
    const languagesForSave = getLanguagesForSave(selectedLanguages);

    if (
      isOtherSelected
      && languagesForSave.length === selectedLanguages.filter((language) => language !== OTHER_LANGUAGE_VALUE).length
    ) {
      setError('Please enter at least one language in Other.');
      return;
    }

    const response = await apiClient.patch(`/user/admin/profiles/${userId}`, {
      phoneNumber: formData.phoneNumber,
      email: formData.email,
      firstName: formData.firstName,
      middleName: formData.middleName,
      lastName: formData.lastName,
      dateOfBirth: formData.dateOfBirth,
      profilePhoto: formData.profilePhoto,
      profilePhotoPublicId: formData.profilePhotoPublicId,
      bio: formData.bio,
      location: formData.location,
      province: formData.province,
      district: formData.district,
      landmark: formData.landmark,
      experienceLevel: formData.experienceLevel,
      gender: formData.gender,
      languagesKnown: languagesForSave,
      isProfilePublic: formData.isProfilePublic,
      profileCompleted: formData.profileCompleted,
    });

    const updatedProfile = response.data as Profile;
    const knownOptionValues = new Set(LANGUAGE_OPTIONS);
    const updatedLanguages = Array.isArray(updatedProfile.languagesKnown)
      ? updatedProfile.languagesKnown
      : [];
    const customUpdatedLanguages = updatedLanguages.filter((language) => !knownOptionValues.has(language));
    const optionUpdatedLanguages = updatedLanguages.filter((language) => knownOptionValues.has(language));

    setCustomOtherLanguage(customUpdatedLanguages.join(', '));
    setFormData({
      ...updatedProfile,
      languagesKnown:
        customUpdatedLanguages.length > 0
          ? Array.from(new Set([...optionUpdatedLanguages, OTHER_LANGUAGE_VALUE]))
          : optionUpdatedLanguages,
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
            <p className="text-xs text-slate-400 mt-1">
              {formData.phoneNumber || 'No phone number'}{formData.email ? ` • ${formData.email}` : ''}
            </p>
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                <input
                  type="text"
                  name="phoneNumber"
                  value={formData.phoneNumber ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  inputMode="numeric"
                  maxLength={10}
                  pattern="\d{10}"
                  placeholder="Enter 10-digit phone number"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  required
                  placeholder="Enter email address"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                />
              </div>
            </div>

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
                  name="lastName"
                  type="text"
                  value={formData.lastName ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date of Birth</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth ? formData.dateOfBirth.slice(0, 10) : ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Age</label>
                <input
                  type="number"
                  value={formData.age ?? ''}
                  disabled
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Gender</label>
                <select
                  name="gender"
                  value={formData.gender ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                >
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Languages Known</label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-3 text-xs text-slate-500">
                    Select all languages this user knows. If you choose Other, add language name(s) below.
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {LANGUAGE_OPTIONS.map((language) => {
                      const isSelected = (formData.languagesKnown ?? []).includes(language);

                      return (
                        <button
                          key={language}
                          type="button"
                          onClick={() => toggleLanguage(language)}
                          disabled={!isEditing}
                          aria-pressed={isSelected}
                          className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                          } disabled:cursor-not-allowed disabled:opacity-70`}
                        >
                          {language}
                        </button>
                      );
                    })}
                  </div>

                  {(formData.languagesKnown ?? []).includes(OTHER_LANGUAGE_VALUE) && (
                    <div className="mt-3">
                      <label className="mb-1 block text-xs font-medium text-slate-600">Other language(s)</label>
                      <input
                        type="text"
                        value={customOtherLanguage}
                        onChange={(e) => setCustomOtherLanguage(e.target.value)}
                        disabled={!isEditing}
                        placeholder="Example: French or French, Spanish"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                      />
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Selected</span>
                    {getLanguagesForSave(formData.languagesKnown ?? []).length > 0 ? (
                      getLanguagesForSave(formData.languagesKnown ?? []).map((language) => (
                        <button
                          key={language}
                          type="button"
                          onClick={() => removeLanguage(language)}
                          disabled={!isEditing}
                          className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                          title={`Remove ${language}`}
                          aria-label={`Remove ${language}`}
                        >
                          {language}
                          <FiX size={12} />
                        </button>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">No languages selected yet</span>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">Click selected chips to remove them.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Profile Photo</label>
                {formData.profilePhoto ? (
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    <Image
                      src={formData.profilePhoto}
                      alt="Profile photo"
                      width={512}
                      height={512}
                      className="h-52 w-full object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                    No profile photo available
                  </div>
                )}
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
