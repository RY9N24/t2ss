import type {
  DemoFilterOptions,
  DemoListResponse,
  DiskStats,
  EmergencyGcRunResult,
  EmergencyGcSettings,
  GameServer,
  HistoryMatch,
  LiveMatch,
  MatchDetail,
  ServerToken,
} from './types';

const PUBLIC_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';
const INTERNAL_BASE =
  process.env.INTERNAL_API_BASE_URL ?? process.env.API_ORIGIN ?? (PUBLIC_BASE.startsWith('http') ? PUBLIC_BASE : 'http://api:3000');

function resolveUrl(path: string) {
  if (typeof window === 'undefined') {
    if (PUBLIC_BASE.startsWith('http')) {
      return `${PUBLIC_BASE}${path}`;
    }
    return `${INTERNAL_BASE}${path}`;
  }
  return `${PUBLIC_BASE}${path}`;
}

export { resolveUrl };

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(resolveUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return (await response.json()) as T;
  }
  return (await response.text()) as T;
}

export const api = {
  fetchLiveMatches: () => apiFetch<LiveMatch[]>('/matches/live'),
  fetchHistory: (params: URLSearchParams) => apiFetch<{ total: number; results: HistoryMatch[] }>(`/matches/history?${params.toString()}`),
  exportHistory: (params: URLSearchParams) => fetch(resolveUrl(`/matches/history/export?${params.toString()}`)),
  fetchMatch: (id: string) => apiFetch<MatchDetail>(`/matches/${id}`),
  fetchDisk: () => apiFetch<DiskStats>('/system/disk'),
  fetchJetStream: () => apiFetch<Record<string, unknown>>('/system/jsz'),
  fetchDatabase: () => apiFetch<{ sizeBytes: number }>('/system/database'),
  fetchDemoFilters: () => apiFetch<DemoFilterOptions>('/demos/options'),
  fetchDemos: (params: URLSearchParams) => apiFetch<DemoListResponse>(`/demos?${params.toString()}`),
  fetchEmergencyGc: () => apiFetch<EmergencyGcSettings>('/system/emergency-gc'),
  updateEmergencyGc: (payload: Partial<EmergencyGcSettings>) =>
    apiFetch<EmergencyGcSettings>('/system/emergency-gc', { method: 'PATCH', body: JSON.stringify(payload) }),
  runEmergencyGc: (force?: boolean) =>
    apiFetch<EmergencyGcRunResult>('/system/emergency-gc/run', { method: 'POST', body: JSON.stringify({ force }) }),
  deleteDemos: (ids: string[]) =>
    apiFetch<{ deleted: string[]; skipped: Array<{ id: string; reason: string }> }>('/demos/delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  reuploadDemo: (id: string) => apiFetch<{ queued: boolean }>(`/demos/${id}/reupload`, { method: 'POST', body: JSON.stringify({}) }),
  updateDemoFlags: (id: string, payload: { isPinned?: boolean; isInUse?: boolean }) =>
    apiFetch<{ id: string; isPinned: boolean; isInUse: boolean }>(`/demos/${id}/flags`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  fetchServers: () => apiFetch<GameServer[]>('/servers'),
  createServer: (payload: { name: string; endpoint: string; location?: string; notes?: string }) =>
    apiFetch<GameServer>('/servers', { method: 'POST', body: JSON.stringify(payload) }),
  toggleServer: (id: string, active: boolean) =>
    apiFetch<GameServer>(`/servers/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'POST', body: JSON.stringify({}) }),
  createServerToken: (id: string, label?: string) =>
    apiFetch<{ plaintext: string; token: ServerToken }>(`/servers/${id}/tokens`, { method: 'POST', body: JSON.stringify({ label }) }),
  revokeServerToken: (id: string, tokenId: string) =>
    apiFetch<ServerToken>(`/servers/${id}/tokens/${tokenId}/revoke`, { method: 'POST', body: JSON.stringify({}) }),
  truncateTournamentData: (confirm: string) =>
    apiFetch<{ truncated: boolean }>('/admin/truncate', { method: 'POST', body: JSON.stringify({ confirm }) }),
  dropDatabase: (confirm: string, finalConfirm: string) =>
    apiFetch<{ dropped: boolean }>('/admin/drop-database', { method: 'POST', body: JSON.stringify({ confirm, finalConfirm }) }),
};
