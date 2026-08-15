'use client';

import { useCallback, useEffect, useState } from 'react';
import { FiClipboard, FiRefreshCw } from 'react-icons/fi';
import { apiClient } from '@/lib/api';

type AuditEvent = {
  timestamp?: string;
  type?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  [key: string]: unknown;
};
type AuditResponse = { items: AuditEvent[]; total: number; page: number; limit: number };

export default function AuditPage() {
  const [data, setData] = useState<AuditResponse>({ items: [], total: 0, page: 1, limit: 50 });
  const [filters, setFilters] = useState({ action: '', actorId: '', entityType: '', entityId: '', from: '', to: '' });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<AuditResponse>('/audit/events', {
        params: {
          page,
          limit: 50,
          action: appliedFilters.action || undefined,
          actorId: appliedFilters.actorId || undefined,
          entityType: appliedFilters.entityType || undefined,
          entityId: appliedFilters.entityId || undefined,
          from: appliedFilters.from || undefined,
          to: appliedFilters.to ? `${appliedFilters.to}T23:59:59.999` : undefined,
        },
      });
      setData(response.data);
    } catch {
      setError('Audit history could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => { void load(1); }, [load]);

  const field = (key: keyof typeof filters, label: string, placeholder?: string, type = 'text') => (
    <label className="text-sm font-medium">{label}
      <input type={type} value={filters[key]} onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3" />
    </label>
  );

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><FiClipboard aria-hidden /></span>
          <div><h1 className="text-2xl font-bold">Audit history</h1><p className="text-sm text-muted-foreground">Trace moderation, place, XP, campaign, and account changes.</p></div>
        </div>
        <button type="button" onClick={() => void load(data.page)} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-60" aria-label="Refresh audit history"><FiRefreshCw aria-hidden />Refresh</button>
      </header>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <form onSubmit={(event) => { event.preventDefault(); setAppliedFilters(filters); }} className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {field('action', 'Action prefix', 'campaign. or moderation.')}
          {field('actorId', 'Actor ID', 'Admin or moderator ID')}
          {field('entityType', 'Entity type', 'campaign, report, places')}
          {field('entityId', 'Entity ID', 'Request code or record ID')}
          {field('from', 'From', undefined, 'date')}
          {field('to', 'To', undefined, 'date')}
          <div className="flex items-end gap-2 xl:col-span-3">
            <button className="min-h-11 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground">Apply filters</button>
            <button type="button" onClick={() => { const empty = { action: '', actorId: '', entityType: '', entityId: '', from: '', to: '' }; setFilters(empty); setAppliedFilters(empty); }} className="min-h-11 rounded-xl border border-border px-5 text-sm font-medium">Clear</button>
          </div>
        </form>

        {error ? <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-destructive">{error}</p> : null}
        {!error && loading ? <p role="status" className="py-10 text-center text-muted-foreground">Loading audit history...</p> : null}
        {!error && !loading && data.items.length === 0 ? <p className="py-10 text-center text-muted-foreground">No matching audit events.</p> : null}
        {!loading && data.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Administrative audit events</caption>
              <thead><tr className="border-b border-border"><th className="p-3">Time</th><th className="p-3">Action</th><th className="p-3">Actor</th><th className="p-3">Entity</th><th className="p-3">Details</th></tr></thead>
              <tbody>{data.items.map((item, index) => {
                const { timestamp, type, actorId, entityType, entityId, ...details } = item;
                return <tr key={`${timestamp}-${index}`} className="border-b border-border/70 align-top"><td className="whitespace-nowrap p-3">{timestamp ? new Date(timestamp).toLocaleString() : '-'}</td><td className="p-3 font-medium">{type ?? 'unknown'}</td><td className="p-3 font-mono text-xs">{actorId ?? 'system'}</td><td className="p-3 font-mono text-xs">{entityType ?? '-'}{entityId ? ` / ${entityId}` : ''}</td><td className="max-w-xl break-words p-3 font-mono text-xs">{JSON.stringify(details)}</td></tr>;
              })}</tbody>
            </table>
          </div>
        ) : null}
        <div className="mt-5 flex items-center justify-between"><span className="text-sm text-muted-foreground">{data.total} events</span><div className="flex gap-2"><button type="button" disabled={loading || data.page <= 1} onClick={() => void load(data.page - 1)} className="min-h-10 rounded-xl border px-4 disabled:opacity-50">Previous</button><button type="button" disabled={loading || data.page * data.limit >= data.total} onClick={() => void load(data.page + 1)} className="min-h-10 rounded-xl border px-4 disabled:opacity-50">Next</button></div></div>
      </section>
    </main>
  );
}
