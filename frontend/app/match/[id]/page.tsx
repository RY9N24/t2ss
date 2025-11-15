import { api } from '../../../lib/api';
import type { MatchDetail } from '../../../lib/types';
import { PageHeader } from '../../../components/PageHeader';

async function fetchMatch(id: string): Promise<MatchDetail> {
  return api.fetchMatch(id);
}

export default async function MatchPage({ params }: { params: { id: string } }) {
  const match = await fetchMatch(params.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Match ${match.homeTeam?.name ?? 'Team 1'} vs ${match.awayTeam?.name ?? 'Team 2'}`}
        description="Confirmed final boxscore and timeline after CSV reconciliation."
      />

      <section className="rounded-xl border border-secondary bg-surface p-6 shadow-lg">
        <h3 className="text-xl font-semibold">Series summary</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {match.maps.map((map) => (
            <div key={map.id} className="rounded border border-secondary bg-background/60 p-4">
              <p className="text-sm uppercase tracking-wide text-gray-400">
                Map {map.mapNumber + 1}: {map.name}
              </p>
              <p className="text-2xl font-semibold mt-2">
                {map.team1Score} - {map.team2Score}
              </p>
              <p className="text-xs text-gray-500">Winner: {map.winnerTeamId ?? 'Pending'}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-secondary bg-surface p-6 shadow-lg">
        <h3 className="text-xl font-semibold">Box score</h3>
        <table className="mt-4 w-full text-sm">
          <thead className="text-gray-400">
            <tr className="text-left">
              <th className="py-2">Player</th>
              <th>K</th>
              <th>D</th>
              <th>A</th>
              <th>Damage</th>
            </tr>
          </thead>
          <tbody>
            {match.players.map((player) => (
              <tr key={player.id} className="border-t border-secondary">
                <td className="py-2 font-medium text-white">{player.name ?? player.id}</td>
                <td>{player.kills}</td>
                <td>{player.deaths}</td>
                <td>{player.assists}</td>
                <td>{player.damage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-secondary bg-surface p-6 shadow-lg">
        <h3 className="text-xl font-semibold">Timeline</h3>
        <div className="mt-4 space-y-3 max-h-96 overflow-y-auto">
          {match.timeline.map((event) => (
            <div key={event.id} className="rounded border border-secondary bg-background/60 p-4 text-sm">
              <p className="text-xs text-gray-400">{new Date(event.occurredAt).toLocaleString()}</p>
              <p className="font-semibold">{event.subject}</p>
              <pre className="mt-2 overflow-x-auto text-xs text-gray-400">{JSON.stringify(event.payload, null, 2)}</pre>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-secondary bg-surface p-6 shadow-lg">
        <h3 className="text-xl font-semibold">Demos</h3>
        <ul className="mt-3 space-y-2 text-sm text-gray-300">
          {match.demoFiles.map((file) => (
            <li key={file.id} className="border border-secondary rounded p-3 bg-background/60">
              <p className="font-semibold text-white">{file.originalFilename ?? file.storedPath}</p>
              <p className="text-xs text-gray-400">Uploaded {new Date(file.uploadedAt).toLocaleString()}</p>
            </li>
          ))}
          {match.demoFiles.length === 0 ? <li>No demo files stored for this match yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
