'use client';

import { useCallback, useEffect, useState } from 'react';
import { FiAward, FiMapPin, FiPlus, FiRefreshCw, FiTrash2, FiZap } from 'react-icons/fi';
import { apiClient } from '@/lib/api';

type XpEntry = {
  _id?: string;
  eventKey: string;
  ruleName?: string;
  points: number;
  awardedAt: string;
  context?: { adminAdjustment?: { reason?: string } };
};

type Visit = {
  _id: string;
  placeCode: string;
  placeType: 'district' | 'province';
  visitedAt: string;
};

type Badge = {
  _id?: string;
  badgeCode: string;
  name?: string;
  tier?: string;
  iconUrl?: string;
  unlockedAt?: string;
};

type Props = {
  profileId: string;
  initialTotalXp?: number;
  initialLevel?: number;
  initialRank?: string | null;
  initialBadges?: Badge[];
};

function messageFrom(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.map(String).join(' ');
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export function UserProgressManager({
  profileId,
  initialTotalXp = 0,
  initialLevel = 1,
  initialRank,
  initialBadges = [],
}: Props) {
  const [xpHistory, setXpHistory] = useState<XpEntry[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [badges, setBadges] = useState<Badge[]>(initialBadges);
  const [totalXp, setTotalXp] = useState(initialTotalXp);
  const [level, setLevel] = useState(initialLevel);
  const [rank, setRank] = useState(initialRank ?? 'F');
  const [xpToAdd, setXpToAdd] = useState('');
  const [xpReason, setXpReason] = useState('');
  const [placeCode, setPlaceCode] = useState('');
  const [placeType, setPlaceType] = useState<'district' | 'province'>('district');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [xpResponse, visitsResponse, badgesResponse] = await Promise.all([
        apiClient.get(`/user/admin/profiles/${profileId}/xp/history`, { params: { page: 1, limit: 100 } }),
        apiClient.get(`/admin/profiles/${profileId}/visited-places`),
        apiClient.get(`/admin/profiles/${profileId}/badges`),
      ]);
      setXpHistory(xpResponse.data.items ?? []);
      setTotalXp(Number(xpResponse.data.currentXp ?? 0));
      setLevel(Number(xpResponse.data.level ?? 1));
      setRank(String(xpResponse.data.rank ?? 'F'));
      setVisits(Array.isArray(visitsResponse.data) ? visitsResponse.data : []);
      setBadges(Array.isArray(badgesResponse.data) ? badgesResponse.data : []);
    } catch (err) {
      setError(messageFrom(err, 'Unable to load user progress data.'));
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => { void load(); }, [load]);

  async function addXp(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!xpReason.trim()) {
      setError('A reason is required for manual XP.');
      return;
    }
    setBusy(true);
    try {
      await apiClient.post(`/user/admin/profiles/${profileId}/xp`, {
        points: Number(xpToAdd),
        reason: xpReason.trim(),
      });
      setXpToAdd('');
      setXpReason('');
      setSuccess('XP added and rank progression recalculated.');
      await load();
    } catch (err) {
      setError(messageFrom(err, 'Unable to add XP.'));
    } finally {
      setBusy(false);
    }
  }

  async function deleteXp(entry: XpEntry) {
    if (!entry._id) return;
    const reason = window.prompt('Reason for deleting this XP entry:');
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      await apiClient.delete(
        `/user/admin/profiles/${profileId}/xp/history/${entry._id}`,
        { data: { reason: reason.trim() } },
      );
      setSuccess('XP entry deleted and totals recalculated.');
      await load();
    } catch (err) {
      setError(messageFrom(err, 'Unable to delete XP entry.'));
    } finally {
      setBusy(false);
    }
  }

  async function addVisit(event: React.FormEvent) {
    event.preventDefault();
    if (!placeCode.trim()) return;
    setBusy(true);
    setError('');
    try {
      await apiClient.post(`/admin/profiles/${profileId}/visited-places`, {
        placeCode: placeCode.trim(),
        placeType,
      });
      setPlaceCode('');
      setSuccess('Visited place recorded.');
      await load();
    } catch (err) {
      setError(messageFrom(err, 'Unable to record visited place.'));
    } finally {
      setBusy(false);
    }
  }

  async function removeVisit(visit: Visit) {
    setBusy(true);
    try {
      await apiClient.delete(`/admin/profiles/${profileId}/visited-places/${encodeURIComponent(visit.placeCode)}`);
      setSuccess('Visited place removed.');
      await load();
    } catch (err) {
      setError(messageFrom(err, 'Unable to remove visited place.'));
    } finally {
      setBusy(false);
    }
  }

  async function revokeBadge(badge: Badge) {
    if (!window.confirm(`Revoke ${badge.name ?? badge.badgeCode}?`)) return;
    setBusy(true);
    try {
      await apiClient.delete(`/admin/profiles/${profileId}/badges/${encodeURIComponent(badge.badgeCode)}`);
      setSuccess('Badge revoked.');
      await load();
    } catch (err) {
      setError(messageFrom(err, 'Unable to revoke badge.'));
    } finally {
      setBusy(false);
    }
  }

  const fieldClass = 'rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40';

  return (
    <section className="mb-8 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">XP, visits and badges</h2>
          <p className="text-sm text-muted-foreground">Progress generated by verified activity and admin actions.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading || busy} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-60"><FiRefreshCw /> Refresh</button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-amber-50 p-4"><FiZap className="text-amber-600" /><p className="mt-2 text-2xl font-bold text-slate-900">{totalXp}</p><p className="text-xs text-slate-600">Total XP</p></div>
        <div className="rounded-xl bg-blue-50 p-4"><p className="text-xs font-medium text-blue-700">LEVEL</p><p className="mt-2 text-2xl font-bold text-slate-900">{level}</p></div>
        <div className="rounded-xl bg-violet-50 p-4"><FiAward className="text-violet-600" /><p className="mt-2 text-2xl font-bold text-slate-900">{rank}</p><p className="text-xs text-slate-600">Current rank</p></div>
      </div>

      <form onSubmit={addXp} className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-[140px_1fr_auto]">
        <input className={fieldClass} type="number" min="1" max="500" value={xpToAdd} onChange={(e) => setXpToAdd(e.target.value)} placeholder="XP (1–500)" required />
        <input className={fieldClass} value={xpReason} onChange={(e) => setXpReason(e.target.value)} placeholder="Reason for manual XP" required />
        <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"><FiPlus /> Add XP</button>
      </form>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Recent XP history</h3>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {!loading && xpHistory.length === 0 && <p className="text-sm text-muted-foreground">No XP history.</p>}
            {xpHistory.map((entry, index) => <div key={entry._id ?? `${entry.eventKey}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"><div><p className="text-sm font-medium text-foreground">{entry.ruleName ?? entry.eventKey}</p><p className="text-xs text-muted-foreground">{new Date(entry.awardedAt).toLocaleString()}</p></div><div className="flex items-center gap-2"><span className="font-semibold text-emerald-700">+{entry.points}</span>{entry._id && <button type="button" title="Delete XP entry" onClick={() => void deleteXp(entry)} className="rounded p-1 text-red-600 hover:bg-red-50"><FiTrash2 /></button>}</div></div>)}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Visited places</h3>
          <form onSubmit={addVisit} className="mb-3 flex flex-wrap gap-2"><input className={`${fieldClass} min-w-0 flex-1`} value={placeCode} onChange={(e) => setPlaceCode(e.target.value)} placeholder="District or province" required /><select className={fieldClass} value={placeType} onChange={(e) => setPlaceType(e.target.value as 'district' | 'province')}><option value="district">District</option><option value="province">Province</option></select><button disabled={busy} className="rounded-full bg-secondary px-3 py-2 text-sm text-secondary-foreground"><FiPlus /></button></form>
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {!loading && visits.length === 0 && <p className="text-sm text-muted-foreground">No visited places recorded.</p>}
            {visits.map((visit) => <div key={visit._id} className="flex items-center justify-between rounded-lg border border-border p-3"><div className="flex items-center gap-2"><FiMapPin className="text-primary" /><div><p className="text-sm font-medium capitalize text-foreground">{visit.placeCode.replaceAll('_', ' ')}</p><p className="text-xs capitalize text-muted-foreground">{visit.placeType}</p></div></div><button type="button" onClick={() => void removeVisit(visit)} className="rounded p-1 text-red-600 hover:bg-red-50"><FiTrash2 /></button></div>)}
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Awarded badges ({badges.length})</h3>
        <div className="flex flex-wrap gap-3">
          {badges.length === 0 && <p className="text-sm text-muted-foreground">No awarded badges.</p>}
          {badges.map((badge) => <div key={badge._id ?? badge.badgeCode} className="flex items-center gap-3 rounded-xl border border-border p-3">{badge.iconUrl ? <img src={badge.iconUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <FiAward className="h-8 w-8 text-violet-600" />}<div><p className="text-sm font-medium text-foreground">{badge.name ?? badge.badgeCode}</p><p className="text-xs text-muted-foreground">{badge.tier ?? 'badge'}</p></div><button type="button" title="Revoke badge" onClick={() => void revokeBadge(badge)} className="ml-2 rounded p-1 text-red-600 hover:bg-red-50"><FiTrash2 /></button></div>)}
        </div>
      </div>
    </section>
  );
}
