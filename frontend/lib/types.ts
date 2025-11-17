export interface TeamSummary {
  id: string;
  name: string;
  shortName?: string | null;
}

export interface LiveMatch {
  id: string;
  externalId: string | null;
  title: string | null;
  tournament: string | null;
  status: string;
  startedAt: string | null;
  homeTeam: TeamSummary | null;
  awayTeam: TeamSummary | null;
  aggregateScore: { team1: number; team2: number };
  mapSummaries: Array<{
    id: string;
    name: string;
    mapNumber: number;
    status: string | null;
    team1Score: number;
    team2Score: number;
    startedAt: string | null;
  }>;
  eventCounts: Record<string, number>;
}

export interface HistoryMatch {
  id: string;
  startedAt: string | null;
  completedAt: string | null;
  title: string | null;
  tournament: string | null;
  homeTeam: TeamSummary | null;
  awayTeam: TeamSummary | null;
  team1Score: number;
  team2Score: number;
  winnerTeamId: string | null;
}

export interface MatchDetail extends HistoryMatch {
  maps: Array<{
    id: string;
    mapNumber: number;
    name: string;
    status: string | null;
    team1Score: number;
    team2Score: number;
    winnerTeamId: string | null;
    startedAt: string | null;
    completedAt: string | null;
  }>;
  players: Array<{
    id: string;
    name: string | null;
    teamId: string | null;
    kills: number;
    deaths: number;
    assists: number;
    damage: number;
  }>;
  timeline: Array<{
    id: string;
    occurredAt: string;
    subject: string;
    payload: Record<string, unknown>;
  }>;
  demoFiles: Array<{
    id: string;
    originalFilename: string | null;
    storedPath: string;
    uploadedAt: string;
  }>;
}

export interface DiskStats {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usagePercent: number;
}

export interface EmergencyGcState {
  lastRunAt: string;
  trigger: 'auto' | 'manual';
  deleted: Array<{ id: string; filename: string | null }>;
  finalUsagePercent: number;
  reason: string;
}

export interface EmergencyGcSettings {
  enabled: boolean;
  graceMinutes: number;
  notifyPanel: boolean;
  notifyBot: boolean;
  lastRun: EmergencyGcState | null;
}

export interface EmergencyGcRunResult {
  ran: boolean;
  deleted: Array<{ id: string; filename: string | null }>;
  finalUsagePercent: number;
  reason: string;
  trigger: 'auto' | 'manual';
}

export interface DemoFile {
  id: string;
  originalFilename: string | null;
  uploadedAt: string;
  status: string;
  sizeBytes: number | null;
  isPinned: boolean;
  isInUse: boolean;
  effectiveInUse: boolean;
  matchzyMatchId: string | null;
  matchzyMapNumber: number | null;
  downloadable: boolean;
  canDelete: boolean;
  match?: {
    id: string;
    title: string | null;
    status: string;
    completedAt: string | null;
    tournament?: { id: string; name: string | null } | null;
  } | null;
  map?: { id: string; name: string; mapNumber: number | null; matchzyMapNumber: number | null } | null;
}

export interface DemoListResponse {
  total: number;
  results: DemoFile[];
}

export interface DemoFilterOptions {
  statuses: string[];
  tournaments: Array<{ id: string; name: string | null }>;
}

export interface ServerToken {
  id: string;
  label?: string | null;
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
}

export interface GameServer {
  id: string;
  name: string;
  endpoint: string;
  location?: string | null;
  notes?: string | null;
  isActive: boolean;
  lastSeenAt?: string | null;
  tokens: ServerToken[];
  createdAt: string;
}

export interface TournamentOption {
  id: string;
  name: string | null;
  slug: string;
}

export interface ImportSummaryResponse {
  dryRun: boolean;
  applied: boolean;
  tables: Record<string, { total: number; inserts: number; updates: number }>;
}

export interface BackupDryRunResponse {
  dryRun: true;
  items: string[];
}

export interface BackupRestoreResponse {
  dryRun: false;
  restored: boolean;
  output: string;
}
