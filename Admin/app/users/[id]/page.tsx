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

const RANK_TIERS = [
  { code: 'E', name: 'Novice Wanderer', minLevel: 1, maxLevel: 10, subRanks: ['Spark', 'Path', 'Rise'] },
  { code: 'D', name: 'Trail Hunter', minLevel: 11, maxLevel: 20, subRanks: ['Track', 'Hunt', 'Stalk'] },
  { code: 'C', name: 'Ridge Slayer', minLevel: 21, maxLevel: 30, subRanks: ['Edge', 'Strike', 'Slay'] },
  { code: 'B', name: 'Summit Conqueror', minLevel: 31, maxLevel: 40, subRanks: ['Climb', 'Break', 'Conquer'] },
  { code: 'A', name: 'Himalayan Elite', minLevel: 41, maxLevel: 50, subRanks: ['Frost', 'Storm', 'Crown'] },
  { code: 'S', name: 'Peak Sovereign', minLevel: 51, maxLevel: 60, subRanks: ['Cloud', 'Thunder', 'Sovereign'] },
  { code: 'SS', name: 'Everest Legend', minLevel: 61, maxLevel: 70, subRanks: ['Myth', 'Legend', 'Eternal'] },
  { code: 'SSS', name: 'Nepal Hike God', minLevel: 71, maxLevel: 85, subRanks: ['Divine', 'Ascend', 'God'] },
  { code: '???', name: 'Himalayan Deity', minLevel: 86, maxLevel: 99, subRanks: ['Awakened', 'Transcendent', 'Infinite'], hidden: true },
  { code: 'Ultimate', name: 'Nepal Conqueror', minLevel: 100, maxLevel: 100, subRanks: ['Mythic', 'Eternal', 'Supreme'] },
] as const;

function getRankTier(level?: number | null) {
  const safeLevel = Math.max(1, Math.floor(Number(level ?? 1)));

  return RANK_TIERS.find((tier) => safeLevel >= tier.minLevel && safeLevel <= tier.maxLevel) ?? RANK_TIERS[0];
}

function getSubRank(level?: number | null) {
  const safeLevel = Math.max(1, Math.floor(Number(level ?? 1)));
  const tier = getRankTier(safeLevel);

  if (tier.minLevel === tier.maxLevel) {
    return tier.subRanks[tier.subRanks.length - 1];
  }

  const span = Math.max(1, tier.maxLevel - tier.minLevel + 1);
  const progress = Math.min(0.999, Math.max(0, (safeLevel - tier.minLevel) / span));
  const index = Math.min(tier.subRanks.length - 1, Math.floor(progress * tier.subRanks.length));

  return tier.subRanks[index];
}

function normalizeRankCode(value?: string | null) {
  const raw = String(value ?? '').trim().toUpperCase();

  if (!raw) {
    return '';
  }

  const inParens = raw.match(/\(([A-Z]{1,3})\)/);
  const candidate = inParens?.[1] ?? raw;
  const supported = new Set(['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'MYTHIC']);

  if (supported.has(candidate)) {
    return candidate === 'MYTHIC' ? 'Mythic' : candidate;
  }

  if (candidate.includes('NOVICE')) return 'E';
  if (candidate.includes('TRAIL')) return 'D';
  if (candidate.includes('RIDGE')) return 'C';
  if (candidate.includes('SUMMIT')) return 'B';
  if (candidate.includes('ELITE')) return 'A';
  if (candidate.includes('SOVEREIGN')) return 'S';
  if (candidate.includes('EVEREST')) return 'SS';
  if (candidate.includes('GOD')) return 'SSS';
  if (candidate.includes('DEITY') || candidate.includes('ULTIMATE')) return 'Mythic';

  return '';
}

function formatRankLabel(rank?: string | null, fallbackLevel?: number | null) {
  const normalized = normalizeRankCode(rank) || getRankTier(fallbackLevel).code;
  const tier = RANK_TIERS.find((item) => item.code === normalized);

  if (!tier) {
    return normalized;
  }

  return `${tier.name} (${tier.code})`;
}

function getSubRankBands(level?: number | null) {
  const tier = getRankTier(level);
  const levelSpan = Math.max(1, tier.maxLevel - tier.minLevel + 1);

  return tier.subRanks.map((name, index) => {
    const fromOffset = Math.floor((index * levelSpan) / tier.subRanks.length);
    const toOffset = Math.floor(((index + 1) * levelSpan) / tier.subRanks.length) - 1;
    const fromLevel = tier.minLevel + fromOffset;
    const toLevel = Math.min(tier.maxLevel, tier.minLevel + Math.max(fromOffset, toOffset));

    return {
      name,
      fromLevel,
      toLevel,
    };
  });
}

function getNextSubRankTarget(level: number, totalXp: number) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  const tier = getRankTier(safeLevel);
  const bands = getSubRankBands(safeLevel);
  const currentIndex = bands.findIndex((band) => safeLevel >= band.fromLevel && safeLevel <= band.toLevel);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const currentBand = bands[safeIndex];

  if (safeIndex < bands.length - 1) {
    const nextBand = bands[safeIndex + 1];
    const startXp = getXpThresholdForLevel(currentBand.fromLevel);
    const targetXp = getXpThresholdForLevel(nextBand.fromLevel);
    const spanXp = Math.max(1, targetXp - startXp);
    const earnedXp = Math.max(0, totalXp - startXp);

    return {
      hasNextTarget: true,
      targetLabel: nextBand.name,
      targetSubtitle: `Next sub-rank in ${tier.name} (${tier.code})`,
      currentRankXp: Math.min(spanXp, earnedXp),
      totalRemainingXp: Math.max(0, targetXp - totalXp),
      progressPercentage: Math.max(0, Math.min(100, Math.round((earnedXp / spanXp) * 100))),
    };
  }

  const nextTier = RANK_TIERS.find((item) => item.minLevel === tier.maxLevel + 1);

  if (nextTier) {
    const startXp = getXpThresholdForLevel(currentBand.fromLevel);
    const targetXp = getXpThresholdForLevel(nextTier.minLevel);
    const spanXp = Math.max(1, targetXp - startXp);
    const earnedXp = Math.max(0, totalXp - startXp);

    return {
      hasNextTarget: true,
      targetLabel: `${nextTier.name} (${nextTier.code}) * ${nextTier.subRanks[0]}`,
      targetSubtitle: 'Next rank promotion target',
      currentRankXp: Math.min(spanXp, earnedXp),
      totalRemainingXp: Math.max(0, targetXp - totalXp),
      progressPercentage: Math.max(0, Math.min(100, Math.round((earnedXp / spanXp) * 100))),
    };
  }

  return {
    hasNextTarget: false,
    targetLabel: 'Max Sub-Rank',
    targetSubtitle: 'Highest progression reached',
    currentRankXp: 0,
    totalRemainingXp: 0,
    progressPercentage: 100,
  };
}

function getXpThresholdForLevel(level: number) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));

  if (safeLevel <= 1) {
    return 0;
  }

  let requiredXp = 0;

  for (let step = 2; step <= safeLevel; step += 1) {
    requiredXp += 80 + (step - 2) * 35;
  }

  return requiredXp;
}

function getLevelFromTotalXp(totalXp: number) {
  const safeXp = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 1;

  for (let nextLevel = 2; nextLevel <= 100; nextLevel += 1) {
    if (safeXp >= getXpThresholdForLevel(nextLevel)) {
      level = nextLevel;
    } else {
      break;
    }
  }

  return level;
}

function getEffectiveLevel(profile: Profile | null) {
  const totalXp = Math.max(0, Math.floor(Number(profile?.totalXp ?? profile?.xp ?? 0)));
  const calculatedLevel = getLevelFromTotalXp(totalXp);
  const persistedLevel = Math.max(1, Math.floor(Number(profile?.level ?? 1)));
  return Math.max(calculatedLevel, persistedLevel);
}

function getRankProgress(profile: Profile | null) {
  const level = getEffectiveLevel(profile);
  const totalXp = Math.max(0, Math.floor(Number(profile?.totalXp ?? profile?.xp ?? 0)));
  return getNextSubRankTarget(level, totalXp);
}

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
  totalXp?: number;
  level?: number;
  subRank?: string | null;
  badge?: string;
  isProfilePublic?: boolean;
  profileCompleted?: boolean;
  createdAt?: string;
  nextRankProgress?: {
    nextRank?: string;
    requiredXp?: number;
    remainingXp?: number;
    currentXp?: number;
    currentRankRequiredXp?: number;
    currentRankXp?: number;
    xpToNextRank?: number;
    progressPercentage?: number;
    requiredAchievements?: Record<string, number>;
    remainingAchievements?: Record<string, number>;
    nextRankHidden?: boolean;
  } | null;
  achievementProgress?: Array<{
    key: string;
    title?: string;
    rewardXp?: number;
    completedAt?: string;
  }>;
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
  const [achievementPopup, setAchievementPopup] = useState<{
    items: Array<{ key: string; title: string; rewardXp: number }>;
    totalRewardXp: number;
  } | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [editingHistoryPoints, setEditingHistoryPoints] = useState('0');
  const [savingHistoryId, setSavingHistoryId] = useState<string | null>(null);
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null);
  const [xpActionReason, setXpActionReason] = useState('');
  const [xpActionModal, setXpActionModal] = useState<{
    mode: 'edit' | 'delete' | 'add';
    historyId?: string;
  } | null>(null);
  const [xpActionProcessing, setXpActionProcessing] = useState(false);
  const [xpToAddAmount, setXpToAddAmount] = useState('');
  const effectiveLevel = getEffectiveLevel(formData);
  const rankProgress = getRankProgress(formData);

  function getCompletionToken(entry: { key: string; completedAt?: string }) {
    return `${entry.key}::${entry.completedAt ?? ''}`;
  }

  function maybeShowAchievementPopup(profile: Profile) {
    if (typeof window === 'undefined') {
      return;
    }

    const completedEntries = (profile.achievementProgress ?? []).filter(
      (entry) => Boolean(entry.completedAt),
    );

    if (completedEntries.length === 0) {
      return;
    }

    const storageKey = `admin_seen_achievement_completion_ids_${profile._id}`;
    const seenTokens = new Set<string>();

    try {
      const persisted = window.sessionStorage.getItem(storageKey);

      if (persisted) {
        const parsed = JSON.parse(persisted) as unknown;

        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            seenTokens.add(String(item));
          });
        }
      }
    } catch {
      // Ignore malformed session data.
    }

    const newlyCompleted = completedEntries.filter((entry) => {
      const token = getCompletionToken(entry);
      return token.length > 2 && !seenTokens.has(token);
    });

    if (newlyCompleted.length === 0) {
      return;
    }

    newlyCompleted.forEach((entry) => {
      seenTokens.add(getCompletionToken(entry));
    });

    window.sessionStorage.setItem(storageKey, JSON.stringify(Array.from(seenTokens)));

    const popupItems = newlyCompleted.map((entry) => ({
      key: entry.key,
      title: entry.title?.trim() || entry.key,
      rewardXp: Math.max(0, Math.floor(Number(entry.rewardXp ?? 0))),
    }));

    setAchievementPopup({
      items: popupItems,
      totalRewardXp: popupItems.reduce((total, item) => total + item.rewardXp, 0),
    });
  }

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

      maybeShowAchievementPopup(profile);
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
      const response = await apiClient.patch(
        `/user/admin/profiles/${userId}/photos/verification-requests/${requestCode}`,
        {
          status,
          reviewNote: reviewNoteByCode[requestCode]?.trim() || undefined,
        },
      );

      const xpAwarded = Number((response.data as { xp?: { totalAwarded?: number } })?.xp?.totalAwarded ?? 0);

      if (status === 'approved') {
        setSuccess(
          xpAwarded > 0
            ? `Photo approved. +${xpAwarded} XP added to the user profile.`
            : 'Photo approved.',
        );
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

  function startXpHistoryEdit(entry: NonNullable<Profile['xpHistory']>[number]) {
    if (!entry._id) {
      return;
    }

    setEditingHistoryId(entry._id);
    setEditingHistoryPoints(String(Math.max(0, Math.floor(Number(entry.points ?? 0)))));
  }

  function cancelXpHistoryEdit() {
    setEditingHistoryId(null);
    setEditingHistoryPoints('0');
  }

  function closeXpActionModal() {
    setXpActionModal(null);
    setXpActionReason('');
    setXpToAddAmount('');
  }

  function openAddXpModal() {
    setXpToAddAmount('');
    setXpActionReason('');
    setXpActionModal({
      mode: 'add',
    });
  }

  function requestSaveXpHistoryEdit() {
    if (!editingHistoryId) {
      return;
    }

    setXpActionModal({
      mode: 'edit',
      historyId: editingHistoryId,
    });
  }

  function requestDeleteXpHistoryEntry(historyId: string) {
    setXpActionModal({
      mode: 'delete',
      historyId,
    });
  }

  async function saveXpHistoryEdit() {
    if (!userId || !editingHistoryId) {
      return;
    }

    const points = Math.max(0, Math.floor(Number(editingHistoryPoints)));

    if (!Number.isFinite(points)) {
      setError('XP points must be a valid non-negative number.');
      return;
    }

    setSavingHistoryId(editingHistoryId);
    setXpActionProcessing(true);
    setError('');
    setSuccess('');

    try {
      await apiClient.patch(
        `/user/admin/profiles/${userId}/xp/history/${editingHistoryId}`,
        {
          points,
          reason: xpActionReason.trim(),
        },
      );

      setSuccess('XP history entry updated successfully.');
      cancelXpHistoryEdit();
      closeXpActionModal();
      await loadProfile();
    } catch {
      setError('Failed to update XP history entry.');
    } finally {
      setSavingHistoryId(null);
      setXpActionProcessing(false);
    }
  }

  async function deleteXpHistoryEntry(historyId: string) {
    if (!userId) {
      return;
    }

    setDeletingHistoryId(historyId);
    setXpActionProcessing(true);
    setError('');
    setSuccess('');

    try {
      await apiClient.delete(`/user/admin/profiles/${userId}/xp/history/${historyId}`, {
        data: {
          reason: xpActionReason.trim(),
        },
      });
      setSuccess('XP history entry deleted successfully.');

      if (editingHistoryId === historyId) {
        cancelXpHistoryEdit();
      }

      closeXpActionModal();
      await loadProfile();
    } catch {
      setError('Failed to delete XP history entry.');
    } finally {
      setDeletingHistoryId(null);
      setXpActionProcessing(false);
    }
  }

  async function confirmXpAction() {
    if (!xpActionModal) {
      return;
    }

    if (xpActionModal.mode === 'add') {
      await addXpToUser();
      return;
    }

    if (!xpActionReason.trim()) {
      setError('Reason is required for XP admin actions.');
      return;
    }

    if (xpActionModal.mode === 'edit') {
      await saveXpHistoryEdit();
      return;
    }

    await deleteXpHistoryEntry(xpActionModal.historyId ?? '');
  }

  async function addXpToUser() {
    if (!userId) {
      return;
    }

    const xpAmount = Math.floor(Number(xpToAddAmount));

    if (!Number.isFinite(xpAmount) || xpAmount < 1 || xpAmount > 500) {
      setError('XP to add must be between 1 and 500');
      return;
    }

    if (!xpActionReason.trim()) {
      setError('Reason is required for XP addition');
      return;
    }

    if (xpActionReason.trim().length < 5) {
      setError('Reason must be at least 5 characters');
      return;
    }

    if (xpActionReason.trim().length > 500) {
      setError('Reason cannot exceed 500 characters');
      return;
    }

    setXpActionProcessing(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiClient.post(`/user/admin/profiles/${userId}/xp/add`, {
        xpToAdd: xpAmount,
        reason: xpActionReason.trim(),
      });

      const result = response.data as {
        message: string;
        newXp: number;
        newLevel: number;
        newRank: string;
        autoRankedUp: boolean;
        autoRankUpReason?: string;
      };

      const successMsg = result.autoRankedUp
        ? `[OK] ${result.message}\nUser auto-ranked up to ${result.newRank}!\n${result.autoRankUpReason ?? ''}`
        : `[OK] ${result.message}\nNew Rank XP: ${result.newXp}, Level: ${result.newLevel}, Rank: ${result.newRank}`;

      setSuccess(successMsg);
      closeXpActionModal();
      await loadProfile();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : (err as any)?.response?.data?.message || 'Failed to add XP to user';
      setError(`Failed to add XP to user: ${errorMsg}`);
      console.error('XP addition error:', err);
    } finally {
      setXpActionProcessing(false);
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
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      await apiClient.delete(`/user/admin/profiles/${userId}`);
      window.location.href = '/users';
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
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
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
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Experience Level</label>
                <select
                  name="experienceLevel"
                  value={formData.experienceLevel ?? ''}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-muted/50"
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

          <div className="mt-6 bg-card rounded-lg border border-border p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">XP History Manager</h2>
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                  Rank resets at level-up
                </span>
              </div>
              <button
                type="button"
                onClick={openAddXpModal}
                className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                Add XP
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Admins can add XP to users (capped at 500 per action). Auto-rank-up will occur when user reaches level threshold and completes all rank-up achievements.
            </p>

            {(formData.xpHistory ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No XP history entries found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
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
                          <tr key={historyId || `${entry.contextKey ?? 'ctx'}-${entry.awardedAt ?? Date.now()}`} className="border-b border-border/60 align-top">
                            <td className="px-3 py-2 text-foreground">
                              {entry.awardedAt ? new Date(entry.awardedAt).toLocaleString() : 'N/A'}
                            </td>
                            <td className="px-3 py-2 text-foreground">{entry.eventKey ?? '-'}</td>
                            <td className="px-3 py-2 text-foreground">{entry.ruleName ?? entry.ruleCode ?? '-'}</td>
                            <td className="px-3 py-2 text-foreground">
                              {isEditingRow ? (
                                <input
                                  type="number"
                                  min={0}
                                  value={editingHistoryPoints}
                                  onChange={(event) => setEditingHistoryPoints(event.target.value)}
                                  className="w-24 rounded-md border border-border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/40"
                                />
                              ) : (
                                Math.max(0, Math.floor(Number(entry.points ?? 0)))
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {!historyId ? (
                                <span className="text-xs text-muted-foreground">Entry ID unavailable</span>
                              ) : isEditingRow ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={requestSaveXpHistoryEdit}
                                    disabled={savingHistoryId === historyId}
                                    className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/90 disabled:opacity-60"
                                  >
                                    {savingHistoryId === historyId ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelXpHistoryEdit}
                                    className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-muted/50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">View only - use "Add XP" button above</span>
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
        </div>

        {/* Sidebar */}
        <div>
          {/* Stats Card */}
          <div className="bg-card rounded-lg border border-border p-6 mb-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Account Stats</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total XP</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {Number(formData.totalXp ?? formData.xp ?? 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Current Rank XP: {Number(formData.xp ?? 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Level</p>
                <p className="text-lg font-semibold text-foreground mt-1">{effectiveLevel}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rank</p>
                <p className="text-lg font-semibold text-foreground mt-1">
                  {formatRankLabel(formData.experienceLevel, effectiveLevel)}
                </p>
                <p className="text-xs text-muted-foreground">{getRankTier(effectiveLevel).name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sub-Rank</p>
                <p className="text-lg font-semibold text-primary mt-1">
                  {formData.subRank ?? getSubRank(effectiveLevel)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {getSubRankBands(effectiveLevel).map((band) => `${band.name} (${band.fromLevel}-${band.toLevel})`).join(' * ')}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current Rank Band</p>
                <p className="text-sm font-semibold text-foreground mt-1">
                  Levels {getRankTier(effectiveLevel).minLevel}-{getRankTier(effectiveLevel).maxLevel}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Badge</p>
                <p className="text-lg font-semibold text-tertiary mt-1">{formData.badge || 'No badge'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Profile Status</p>
                <div className="mt-1">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    formData.profileCompleted
                      ? 'bg-secondary/15 text-secondary'
                      : 'bg-primary/15 text-primary'
                  }`}>
                    {formData.profileCompleted ? 'Complete' : 'Incomplete'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border p-6 mb-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Next Target Progress</h3>
            {rankProgress.hasNextTarget ? (
              <div className="mb-4 rounded-2xl border border-border bg-muted/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sub-Rank Progress</p>
                    <p className="mt-1 text-sm text-foreground">
                      {rankProgress.currentRankXp.toLocaleString()} XP in this rank
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Rank XP is band-based and resets on rank-up; Total XP never resets.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">
                      Next: {rankProgress.targetLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">{rankProgress.targetSubtitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {rankProgress.totalRemainingXp.toLocaleString()} XP remaining
                    </p>
                  </div>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-secondary via-tertiary to-primary transition-all duration-500"
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
              <div className="space-y-3 text-sm text-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Next Target</span>
                  <span className="font-semibold text-foreground">{rankProgress.targetLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">XP Remaining</span>
                  <span className="font-semibold text-foreground">{rankProgress.totalRemainingXp}</span>
                </div>
                {formData.nextRankProgress?.remainingAchievements
                && Object.keys(formData.nextRankProgress.remainingAchievements).length > 0
                && rankProgress.totalRemainingXp === 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Remaining Achievements</p>
                    <div className="space-y-1">
                      {Object.entries(formData.nextRankProgress.remainingAchievements).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                          <span className="capitalize text-muted-foreground">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <span className="font-semibold text-foreground">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Progress updates automatically for sub-rank, then rank promotion.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No further sub-rank progression available.</p>
            )}
          </div>

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

      {achievementPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-foreground">Achievement Unlocked</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              The user completed {achievementPopup.items.length} achievement{achievementPopup.items.length > 1 ? 's' : ''}.
            </p>
            {achievementPopup.totalRewardXp > 0 && (
              <p className="mt-1 text-sm font-medium text-emerald-700">
                +{achievementPopup.totalRewardXp} XP added from achievement rewards.
              </p>
            )}

            <div className="mt-4 space-y-2">
              {achievementPopup.items.map((item) => (
                <div key={item.key} className="rounded-lg border border-border px-3 py-2">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.rewardXp > 0 ? `Reward: +${item.rewardXp} XP` : 'No XP reward configured'}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setAchievementPopup(null)}
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(xpActionModal) && xpActionModal?.mode !== 'add'}
        title={xpActionModal?.mode === 'edit' ? 'Confirm XP Update' : 'Confirm XP Deletion'}
        description={xpActionModal?.mode === 'edit'
          ? 'Provide a reason and confirm to update this XP history entry.'
          : 'Provide a reason and confirm to delete this XP history entry. This will recalculate XP progression.'}
        confirmLabel={xpActionModal?.mode === 'edit' ? 'Confirm Update' : 'Confirm Delete'}
        cancelLabel="Cancel"
        isProcessing={xpActionProcessing}
        requireReason
        reasonLabel="Reason (required)"
        reasonPlaceholder="Enter why this admin action is needed"
        reasonValue={xpActionReason}
        onReasonChange={setXpActionReason}
        onConfirm={() => void confirmXpAction()}
        onCancel={closeXpActionModal}
      />

      {/* Add XP Modal */}
      {xpActionModal?.mode === 'add' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-foreground mb-4">Add XP to User</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                Current XP: <span className="font-semibold text-primary">{formData.xp}</span>
              </label>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                XP to Add <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={xpToAddAmount}
                onChange={(e) => setXpToAddAmount(e.target.value)}
                placeholder="Enter amount (1-500)"
                className="w-full rounded-lg border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="text-xs text-muted-foreground mt-1">Maximum 500 XP per action</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground mb-2">
                Reason <span className="text-red-600">*</span>
              </label>
              <textarea
                value={xpActionReason}
                onChange={(e) => setXpActionReason(e.target.value)}
                placeholder="Enter reason for adding XP (e.g., 'Manual correction for completed activity')"
                rows={3}
                className="w-full rounded-lg border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeXpActionModal}
                disabled={xpActionProcessing}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmXpAction()}
                disabled={xpActionProcessing}
                className="flex-1 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {xpActionProcessing ? 'Adding XP...' : 'Add XP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

