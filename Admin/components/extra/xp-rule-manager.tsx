'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';
import {
  createExtra,
  deleteExtra,
  ExtraItem,
  fetchExtras,
  updateExtra,
} from '@/lib/extras';

type RuleRepeatMode =
  | 'always'
  | 'once_per_user'
  | 'once_per_campaign'
  | 'once_per_district'
  | 'once_per_difficulty'
  | 'once_per_referred_user';

type RuleType = 'activity' | 'location' | 'global' | 'social';

type DifficultyKey = 'easy' | 'moderate' | 'hard' | 'extreme';

type RuleConditions = {
  difficulty?: string;
  district?: string;
  locationKey?: string;
  activityType?: string;
  ratingGte?: number;
  solo?: boolean;
  hostOnly?: boolean;
  hiddenGem?: boolean;
  rareRoute?: boolean;
};

type RuleValuePayload = {
  eventKey: string;
  baseXp: number;
  overrideXp?: number;
  bonusXp?: number;
  socialBonusXp?: number;
  ruleType: RuleType;
  activityType?: string;
  locationKey?: string;
  overrideEnabled?: boolean;
  repeatPenaltyEnabled?: boolean;
  difficultyMultipliers?: Partial<Record<DifficultyKey, number>>;
  explorationBonuses?: {
    firstVisit?: number;
    newDistrict?: number;
    hiddenGem?: number;
    rareRoute?: number;
  };
  repeat: RuleRepeatMode;
  conditions?: RuleConditions;
};

type RuleFormState = {
  name: string;
  description: string;
  eventKey: string;
  ruleType: RuleType;
  activityType: string;
  locationKey: string;
  baseXp: string;
  overrideEnabled: boolean;
  overrideXp: string;
  repeat: RuleRepeatMode;
  repeatPenaltyEnabled: boolean;
  bonusXp: string;
  socialBonusXp: string;
  difficultyEasy: string;
  difficultyModerate: string;
  difficultyHard: string;
  difficultyExtreme: string;
  bonusFirstVisit: string;
  bonusNewDistrict: string;
  bonusHiddenGem: string;
  bonusRareRoute: string;
  difficultyCondition: string;
  districtCondition: string;
  ratingGte: string;
  soloOnly: boolean;
  hostOnly: boolean;
  hiddenGemOnly: boolean;
  rareRouteOnly: boolean;
  enabled: boolean;
};

type XpSimulationResult = {
  eventKey: string;
  totalAwarded: number;
  currentXp?: number;
  appliedRules: Array<{
    ruleCode: string;
    ruleName: string;
    points: number;
    breakdown?: {
      baseXp: number;
      source: string;
      difficultyMultiplier: number;
      difficultyComponent: number;
      explorationBonus: number;
      socialBonus: number;
      repeatMultiplier: number;
      repeatPenalty: number;
      beforePenalty: number;
      finalXp: number;
      repeatCountForLocation: number;
    };
  }>;
};

const eventPresets = [
  { key: 'campaign_completed', label: 'Campaign completed (participant)' },
  { key: 'host_campaign_completed', label: 'Hosted campaign completed' },
  { key: 'group_photo_uploaded', label: 'Group photo uploaded' },
  { key: 'solo_photo_uploaded', label: 'Solo photo uploaded' },
  { key: 'first_solo_trek', label: 'First solo trek' },
  { key: 'first_trek_new_district', label: 'First trek in new district' },
  { key: 'received_five_star_rating', label: 'Received 5-star rating' },
  { key: 'referral_completed_trek', label: 'Referral completed trek' },
  { key: 'campaign_created', label: 'Campaign created' },
];

const activityPresets = [
  { key: 'hike', label: 'Hike' },
  { key: 'trek', label: 'Trek' },
  { key: 'temple', label: 'Temple / Heritage' },
  { key: 'adventure', label: 'Nature Adventure' },
  { key: 'hidden_gem', label: 'Hidden Gem Discovery' },
];

const defaultFormState: RuleFormState = {
  name: '',
  description: '',
  eventKey: 'campaign_completed',
  ruleType: 'activity',
  activityType: 'trek',
  locationKey: '',
  baseXp: '100',
  overrideEnabled: false,
  overrideXp: '0',
  repeat: 'once_per_campaign',
  repeatPenaltyEnabled: true,
  bonusXp: '0',
  socialBonusXp: '0',
  difficultyEasy: '1',
  difficultyModerate: '1.2',
  difficultyHard: '1.8',
  difficultyExtreme: '2.4',
  bonusFirstVisit: '150',
  bonusNewDistrict: '250',
  bonusHiddenGem: '300',
  bonusRareRoute: '400',
  difficultyCondition: '',
  districtCondition: '',
  ratingGte: '',
  soloOnly: false,
  hostOnly: false,
  hiddenGemOnly: false,
  rareRouteOnly: false,
  enabled: true,
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function safeNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseRuleValue(rawValue?: string | null): RuleValuePayload | null {
  if (!rawValue?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<RuleValuePayload & { points?: number }>;

    if (!parsed.eventKey || parsed.repeat === undefined) {
      return null;
    }

    const baseXp = Number(parsed.baseXp ?? parsed.points ?? 0);
    if (!Number.isFinite(baseXp)) {
      return null;
    }

    return {
      eventKey: normalizeKey(parsed.eventKey),
      baseXp,
      repeat: parsed.repeat,
      ruleType: parsed.ruleType ?? 'global',
      ...(parsed.overrideXp !== undefined ? { overrideXp: Number(parsed.overrideXp) } : {}),
      ...(parsed.bonusXp !== undefined ? { bonusXp: Number(parsed.bonusXp) } : {}),
      ...(parsed.socialBonusXp !== undefined ? { socialBonusXp: Number(parsed.socialBonusXp) } : {}),
      ...(parsed.activityType ? { activityType: normalizeKey(parsed.activityType) } : {}),
      ...(parsed.locationKey ? { locationKey: normalizeKey(parsed.locationKey) } : {}),
      ...(parsed.overrideEnabled !== undefined ? { overrideEnabled: Boolean(parsed.overrideEnabled) } : {}),
      ...(parsed.repeatPenaltyEnabled !== undefined
        ? { repeatPenaltyEnabled: Boolean(parsed.repeatPenaltyEnabled) }
        : {}),
      ...(parsed.difficultyMultipliers ? { difficultyMultipliers: parsed.difficultyMultipliers } : {}),
      ...(parsed.explorationBonuses ? { explorationBonuses: parsed.explorationBonuses } : {}),
      ...(parsed.conditions ? { conditions: parsed.conditions } : {}),
    };
  } catch {
    const points = Number(rawValue);

    if (!Number.isFinite(points)) {
      return null;
    }

    return {
      eventKey: 'manual',
      baseXp: points,
      ruleType: 'global',
      repeat: 'always',
    };
  }
}

function buildRuleValue(form: RuleFormState) {
  const baseXp = safeNumber(form.baseXp, Number.NaN);

  if (!Number.isFinite(baseXp) || baseXp < 0) {
    throw new Error('Base XP must be a non-negative number.');
  }

  const eventKey = normalizeKey(form.eventKey);

  if (!eventKey) {
    throw new Error('Event key is required.');
  }

  const conditions: RuleConditions = {};

  if (form.difficultyCondition.trim()) {
    conditions.difficulty = normalizeKey(form.difficultyCondition);
  }

  if (form.districtCondition.trim()) {
    conditions.district = normalizeKey(form.districtCondition);
  }

  if (form.locationKey.trim()) {
    conditions.locationKey = normalizeKey(form.locationKey);
  }

  if (form.activityType.trim()) {
    conditions.activityType = normalizeKey(form.activityType);
  }

  if (form.ratingGte.trim()) {
    const ratingGte = Number(form.ratingGte);

    if (!Number.isFinite(ratingGte)) {
      throw new Error('Minimum rating must be a valid number.');
    }

    conditions.ratingGte = ratingGte;
  }

  if (form.soloOnly) {
    conditions.solo = true;
  }

  if (form.hostOnly) {
    conditions.hostOnly = true;
  }

  if (form.hiddenGemOnly) {
    conditions.hiddenGem = true;
  }

  if (form.rareRouteOnly) {
    conditions.rareRoute = true;
  }

  const payload: RuleValuePayload = {
    eventKey,
    ruleType: form.ruleType,
    baseXp: Math.floor(baseXp),
    repeat: form.repeat,
    repeatPenaltyEnabled: form.repeatPenaltyEnabled,
    overrideEnabled: form.overrideEnabled,
    difficultyMultipliers: {
      easy: safeNumber(form.difficultyEasy, 1),
      moderate: safeNumber(form.difficultyModerate, 1),
      hard: safeNumber(form.difficultyHard, 1),
      extreme: safeNumber(form.difficultyExtreme, 1),
    },
    explorationBonuses: {
      firstVisit: Math.floor(Math.max(0, safeNumber(form.bonusFirstVisit, 150))),
      newDistrict: Math.floor(Math.max(0, safeNumber(form.bonusNewDistrict, 250))),
      hiddenGem: Math.floor(Math.max(0, safeNumber(form.bonusHiddenGem, 300))),
      rareRoute: Math.floor(Math.max(0, safeNumber(form.bonusRareRoute, 400))),
    },
    bonusXp: Math.floor(Math.max(0, safeNumber(form.bonusXp, 0))),
    socialBonusXp: Math.floor(Math.max(0, safeNumber(form.socialBonusXp, 0))),
    ...(form.overrideEnabled
      ? { overrideXp: Math.floor(Math.max(0, safeNumber(form.overrideXp, 0))) }
      : {}),
    ...(form.activityType.trim() ? { activityType: normalizeKey(form.activityType) } : {}),
    ...(form.locationKey.trim() ? { locationKey: normalizeKey(form.locationKey) } : {}),
    ...(Object.keys(conditions).length > 0 ? { conditions } : {}),
  };

  return JSON.stringify(payload);
}

export function XpRuleManager() {
  const [items, setItems] = useState<ExtraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [form, setForm] = useState<RuleFormState>(defaultFormState);
  const [editId, setEditId] = useState<string | null>(null);

  const [simProfileId, setSimProfileId] = useState('');
  const [simEventKey, setSimEventKey] = useState('campaign_completed');
  const [simActivityType, setSimActivityType] = useState('trek');
  const [simDifficulty, setSimDifficulty] = useState('moderate');
  const [simDistrict, setSimDistrict] = useState('');
  const [simLocation, setSimLocation] = useState('');
  const [simHiddenGem, setSimHiddenGem] = useState(false);
  const [simRareRoute, setSimRareRoute] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<XpSimulationResult | null>(null);

  async function loadRules() {
    setLoading(true);
    setError('');

    try {
      const response = await fetchExtras('xp', { page: 1, limit: 300 });
      setItems(response.items);
    } catch {
      setError('Failed to load XP rules. Please verify backend API and admin session.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRules();
  }, []);

  const parsedRows = useMemo(() => {
    return items.map((item) => {
      const parsed = parseRuleValue(item.value);

      return {
        item,
        parsed,
      };
    });
  }, [items]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return parsedRows.filter(({ item, parsed }) => {
      if (eventFilter !== 'all' && parsed?.eventKey !== eventFilter) {
        return false;
      }

      if (statusFilter === 'enabled' && item.enabled === false) {
        return false;
      }

      if (statusFilter === 'disabled' && item.enabled !== false) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        item.name.toLowerCase().includes(normalizedSearch)
        || (item.description ?? '').toLowerCase().includes(normalizedSearch)
        || (parsed?.eventKey ?? '').includes(normalizedSearch)
        || (parsed?.ruleType ?? '').includes(normalizedSearch)
        || (parsed?.activityType ?? '').includes(normalizedSearch)
      );
    });
  }, [eventFilter, parsedRows, search, statusFilter]);

  function resetForm() {
    setForm(defaultFormState);
    setEditId(null);
  }

  function startEdit(item: ExtraItem) {
    const parsed = parseRuleValue(item.value);

    setEditId(item._id);
    setForm({
      name: item.name,
      description: item.description ?? '',
      eventKey: parsed?.eventKey ?? 'campaign_completed',
      ruleType: parsed?.ruleType ?? 'global',
      activityType: parsed?.activityType ?? '',
      locationKey: parsed?.locationKey ?? '',
      baseXp: String(parsed?.baseXp ?? 100),
      overrideEnabled: parsed?.overrideEnabled ?? false,
      overrideXp: String(parsed?.overrideXp ?? 0),
      repeat: parsed?.repeat ?? 'always',
      repeatPenaltyEnabled: parsed?.repeatPenaltyEnabled ?? true,
      bonusXp: String(parsed?.bonusXp ?? 0),
      socialBonusXp: String(parsed?.socialBonusXp ?? 0),
      difficultyEasy: String(parsed?.difficultyMultipliers?.easy ?? 1),
      difficultyModerate: String(parsed?.difficultyMultipliers?.moderate ?? 1),
      difficultyHard: String(parsed?.difficultyMultipliers?.hard ?? 1),
      difficultyExtreme: String(parsed?.difficultyMultipliers?.extreme ?? 1),
      bonusFirstVisit: String(parsed?.explorationBonuses?.firstVisit ?? 150),
      bonusNewDistrict: String(parsed?.explorationBonuses?.newDistrict ?? 250),
      bonusHiddenGem: String(parsed?.explorationBonuses?.hiddenGem ?? 300),
      bonusRareRoute: String(parsed?.explorationBonuses?.rareRoute ?? 400),
      difficultyCondition: parsed?.conditions?.difficulty ?? '',
      districtCondition: parsed?.conditions?.district ?? '',
      ratingGte: parsed?.conditions?.ratingGte !== undefined
        ? String(parsed.conditions.ratingGte)
        : '',
      soloOnly: parsed?.conditions?.solo ?? false,
      hostOnly: parsed?.conditions?.hostOnly ?? false,
      hiddenGemOnly: parsed?.conditions?.hiddenGem ?? false,
      rareRouteOnly: parsed?.conditions?.rareRoute ?? false,
      enabled: item.enabled !== false,
    });
  }

  async function submitRule(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!form.name.trim()) {
        throw new Error('Rule name is required.');
      }

      const value = buildRuleValue(form);
      const payload = {
        category: 'xp' as const,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        value,
        enabled: form.enabled,
      };

      if (editId) {
        await updateExtra(editId, payload);
        setSuccess('XP rule updated successfully.');
      } else {
        await createExtra(payload);
        setSuccess('XP rule created successfully.');
      }

      resetForm();
      await loadRules();
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        setError(caughtError.message);
      } else {
        setError('Failed to save XP rule.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeRule(id: string) {
    setDeletingId(id);
    setError('');
    setSuccess('');

    try {
      await deleteExtra(id);
      setSuccess('XP rule deleted successfully.');
      if (editId === id) {
        resetForm();
      }
      await loadRules();
    } catch {
      setError('Failed to delete XP rule.');
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleRuleEnabled(item: ExtraItem) {
    setError('');
    setSuccess('');

    try {
      await updateExtra(item._id, {
        category: 'xp',
        name: item.name,
        description: item.description ?? undefined,
        value: item.value ?? undefined,
        enabled: item.enabled === false,
      });
      await loadRules();
      setSuccess('Rule status updated.');
    } catch {
      setError('Failed to change rule status.');
    }
  }

  async function runSimulation() {
    setSimLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/user/admin/xp/simulate', {
        eventKey: simEventKey,
        ...(simProfileId.trim() ? { profileId: simProfileId.trim() } : {}),
        context: {
          activityType: simActivityType,
          difficulty: simDifficulty,
          district: simDistrict,
          locationKey: simLocation,
          hiddenGem: simHiddenGem,
          rareRoute: simRareRoute,
        },
      });

      setSimResult(response.data as XpSimulationResult);
    } catch {
      setError('Simulation failed. Verify API session and payload values.');
      setSimResult(null);
    } finally {
      setSimLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">XP Rule Creator</h1>
        <p className="mt-2 text-sm text-slate-600">
          Build dynamic XP rules without manual math. Backend computes final XP using base/override, multipliers, bonuses, and anti-farming penalties.
        </p>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <form onSubmit={submitRule} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">
            {editId ? 'Edit XP Rule' : 'Create XP Rule'}
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-900">Rule Name</label>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Adventure hard route completion"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-900">Description</label>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Dynamic XP for difficult nature adventure campaigns"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">Rule Type</label>
              <select
                value={form.ruleType}
                onChange={(event) => setForm((current) => ({ ...current, ruleType: event.target.value as RuleType }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="activity">Activity</option>
                <option value="location">Location</option>
                <option value="global">Global</option>
                <option value="social">Social</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">Event Key</label>
              <input
                list="xp-event-presets"
                value={form.eventKey}
                onChange={(event) => setForm((current) => ({ ...current, eventKey: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="xp-event-presets">
                {eventPresets.map((preset) => (
                  <option key={preset.key} value={preset.key}>{preset.label}</option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">Activity</label>
              <select
                value={form.activityType}
                onChange={(event) => setForm((current) => ({ ...current, activityType: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {activityPresets.map((activity) => (
                  <option key={activity.key} value={activity.key}>{activity.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">Location Key</label>
              <input
                value={form.locationKey}
                onChange={(event) => setForm((current) => ({ ...current, locationKey: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="shivapuri-peak"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">Base XP</label>
              <input
                type="number"
                min={0}
                value={form.baseXp}
                onChange={(event) => setForm((current) => ({ ...current, baseXp: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">Override XP</label>
              <input
                type="number"
                min={0}
                value={form.overrideXp}
                onChange={(event) => setForm((current) => ({ ...current, overrideXp: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">Rule Bonus XP</label>
              <input
                type="number"
                min={0}
                value={form.bonusXp}
                onChange={(event) => setForm((current) => ({ ...current, bonusXp: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">Social Bonus XP</label>
              <input
                type="number"
                min={0}
                value={form.socialBonusXp}
                onChange={(event) => setForm((current) => ({ ...current, socialBonusXp: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">Repeat Mode</label>
              <select
                value={form.repeat}
                onChange={(event) => setForm((current) => ({ ...current, repeat: event.target.value as RuleRepeatMode }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="always">Always</option>
                <option value="once_per_user">Once per user</option>
                <option value="once_per_campaign">Once per campaign</option>
                <option value="once_per_district">Once per district</option>
                <option value="once_per_difficulty">Once per difficulty</option>
                <option value="once_per_referred_user">Once per referred user</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">Difficulty Condition</label>
              <input
                value={form.difficultyCondition}
                onChange={(event) => setForm((current) => ({ ...current, difficultyCondition: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="easy, moderate, hard, extreme"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">District Condition</label>
              <input
                value={form.districtCondition}
                onChange={(event) => setForm((current) => ({ ...current, districtCondition: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">Minimum Rating</label>
              <input
                type="number"
                min={1}
                max={5}
                step={0.1}
                value={form.ratingGte}
                onChange={(event) => setForm((current) => ({ ...current, ratingGte: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2 rounded-lg border border-slate-200 p-3">
              <p className="mb-2 text-sm font-medium text-slate-900">Difficulty Multipliers</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <input value={form.difficultyEasy} onChange={(event) => setForm((current) => ({ ...current, difficultyEasy: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Easy" />
                <input value={form.difficultyModerate} onChange={(event) => setForm((current) => ({ ...current, difficultyModerate: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Moderate" />
                <input value={form.difficultyHard} onChange={(event) => setForm((current) => ({ ...current, difficultyHard: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Hard" />
                <input value={form.difficultyExtreme} onChange={(event) => setForm((current) => ({ ...current, difficultyExtreme: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Extreme" />
              </div>
            </div>

            <div className="md:col-span-2 rounded-lg border border-slate-200 p-3">
              <p className="mb-2 text-sm font-medium text-slate-900">Exploration Bonuses</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <input value={form.bonusFirstVisit} onChange={(event) => setForm((current) => ({ ...current, bonusFirstVisit: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="First visit" />
                <input value={form.bonusNewDistrict} onChange={(event) => setForm((current) => ({ ...current, bonusNewDistrict: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="New district" />
                <input value={form.bonusHiddenGem} onChange={(event) => setForm((current) => ({ ...current, bonusHiddenGem: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Hidden gem" />
                <input value={form.bonusRareRoute} onChange={(event) => setForm((current) => ({ ...current, bonusRareRoute: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Rare route" />
              </div>
            </div>

            <div className="md:col-span-2 flex flex-wrap items-center gap-6 rounded-lg border border-slate-200 p-3">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.overrideEnabled} onChange={(event) => setForm((current) => ({ ...current, overrideEnabled: event.target.checked }))} />
                Override enabled
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.repeatPenaltyEnabled} onChange={(event) => setForm((current) => ({ ...current, repeatPenaltyEnabled: event.target.checked }))} />
                Repeat penalty enabled
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.soloOnly} onChange={(event) => setForm((current) => ({ ...current, soloOnly: event.target.checked }))} />
                Solo only
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.hostOnly} onChange={(event) => setForm((current) => ({ ...current, hostOnly: event.target.checked }))} />
                Host only
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.hiddenGemOnly} onChange={(event) => setForm((current) => ({ ...current, hiddenGemOnly: event.target.checked }))} />
                Hidden gem only
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.rareRouteOnly} onChange={(event) => setForm((current) => ({ ...current, rareRouteOnly: event.target.checked }))} />
                Rare route only
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
                Enabled
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editId ? 'Update Rule' : 'Create Rule'}
            </button>
            {editId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">XP Simulator</h3>
            <p className="mt-1 text-xs text-slate-600">Test final XP instantly before publishing rules.</p>

            <div className="mt-4 space-y-3">
              <input value={simProfileId} onChange={(event) => setSimProfileId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Optional profile ID" />
              <input list="xp-event-presets" value={simEventKey} onChange={(event) => setSimEventKey(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Event key" />
              <select value={simActivityType} onChange={(event) => setSimActivityType(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {activityPresets.map((activity) => (
                  <option key={activity.key} value={activity.key}>{activity.label}</option>
                ))}
              </select>
              <select value={simDifficulty} onChange={(event) => setSimDifficulty(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="easy">Easy</option>
                <option value="moderate">Moderate</option>
                <option value="hard">Hard</option>
                <option value="extreme">Extreme</option>
              </select>
              <input value={simDistrict} onChange={(event) => setSimDistrict(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="District" />
              <input value={simLocation} onChange={(event) => setSimLocation(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Location key" />
              <div className="flex items-center gap-4 text-xs text-slate-700">
                <label className="inline-flex items-center gap-1"><input type="checkbox" checked={simHiddenGem} onChange={(event) => setSimHiddenGem(event.target.checked)} /> Hidden gem</label>
                <label className="inline-flex items-center gap-1"><input type="checkbox" checked={simRareRoute} onChange={(event) => setSimRareRoute(event.target.checked)} /> Rare route</label>
              </div>
              <button type="button" onClick={() => void runSimulation()} disabled={simLoading} className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
                {simLoading ? 'Simulating...' : 'Simulate XP'}
              </button>
            </div>

            {simResult && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <p className="font-semibold text-slate-900">Final XP: {simResult.totalAwarded}</p>
                {simResult.appliedRules.map((rule) => (
                  <div key={rule.ruleCode} className="mt-2 rounded-md bg-white p-2">
                    <p className="font-medium text-slate-900">{rule.ruleName} ({rule.points} XP)</p>
                    {rule.breakdown && (
                      <p className="mt-1 text-slate-600">
                        Base {rule.breakdown.baseXp} x {rule.breakdown.difficultyMultiplier} + bonuses {rule.breakdown.explorationBonus + rule.breakdown.socialBonus} - penalty {rule.breakdown.repeatPenalty} = {rule.breakdown.finalXp}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Rule Dashboard</h2>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Search rules"
          />
          <select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All events</option>
            {eventPresets.map((preset) => (
              <option key={preset.key} value={preset.key}>{preset.key}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'enabled' | 'disabled')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All status</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        {loading ? (
          <p className="mt-3 text-sm text-slate-600">Loading rules...</p>
        ) : filteredRows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No XP rules found for the current filter.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-3 py-2">Rule</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2">Base XP</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(({ item, parsed }) => (
                  <tr key={item._id} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      {item.description && <p className="text-xs text-slate-600">{item.description}</p>}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{parsed?.ruleType ?? '-'}</td>
                    <td className="px-3 py-2 text-slate-700">{parsed?.eventKey ?? 'Invalid JSON'}</td>
                    <td className="px-3 py-2 text-slate-700">{parsed?.baseXp ?? '-'}</td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => void toggleRuleEnabled(item)} className={`rounded-full px-2 py-1 text-xs ${item.enabled === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>
                        {item.enabled === false ? 'Disabled' : 'Enabled'}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => startEdit(item)} className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50">
                          Edit
                        </button>
                        <button type="button" onClick={() => void removeRule(item._id)} disabled={deletingId === item._id} className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60">
                          {deletingId === item._id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
