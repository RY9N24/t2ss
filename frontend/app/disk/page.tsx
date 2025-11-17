'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, resolveUrl } from '../../lib/api';
import type { DemoFile, DemoFilterOptions, DiskStats } from '../../lib/types';
import { PageHeader } from '../../components/PageHeader';
import { InfoCard } from '../../components/InfoCard';
import { DiskUsageBanner } from '../../components/DiskUsageBanner';

interface DemoFiltersState {
  tournamentId: string;
  status: string;
  pinned: string;
  inUse: string;
  from: string;
  to: string;
  minSize: string;
  maxSize: string;
  search: string;
}

const initialFilters: DemoFiltersState = {
  tournamentId: 'all',
  status: 'all',
  pinned: 'all',
  inUse: 'all',
  from: '',
  to: '',
  minSize: '',
  maxSize: '',
  search: '',
};

export default function DiskPage() {
  const queryClient = useQueryClient();
  const tableRef = useRef<HTMLDivElement | null>(null);
  const [filters, setFilters] = useState<DemoFiltersState>(initialFilters);
  const [selected, setSelected] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [gcForm, setGcForm] = useState({ enabled: false, graceMinutes: 30, notifyPanel: true, notifyBot: false });
  const [actionStatuses, setActionStatuses] = useState<Record<string, { type: 'pending' | 'success' | 'error'; message: string; expiresAt: number }>>({});

  const diskQuery = useQuery({ queryKey: ['disk'], queryFn: () => api.fetchDisk() as Promise<DiskStats> });
  const dbQuery = useQuery({ queryKey: ['db-size'], queryFn: () => api.fetchDatabase() as Promise<{ sizeBytes: number }> });
  const jszQuery = useQuery({ queryKey: ['jsz'], queryFn: () => api.fetchJetStream() as Promise<Record<string, unknown>> });
  const demoFiltersQuery = useQuery({ queryKey: ['demo-filter-options'], queryFn: () => api.fetchDemoFilters() as Promise<DemoFilterOptions> });
  const gcQuery = useQuery({ queryKey: ['emergency-gc'], queryFn: () => api.fetchEmergencyGc() });

  useEffect(() => {
    if (gcQuery.data) {
      setGcForm({
        enabled: gcQuery.data.enabled,
        graceMinutes: gcQuery.data.graceMinutes,
        notifyPanel: gcQuery.data.notifyPanel,
        notifyBot: gcQuery.data.notifyBot,
      });
    }
  }, [gcQuery.data]);

  const registerStatus = useCallback((ids: string[], type: 'pending' | 'success' | 'error', message: string) => {
    if (ids.length === 0) return;
    setActionStatuses((prev) => {
      const next = { ...prev };
      const expiresAt = Date.now() + 8000;
      ids.forEach((id) => {
        next[id] = { type, message, expiresAt };
      });
      return next;
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setActionStatuses((prev) => {
        let mutated = false;
        const next: typeof prev = {};
        Object.entries(prev).forEach(([id, status]) => {
          if (status.expiresAt > now) {
            next[id] = status;
          } else {
            mutated = true;
          }
        });
        return mutated ? next : prev;
      });
    }, 4000);
    return () => window.clearInterval(timer);
  }, []);

  function translateSkipReason(reason: string) {
    switch (reason) {
      case 'pinned':
        return 'Demo is pinned';
      case 'in_use':
        return 'Demo is still in use';
      case 'not_found':
        return 'Demo not found';
      default:
        return `Skipped: ${reason}`;
    }
  }

  const usagePercent = diskQuery.data?.usagePercent ?? 0;
  const jszSubjects = useMemo(() => {
    const streams = (jszQuery.data?.streams as Array<{ name: string; state: { messages: number } }> | undefined) ?? [];
    return streams.map((stream) => `${stream.name}: ${stream.state.messages} msgs`);
  }, [jszQuery.data]);

  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.tournamentId !== 'all') params.set('tournamentId', filters.tournamentId);
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.pinned !== 'all') params.set('pinned', filters.pinned);
    if (filters.inUse !== 'all') params.set('inUse', filters.inUse);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.minSize) params.set('minSize', filters.minSize);
    if (filters.maxSize) params.set('maxSize', filters.maxSize);
    if (filters.search) params.set('search', filters.search);
    return params;
  }, [filters]);

  const demosQuery = useQuery({
    queryKey: ['demos', searchParams.toString()],
    queryFn: () => api.fetchDemos(searchParams),
  });

  useEffect(() => {
    const currentIds = new Set((demosQuery.data?.results ?? []).map((demo) => demo.id));
    setSelected((prev) => prev.filter((id) => currentIds.has(id)));
  }, [demosQuery.data]);

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.deleteDemos(ids),
    onMutate: (ids) => registerStatus(ids, 'pending', 'Deleting...'),
    onSuccess: (result) => {
      setSelected([]);
      setFeedback(`Удалено ${result.deleted.length}, пропущено ${result.skipped.length}`);
      registerStatus(result.deleted, 'success', 'Demo deleted');
      result.skipped.forEach((item) => registerStatus([item.id], 'error', translateSkipReason(item.reason)));
      queryClient.invalidateQueries({ queryKey: ['demos'] });
    },
    onError: (error, ids) => {
      registerStatus(ids, 'error', (error as Error).message);
      setFeedback((error as Error).message);
    },
  });

  const reuploadMutation = useMutation({
    mutationFn: (id: string) => api.reuploadDemo(id),
    onMutate: (id) => registerStatus([id], 'pending', 'Contacting server...'),
    onSuccess: (_, id) => {
      registerStatus([id], 'success', 'Reupload queued');
      setFeedback('Запрошена повторная загрузка демки');
      queryClient.invalidateQueries({ queryKey: ['demos'] });
    },
    onError: (error, id) => {
      registerStatus([id], 'error', (error as Error).message);
      setFeedback((error as Error).message);
    },
  });

  const flagMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { isPinned?: boolean; isInUse?: boolean } }) =>
      api.updateDemoFlags(id, payload),
    onMutate: ({ id }) => registerStatus([id], 'pending', 'Saving flags...'),
    onSuccess: (_, variables) => {
      registerStatus([variables.id], 'success', 'Flags updated');
      queryClient.invalidateQueries({ queryKey: ['demos'] });
    },
    onError: (error, variables) => {
      registerStatus([variables.id], 'error', (error as Error).message);
      setFeedback((error as Error).message);
    },
  });

  const updateGcMutation = useMutation({
    mutationFn: () =>
      api.updateEmergencyGc({
        enabled: gcForm.enabled,
        graceMinutes: gcForm.graceMinutes,
        notifyPanel: gcForm.notifyPanel,
        notifyBot: gcForm.notifyBot,
      }),
    onSuccess: () => {
      setFeedback('Emergency GC configuration saved');
      queryClient.invalidateQueries({ queryKey: ['emergency-gc'] });
    },
    onError: (error) => setFeedback((error as Error).message),
  });

  const runGcMutation = useMutation({
    mutationFn: () => api.runEmergencyGc(true),
    onSuccess: (result) => {
      const deletedCount = result.deleted.length;
      setFeedback(
        deletedCount > 0
          ? `Emergency GC removed ${deletedCount} demo(s) and usage is ${result.finalUsagePercent.toFixed(1)}%.`
          : `Emergency GC finished with reason: ${result.reason}.`,
      );
      queryClient.invalidateQueries({ queryKey: ['disk'] });
      queryClient.invalidateQueries({ queryKey: ['demos'] });
      queryClient.invalidateQueries({ queryKey: ['emergency-gc'] });
    },
    onError: (error) => setFeedback((error as Error).message),
  });

  function formatBytes(bytes: number) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  }

  function handleCheckboxChange(id: string, checked: boolean) {
    setSelected((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((item) => item !== id)));
  }

  function handleSelectAll(demos: DemoFile[], checked: boolean) {
    if (!checked) {
      setSelected([]);
      return;
    }
    setSelected(demos.map((demo) => demo.id));
  }

  function handleBulkDelete() {
    if (selected.length === 0) return;
    if (!window.confirm(`Удалить ${selected.length} демо?`)) return;
    deleteMutation.mutate(selected);
  }

  function handleDeleteSingle(id: string) {
    if (!window.confirm('Удалить выбранную демку?')) return;
    deleteMutation.mutate([id]);
  }

  function handleReupload(id: string) {
    reuploadMutation.mutate(id);
  }

  function togglePin(demo: DemoFile) {
    flagMutation.mutate({ id: demo.id, payload: { isPinned: !demo.isPinned } });
  }

  function toggleInUse(demo: DemoFile) {
    flagMutation.mutate({ id: demo.id, payload: { isInUse: !demo.isInUse } });
  }

  const demos = demosQuery.data?.results ?? [];
  const filtersData = demoFiltersQuery.data;
  const lastGcRun = gcQuery.data?.lastRun;

  return (
    <div>
      <PageHeader
        title="Disk & JetStream"
        description="Observe disk utilisation, JetStream /jsz telemetry, and database footprint."
      />

      <DiskUsageBanner
        usagePercent={usagePercent}
        onManage={() => tableRef.current?.scrollIntoView({ behavior: 'smooth' })}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard
          title="Demo storage"
          value={diskQuery.data ? formatBytes(diskQuery.data.usedBytes) : '...'}
          footer={`Usage ${usagePercent.toFixed(1)}% of ${diskQuery.data ? formatBytes(diskQuery.data.totalBytes) : '...'}`}
          accent={usagePercent >= 90 ? 'danger' : usagePercent >= 70 ? 'success' : 'default'}
        />
        <InfoCard
          title="Available"
          value={diskQuery.data ? formatBytes(diskQuery.data.availableBytes) : '...'}
          footer="Free space for ingest and exports"
        />
        <InfoCard
          title="Database size"
          value={dbQuery.data ? formatBytes(dbQuery.data.sizeBytes) : '...'}
          footer="Use pg_dump / pg_restore for backups"
        />
      </div>

      <section className="mt-8 rounded-xl border border-secondary bg-surface p-6 shadow-lg">
        <h3 className="text-xl font-semibold mb-4">JetStream summary</h3>
        {jszQuery.isLoading ? (
          <p className="text-gray-400">Loading /jsz data...</p>
        ) : jszSubjects.length === 0 ? (
          <p className="text-gray-400 text-sm">No JetStream streams discovered.</p>
        ) : (
          <ul className="space-y-2 text-sm text-gray-300">
            {jszSubjects.map((line) => (
              <li key={line} className="rounded border border-secondary bg-background/60 p-3">
                {line}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-gray-500">
          Source: NATS JetStream Monitoring (/jsz). Adjust credentials via Caddy configuration.
        </p>
      </section>

      <section className="mt-8 rounded-xl border border-secondary bg-surface p-6 shadow-lg space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-semibold">Emergency cleanup (97% → 95%)</h3>
            <p className="text-sm text-gray-400">
              Automatically deletes the oldest finished demos when disk usage crosses 97% until it falls under 95%.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded border border-secondary px-4 py-2 text-sm"
              onClick={() => updateGcMutation.mutate()}
              disabled={updateGcMutation.isLoading}
            >
              Save config
            </button>
            <button
              className="rounded bg-danger px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
              onClick={() => runGcMutation.mutate()}
              disabled={runGcMutation.isLoading}
            >
              Run now
            </button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm text-gray-300 flex items-center gap-2">
            <input
              type="checkbox"
              checked={gcForm.enabled}
              onChange={(event) => setGcForm((prev) => ({ ...prev, enabled: event.target.checked }))}
            />
            Enable emergency GC (OFF by default)
          </label>
          <label className="text-sm text-gray-300">
            Grace period (minutes)
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded border border-secondary bg-background/60 p-2"
              value={gcForm.graceMinutes}
              onChange={(event) =>
                setGcForm((prev) => ({ ...prev, graceMinutes: Math.max(0, Number(event.target.value) || 0) }))
              }
            />
          </label>
          <label className="text-sm text-gray-300 flex items-center gap-2">
            <input
              type="checkbox"
              checked={gcForm.notifyPanel}
              onChange={(event) => setGcForm((prev) => ({ ...prev, notifyPanel: event.target.checked }))}
            />
            Log banner warnings in the panel
          </label>
          <label className="text-sm text-gray-300 flex items-center gap-2">
            <input
              type="checkbox"
              checked={gcForm.notifyBot}
              onChange={(event) => setGcForm((prev) => ({ ...prev, notifyBot: event.target.checked }))}
            />
            Notify the Telegram bot when demos are removed
          </label>
        </div>
        <div className="rounded border border-secondary/60 bg-background/40 p-3 text-xs text-gray-400">
          {gcQuery.isLoading ? (
            'Loading emergency GC status...'
          ) : lastGcRun ? (
            <>
              <div>
                Last run {new Date(lastGcRun.lastRunAt).toLocaleString()} ({lastGcRun.trigger}) — {lastGcRun.reason}.
              </div>
              <div>
                Deleted demos: {lastGcRun.deleted.length}{' '}
                {lastGcRun.deleted.slice(0, 3).map((item) => item.filename ?? item.id).join(', ')}
              </div>
              <div>Usage after cleanup: {lastGcRun.finalUsagePercent.toFixed(1)}%</div>
            </>
          ) : (
            'Emergency GC has not been executed yet.'
          )}
        </div>
      </section>

      <section ref={tableRef} className="mt-8 rounded-xl border border-secondary bg-surface p-6 shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-semibold">Demo storage</h3>
            <p className="text-sm text-gray-400">Filter, download, reupload, or delete stored demos.</p>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded border border-secondary px-3 py-2 text-sm"
              onClick={() => setFilters(initialFilters)}
            >
              Reset filters
            </button>
            <button
              className="rounded bg-danger px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
              disabled={selected.length === 0 || deleteMutation.isLoading}
              onClick={handleBulkDelete}
            >
              Delete selected ({selected.length})
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm text-gray-400">
            Tournament
            <select
              className="mt-1 w-full rounded border border-secondary bg-background/60 p-2"
              value={filters.tournamentId}
              onChange={(event) => setFilters((prev) => ({ ...prev, tournamentId: event.target.value }))}
            >
              <option value="all">All tournaments</option>
              {filtersData?.tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name ?? tournament.id}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-400">
            Status
            <select
              className="mt-1 w-full rounded border border-secondary bg-background/60 p-2"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="all">Any</option>
              {(filtersData?.statuses ?? ['stored', 'deleted', 'missing', 'reuploading']).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-400">
            Pinned
            <select
              className="mt-1 w-full rounded border border-secondary bg-background/60 p-2"
              value={filters.pinned}
              onChange={(event) => setFilters((prev) => ({ ...prev, pinned: event.target.value }))}
            >
              <option value="all">All</option>
              <option value="true">Pinned only</option>
              <option value="false">Unpinned</option>
            </select>
          </label>
          <label className="text-sm text-gray-400">
            In use
            <select
              className="mt-1 w-full rounded border border-secondary bg-background/60 p-2"
              value={filters.inUse}
              onChange={(event) => setFilters((prev) => ({ ...prev, inUse: event.target.value }))}
            >
              <option value="all">All</option>
              <option value="true">In use</option>
              <option value="false">Idle</option>
            </select>
          </label>
          <label className="text-sm text-gray-400">
            From
            <input
              type="date"
              className="mt-1 w-full rounded border border-secondary bg-background/60 p-2"
              value={filters.from}
              onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
            />
          </label>
          <label className="text-sm text-gray-400">
            To
            <input
              type="date"
              className="mt-1 w-full rounded border border-secondary bg-background/60 p-2"
              value={filters.to}
              onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
            />
          </label>
          <label className="text-sm text-gray-400">
            Min size (MB)
            <input
              type="number"
              min="0"
              className="mt-1 w-full rounded border border-secondary bg-background/60 p-2"
              value={filters.minSize}
              onChange={(event) => setFilters((prev) => ({ ...prev, minSize: event.target.value }))}
            />
          </label>
          <label className="text-sm text-gray-400">
            Max size (MB)
            <input
              type="number"
              min="0"
              className="mt-1 w-full rounded border border-secondary bg-background/60 p-2"
              value={filters.maxSize}
              onChange={(event) => setFilters((prev) => ({ ...prev, maxSize: event.target.value }))}
            />
          </label>
          <label className="text-sm text-gray-400 md:col-span-2 lg:col-span-3">
            Search filename or MatchZy ID
            <input
              type="text"
              placeholder="demo.zip or match id"
              className="mt-1 w-full rounded border border-secondary bg-background/60 p-2"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            />
          </label>
        </div>

        {feedback ? (
          <p className="mt-4 rounded border border-secondary bg-background/60 p-3 text-sm text-gray-200">{feedback}</p>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-gray-400">
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.length > 0 && selected.length === demos.length}
                    onChange={(event) => handleSelectAll(demos, event.target.checked)}
                  />
                </th>
                <th className="px-3 py-2">Match</th>
                <th className="px-3 py-2">Filename</th>
                <th className="px-3 py-2">MatchZy</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Flags</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {demosQuery.isLoading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-gray-400">
                    Loading demos...
                  </td>
                </tr>
              ) : demos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-gray-400">
                    No demos stored yet.
                  </td>
                </tr>
              ) : (
                demos.map((demo) => (
                  <tr key={demo.id} className="border-t border-secondary/40">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.includes(demo.id)}
                        onChange={(event) => handleCheckboxChange(demo.id, event.target.checked)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-100">{demo.match?.title ?? 'Unlinked'}</span>
                        <span className="text-xs text-gray-400">
                          {demo.match?.tournament?.name ?? '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span>{demo.originalFilename ?? 'unknown.zip'}</span>
                        <span className="text-xs text-gray-500">
                          Uploaded {new Date(demo.uploadedAt).toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400">
                      <div>Match: {demo.matchzyMatchId ?? '—'}</div>
                      <div>Map: {demo.matchzyMapNumber ?? '—'}</div>
                    </td>
                    <td className="px-3 py-2">{demo.sizeBytes ? formatBytes(demo.sizeBytes) : '—'}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full border border-secondary px-2 py-1 text-xs">
                        {demo.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-300">
                      <div>pinned: {demo.isPinned ? 'yes' : 'no'}</div>
                      <div>in use: {demo.effectiveInUse ? 'yes' : 'no'}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={demo.downloadable ? resolveUrl(`/demos/${demo.id}/download`) : '#'}
                          className={`rounded border border-secondary px-3 py-1 text-xs ${demo.downloadable ? 'hover:bg-primary/20' : 'opacity-40'}`}
                        >
                          Download
                        </a>
                        <button
                          className="rounded border border-secondary px-3 py-1 text-xs hover:bg-primary/20"
                          onClick={() => handleReupload(demo.id)}
                          disabled={reuploadMutation.isLoading}
                        >
                          Reupload
                        </button>
                        <button
                          className="rounded border border-secondary px-3 py-1 text-xs hover:bg-primary/20"
                          onClick={() => togglePin(demo)}
                        >
                          {demo.isPinned ? 'Unpin' : 'Pin'}
                        </button>
                        <button
                          className="rounded border border-secondary px-3 py-1 text-xs hover:bg-primary/20"
                          onClick={() => toggleInUse(demo)}
                        >
                          {demo.isInUse ? 'Mark idle' : 'Mark in use'}
                        </button>
                        <button
                          className="rounded border border-danger px-3 py-1 text-xs text-black"
                          onClick={() => handleDeleteSingle(demo.id)}
                          disabled={!demo.canDelete || deleteMutation.isLoading}
                        >
                          Delete
                        </button>
                      </div>
                      {actionStatuses[demo.id] ? (
                        <p
                          className={`mt-2 text-xs ${
                            actionStatuses[demo.id]?.type === 'error'
                              ? 'text-red-400'
                              : actionStatuses[demo.id]?.type === 'success'
                              ? 'text-green-300'
                              : 'text-yellow-200'
                          }`}
                        >
                          {actionStatuses[demo.id]?.message}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
