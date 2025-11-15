'use client';

import { useState } from 'react';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export default function SettingsPage() {
  const [status, setStatus] = useState<string | null>(null);

  async function handleTruncate() {
    try {
      await api.truncateTournamentData('DELETE');
      setStatus('Tournament data truncated.');
    } catch (error) {
      setStatus(`Failed to truncate: ${(error as Error).message}`);
    }
  }

  async function handleDrop() {
    try {
      await api.dropDatabase('DELETE', 'DROP DATABASE');
      setStatus('Database schema reset.');
    } catch (error) {
      setStatus(`Failed to drop database: ${(error as Error).message}`);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings & maintenance"
        description="Administrative tooling, backups, and Telegram bot delivery policies."
      />

      {status ? <p className="rounded border border-secondary bg-secondary/40 p-3 text-sm text-gray-200">{status}</p> : null}

      <section className="rounded-xl border border-secondary bg-surface p-6 shadow-lg space-y-4">
        <h3 className="text-xl font-semibold">Data management</h3>
        <p className="text-sm text-gray-300">
          Use the TRUNCATE command to reset tournament history while keeping server definitions intact. This is a destructive
          action and cannot be undone.
        </p>
        <ConfirmDialog
          title="Truncate tournament data"
          description="Remove tournaments, matches, stats, and history entries. Servers remain registered."
          confirmLabel="Truncate"
          confirmValue="DELETE"
          onConfirm={handleTruncate}
          tone="danger"
        />
      </section>

      <section className="rounded-xl border border-secondary bg-surface p-6 shadow-lg space-y-4">
        <h3 className="text-xl font-semibold">Backups & restores</h3>
        <p className="text-sm text-gray-300">
          Use <code className="font-mono">pg_dump</code> to export the PostgreSQL database and{' '}
          <code className="font-mono">pg_restore</code> to import backups according to the official PostgreSQL documentation.
          Store exports off the tournament server to avoid filling disk capacity.
        </p>
        <p className="text-sm text-gray-300">
          Create regular snapshots of demo storage and MatchZy CSV archives alongside database dumps for complete recovery.
        </p>
      </section>

      <section className="rounded-xl border border-secondary bg-surface p-6 shadow-lg space-y-4">
        <h3 className="text-xl font-semibold">Danger zone</h3>
        <p className="text-sm text-gray-300">
          Resets the entire schema (drops and recreates the public schema). Requires configuration flag ALLOW_DB_DROP=true.
        </p>
        <ConfirmDialog
          title="Drop database schema"
          description="Drops and recreates the PostgreSQL public schema. Ensure backups are taken."
          confirmLabel="Drop"
          confirmValue="DELETE"
          secondaryPrompt="Type DROP DATABASE to confirm"
          secondaryConfirmValue="DROP DATABASE"
          onConfirm={handleDrop}
          tone="danger"
        />
      </section>

      <section className="rounded-xl border border-secondary bg-surface p-6 shadow-lg space-y-4">
        <h3 className="text-xl font-semibold">Telegram bot delivery</h3>
        <p className="text-sm text-gray-300">
          Only final match results are pushed to subscribers to respect Telegram Bot API rate limits (see Telegram Bots FAQ).
          Configure bot tokens and chat IDs via environment variables before enabling notifications.
        </p>
      </section>
    </div>
  );
}
