import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { AuditLogEntry, StoredFile, SystemSetting } from '../database/entities';

const execFileAsync = promisify(execFile);

const CONFIG_KEY = 'emergency_gc_config';
const STATE_KEY = 'emergency_gc_state';
const HIGH_WATERMARK = 97;
const TARGET_WATERMARK = 95;

export interface DiskStats {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usagePercent: number;
}

export interface EmergencyGcConfig {
  enabled: boolean;
  graceMinutes: number;
  notifyPanel: boolean;
  notifyBot: boolean;
}

export interface EmergencyGcState {
  lastRunAt: string;
  trigger: 'auto' | 'manual';
  deleted: Array<{ id: string; filename: string | null }>;
  finalUsagePercent: number;
  reason: string;
}

export interface EmergencyGcSettings extends EmergencyGcConfig {
  lastRun: EmergencyGcState | null;
}

export interface EmergencyGcRunResult {
  ran: boolean;
  deleted: Array<{ id: string; filename: string | null }>;
  finalUsagePercent: number;
  reason: string;
  trigger: 'auto' | 'manual';
}

@Injectable()
export class EmergencyGcService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmergencyGcService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(StoredFile) private readonly filesRepo: Repository<StoredFile>,
    @InjectRepository(AuditLogEntry) private readonly auditRepo: Repository<AuditLogEntry>,
    @InjectRepository(SystemSetting) private readonly settingsRepo: Repository<SystemSetting>,
  ) {}

  async onModuleInit() {
    const pollMs = Number(this.config.get('EMERGENCY_GC_POLL_INTERVAL_MS') ?? 60000);
    const disabled = this.config.get('EMERGENCY_GC_DISABLE_AUTORUN') === 'true' || process.env.NODE_ENV === 'test';
    if (!disabled && pollMs > 0) {
      this.timer = setInterval(() => {
        void this.runCleanup({ trigger: 'auto' }).catch((error) => {
          this.logger.warn({ error: (error as Error).message }, 'Emergency GC tick failed');
        });
      }, pollMs);
      if (typeof this.timer.unref === 'function') {
        this.timer.unref();
      }
    }
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async getDiskStats(): Promise<DiskStats> {
    const storagePath = this.config.get<string>('DEMO_STORAGE_PATH', join(process.cwd(), 'storage/demos'));
    try {
      await fs.access(storagePath);
    } catch {
      await fs.mkdir(storagePath, { recursive: true });
    }
    const { stdout } = await execFileAsync('df', ['-Pk', storagePath]);
    const [, ...rows] = stdout.trim().split('\n');
    if (!rows.length) {
      throw new Error('Unable to determine disk usage');
    }
    const parts = rows[0].trim().split(/\s+/);
    const total = Number(parts[1]) * 1024;
    const used = Number(parts[2]) * 1024;
    const available = Number(parts[3]) * 1024;
    const usagePercent = total > 0 ? Math.round((used / total) * 1000) / 10 : 0;
    return { totalBytes: total, usedBytes: used, availableBytes: available, usagePercent };
  }

  async getSettings(): Promise<EmergencyGcSettings> {
    const config = await this.getConfig();
    const lastRun = await this.getState();
    return { ...config, lastRun };
  }

  async updateSettings(patch: Partial<EmergencyGcConfig>): Promise<EmergencyGcSettings> {
    const current = await this.getConfig();
    const next: EmergencyGcConfig = {
      ...current,
      ...patch,
    };
    if (next.graceMinutes < 0) {
      next.graceMinutes = 0;
    }
    await this.saveConfig(next);
    return this.getSettings();
  }

  async triggerManualRun(force = false): Promise<EmergencyGcRunResult> {
    return this.runCleanup({ trigger: 'manual', force });
  }

  private async getConfig(): Promise<EmergencyGcConfig> {
    const row = await this.settingsRepo.findOne({ where: { key: CONFIG_KEY } });
    if (row) {
      const value = row.value as Partial<EmergencyGcConfig>;
      return {
        enabled: Boolean(value.enabled),
        graceMinutes: typeof value.graceMinutes === 'number' ? value.graceMinutes : this.defaultGraceMinutes(),
        notifyPanel: value.notifyPanel ?? true,
        notifyBot: value.notifyBot ?? false,
      };
    }
    return {
      enabled: this.config.get('EMERGENCY_GC_DEFAULT_ENABLED') === 'true',
      graceMinutes: this.defaultGraceMinutes(),
      notifyPanel: true,
      notifyBot: false,
    };
  }

  private defaultGraceMinutes(): number {
    const parsed = Number(this.config.get('EMERGENCY_GC_DEFAULT_GRACE_MINUTES') ?? 30);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 30;
  }

  private async saveConfig(value: EmergencyGcConfig) {
    await this.settingsRepo.save({ key: CONFIG_KEY, value: value as unknown as Record<string, unknown> });
  }

  private async getState(): Promise<EmergencyGcState | null> {
    const row = await this.settingsRepo.findOne({ where: { key: STATE_KEY } });
    if (!row) {
      return null;
    }
    const value = row.value as unknown as EmergencyGcState;
    return value ?? null;
  }

  private async saveState(state: EmergencyGcState) {
    await this.settingsRepo.save({ key: STATE_KEY, value: state as unknown as Record<string, unknown> });
  }

  /**
   * MatchZy GOTV & Demos: https://shobhit-pathak.github.io/MatchZy/gotv/
   * Preserve pinned/in-use demos tied to MatchZy GOTV headers by only selecting idle files.
   */
  private async findDeletable(graceCutoff: Date): Promise<StoredFile | null> {
    const candidates = await this.filesRepo.find({
      where: {
        status: 'stored',
        isPinned: false,
        isInUse: false,
        deletedAt: IsNull(),
      },
      relations: { match: true },
      order: { createdAt: 'ASC' },
      take: 50,
    });
    for (const file of candidates) {
      if (file.createdAt > graceCutoff) {
        continue;
      }
      const effectiveInUse = file.isInUse || (file.match ? !file.match.completedAt : false);
      if (effectiveInUse) {
        continue;
      }
      return file;
    }
    return null;
  }

  private async deleteFile(file: StoredFile, trigger: 'auto' | 'manual') {
    try {
      await fs.unlink(file.storagePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
    file.status = 'deleted';
    file.deletedAt = new Date();
    file.isInUse = false;
    await this.filesRepo.save(file);
    await this.auditRepo.save(
      this.auditRepo.create({
        category: 'demos',
        action: 'delete_emergency_gc',
        entityType: 'file',
        entityId: file.id,
        metadata: { trigger },
      }),
    );
  }

  private async runCleanup({
    trigger,
    force = false,
  }: {
    trigger: 'auto' | 'manual';
    force?: boolean;
  }): Promise<EmergencyGcRunResult> {
    if (this.running) {
      return { ran: false, deleted: [], finalUsagePercent: 0, reason: 'already_running', trigger };
    }
    this.running = true;
    try {
      const config = await this.getConfig();
      if (!config.enabled && !force) {
        const stats = await this.getDiskStats();
        const state: EmergencyGcState = {
          lastRunAt: new Date().toISOString(),
          trigger,
          deleted: [],
          finalUsagePercent: stats.usagePercent,
          reason: 'disabled',
        };
        await this.saveState(state);
        return { ran: false, deleted: [], finalUsagePercent: stats.usagePercent, reason: 'disabled', trigger };
      }
      let stats = await this.getDiskStats();
      if (!force && stats.usagePercent < HIGH_WATERMARK) {
        const state: EmergencyGcState = {
          lastRunAt: new Date().toISOString(),
          trigger,
          deleted: [],
          finalUsagePercent: stats.usagePercent,
          reason: 'below_threshold',
        };
        await this.saveState(state);
        return { ran: false, deleted: [], finalUsagePercent: stats.usagePercent, reason: 'below_threshold', trigger };
      }

      const deleted: Array<{ id: string; filename: string | null }> = [];
      const graceCutoff = new Date(Date.now() - config.graceMinutes * 60 * 1000);
      while ((force || stats.usagePercent >= HIGH_WATERMARK) && stats.usagePercent > TARGET_WATERMARK) {
        const candidate = await this.findDeletable(graceCutoff);
        if (!candidate) {
          break;
        }
        await this.deleteFile(candidate, trigger);
        deleted.push({ id: candidate.id, filename: candidate.originalFilename ?? null });
        stats = await this.getDiskStats();
        if (stats.usagePercent <= TARGET_WATERMARK) {
          break;
        }
      }
      const reason = deleted.length === 0 ? 'no_candidates' : 'completed';
      const state: EmergencyGcState = {
        lastRunAt: new Date().toISOString(),
        trigger,
        deleted,
        finalUsagePercent: stats.usagePercent,
        reason,
      };
      await this.saveState(state);
      return { ran: deleted.length > 0, deleted, finalUsagePercent: stats.usagePercent, reason, trigger };
    } finally {
      this.running = false;
    }
  }
}
