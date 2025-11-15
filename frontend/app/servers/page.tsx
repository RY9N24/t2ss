'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { GameServer } from '../../lib/types';
import { PageHeader } from '../../components/PageHeader';

export default function ServersPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['servers'],
    queryFn: async () => api.fetchServers() as Promise<GameServer[]>,
  });

  const [form, setForm] = useState({ name: '', endpoint: '', location: '', notes: '' });
  const [tokenServerId, setTokenServerId] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  async function handleCreateServer(event: React.FormEvent) {
    event.preventDefault();
    await api.createServer(form);
    await queryClient.invalidateQueries({ queryKey: ['servers'] });
    setForm({ name: '', endpoint: '', location: '', notes: '' });
  }

  async function handleToggle(server: GameServer, active: boolean) {
    await api.toggleServer(server.id, active);
    await queryClient.invalidateQueries({ queryKey: ['servers'] });
  }

  async function handleCreateToken(serverId: string) {
    const response = await api.createServerToken(serverId);
    setTokenServerId(serverId);
    setGeneratedToken(response.plaintext);
    await queryClient.invalidateQueries({ queryKey: ['servers'] });
  }

  async function handleRevokeToken(serverId: string, tokenId: string) {
    await api.revokeServerToken(serverId, tokenId);
    await queryClient.invalidateQueries({ queryKey: ['servers'] });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Servers"
        description="Register GOTV endpoints and manage ingest tokens for MatchZy loadmatch setups."
      />

      <section className="rounded-xl border border-secondary bg-surface p-6 shadow-lg">
        <h3 className="text-xl font-semibold mb-4">Register server</h3>
        <form onSubmit={handleCreateServer} className="grid gap-4 md:grid-cols-2">
          <input
            required
            placeholder="Display name"
            className="rounded border border-secondary bg-background p-2"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            required
            placeholder="MatchZy server identifier or endpoint"
            className="rounded border border-secondary bg-background p-2"
            value={form.endpoint}
            onChange={(event) => setForm((prev) => ({ ...prev, endpoint: event.target.value }))}
          />
          <input
            placeholder="Location"
            className="rounded border border-secondary bg-background p-2"
            value={form.location}
            onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
          />
          <input
            placeholder="Notes"
            className="rounded border border-secondary bg-background p-2"
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          />
          <div>
            <button type="submit" className="rounded bg-primary px-4 py-2 text-black font-semibold">
              Register server
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-secondary bg-surface p-6 shadow-lg">
        <h3 className="text-xl font-semibold mb-4">Registered servers</h3>
        {isLoading ? (
          <p className="text-gray-400">Loading servers...</p>
        ) : data && data.length === 0 ? (
          <p className="text-gray-400">No servers registered yet.</p>
        ) : (
          <div className="space-y-4">
            {data?.map((server) => (
              <div key={server.id} className="rounded border border-secondary bg-background/60 p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">{server.name}</h4>
                    <p className="text-sm text-gray-400">Endpoint: {server.endpoint}</p>
                    <p className="text-xs text-gray-500">
                      Last seen: {server.lastSeenAt ? new Date(server.lastSeenAt).toLocaleString() : 'Never'}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      className={`rounded px-3 py-1 text-sm font-semibold ${server.isActive ? 'bg-success text-black' : 'bg-secondary text-white'}`}
                      onClick={() => handleToggle(server, !server.isActive)}
                    >
                      {server.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      className="rounded border border-primary px-3 py-1 text-sm"
                      onClick={() => handleCreateToken(server.id)}
                    >
                      Create token
                    </button>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-gray-400">Tokens</p>
                  {server.tokens.length === 0 ? (
                    <p className="text-gray-400 text-sm">No tokens issued.</p>
                  ) : (
                    <ul className="space-y-2 text-sm text-gray-300">
                      {server.tokens.map((token) => (
                        <li key={token.id} className="flex items-center justify-between rounded border border-secondary p-2">
                          <div>
                            <p className="font-semibold text-white">{token.label ?? token.id}</p>
                            <p className="text-xs text-gray-500">
                              Created {new Date(token.createdAt).toLocaleString()} | Last used:{' '}
                              {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : 'Never'}
                            </p>
                          </div>
                          <button
                            className="rounded border border-danger px-3 py-1 text-xs text-danger"
                            onClick={() => handleRevokeToken(server.id, token.id)}
                          >
                            Revoke
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {tokenServerId === server.id && generatedToken ? (
                  <div className="mt-4 rounded border border-primary bg-primary/10 p-3 text-sm text-yellow-200">
                    <p className="font-semibold text-yellow-100">New token</p>
                    <p className="mt-1 break-all font-mono">{generatedToken}</p>
                    <p className="text-xs mt-2 text-yellow-200">Copy immediately; it will not be shown again.</p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
