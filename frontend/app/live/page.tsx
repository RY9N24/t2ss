'use client';

import { useMemo } from 'react';
import { useLiveMatches } from '../../lib/hooks';
import { PageHeader } from '../../components/PageHeader';

export default function LivePage() {
  const { matches, isLoading } = useLiveMatches();

  const content = useMemo(() => {
    if (isLoading && matches.length === 0) {
      return <p className="text-gray-400">Loading live data...</p>;
    }
    if (matches.length === 0) {
      return <p className="text-gray-400">No live matches detected. Waiting for MatchZy events.</p>;
    }

    return (
      <div className="space-y-6">
        {matches.map((match) => (
          <div key={match.id} className="rounded-xl border border-secondary bg-surface p-6 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-wide text-gray-400">{match.tournament ?? 'Unassigned tournament'}</p>
                <h3 className="text-2xl font-semibold">
                  {match.homeTeam?.name ?? 'Team 1'} <span className="text-gray-400">vs</span> {match.awayTeam?.name ?? 'Team 2'}
                </h3>
                <p className="text-gray-400">{match.title ?? match.externalId ?? match.id}</p>
              </div>
              <div className="text-right">
                <p className="text-sm uppercase tracking-wide text-gray-400">Aggregate score</p>
                <p className="text-4xl font-bold text-primary">
                  {match.aggregateScore.team1} - {match.aggregateScore.team2}
                </p>
                <p className="text-xs text-gray-500">Status: {match.status}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {match.mapSummaries.map((map) => (
                <div key={map.id} className="rounded-lg border border-secondary bg-background/60 p-4">
                  <p className="text-sm uppercase tracking-wide text-gray-400">
                    Map {map.mapNumber + 1}: {map.name}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {map.team1Score} - {map.team2Score}
                  </p>
                  <p className="text-xs text-gray-500">{map.status ?? 'Pending'}</p>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <p className="text-sm uppercase tracking-wide text-gray-400 mb-2">Event counters</p>
              <div className="grid gap-3 md:grid-cols-4">
                {Object.entries(match.eventCounts).map(([event, count]) => (
                  <div key={event} className="rounded border border-secondary bg-background/50 p-3 text-sm">
                    <p className="text-gray-300">{event}</p>
                    <p className="text-xl font-semibold">{count}</p>
                  </div>
                ))}
                {Object.keys(match.eventCounts).length === 0 ? (
                  <p className="text-gray-400 text-sm">No aggregated events yet from MatchZy streams.</p>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }, [isLoading, matches]);

  return (
    <div>
      <PageHeader
        title="Live matches"
        description="Real-time status derived from MatchZy events (MatchZy Events & Forwards)."
      />
      {content}
    </div>
  );
}
