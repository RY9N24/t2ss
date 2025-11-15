'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { DiskStats } from '../../lib/types';
import { PageHeader } from '../../components/PageHeader';
import { InfoCard } from '../../components/InfoCard';
import { DiskUsageBanner } from '../../components/DiskUsageBanner';

export default function DiskPage() {
  const diskQuery = useQuery({ queryKey: ['disk'], queryFn: () => api.fetchDisk() as Promise<DiskStats> });
  const dbQuery = useQuery({ queryKey: ['db-size'], queryFn: () => api.fetchDatabase() as Promise<{ sizeBytes: number }> });
  const jszQuery = useQuery({ queryKey: ['jsz'], queryFn: () => api.fetchJetStream() as Promise<Record<string, unknown>> });

  const usagePercent = diskQuery.data?.usagePercent ?? 0;
  const jszSubjects = useMemo(() => {
    const streams = (jszQuery.data?.streams as Array<{ name: string; state: { messages: number } }> | undefined) ?? [];
    return streams.map((stream) => `${stream.name}: ${stream.state.messages} msgs`);
  }, [jszQuery.data]);

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

  return (
    <div>
      <PageHeader
        title="Disk & JetStream"
        description="Observe disk utilisation, JetStream /jsz telemetry, and database footprint."
      />

      <DiskUsageBanner usagePercent={usagePercent} onManage={() => window.open('/settings', '_blank')} />

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
    </div>
  );
}
