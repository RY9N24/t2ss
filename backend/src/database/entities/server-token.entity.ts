import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { TimestampedEntity } from './timestamped.entity';
import { GameServer } from './server.entity';
import { TIMESTAMP_COLUMN_TYPE } from './column-types';

@Entity({ name: 'server_tokens' })
@Index(['serverId', 'tokenHash'], { unique: true })
export class ServerToken extends TimestampedEntity {
  @Column({ name: 'server_id', type: 'uuid' })
  serverId!: string;

  @ManyToOne(() => GameServer, (server) => server.tokens, {
    onDelete: 'CASCADE',
  })
  server!: GameServer;

  @Column({ name: 'token_hash', type: 'text' })
  tokenHash!: string;

  @Column({ type: 'text', nullable: true })
  label?: string | null;

  @Column({ name: 'last_used_at', type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  lastUsedAt?: Date | null;

  @Column({ name: 'revoked_at', type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  revokedAt?: Date | null;
}
