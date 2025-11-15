'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { HistoryMatch } from '../../lib/types';
import { PageHeader } from '../../components/PageHeader';

export default function HistoryPage() {
  const [filters, setFilters] = useState({
    search: '',
    tournamentId: '',
    teamId: '',
    from: '',
    to: '',
  });

  const params = useMemo(() => {
    const searchParams = new URLSearchParams();
    if (filters.search) searchParams.set('search', filters.search);
    if (filters.tournamentId) searchParams.set('tournamentId', filters.tournamentId);
    if (filters.teamId) searchParams.set('teamId', filters.teamId);
    if (filters.from) searchParams.set('from', filters.from);
    if (filters.to) searchParams.set('to', filters.to);
    return searchParams;
  }, [filters]);

  const { data, isLoading } = useQuery({
    queryKey: ['history', params.toString()],
    queryFn: async () => {
      const result = await api.fetchHistory(params);
      return result as { total: number; results: HistoryMatch[] };
    },
  });

  async function handleExport() {
    const response = await api.exportHistory(params);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'match-history.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="History"
        description="Confirmed results after CSV reconciliation with MatchZy exports."
        actions={
          <button className="rounded bg-primary px-4 py-2 text-black font-semibold" onClick={handleExport}>
            Export CSV
          </button>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <input
          placeholder="Search by team, tournament or match title"
          className="rounded border border-secondary bg-surface p-2"
          value={filters.search}
          onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
        />
        <input
          placeholder="Tournament ID"
          className="rounded border border-secondary bg-surface p-2"
          value={filters.tournamentId}
          onChange={(event) => setFilters((prev) => ({ ...prev, tournamentId: event.target.value }))}
        />
        <input
          placeholder="Team ID"
          className="rounded border border-secondary bg-surface p-2"
          value={filters.teamId}
          onChange={(event) => setFilters((prev) => ({ ...prev, teamId: event.target.value }))}
        />
        <div className="flex gap-3">
          <input
            type="date"
            className="w-1/2 rounded border border-secondary bg-surface p-2"
            value={filters.from}
            onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
          />
          <input
            type="date"
            className="w-1/2 rounded border border-secondary bg-surface p-2"
            value={filters.to}
            onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-400">Loading history...</p>
      ) : data && data.results.length === 0 ? (
        <p className="text-gray-400">No completed matches match the current filters.</p>
      ) : (
        <div className="space-y-4">
          {data?.results.map((match) => {
            const winner = match.winnerTeamId
              ? match.homeTeam?.id === match.winnerTeamId
                ? match.homeTeam?.name
                : match.awayTeam?.name
              : 'Pending';
            const loser = match.winnerTeamId
              ? match.homeTeam?.id === match.winnerTeamId
                ? match.awayTeam?.name
                : match.homeTeam?.name
              : '';
            const title = `${loser ?? 'TBD'} lose vs ${winner ?? 'TBD'} win`;
            return (
              <div key={match.id} className="rounded-xl border border-secondary bg-surface p-5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-wide text-gray-400">{title}</p>
                    <h3 className="text-2xl font-semibold">
                      {match.homeTeam?.name ?? 'Team 1'} <span className="text-gray-400">vs</span> {match.awayTeam?.name ?? 'Team 2'}
                    </h3>
                    <p className="text-gray-400">{match.tournament ?? 'Tournament TBD'}</p>
                  </div>
                  <div className="text-right space-y-2">
                    <div>
                      <p className="text-3xl font-bold text-primary">
                        {match.team1Score} - {match.team2Score}
                      </p>
                      <p className="text-xs text-gray-500">
                        Completed: {match.completedAt ? new Date(match.completedAt).toLocaleString() : 'Pending'}
                      </p>
                    </div>
                    <a
                      href={`/match/${match.id}`}
                      className="inline-flex items-center justify-center rounded border border-primary px-3 py-1 text-xs font-semibold"
                    >
                      View match
                    </a>
                  </div>
                </div>
              </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
