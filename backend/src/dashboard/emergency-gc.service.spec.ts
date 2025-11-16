import type { Repository } from 'typeorm';
import type { ConfigService } from '@nestjs/config';
import { EmergencyGcService } from './emergency-gc.service';
import type { AuditLogEntry, StoredFile, SystemSetting } from '../database/entities';

jest.mock('node:fs', () => ({
  promises: {
    access: jest.fn(async () => undefined),
    mkdir: jest.fn(async () => undefined),
    unlink: jest.fn(async () => undefined),
  },
}));

describe('EmergencyGcService', () => {
  let filesRepo: jest.Mocked<Repository<StoredFile>>;
  let auditRepo: jest.Mocked<Repository<AuditLogEntry>>;
  let settingsRepo: jest.Mocked<Repository<SystemSetting>>;
  let config: jest.Mocked<ConfigService>;
  let service: EmergencyGcService;
  let configValue: any;
  let stateValue: any;

  beforeEach(() => {
    configValue = { enabled: false, graceMinutes: 30, notifyPanel: true, notifyBot: false };
    stateValue = null;
    filesRepo = {
      find: jest.fn(async () => []),
      save: jest.fn(async (file) => file as StoredFile),
    } as unknown as jest.Mocked<Repository<StoredFile>>;
    auditRepo = {
      create: jest.fn((payload) => payload),
      save: jest.fn(async () => ({} as AuditLogEntry)),
    } as unknown as jest.Mocked<Repository<AuditLogEntry>>;
    settingsRepo = {
      findOne: jest.fn(async ({ where: { key } }) => {
        if (key === 'emergency_gc_config') {
          return { key, value: configValue } as SystemSetting;
        }
        if (key === 'emergency_gc_state' && stateValue) {
          return { key, value: stateValue } as SystemSetting;
        }
        return null;
      }),
      save: jest.fn(async (payload: any) => {
        if (payload.key === 'emergency_gc_config') {
          configValue = payload.value;
        }
        if (payload.key === 'emergency_gc_state') {
          stateValue = payload.value;
        }
        return payload;
      }),
    } as unknown as jest.Mocked<Repository<SystemSetting>>;
    config = {
      get: jest.fn((key: string) => {
        if (key === 'EMERGENCY_GC_DEFAULT_GRACE_MINUTES') return '5';
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;
    service = new EmergencyGcService(config, filesRepo, auditRepo, settingsRepo);
  });

  it('skips cleanup when disabled and not forced', async () => {
    jest.spyOn(service, 'getDiskStats').mockResolvedValue({
      totalBytes: 1000,
      usedBytes: 500,
      availableBytes: 500,
      usagePercent: 50,
    });
    const result = await service.triggerManualRun(false);
    expect(result.reason).toBe('disabled');
    expect(settingsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'emergency_gc_state', value: expect.objectContaining({ reason: 'disabled' }) }),
    );
    expect(filesRepo.find).not.toHaveBeenCalled();
  });

  it('removes oldest eligible demos until usage drops below target', async () => {
    configValue.enabled = true;
    configValue.graceMinutes = 0;
    const candidate: StoredFile = {
      id: 'file-1',
      storagePath: '/tmp/demo1.zip',
      status: 'stored',
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
      isPinned: false,
      isInUse: false,
      metaHeaders: {},
    } as StoredFile;
    let findCalls = 0;
    filesRepo.find.mockImplementation(async () => {
      findCalls += 1;
      if (findCalls === 1) {
        return [candidate];
      }
      return [];
    });
    const statsSequence = [
      { totalBytes: 1000, usedBytes: 980, availableBytes: 20, usagePercent: 98 },
      { totalBytes: 1000, usedBytes: 940, availableBytes: 60, usagePercent: 94 },
    ];
    jest.spyOn(service, 'getDiskStats').mockImplementation(async () => {
      return statsSequence.length > 1 ? statsSequence.shift()! : statsSequence[0];
    });
    const result = await service.triggerManualRun(false);
    expect(result.ran).toBe(true);
    expect(result.deleted[0].id).toBe('file-1');
    expect(filesRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'file-1', status: 'deleted' }));
    expect(auditRepo.save).toHaveBeenCalled();
    expect(result.finalUsagePercent).toBe(94);
    expect(settingsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'emergency_gc_state', value: expect.objectContaining({ reason: 'completed' }) }),
    );
  });
});
