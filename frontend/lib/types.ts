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
