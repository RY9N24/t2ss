import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';

interface CommandOptions {
  env?: NodeJS.ProcessEnv;
  input?: Buffer;
}

interface CommandResult {
  stdout: Buffer;
  stderr: Buffer;
  code: number;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * PostgreSQL pg_dump: https://www.postgresql.org/docs/current/app-pgdump.html
   */
  async createArchive(): Promise<{ filename: string; buffer: Buffer }> {
    const { connectionString, env } = this.resolveConnection();
    const binary = this.config.get<string>('PG_DUMP_BIN') ?? 'pg_dump';
    const args = [`--format=custom`, `--dbname=${connectionString}`];
    const result = await this.runCommand(binary, args, { env });
    if (result.code !== 0) {
      this.logger.error(result.stderr.toString());
      throw new InternalServerErrorException('pg_dump failed');
    }
    const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`;
    return { filename, buffer: result.stdout };
  }

  /**
   * PostgreSQL pg_restore: https://www.postgresql.org/docs/current/app-pgrestore.html
   */
  async dryRunRestore(buffer: Buffer): Promise<{ dryRun: true; items: string[] }> {
    const binary = this.config.get<string>('PG_RESTORE_BIN') ?? 'pg_restore';
    const result = await this.runCommand(binary, ['--list'], { input: buffer });
    if (result.code !== 0) {
      throw new InternalServerErrorException('pg_restore --list failed');
    }
    const items = result.stdout
      .toString()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    return { dryRun: true, items };
  }

  async restore(buffer: Buffer): Promise<{ restored: boolean; output: string }> {
    const { connectionString, env } = this.resolveConnection();
    const binary = this.config.get<string>('PG_RESTORE_BIN') ?? 'pg_restore';
    const args = ['--clean', '--if-exists', '--no-owner', `--dbname=${connectionString}`];
    const result = await this.runCommand(binary, args, { env, input: buffer });
    if (result.code !== 0) {
      this.logger.error(result.stderr.toString());
      throw new InternalServerErrorException('pg_restore failed');
    }
    return { restored: true, output: result.stderr.toString() || 'pg_restore completed' };
  }

  private async runCommand(binary: string, args: string[], options: CommandOptions = {}): Promise<CommandResult> {
    const child = spawn(binary, args, {
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: 'pipe',
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    if (options.input) {
      child.stdin.end(options.input);
    } else {
      child.stdin.end();
    }

    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));

    return new Promise((resolve, reject) => {
      child.on('error', (error) => reject(error));
      child.on('close', (code) => {
        resolve({ stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), code: code ?? 0 });
      });
    });
  }

  private resolveConnection(): { connectionString: string; env: NodeJS.ProcessEnv } {
    const url = this.config.get<string>('DATABASE_URL');
    if (url) {
      return { connectionString: url, env: {} };
    }
    const host = this.config.get<string>('POSTGRES_HOST') ?? 'postgres';
    const port = this.config.get<string>('POSTGRES_PORT') ?? '5432';
    const user = this.config.get<string>('POSTGRES_USER') ?? 'postgres';
    const database = this.config.get<string>('POSTGRES_DB') ?? 'postgres';
    const password = this.config.get<string>('POSTGRES_PASSWORD') ?? '';
    const encodedUser = encodeURIComponent(user);
    const encodedPassword = password ? `:${encodeURIComponent(password)}` : '';
    const connectionString = `postgresql://${encodedUser}${encodedPassword}@${host}:${port}/${database}`;
    const env: NodeJS.ProcessEnv = password ? { PGPASSWORD: password } : {};
    return { connectionString, env };
  }
}
