'use client';

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { FiSave, FiUpload, FiX } from 'react-icons/fi';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

type Gender = 'male' | 'female' | 'non_binary' | 'other' | 'prefer_not_to_say';

type LanguageOption = {
  label: string;
  value: string;
};

type Profile = {
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
  isProfilePublic?: boolean;
};

const GENDER_OPTIONS: Array<{ label: string; value: Gender }> = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Non-binary', value: 'non_binary' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { label: 'English', value: 'English' },
  { label: 'Nepali', value: 'Nepali' },
  { label: 'Hindi', value: 'Hindi' },
  { label: 'Maithili', value: 'Maithili' },
  { label: 'Bhojpuri', value: 'Bhojpuri' },
  { label: 'Tamang', value: 'Tamang' },
  { label: 'Newari', value: 'Newari' },
  { label: 'Tharu', value: 'Tharu' },
  { label: 'Urdu', value: 'Urdu' },
  { label: 'Other', value: 'Other' },
];

const OTHER_LANGUAGE_VALUE = 'Other';

type CloudinarySignatureResponse = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder?: string;
};

type CloudinaryUploadResponse = {
  secure_url: string;
  public_id: string;
};

function calculateAgeFromDob(dob: string) {
  const birthDate = new Date(dob);

  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
}

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const setProfilePhoto = useAuthStore((state) => state.setProfilePhoto);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [formData, setFormData] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [customOtherLanguage, setCustomOtherLanguage] = useState('');
  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await apiClient.get('/user/profile');

        if (active) {
          const profile = response.data as Profile;
          const loadedLanguages = Array.isArray(profile.languagesKnown) ? profile.languagesKnown : [];
          const knownOptionValues = new Set(LANGUAGE_OPTIONS.map((option) => option.value));
          const customLoadedLanguages = loadedLanguages.filter((language) => !knownOptionValues.has(language));
          const optionLoadedLanguages = loadedLanguages.filter((language) => knownOptionValues.has(language));

          if (customLoadedLanguages.length > 0) {
            setCustomOtherLanguage(customLoadedLanguages.join(', '));
          }

          setFormData({
            ...profile,
            phoneNumber: profile.phoneNumber ?? user?.phoneNumber ?? null,
            email: profile.email ?? user?.email ?? null,
            dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : null,
            languagesKnown:
              customLoadedLanguages.length > 0
                ? Array.from(new Set([...optionLoadedLanguages, OTHER_LANGUAGE_VALUE]))
                : optionLoadedLanguages,
          });
          setProfilePhoto(profile.profilePhoto ?? null);
        }
      } catch (loadError) {
        if (!active) {
          return;
        }

        const backendMessage = axios.isAxiosError(loadError)
          ? (loadError.response?.data as { message?: string } | undefined)?.message
          : undefined;

        setError(backendMessage || 'Unable to load admin profile.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [setProfilePhoto, user?.email, user?.phoneNumber]);

  useEffect(() => {
    if (!selectedImageFile) {
      setSelectedImagePreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(selectedImageFile);
    setSelectedImagePreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [selectedImageFile]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const normalizedValue =
      name === 'phoneNumber' ? value.replace(/\D/g, '').slice(0, 10) : value;

    setFormData((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : normalizedValue,
      };
    });
  };

  const toggleLanguage = (language: string) => {
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
    const optionValues = new Set(LANGUAGE_OPTIONS.map((option) => option.value));

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

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dob = e.target.value;
    const age = dob ? calculateAgeFromDob(dob) : null;

    setFormData((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        dateOfBirth: dob,
        age,
      };
    });
  };

  const handleSelectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be 5MB or less.');
      return;
    }

    setError('');
    setSuccess('');
    setSelectedImageFile(file);
    e.target.value = '';
  };

  const openImagePicker = () => {
    fileInputRef.current?.click();
  };

  const clearSelectedImage = () => {
    setSelectedImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!formData) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!formData.phoneNumber || !/^\d{10}$/.test(formData.phoneNumber)) {
        setError('Phone number must be exactly 10 digits.');
        setSaving(false);
        return;
      }

      if (!formData.email?.trim()) {
        setError('Email is required.');
        setSaving(false);
        return;
      }

      const selectedLanguages = formData.languagesKnown ?? [];
      const isOtherSelected = selectedLanguages.includes(OTHER_LANGUAGE_VALUE);
      const languagesForSave = getLanguagesForSave(selectedLanguages);

      if (isOtherSelected && languagesForSave.length === selectedLanguages.filter((l) => l !== OTHER_LANGUAGE_VALUE).length) {
        setError('Please enter at least one language in Other.');
        setSaving(false);
        return;
      }

      const payload: Record<string, unknown> = {
        phoneNumber: formData.phoneNumber,
        email: formData.email,
        firstName: formData.firstName,
        middleName: formData.middleName,
        lastName: formData.lastName,
        dateOfBirth: formData.dateOfBirth || undefined,
        bio: formData.bio,
        location: formData.location,
        province: formData.province,
        district: formData.district,
        landmark: formData.landmark,
        experienceLevel: formData.experienceLevel,
        gender: formData.gender,
        languagesKnown: languagesForSave,
        isProfilePublic: formData.isProfilePublic,
      };

      if (selectedImageFile) {
        const signatureResponse = await apiClient.post('/cloudinary/signature', {
          folder: 'admin_profiles',
        });

        const signatureData = signatureResponse.data as CloudinarySignatureResponse;
        const uploadFormData = new FormData();
        uploadFormData.append('file', selectedImageFile);
        uploadFormData.append('api_key', signatureData.apiKey);
        uploadFormData.append('timestamp', String(signatureData.timestamp));
        uploadFormData.append('signature', signatureData.signature);

        if (signatureData.folder) {
          uploadFormData.append('folder', signatureData.folder);
        }

        const uploadResponse = await axios.post(
          `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`,
          uploadFormData,
        );

        const uploadedImage = uploadResponse.data as CloudinaryUploadResponse;
        payload.profilePhoto = uploadedImage.secure_url;
        payload.profilePhotoPublicId = uploadedImage.public_id;
      }

      const response = await apiClient.patch('/user/profile', payload);
      const updatedProfile = response.data as Profile;

      setFormData({
        ...updatedProfile,
        dateOfBirth: updatedProfile.dateOfBirth ? updatedProfile.dateOfBirth.slice(0, 10) : null,
        languagesKnown: Array.isArray(updatedProfile.languagesKnown)
          ? updatedProfile.languagesKnown
          : [],
      });

      if (user) {
        setSession({
          ...user,
          phoneNumber: updatedProfile.phoneNumber ?? user.phoneNumber,
          email: updatedProfile.email ?? null,
        });
      }

      const knownOptionValues = new Set(LANGUAGE_OPTIONS.map((option) => option.value));
      const updatedLanguages = Array.isArray(updatedProfile.languagesKnown)
        ? updatedProfile.languagesKnown
        : [];
      const customUpdatedLanguages = updatedLanguages.filter(
        (language) => !knownOptionValues.has(language),
      );

      setCustomOtherLanguage(customUpdatedLanguages.join(', '));

      if (customUpdatedLanguages.length > 0) {
        setFormData((current) => {
          if (!current) {
            return current;
          }

          const optionUpdatedLanguages = updatedLanguages.filter((language) => knownOptionValues.has(language));

          return {
            ...current,
            languagesKnown: Array.from(new Set([...optionUpdatedLanguages, OTHER_LANGUAGE_VALUE])),
          };
        });
      }

      if (updatedProfile.profilePhoto) {
        setProfilePhoto(updatedProfile.profilePhoto);
      }

      setSuccess('Admin profile updated successfully.');
      setSelectedImageFile(null);
    } catch (saveError) {
      const backendMessage = axios.isAxiosError(saveError)
        ? (saveError.response?.data as { message?: string } | undefined)?.message
        : undefined;
      setError(backendMessage || 'Unable to update admin profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Loading admin profile...
        </div>
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error || 'Admin profile is not available.'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Admin Profile</h1>
          <p className="mt-2 text-sm text-slate-600">Update your own admin information.</p>
          <p className="mt-1 text-xs text-slate-500">
            Logged in as {user?.phoneNumber || 'Unknown'} ({user?.role || 'admin'})
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiSave size={18} />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Phone Number</label>
            <input
              type="text"
              name="phoneNumber"
              value={formData?.phoneNumber ?? ''}
              onChange={handleInputChange}
              inputMode="numeric"
              maxLength={10}
              pattern="\d{10}"
              placeholder="Enter 10-digit phone number"
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              name="email"
              value={formData?.email ?? ''}
              onChange={handleInputChange}
              required
              placeholder="Enter email address"
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">First Name</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName ?? ''}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Middle Name</label>
            <input
              type="text"
              name="middleName"
              value={formData.middleName ?? ''}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Last Name</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName ?? ''}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Date of Birth</label>
            <input
              type="date"
              name="dateOfBirth"
              value={formData.dateOfBirth ?? ''}
              onChange={handleDobChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-slate-700">Age (auto-calculated)</label>
          <input
            type="number"
            value={formData.age ?? ''}
            readOnly
            className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-slate-600"
          />
        </div>

        <div className="mb-6 rounded-lg border border-slate-200 p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-700">
            <FiUpload size={16} />
            Profile Picture
            <button
              type="button"
              onClick={openImagePicker}
              className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Choose profile picture"
              title="Choose profile picture"
            >
              <FiUpload size={14} />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleSelectImage}
            className="mb-4 block w-full text-sm text-slate-700"
          />

          {selectedImageFile && selectedImagePreview ? (
            <div className="relative inline-block">
              <button
                type="button"
                onClick={clearSelectedImage}
                className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-sm hover:bg-slate-100 hover:text-slate-900"
                aria-label="Remove selected image"
                title="Remove selected image"
              >
                <FiX size={13} />
              </button>
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Selected Image Preview</p>
              <img
                src={selectedImagePreview}
                alt={selectedImageFile.name}
                className="h-32 w-32 rounded-lg border border-slate-200 object-cover"
              />
              <p className="mt-2 text-sm text-slate-600">{selectedImageFile.name}</p>
            </div>
          ) : formData.profilePhoto ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Current Profile Photo</p>
              <img
                src={formData.profilePhoto}
                alt="Current profile"
                className="h-32 w-32 rounded-lg border border-slate-200 object-cover"
              />
            </div>
          ) : null}
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-slate-700">Bio</label>
          <textarea
            name="bio"
            rows={4}
            value={formData.bio ?? ''}
            onChange={handleInputChange}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Location</label>
            <input
              type="text"
              name="location"
              value={formData.location ?? ''}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Province</label>
            <input
              type="text"
              name="province"
              value={formData.province ?? ''}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">District</label>
            <input
              type="text"
              name="district"
              value={formData.district ?? ''}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Landmark</label>
            <input
              type="text"
              name="landmark"
              value={formData.landmark ?? ''}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-slate-700">Experience Level</label>
          <select
            name="experienceLevel"
            value={formData.experienceLevel ?? ''}
            onChange={handleInputChange}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select level</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Gender</label>
            <select
              name="gender"
              value={formData.gender ?? ''}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="mb-2 block text-sm font-medium text-slate-700">Languages Known</label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-3 text-xs text-slate-500">
                Select all languages you know. If you choose Other, add language name(s) in the field below.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {LANGUAGE_OPTIONS.map((option) => {
                  const isSelected = (formData.languagesKnown ?? []).includes(option.value);

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleLanguage(option.value)}
                      aria-pressed={isSelected}
                      className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                      }`}
                    >
                      <span className="block">{option.label}</span>
                    </button>
                  );
                })}
              </div>

              {(formData.languagesKnown ?? []).includes(OTHER_LANGUAGE_VALUE) && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Other language(s)[ write , to seperate ]</label>
                  <input
                    type="text"
                    value={customOtherLanguage}
                    onChange={(e) => setCustomOtherLanguage(e.target.value)}
                    placeholder="Example: French or French, Spanish"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
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
            <p className="mt-2 text-xs text-slate-500">Click selected chips to remove them.</p>
          </div>
        </div>

        <div className="flex items-center">
          <input
            id="isProfilePublic"
            type="checkbox"
            name="isProfilePublic"
            checked={formData.isProfilePublic ?? false}
            onChange={handleInputChange}
            className="h-4 w-4 rounded border-slate-300"
          />
          <label htmlFor="isProfilePublic" className="ml-3 text-sm font-medium text-slate-700">
            Make profile public
          </label>
        </div>
      </div>
    </div>
  );
}
