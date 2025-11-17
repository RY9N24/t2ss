import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import multipart from '@fastify/multipart';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { Tournament, Team, Match, Map } from '../src/database/entities';

function binaryParser(res: request.Response, callback: (err: Error | null, body: Buffer) => void) {
  res.setEncoding('binary');
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    callback(null, Buffer.from(data, 'binary'));
  });
}

async function seedTournament(dataSource: DataSource): Promise<Tournament> {
  const tournaments = dataSource.getRepository(Tournament);
  const teams = dataSource.getRepository(Team);
  const matches = dataSource.getRepository(Match);
  const maps = dataSource.getRepository(Map);

  const tournament = await tournaments.save(
    tournaments.create({ name: 'LAN Finals', slug: `lan-${Math.random().toString(36).slice(2, 8)}` }),
  );
  const teamA = await teams.save(teams.create({ name: 'Team A', tournamentId: tournament.id }));
  const teamB = await teams.save(teams.create({ name: 'Team B', tournamentId: tournament.id }));
  const match = await matches.save(
    matches.create({
      tournamentId: tournament.id,
      homeTeamId: teamA.id,
      awayTeamId: teamB.id,
      team1Score: 16,
      team2Score: 8,
      status: 'completed',
      title: 'Group Stage',
    }),
  );
  await maps.save(
    maps.create({ matchId: match.id, mapNumber: 0, name: 'de_inferno', status: 'completed', team1Score: 16, team2Score: 8 }),
  );

  return tournament;
}

describe('Tournament export/import (e2e)', () => {
  let app: NestFastifyApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication(new FastifyAdapter());
    await app.register(multipart);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    dataSource = moduleFixture.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
  });

  it('exports a tournament snapshot and re-imports it', async () => {
    const tournament = await seedTournament(dataSource);

    const exportResponse = await request(app.getHttpServer())
      .get(`/system/tournaments/${tournament.id}/export/csv`)
      .buffer()
      .parse(binaryParser)
      .expect(200);

    const zipBuffer = exportResponse.body as Buffer;
    expect(zipBuffer.length).toBeGreaterThan(0);

    await dataSource.synchronize(true);

    const importResponse = await request(app.getHttpServer())
      .post('/system/tournaments/import/csv?apply=true')
      .attach('file', zipBuffer, 'snapshot.zip')
      .expect(201);

    expect(importResponse.body.applied).toBe(true);
    expect(importResponse.body.tables?.tournaments?.total).toBe(1);

    const stored = await dataSource.getRepository(Tournament).find();
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('LAN Finals');
  });
});
