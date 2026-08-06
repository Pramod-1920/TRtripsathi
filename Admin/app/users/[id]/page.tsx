'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { FiArrowLeft, FiCheck, FiSave, FiTrash2, FiX } from 'react-icons/fi';
import { apiClient } from '@/lib/api';
import { ConfirmModal } from '@/components/ui/confirm-modal';

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
  isProfilePublic?: boolean;
  profileCompleted?: boolean;
  isActive?: boolean;
  deactivatedAt?: string | null;
  createdAt?: string;
  photoVerificationRequests?: Array<{
    requestCode: string;
    campaignId: string;
    url: string;
    kind: 'group' | 'solo';
    status: 'pending' | 'approved' | 'rejected';
    submittedAt: string;
    reviewedAt?: string;
    reviewNote?: string;
  }>;
<<<<<<< HEAD
=======
  xpHistory?: Array<{
    _id?: string;
    eventKey?: string;
    ruleCode?: string;
    ruleName?: string;
    points?: number;
    contextKey?: string;
    context?: Record<string, unknown>;
    awardedAt?: string;
  }>;
  currentRankBadge?: {
    rankCode?: string;
    imageUrl?: string;
    publicId?: string;
    name?: string;
    isCurrentRank?: boolean;
  } | null;
  rankBadges?: Array<{
    rankCode?: string;
    imageUrl?: string;
    publicId?: string;
    name?: string;
    isCurrentRank?: boolean;
  }>;
  userBadges?: Array<{
    _id?: string;
    userId?: string;
    badgeCode?: string;
    tier?: string;
    name?: string;
    description?: string;
    iconUrl?: string;
    unlockedAt?: string;
  }>;
  badgeCount?: number;
>>>>>>> e09d3789ef38baf838053502fd4c44d5b127d5a4
};

export default function UserDetailPage() {
  const params = useParams();
  const userId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [formData, setFormData] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [customOtherLanguage, setCustomOtherLanguage] = useState('');
  const [reviewNoteByCode, setReviewNoteByCode] = useState<Record<string, string>>({});
  const [reviewingCode, setReviewingCode] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteProfileModalOpen, setDeleteProfileModalOpen] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState(false);

  async function loadProfile() {
    try {
      const response = await apiClient.get(`/user/admin/profiles/${userId}`);
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

    } catch {
      setError('Unable to load the selected profile from the backend.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userId) {
      void loadProfile();
    }
  }, [userId]);

  async function handleReviewPhotoRequest(
    requestCode: string,
    status: 'approved' | 'rejected',
  ) {
    if (!userId) {
      return;
    }

    setReviewingCode(requestCode);
    setError('');
    setSuccess('');

    try {
      await apiClient.patch(
        `/user/admin/profiles/${userId}/photos/verification-requests/${requestCode}`,
        {
          status,
          reviewNote: reviewNoteByCode[requestCode]?.trim() || undefined,
        },
      );

      if (status === 'approved') {
        setSuccess('Photo approved.');
      } else {
        setSuccess('Photo request rejected.');
      }

      await loadProfile();
    } catch {
      setError('Failed to review photo verification request.');
    } finally {
      setReviewingCode(null);
    }
  }

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
    setDeletingProfile(true);

    try {
      await apiClient.delete(`/user/admin/profiles/${userId}`);
      window.location.href = '/users';
    } catch {
      setError(formData?.isActive === false
        ? 'Failed to permanently delete the user.'
        : 'Failed to deactivate the user.');
      setDeleteProfileModalOpen(false);
    } finally {
      setDeletingProfile(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
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
      {success && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/users"
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <FiArrowLeft size={24} className="text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {formData.firstName} {formData.lastName}
            </h1>
            <p className="text-sm text-muted-foreground">{formData.location || 'No location provided'}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formData.phoneNumber || 'No phone number'}{formData.email ? ` * ${formData.email}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors"
              >
                <FiSave size={20} />
                Save Changes
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Edit User
              </button>
              <button
                onClick={() => setDeleteProfileModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
              >
                <FiTrash2 size={20} />
                {formData.isActive === false ? 'Delete permanently' : 'Deactivate'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">Personal Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Phone Number</label>
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
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-muted/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  required
                  placeholder="Enter email address"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-muted/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-muted/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Last Name</label>
                <input
                  name="lastName"
                  type="text"
                  value={formData.lastName ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-muted/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Date of Birth</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth ? formData.dateOfBirth.slice(0, 10) : ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-muted/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Age</label>
                <input
                  type="number"
                  value={formData.age ?? ''}
                  disabled
                  className="w-full px-4 py-2 border border-border rounded-lg bg-muted/50 text-muted-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Gender</label>
                <select
                  name="gender"
                  value={formData.gender ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-muted/50"
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
                <label className="block text-sm font-medium text-foreground mb-2">Languages Known</label>
                <div className="rounded-xl border border-border bg-muted/50 p-3">
                  <p className="mb-3 text-xs text-muted-foreground">
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
                          className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                              : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary'
                          } disabled:cursor-not-allowed disabled:opacity-70`}
                        >
                          {language}
                        </button>
                      );
                    })}
                  </div>

                  {(formData.languagesKnown ?? []).includes(OTHER_LANGUAGE_VALUE) && (
                    <div className="mt-3">
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Other language(s)</label>
                      <input
                        type="text"
                        value={customOtherLanguage}
                        onChange={(e) => setCustomOtherLanguage(e.target.value)}
                        disabled={!isEditing}
                        placeholder="Example: French or French, Spanish"
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-muted/50"
                      />
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected</span>
                    {getLanguagesForSave(formData.languagesKnown ?? []).length > 0 ? (
                      getLanguagesForSave(formData.languagesKnown ?? []).map((language) => (
                        <button
                          key={language}
                          type="button"
                          onClick={() => removeLanguage(language)}
                          disabled={!isEditing}
                          className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-1 text-xs font-medium text-foreground ring-1 ring-border hover:bg-accent disabled:cursor-not-allowed disabled:opacity-70"
                          title={`Remove ${language}`}
                          aria-label={`Remove ${language}`}
                        >
                          {language}
                          <FiX size={12} />
                        </button>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No languages selected yet</span>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Click selected chips to remove them.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Profile Photo</label>
                {formData.profilePhoto ? (
                  <div className="overflow-hidden rounded-lg border border-border bg-muted/50">
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
                  <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 text-sm text-muted-foreground">
                    No profile photo available
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Age</label>
                <input
                  type="number"
                  name="age"
                  value={formData.age ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-muted/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Profile Photo URL</label>
                <input
                  type="text"
                  name="profilePhoto"
                  value={formData.profilePhoto ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-muted/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Landmark</label>
                <input
                  type="text"
                  name="landmark"
                  value={formData.landmark ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-muted/50"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground mb-2">Bio</label>
              <textarea
                name="bio"
                value={formData.bio ?? ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                rows={4}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-muted/50"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground mb-2">Location</label>
              <input
                type="text"
                name="location"
                value={formData.location ?? ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-muted/50"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Province</label>
                <input
                  type="text"
                  name="province"
                  value={formData.province ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-muted/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">District</label>
                <input
                  type="text"
                  name="district"
                  value={formData.district ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-muted/50"
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
                className="w-4 h-4 rounded border-border"
              />
              <label className="ml-3 text-sm font-medium text-foreground">Make profile public</label>
            </div>
          </div>

<<<<<<< HEAD
=======
          {(formData.userBadges ?? []).length > 0 && (
            <div className="mt-6 bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Awarded Badges ({formData.badgeCount ?? 0})</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                {formData.userBadges!.map((badge) => (
                  <div key={badge._id} className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    {badge.iconUrl && (
                      <Image
                        src={badge.iconUrl}
                        alt={badge.name || 'Badge'}
                        width={64}
                        height={64}
                        className="h-16 w-16 rounded-full"
                        unoptimized
                      />
                    )}
                    <div className="text-center">
                      <p className="font-medium text-slate-900">{badge.name || 'Unknown Badge'}</p>
                      <p className="text-xs text-slate-600">{badge.tier}</p>
                      {badge.description && (
                        <p className="mt-1 text-xs text-slate-500">{badge.description}</p>
                      )}
                      {badge.unlockedAt && (
                        <p className="mt-2 text-xs text-slate-500">
                          Unlocked: {new Date(badge.unlockedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 bg-white rounded-lg border border-slate-200 p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">XP History Manager</h2>
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                  Rank resets at level-up
                </span>
              </div>
              <button
                type="button"
                onClick={openAddXpModal}
                className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Add XP
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Admins can add XP to users (capped at 500 per action). Auto-rank-up will occur when user reaches level threshold and completes all rank-up achievements.
            </p>

            {(formData.xpHistory ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No XP history entries found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-600">
                      <th className="px-3 py-2">Awarded At</th>
                      <th className="px-3 py-2">Event</th>
                      <th className="px-3 py-2">Rule</th>
                      <th className="px-3 py-2">Points</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(formData.xpHistory ?? [])]
                      .sort((a, b) => {
                        return new Date(b.awardedAt ?? 0).getTime() - new Date(a.awardedAt ?? 0).getTime();
                      })
                      .slice(0, 50)
                      .map((entry) => {
                        const historyId = entry._id ?? '';
                        const isEditingRow = editingHistoryId === historyId;

                        return (
                          <tr key={historyId || `${entry.contextKey ?? 'ctx'}-${entry.awardedAt ?? Date.now()}`} className="border-b border-slate-100 align-top">
                            <td className="px-3 py-2 text-slate-700">
                              {entry.awardedAt ? new Date(entry.awardedAt).toLocaleString() : 'N/A'}
                            </td>
                            <td className="px-3 py-2 text-slate-700">{entry.eventKey ?? '-'}</td>
                            <td className="px-3 py-2 text-slate-700">{entry.ruleName ?? entry.ruleCode ?? '-'}</td>
                            <td className="px-3 py-2 text-slate-700">
                              {isEditingRow ? (
                                <input
                                  type="number"
                                  min={0}
                                  value={editingHistoryPoints}
                                  onChange={(event) => setEditingHistoryPoints(event.target.value)}
                                  className="w-24 rounded-md border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              ) : (
                                Math.max(0, Math.floor(Number(entry.points ?? 0)))
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {!historyId ? (
                                <span className="text-xs text-slate-400">Entry ID unavailable</span>
                              ) : isEditingRow ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={requestSaveXpHistoryEdit}
                                    disabled={savingHistoryId === historyId}
                                    className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                                  >
                                    {savingHistoryId === historyId ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelXpHistoryEdit}
                                    className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500">View only - use "Add XP" button above</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
>>>>>>> e09d3789ef38baf838053502fd4c44d5b127d5a4
        </div>

        {/* Sidebar */}
        <div>
<<<<<<< HEAD
=======
          {/* Stats Card */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Account Stats</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total XP</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {Number(formData.totalXp ?? formData.xp ?? 0).toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Current Rank XP: {Number(formData.xp ?? 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Level</p>
                <p className="text-lg font-semibold text-slate-900 mt-1">{effectiveLevel}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Rank</p>
                <p className="text-lg font-semibold text-slate-900 mt-1">
                  {formatRankLabel(formData.experienceLevel, effectiveLevel)}
                </p>
                <p className="text-xs text-slate-500">{getRankTier(effectiveLevel).name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sub-Rank</p>
                <p className="text-lg font-semibold text-blue-700 mt-1">
                  {formData.subRank ?? getSubRank(effectiveLevel)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {getSubRankBands(effectiveLevel).map((band) => `${band.name} (${band.fromLevel}-${band.toLevel})`).join(' • ')}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Current Rank Band</p>
                <p className="text-sm font-semibold text-slate-900 mt-1">
                  Levels {getRankTier(effectiveLevel).minLevel}-{getRankTier(effectiveLevel).maxLevel}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Current Rank Badge</p>
                {formData.currentRankBadge?.imageUrl ? (
                  <div className="mt-2 flex items-center gap-2">
                    <Image
                      src={formData.currentRankBadge.imageUrl}
                      alt={formData.currentRankBadge.name || 'Rank badge'}
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-lg border border-slate-200"
                      unoptimized
                    />
                    <div>
                      <p className="font-medium text-slate-900">{formData.currentRankBadge.name || 'Unlocked Badge'}</p>
                      <p className="text-xs text-slate-500">{formData.currentRankBadge.rankCode}</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">No rank badge yet</p>
                )}
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

          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Next Target Progress</h3>
            {rankProgress.hasNextTarget ? (
              <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sub-Rank Progress</p>
                    <p className="mt-1 text-sm text-slate-700">
                      {rankProgress.currentRankXp.toLocaleString()} XP in this rank
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Rank XP is band-based and resets on rank-up; Total XP never resets.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      Next: {rankProgress.targetLabel}
                    </p>
                    <p className="text-xs text-slate-500">{rankProgress.targetSubtitle}</p>
                    <p className="text-xs text-slate-500">
                      {rankProgress.totalRemainingXp.toLocaleString()} XP remaining
                    </p>
                  </div>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-emerald-500 via-cyan-500 to-blue-500 transition-all duration-500"
                    style={{ width: `${Math.max(0, Math.min(100, rankProgress.progressPercentage))}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
                This user is currently at the highest sub-rank.
              </p>
            )}
            {rankProgress.hasNextTarget ? (
              <div className="space-y-3 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Next Target</span>
                  <span className="font-semibold text-slate-900">{rankProgress.targetLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500">XP Remaining</span>
                  <span className="font-semibold text-slate-900">{rankProgress.totalRemainingXp}</span>
                </div>
                {formData.nextRankProgress?.remainingAchievements
                && Object.keys(formData.nextRankProgress.remainingAchievements).length > 0
                && rankProgress.totalRemainingXp === 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Remaining Achievements</p>
                    <div className="space-y-1">
                      {Object.entries(formData.nextRankProgress.remainingAchievements).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                          <span className="capitalize text-slate-600">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <span className="font-semibold text-slate-900">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500">Progress updates automatically for sub-rank, then rank promotion.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No further sub-rank progression available.</p>
            )}
          </div>

>>>>>>> e09d3789ef38baf838053502fd4c44d5b127d5a4
          {/* Info Card */}
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold">User ID:</span> {userId}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              <span className="font-semibold">Created:</span> {formData.createdAt ? new Date(formData.createdAt).toLocaleString() : 'N/A'}
            </p>
          </div>

          <div className="mt-6 rounded-lg border border-border bg-card p-4">
            <h4 className="text-sm font-semibold text-foreground">Photo Verification Requests</h4>
            <div className="mt-3 space-y-3">
              {(formData.photoVerificationRequests ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">No photo verification requests.</p>
              )}

              {(formData.photoVerificationRequests ?? []).map((request) => (
                <div key={request.requestCode} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">{request.requestCode}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        request.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : request.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {request.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Campaign: {request.campaignId}</p>
                  <p className="text-xs text-muted-foreground">Kind: {request.kind}</p>
                  <a
                    href={request.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-primary underline"
                  >
                    Open photo
                  </a>

                  {request.status === 'pending' && (
                    <div className="mt-3 space-y-2">
                      <input
                        type="text"
                        value={reviewNoteByCode[request.requestCode] ?? ''}
                        onChange={(event) =>
                          setReviewNoteByCode((current) => ({
                            ...current,
                            [request.requestCode]: event.target.value,
                          }))
                        }
                        placeholder="Optional review note"
                        className="w-full rounded-md border border-border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleReviewPhotoRequest(request.requestCode, 'approved')}
                          disabled={reviewingCode === request.requestCode}
                          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/90 disabled:opacity-60"
                        >
                          <FiCheck size={12} />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleReviewPhotoRequest(request.requestCode, 'rejected')}
                          disabled={reviewingCode === request.requestCode}
                          className="rounded-full bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {request.reviewNote && (
                    <p className="mt-2 text-xs text-muted-foreground">Note: {request.reviewNote}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={deleteProfileModalOpen}
        title={formData.isActive === false ? 'Permanently delete user?' : 'Deactivate user?'}
        description={formData.isActive === false
          ? 'This is the second deletion step. The profile and linked authentication account will be permanently deleted. This cannot be undone.'
          : 'The user will be marked inactive, signed out, and prevented from signing in. Their data will remain available for later permanent deletion.'}
        confirmLabel={formData.isActive === false ? 'Delete permanently' : 'Deactivate user'}
        cancelLabel="Cancel"
        intent="danger"
        isProcessing={deletingProfile}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          if (!deletingProfile) {
            setDeleteProfileModalOpen(false);
          }
        }}
      />

    </div>
  );
}

