'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiEdit2, FiPlus, FiRefreshCw, FiSave, FiTrash2, FiX } from 'react-icons/fi';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { apiClient } from '@/lib/api';
import {
  createExtra,
  deleteExtra,
  ExtraItem,
  fetchExtras,
  updateExtra,
} from '@/lib/extras';

type RepeatMode =
  | 'always'
  | 'once_per_user'
  | 'once_per_campaign'
  | 'once_per_district'
  | 'once_per_difficulty'
  | 'once_per_referred_user';

type RuleType = 'global' | 'activity' | 'location' | 'social';

type XpEventCatalogItem = {
  key: string;
  label: string;
  description: string;
  source: string;
  contextFields: string[];
  recommendedRepeat: RepeatMode;
};

type XpRuleValue = {
  eventKey: string;
  baseXp: number;
  bonusXp?: number;
  socialBonusXp?: number;
  ruleType?: RuleType;
  repeat?: RepeatMode;
  difficultyMultipliers?: Partial<Record<'easy' | 'moderate' | 'hard' | 'extreme', number>>;
  explorationBonuses?: {
    firstVisit?: number;
    newDistrict?: number;
    hiddenGem?: number;
    rareRoute?: number;
  };
  conditions?: {
    difficulty?: string;
    district?: string;
    activityType?: string;
    locationKey?: string;
    ratingGte?: number;
    solo?: boolean;
    hostOnly?: boolean;
    hiddenGem?: boolean;
    rareRoute?: boolean;
  };
};

type XpRuleForm = {
  name: string;
  description: string;
  eventKey: string;
  baseXp: string;
  bonusXp: string;
  socialBonusXp: string;
  ruleType: RuleType;
  repeat: RepeatMode;
  difficulty: string;
  district: string;
  activityType: string;
  locationKey: string;
  ratingGte: string;
  solo: boolean;
  hostOnly: boolean;
  hiddenGem: boolean;
  rareRoute: boolean;
  easyMultiplier: string;
  moderateMultiplier: string;
  hardMultiplier: string;
  extremeMultiplier: string;
  firstVisitBonus: string;
  newDistrictBonus: string;
  hiddenGemBonus: string;
  rareRouteBonus: string;
  enabled: boolean;
};

const emptyForm: XpRuleForm = {
  name: '',
  description: '',
  eventKey: '',
  baseXp: '0',
  bonusXp: '0',
  socialBonusXp: '0',
  ruleType: 'global',
  repeat: 'always',
  difficulty: '',
  district: '',
  activityType: '',
  locationKey: '',
  ratingGte: '',
  solo: false,
  hostOnly: false,
  hiddenGem: false,
  rareRoute: false,
  easyMultiplier: '',
  moderateMultiplier: '',
  hardMultiplier: '',
  extremeMultiplier: '',
  firstVisitBonus: '150',
  newDistrictBonus: '250',
  hiddenGemBonus: '300',
  rareRouteBonus: '400',
  enabled: true,
};

function apiError(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.map(String).join(' ');
  return typeof message === 'string' && message.trim() ? message : fallback;
}

function parseRule(item: ExtraItem): XpRuleValue | null {
  try {
    const value = JSON.parse(item.value ?? '') as XpRuleValue;
    return value && typeof value.eventKey === 'string' ? value : null;
  } catch {
    return null;
  }
}

function optionalNumber(value: string) {
  return value.trim() === '' ? undefined : Number(value);
}

function exampleContext(fields: string[]) {
  const examples: Record<string, unknown> = {
    campaignId: 'preview-campaign',
    difficulty: 'hard',
    district: 'kathmandu',
    locationKey: 'shivapuri',
    activityType: 'hiking',
    solo: true,
    hostOnly: true,
    rating: 5,
    referredUserId: 'preview-referred-user',
  };
  return JSON.stringify(
    Object.fromEntries(fields.filter((field) => field in examples).map((field) => [field, examples[field]])),
    null,
    2,
  );
}

function formFromItem(item: ExtraItem): XpRuleForm {
  const rule = parseRule(item);
  if (!rule) return { ...emptyForm, name: item.name, description: item.description ?? '', enabled: item.enabled !== false };
  const conditions = rule.conditions ?? {};
  const multipliers = rule.difficultyMultipliers ?? {};
  const bonuses = rule.explorationBonuses ?? {};
  return {
    ...emptyForm,
    name: item.name,
    description: item.description ?? '',
    eventKey: rule.eventKey,
    baseXp: String(rule.baseXp ?? 0),
    bonusXp: String(rule.bonusXp ?? 0),
    socialBonusXp: String(rule.socialBonusXp ?? 0),
    ruleType: rule.ruleType ?? 'global',
    repeat: rule.repeat ?? 'always',
    difficulty: conditions.difficulty ?? '',
    district: conditions.district ?? '',
    activityType: conditions.activityType ?? '',
    locationKey: conditions.locationKey ?? '',
    ratingGte: conditions.ratingGte === undefined ? '' : String(conditions.ratingGte),
    solo: conditions.solo === true,
    hostOnly: conditions.hostOnly === true,
    hiddenGem: conditions.hiddenGem === true,
    rareRoute: conditions.rareRoute === true,
    easyMultiplier: multipliers.easy === undefined ? '' : String(multipliers.easy),
    moderateMultiplier: multipliers.moderate === undefined ? '' : String(multipliers.moderate),
    hardMultiplier: multipliers.hard === undefined ? '' : String(multipliers.hard),
    extremeMultiplier: multipliers.extreme === undefined ? '' : String(multipliers.extreme),
    firstVisitBonus: String(bonuses.firstVisit ?? 150),
    newDistrictBonus: String(bonuses.newDistrict ?? 250),
    hiddenGemBonus: String(bonuses.hiddenGem ?? 300),
    rareRouteBonus: String(bonuses.rareRoute ?? 400),
    enabled: item.enabled !== false,
  };
}

export function XpManager() {
  const [items, setItems] = useState<ExtraItem[]>([]);
  const [events, setEvents] = useState<XpEventCatalogItem[]>([]);
  const [form, setForm] = useState<XpRuleForm>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteItem, setDeleteItem] = useState<ExtraItem | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewProfileId, setPreviewProfileId] = useState('');
  const [previewEventKey, setPreviewEventKey] = useState('');
  const [previewContext, setPreviewContext] = useState('{}');
  const [previewResult, setPreviewResult] = useState<{
    totalAwarded?: number;
    appliedRules?: Array<{ ruleName: string; points: number }>;
    fallbackApplied?: boolean;
  } | null>(null);

  async function loadRules() {
    setLoading(true);
    setError('');
    try {
      const [response, eventResponse] = await Promise.all([
        fetchExtras('xp', { page: 1, limit: 100 }),
        apiClient.get('/extra/xp/events'),
      ]);
      setItems(response.items);
      setEvents(eventResponse.data.items ?? []);
    } catch (err) {
      setError(apiError(err, 'Unable to load XP rules.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadRules(); }, []);

  const invalidRules = useMemo(() => items.filter((item) => !parseRule(item)).length, [items]);
  const selectedEvent = useMemo(
    () => events.find((event) => event.key === form.eventKey) ?? null,
    [events, form.eventKey],
  );

  function update<K extends keyof XpRuleForm>(key: K, value: XpRuleForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditId(null);
    setShowAdvanced(false);
  }

  function startEdit(item: ExtraItem) {
    const nextForm = formFromItem(item);
    setForm(nextForm);
    setPreviewEventKey(nextForm.eventKey);
    const eventDefinition = events.find((event) => event.key === nextForm.eventKey);
    if (eventDefinition) setPreviewContext(exampleContext(eventDefinition.contextFields));
    setEditId(item._id);
    setShowAdvanced(true);
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function buildValue(): XpRuleValue {
    const availableContext = new Set(selectedEvent?.contextFields ?? []);
    const conditions: NonNullable<XpRuleValue['conditions']> = {};
    if (availableContext.has('difficulty') && form.difficulty.trim()) conditions.difficulty = form.difficulty.trim();
    if (availableContext.has('district') && form.district.trim()) conditions.district = form.district.trim();
    if (availableContext.has('activityType') && form.activityType.trim()) conditions.activityType = form.activityType.trim();
    if (availableContext.has('locationKey') && form.locationKey.trim()) conditions.locationKey = form.locationKey.trim();
    if (availableContext.has('rating') && form.ratingGte.trim()) conditions.ratingGte = Number(form.ratingGte);
    if (availableContext.has('solo') && form.solo) conditions.solo = true;
    if (availableContext.has('hostOnly') && form.hostOnly) conditions.hostOnly = true;
    if (availableContext.has('hiddenGem') && form.hiddenGem) conditions.hiddenGem = true;
    if (availableContext.has('rareRoute') && form.rareRoute) conditions.rareRoute = true;

    const difficultyMultipliers = {
      easy: optionalNumber(form.easyMultiplier),
      moderate: optionalNumber(form.moderateMultiplier),
      hard: optionalNumber(form.hardMultiplier),
      extreme: optionalNumber(form.extremeMultiplier),
    };
    const definedMultipliers = Object.fromEntries(
      Object.entries(difficultyMultipliers).filter(([, value]) => value !== undefined),
    ) as XpRuleValue['difficultyMultipliers'];

    return {
      eventKey: form.eventKey.trim().toLowerCase().replace(/[\s-]+/g, '_'),
      baseXp: Number(form.baseXp),
      bonusXp: Number(form.bonusXp || 0),
      socialBonusXp: Number(form.socialBonusXp || 0),
      ruleType: form.ruleType,
      repeat: form.repeat,
      ...(availableContext.has('difficulty') && Object.keys(definedMultipliers ?? {}).length ? { difficultyMultipliers: definedMultipliers } : {}),
      explorationBonuses: {
        firstVisit: Number(form.firstVisitBonus),
        newDistrict: Number(form.newDistrictBonus),
        hiddenGem: Number(form.hiddenGemBonus),
        rareRoute: Number(form.rareRouteBonus),
      },
      ...(Object.keys(conditions).length ? { conditions } : {}),
    };
  }

  async function saveRule(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!form.name.trim() || !form.eventKey.trim()) {
      setError('Rule name and event key are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        category: 'xp' as const,
        name: form.name.trim(),
        description: form.description.trim(),
        value: JSON.stringify(buildValue()),
        enabled: form.enabled,
      };
      if (editId) {
        await updateExtra(editId, payload);
        setSuccess('XP rule updated successfully.');
      } else {
        await createExtra(payload);
        setSuccess('XP rule created successfully. It is now available to the XP engine.');
      }
      setPreviewEventKey(form.eventKey);
      if (selectedEvent) setPreviewContext(exampleContext(selectedEvent.contextFields));
      resetForm();
      await loadRules();
    } catch (err) {
      setError(apiError(err, 'Unable to save XP rule.'));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteItem) return;
    try {
      await deleteExtra(deleteItem._id);
      setDeleteItem(null);
      setSuccess('XP rule deleted.');
      await loadRules();
    } catch (err) {
      setError(apiError(err, 'Unable to delete XP rule.'));
    }
  }

  async function previewRule(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setPreviewResult(null);
    if (!previewProfileId.trim() || !previewEventKey) {
      setError('Select an event and enter a user profile ID to preview rewards.');
      return;
    }
    try {
      const context = JSON.parse(previewContext || '{}') as Record<string, unknown>;
      const response = await apiClient.post(
        `/user/admin/profiles/${encodeURIComponent(previewProfileId.trim())}/xp/simulate`,
        { eventKey: previewEventKey, context },
      );
      setPreviewResult(response.data);
    } catch (err) {
      setError(apiError(err, 'Unable to preview XP reward. Check the profile ID and context JSON.'));
    }
  }

  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">XP Rules</h1>
          <p className="mt-1 text-sm text-slate-600">Create event rules used by the backend when awarding XP to users.</p>
        </div>
        <button type="button" onClick={() => void loadRules()} className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
          <FiRefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}
      {invalidRules > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{invalidRules} legacy rule(s) contain invalid data. Edit and save them to repair the configuration.</div>}

      <form onSubmit={saveRule} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{editId ? 'Edit XP Rule' : 'Create XP Rule'}</h2>
          {editId && <button type="button" onClick={resetForm} className="inline-flex items-center gap-1 text-sm text-slate-600"><FiX /> Cancel</button>}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Rule name
            <input className={`${inputClass} mt-1`} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Campaign completion" required />
          </label>
          <label className="text-sm font-medium text-slate-700">Reward trigger
            <select
              className={`${inputClass} mt-1`}
              value={form.eventKey}
              onChange={(e) => {
                const nextEvent = events.find((item) => item.key === e.target.value);
                setForm((current) => ({
                  ...current,
                  eventKey: e.target.value,
                  repeat: nextEvent?.recommendedRepeat ?? current.repeat,
                }));
                setPreviewEventKey(e.target.value);
                if (nextEvent) setPreviewContext(exampleContext(nextEvent.contextFields));
              }}
              required
            >
              <option value="">Select a verified trigger</option>
              {events.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Base XP
            <input className={`${inputClass} mt-1`} type="number" min="0" max="10000" value={form.baseXp} onChange={(e) => update('baseXp', e.target.value)} required />
          </label>
          <label className="text-sm font-medium text-slate-700">Repeat policy
            <select className={`${inputClass} mt-1`} value={form.repeat} onChange={(e) => update('repeat', e.target.value as RepeatMode)}>
              <option value="always">Every matching event</option>
              <option value="once_per_user">Once per user</option>
              <option value="once_per_campaign" disabled={!selectedEvent?.contextFields.includes('campaignId')}>Once per campaign</option>
              <option value="once_per_district" disabled={!selectedEvent?.contextFields.includes('district')}>Once per district</option>
              <option value="once_per_difficulty" disabled={!selectedEvent?.contextFields.includes('difficulty')}>Once per difficulty</option>
              <option value="once_per_referred_user" disabled={!selectedEvent?.contextFields.includes('referredUserId')}>Once per referred user</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Rule type
            <select className={`${inputClass} mt-1`} value={form.ruleType} onChange={(e) => update('ruleType', e.target.value as RuleType)}>
              <option value="global">Global</option><option value="activity">Activity</option><option value="location">Location</option><option value="social">Social</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Description
            <input className={`${inputClass} mt-1`} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="When and why this XP is awarded" />
          </label>
        </div>

        {selectedEvent && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-semibold">{selectedEvent.label}</p>
            <p className="mt-1">{selectedEvent.description}</p>
            <p className="mt-2 text-xs"><span className="font-semibold">Triggered by:</span> {selectedEvent.source}</p>
            <p className="mt-1 text-xs"><span className="font-semibold">Available context:</span> {selectedEvent.contextFields.join(', ') || 'none'}</p>
          </div>
        )}

        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={form.enabled} onChange={(e) => update('enabled', e.target.checked)} /> Enabled
        </label>

        <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="text-sm font-semibold text-primary">
          {showAdvanced ? 'Hide advanced conditions' : 'Show advanced conditions'}
        </button>

        {showAdvanced && (
          <div className="space-y-5 border-t border-slate-200 pt-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Bonuses and matching conditions</h3>
              <div className="mt-3 grid gap-4 md:grid-cols-3">
                <label className="text-sm text-slate-700">Bonus XP<input className={`${inputClass} mt-1`} type="number" min="0" value={form.bonusXp} onChange={(e) => update('bonusXp', e.target.value)} /></label>
                <label className="text-sm text-slate-700">Social bonus XP<input className={`${inputClass} mt-1`} type="number" min="0" value={form.socialBonusXp} onChange={(e) => update('socialBonusXp', e.target.value)} /></label>
                {selectedEvent?.contextFields.includes('rating') && <label className="text-sm text-slate-700">Minimum rating<input className={`${inputClass} mt-1`} type="number" min="1" max="5" value={form.ratingGte} onChange={(e) => update('ratingGte', e.target.value)} placeholder="Any" /></label>}
                {selectedEvent?.contextFields.includes('difficulty') && <label className="text-sm text-slate-700">Difficulty<input className={`${inputClass} mt-1`} value={form.difficulty} onChange={(e) => update('difficulty', e.target.value)} placeholder="Any" /></label>}
                {selectedEvent?.contextFields.includes('district') && <label className="text-sm text-slate-700">District<input className={`${inputClass} mt-1`} value={form.district} onChange={(e) => update('district', e.target.value)} placeholder="Any" /></label>}
                {selectedEvent?.contextFields.includes('activityType') && <label className="text-sm text-slate-700">Activity type<input className={`${inputClass} mt-1`} value={form.activityType} onChange={(e) => update('activityType', e.target.value)} placeholder="Any" /></label>}
                {selectedEvent?.contextFields.includes('locationKey') && <label className="text-sm text-slate-700">Location key<input className={`${inputClass} mt-1`} value={form.locationKey} onChange={(e) => update('locationKey', e.target.value)} placeholder="Any" /></label>}
              </div>
              <div className="mt-3 flex flex-wrap gap-4">
                {(['solo', 'hostOnly', 'hiddenGem', 'rareRoute'] as const).filter((key) => selectedEvent?.contextFields.includes(key)).map((key) => (
                  <label key={key} className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form[key]} onChange={(e) => update(key, e.target.checked)} />{key === 'hostOnly' ? 'Host only' : key === 'hiddenGem' ? 'Hidden gem' : key === 'rareRoute' ? 'Rare route' : 'Solo only'}</label>
                ))}
              </div>
            </div>

            {selectedEvent?.contextFields.includes('difficulty') && <div>
              <h3 className="text-sm font-semibold text-slate-900">Difficulty multipliers</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(['easy', 'moderate', 'hard', 'extreme'] as const).map((difficulty) => {
                  const key = `${difficulty}Multiplier` as keyof XpRuleForm;
                  return <label key={difficulty} className="text-sm capitalize text-slate-700">{difficulty}<input className={`${inputClass} mt-1`} type="number" min="0" step="0.1" value={form[key] as string} onChange={(e) => update(key, e.target.value as never)} placeholder="Default" /></label>;
                })}
              </div>
            </div>}

            {(selectedEvent?.contextFields.includes('locationKey') || selectedEvent?.contextFields.includes('district')) && <div>
              <h3 className="text-sm font-semibold text-slate-900">Exploration bonuses</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-sm text-slate-700">First visit<input className={`${inputClass} mt-1`} type="number" min="0" value={form.firstVisitBonus} onChange={(e) => update('firstVisitBonus', e.target.value)} /></label>
                <label className="text-sm text-slate-700">New district<input className={`${inputClass} mt-1`} type="number" min="0" value={form.newDistrictBonus} onChange={(e) => update('newDistrictBonus', e.target.value)} /></label>
                <label className="text-sm text-slate-700">Hidden gem<input className={`${inputClass} mt-1`} type="number" min="0" value={form.hiddenGemBonus} onChange={(e) => update('hiddenGemBonus', e.target.value)} /></label>
                <label className="text-sm text-slate-700">Rare route<input className={`${inputClass} mt-1`} type="number" min="0" value={form.rareRouteBonus} onChange={(e) => update('rareRouteBonus', e.target.value)} /></label>
              </div>
            </div>}
          </div>
        )}

        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {editId ? <FiSave size={16} /> : <FiPlus size={16} />}{saving ? 'Saving...' : editId ? 'Update rule' : 'Create rule'}
        </button>
      </form>

      <form onSubmit={previewRule} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Preview saved reward</h2>
          <p className="mt-1 text-sm text-slate-600">Test enabled rules for the selected trigger without changing the user&apos;s XP.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">Reward trigger<select className={`${inputClass} mt-1`} value={previewEventKey} onChange={(e) => { const nextEvent = events.find((item) => item.key === e.target.value); setPreviewEventKey(e.target.value); if (nextEvent) setPreviewContext(exampleContext(nextEvent.contextFields)); }}><option value="">Select trigger</option>{events.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">User profile ID<input className={`${inputClass} mt-1`} value={previewProfileId} onChange={(e) => setPreviewProfileId(e.target.value)} placeholder="Mongo profile ID" /></label>
          <label className="text-sm font-medium text-slate-700">Event context (JSON)<input className={`${inputClass} mt-1 font-mono`} value={previewContext} onChange={(e) => setPreviewContext(e.target.value)} placeholder='{"campaignId":"...","difficulty":"hard"}' /></label>
        </div>
        <button type="submit" className="rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5">Preview XP</button>
        {previewResult && (
          <div className="rounded-xl bg-slate-900 p-4 text-sm text-white">
            <p className="text-2xl font-bold">{previewResult.totalAwarded ?? 0} XP</p>
            <p className="mt-1 text-xs text-slate-300">No XP was awarded. {previewResult.fallbackApplied ? 'System fallback was used.' : `${previewResult.appliedRules?.length ?? 0} rule(s) matched.`}</p>
            {(previewResult.appliedRules ?? []).map((rule, index) => <p key={`${rule.ruleName}-${index}`} className="mt-2 text-xs">{rule.ruleName}: {rule.points} XP</p>)}
          </div>
        )}
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50"><tr>{['Rule', 'Event', 'XP', 'Repeat', 'Status', 'Actions'].map((label) => <th key={label} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">Loading XP rules...</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">No XP rules configured.</td></tr>}
            {!loading && items.map((item) => {
              const rule = parseRule(item);
              return <tr key={item._id}>
                <td className="px-5 py-4"><p className="font-medium text-slate-900">{item.name}</p><p className="text-xs text-slate-500">{item.extraCode}</p></td>
                <td className="px-5 py-4 font-mono text-xs text-slate-700">{rule?.eventKey ?? 'Invalid rule'}</td>
                <td className="px-5 py-4 text-sm font-semibold text-slate-900">{rule ? `${rule.baseXp} XP` : '—'}</td>
                <td className="px-5 py-4 text-xs text-slate-600">{rule?.repeat?.replaceAll('_', ' ') ?? '—'}</td>
                <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.enabled !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.enabled !== false ? 'Enabled' : 'Disabled'}</span></td>
                <td className="px-5 py-4"><div className="flex gap-2"><button type="button" onClick={() => startEdit(item)} className="rounded-lg p-2 text-amber-600 hover:bg-amber-50" title="Edit"><FiEdit2 /></button><button type="button" onClick={() => setDeleteItem(item)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" title="Delete"><FiTrash2 /></button></div></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>

      <ConfirmModal open={Boolean(deleteItem)} title="Delete XP rule?" description={`Delete ${deleteItem?.name ?? 'this rule'}? Future matching events will no longer use it.`} confirmLabel="Delete rule" onConfirm={() => void confirmDelete()} onCancel={() => setDeleteItem(null)} />
    </div>
  );
}
