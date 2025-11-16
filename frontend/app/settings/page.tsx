'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { ImportSummaryResponse, TournamentOption } from '../../lib/types';

export default function SettingsPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx' | 'sqlite'>('csv');
  const [importFormat, setImportFormat] = useState<'csv' | 'sqlite'>('csv');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummaryResponse | null>(null);
  const [backupDryRun, setBackupDryRun] = useState<string[] | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .fetchTournaments()
      .then((list) => {
        if (!mounted) return;
        setTournaments(list);
      })
      .catch(() => {
        // ignore errors in settings sidebar
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedTournament && tournaments.length > 0) {
      setSelectedTournament(tournaments[0].id);
    }
  }, [tournaments, selectedTournament]);

  const importTable = useMemo(() => {
    if (!importSummary) return null;
    const entries = Object.entries(importSummary.tables ?? {});
    if (!entries.length) return null;
    return (
      <div className="overflow-x-auto rounded border border-secondary bg-surface/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/30 text-left">
              <th className="px-3 py-2">Table</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Inserted</th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([table, stats]) => (
              <tr key={table} className="odd:bg-black/20">
                <td className="px-3 py-2 font-mono text-xs uppercase">{table}</td>
                <td className="px-3 py-2">{stats.total}</td>
                <td className="px-3 py-2 text-emerald-300">{stats.inserts}</td>
                <td className="px-3 py-2 text-amber-200">{stats.updates}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [importSummary]);

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

  async function handleExportTournament() {
    if (!selectedTournament) {
      setStatus('Select a tournament to export');
      return;
    }
    try {
      const response = await api.exportTournament(selectedTournament, exportFormat);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const suffix =
        exportFormat === 'csv' ? 'csv.zip' : exportFormat === 'xlsx' ? 'xlsx' : 'sqlite';
      link.href = url;
      link.download = `${selectedTournament}.${suffix}`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus('Tournament export generated.');
    } catch (error) {
      setStatus(`Export failed: ${(error as Error).message}`);
    }
  }

  async function runImport(apply: boolean) {
    if (!importFile) {
      setImportStatus('Select a CSV archive or SQLite file before running import.');
      return;
    }
    try {
      const result =
        importFormat === 'csv'
          ? await api.importTournamentCsv(importFile, apply)
          : await api.importTournamentSqlite(importFile, apply);
      setImportSummary(result);
      setImportStatus(apply ? 'Import applied successfully.' : 'Dry-run completed.');
    } catch (error) {
      setImportStatus(`Import failed: ${(error as Error).message}`);
    }
  }

  async function handleBackupDownload() {
    try {
      const response = await api.downloadBackup();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `matchzy-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`;
      link.click();
      URL.revokeObjectURL(url);
      setBackupStatus('Backup created via pg_dump.');
    } catch (error) {
      setBackupStatus(`Backup failed: ${(error as Error).message}`);
    }
  }

  async function runRestore(apply: boolean) {
    if (!restoreFile) {
      setBackupStatus('Select a .dump file before running pg_restore.');
      return;
    }
    try {
      const result = await api.restoreBackup(restoreFile, apply);
      if ('items' in result) {
        setBackupDryRun(result.items);
        setBackupStatus('pg_restore --list dry-run completed.');
      } else {
        setBackupDryRun(null);
        setBackupStatus('Backup restored with pg_restore.');
      }
    } catch (error) {
      setBackupStatus(`Restore failed: ${(error as Error).message}`);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings & maintenance"
        description="Administrative tooling, exports, and Telegram bot delivery policies."
      />

      {status ? <p className="rounded border border-secondary bg-secondary/40 p-3 text-sm text-gray-200">{status}</p> : null}

      <section className="rounded-xl border border-secondary bg-surface p-6 shadow-lg space-y-4">
        <h3 className="text-xl font-semibold">Tournament export</h3>
        <p className="text-sm text-gray-300">
          Generates CSV archives (per entity), Excel workbooks, or SQLite snapshots that mirror MatchZy export formats.
        </p>
        <div className="flex flex-col gap-3 md:flex-row">
          <select
            className="flex-1 rounded border border-secondary bg-black/30 p-2"
            value={selectedTournament}
            onChange={(event) => setSelectedTournament(event.target.value)}
          >
            {tournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.name ?? tournament.slug}
              </option>
            ))}
          </select>
          <select
            className="rounded border border-secondary bg-black/30 p-2"
            value={exportFormat}
            onChange={(event) => setExportFormat(event.target.value as 'csv' | 'xlsx' | 'sqlite')}
          >
            <option value="csv">CSV archive (.csv.zip)</option>
            <option value="xlsx">Excel workbook (.xlsx)</option>
            <option value="sqlite">SQLite snapshot (.sqlite)</option>
          </select>
          <button className="rounded bg-primary px-4 py-2 text-black font-semibold" onClick={handleExportTournament}>
            Download
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-secondary bg-surface p-6 shadow-lg space-y-4">
        <h3 className="text-xl font-semibold">Tournament import</h3>
        <p className="text-sm text-gray-300">
          Upload CSV bundles or SQLite snapshots exported from MatchZy. Always run a dry-run first to inspect diffs.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-gray-400">
            <span className="mb-1 block font-semibold text-gray-200">Snapshot format</span>
            <select
              className="w-full rounded border border-secondary bg-black/30 p-2"
              value={importFormat}
              onChange={(event) => setImportFormat(event.target.value as 'csv' | 'sqlite')}
            >
              <option value="csv">CSV archive (.csv.zip)</option>
              <option value="sqlite">SQLite file (.sqlite)</option>
            </select>
          </label>
          <label className="text-sm text-gray-400">
            <span className="mb-1 block font-semibold text-gray-200">Snapshot file</span>
            <input
              type="file"
              accept={importFormat === 'csv' ? '.zip' : '.sqlite'}
              className="w-full rounded border border-secondary bg-black/30 p-2"
              onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            className="rounded border border-secondary px-4 py-2 text-sm font-semibold"
            onClick={() => runImport(false)}
          >
            Dry-run import
          </button>
          <button
            className="rounded bg-primary px-4 py-2 text-sm font-semibold text-black"
            onClick={() => runImport(true)}
          >
            Apply import
          </button>
        </div>
        {importStatus ? <p className="rounded border border-secondary/40 bg-secondary/20 p-2 text-sm">{importStatus}</p> : null}
        {importTable}
      </section>

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
        </p>
        <div className="flex flex-wrap gap-3">
          <button className="rounded bg-primary px-4 py-2 text-sm font-semibold text-black" onClick={handleBackupDownload}>
            Download pg_dump archive
          </button>
          <label className="text-sm text-gray-400">
            <span className="mb-1 block font-semibold text-gray-200">pg_restore .dump file</span>
            <input
              type="file"
              accept=".dump"
              className="w-full rounded border border-secondary bg-black/30 p-2"
              onChange={(event) => setRestoreFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="rounded border border-secondary px-4 py-2 text-xs font-semibold" onClick={() => runRestore(false)}>
              Dry-run (pg_restore --list)
            </button>
            <button className="rounded bg-emerald-400 px-4 py-2 text-xs font-semibold text-black" onClick={() => runRestore(true)}>
              Apply restore
            </button>
          </div>
        </div>
        {backupStatus ? <p className="rounded border border-secondary/40 bg-secondary/20 p-2 text-sm">{backupStatus}</p> : null}
        {backupDryRun ? (
          <div className="rounded border border-secondary/40 bg-black/40 p-3 text-xs text-gray-300">
            <p className="mb-2 font-semibold">pg_restore manifest ({backupDryRun.length} entries)</p>
            <div className="max-h-48 overflow-y-auto font-mono">
              {backupDryRun.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        ) : null}
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
