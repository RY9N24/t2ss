import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource, Repository } from 'typeorm';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import {
  AuditLogEntry,
  GameServer,
  Map,
  Match,
  StoredFile,
  Tournament,
} from '../src/database/entities';
import multipart from '@fastify/multipart';

interface SeedResult {
  file: StoredFile;
  tournament: Tournament;
  match: Match;
  map: Map;
}

describe('DemosController (e2e)', () => {
  let app: NestFastifyApplication;
  let dataSource: DataSource;
  let filesRepo: Repository<StoredFile>;
  let auditRepo: Repository<AuditLogEntry>;
  let storageDir: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    storageDir = join(process.cwd(), 'tmp', 'demos-e2e');
    await fs.rm(storageDir, { recursive: true, force: true });
    await fs.mkdir(storageDir, { recursive: true });
    process.env.DEMO_STORAGE_PATH = storageDir;

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication(new FastifyAdapter());
    await app.register(multipart);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    dataSource = moduleFixture.get(DataSource);
    filesRepo = dataSource.getRepository(StoredFile);
    auditRepo = dataSource.getRepository(AuditLogEntry);
    const driver = dataSource.driver as { database?: string };
    if (!driver.database) {
      (driver as Record<string, unknown>).database = dataSource.options.database;
    }
  });

  afterAll(async () => {
    await app.close();
    await fs.rm(storageDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
  });

  async function seedDemo(overrides: Partial<StoredFile> = {}): Promise<SeedResult> {
    const tournaments = dataSource.getRepository(Tournament);
    const matches = dataSource.getRepository(Match);
    const maps = dataSource.getRepository(Map);
    const servers = dataSource.getRepository(GameServer);

    const tournament = await tournaments.save(
      tournaments.create({ name: 'LAN Finals', slug: `lan-${Math.random().toString(36).slice(2, 8)}` }),
    );
    const server = await servers.save(
      servers.create({
        name: 'Server 1',
        endpoint: `http://agent-${Math.random().toString(36).slice(2, 7)}.local`,
        isActive: true,
      }),
    );
    const match = await matches.save(
      matches.create({
        tournamentId: tournament.id,
        tournament,
        serverId: server.id,
        server,
        title: overrides.match?.title ?? 'Match 1',
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
      }),
    );
    const map = await maps.save(
      maps.create({
        matchId: match.id,
        match,
        mapNumber: overrides.map?.mapNumber ?? 0,
        name: overrides.map?.name ?? 'de_inferno',
        status: 'completed',
      }),
    );
    const storagePath = join(storageDir, `${Math.random().toString(36).slice(2)}.zip`);
    await fs.writeFile(storagePath, 'demo');

    const file = await filesRepo.save(
      filesRepo.create({
        storagePath,
        originalFilename: overrides.originalFilename ?? 'demo.zip',
        sizeBytes: '4',
        contentType: 'application/zip',
        status: overrides.status ?? 'stored',
        isPinned: overrides.isPinned ?? false,
        isInUse: overrides.isInUse ?? false,
        matchId: match.id,
        match,
        mapId: map.id,
        map,
        matchzyMatchId: overrides.matchzyMatchId ?? 'matchzy-1',
        matchzyMapNumber: overrides.matchzyMapNumber ?? 0,
        metaHeaders: overrides.metaHeaders ?? { 'matchzy-filename': 'demo.zip' },
      }),
    );

    return { file, tournament, match, map };
  }

  it('lists demos with filters and honours deletion guards', async () => {
    const { file: deletable } = await seedDemo();
    const { file: pinned } = await seedDemo({ isPinned: true, originalFilename: 'pinned.zip' });

    const listResponse = await request(app.getHttpServer()).get('/demos').expect(200);
    expect(listResponse.body.results).toHaveLength(2);

    const deleteResponse = await request(app.getHttpServer())
      .post('/demos/delete')
      .send({ ids: [deletable.id, pinned.id, 'missing-id'] })
      .expect(200);

    expect(deleteResponse.body.deleted).toEqual([deletable.id]);
    expect(deleteResponse.body.skipped).toEqual(
      expect.arrayContaining([
        { id: pinned.id, reason: 'pinned' },
        { id: 'missing-id', reason: 'not_found' },
      ]),
    );

    const stored = await filesRepo.findOne({ where: { id: deletable.id } });
    expect(stored?.status).toBe('deleted');
    expect(stored?.deletedAt).toBeTruthy();
    await expect(fs.access(deletable.storagePath)).rejects.toThrow();

    const auditEntries = await auditRepo.find({ where: { action: 'delete' } });
    expect(auditEntries.length).toBeGreaterThan(0);
  });
});
