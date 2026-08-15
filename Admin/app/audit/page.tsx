'use client';

import { useCallback, useEffect, useState } from 'react';
import { FiClipboard, FiRefreshCw } from 'react-icons/fi';
import { apiClient } from '@/lib/api';

type AuditEvent = { timestamp?: string; type?: string; actorId?: string; [key: string]: unknown };
type AuditResponse = { items: AuditEvent[]; total: number; page: number; limit: number };

export default function AuditPage() {
  const [data, setData] = useState<AuditResponse>({ items: [], total: 0, page: 1, limit: 50 });
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (page = 1) => {
    setLoading(true); setError(null);
    try {
      const response = await apiClient.get<AuditResponse>('/audit/events', { params: { page, limit: 50, type: type || undefined } });
      setData(response.data);
    } catch { setError('Audit history could not be loaded.'); }
    finally { setLoading(false); }
  }, [type]);

  useEffect(() => { void load(1); }, [load]);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><FiClipboard aria-hidden /></span>
          <div><h1 className="text-2xl font-bold">Audit history</h1><p className="text-sm text-muted-foreground">Searchable history of moderation, place, account, campaign, and administrative changes.</p></div>
        </div>
        <button type="button" onClick={() => void load(data.page)} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-60" aria-label="Refresh audit history"><FiRefreshCw aria-hidden />Refresh</button>
      </header>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <form onSubmit={(event) => { event.preventDefault(); void load(1); }} className="mb-5 flex flex-col gap-3 sm:flex-row">
          <label className="flex-1 text-sm font-medium">Event type
            <input value={type} onChange={(event) => setType(event.target.value)} placeholder="For example: moderation. or places." className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3" />
          </label>
          <button className="min-h-11 self-end rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground">Filter</button>
        </form>
        {error ? <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-destructive">{error}</p> : null}
        {!error && loading ? <p role="status" className="py-10 text-center text-muted-foreground">Loading audit history…</p> : null}
        {!error && !loading && data.items.length === 0 ? <p className="py-10 text-center text-muted-foreground">No matching audit events.</p> : null}
        {!loading && data.items.length > 0 ? (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Administrative audit events</caption><thead><tr className="border-b border-border"><th className="p-3">Time</th><th className="p-3">Event</th><th className="p-3">Actor</th><th className="p-3">Details</th></tr></thead><tbody>{data.items.map((item, index) => { const { timestamp, type: eventType, actorId, ...details } = item; return <tr key={`${timestamp}-${index}`} className="border-b border-border/70 align-top"><td className="whitespace-nowrap p-3">{timestamp ? new Date(timestamp).toLocaleString() : '—'}</td><td className="p-3 font-medium">{eventType ?? 'unknown'}</td><td className="p-3 font-mono text-xs">{actorId ?? 'system'}</td><td className="max-w-xl p-3 font-mono text-xs break-words">{JSON.stringify(details)}</td></tr>; })}</tbody></table></div>
        ) : null}
        <div className="mt-5 flex items-center justify-between"><span className="text-sm text-muted-foreground">{data.total} events</span><div className="flex gap-2"><button type="button" disabled={loading || data.page <= 1} onClick={() => void load(data.page - 1)} className="min-h-10 rounded-xl border px-4 disabled:opacity-50">Previous</button><button type="button" disabled={loading || data.page * data.limit >= data.total} onClick={() => void load(data.page + 1)} className="min-h-10 rounded-xl border px-4 disabled:opacity-50">Next</button></div></div>
      </section>
    </main>
  );
}
