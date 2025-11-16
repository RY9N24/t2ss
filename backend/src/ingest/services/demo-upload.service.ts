import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoredFile } from '../../database/entities/file.entity';
import { Match } from '../../database/entities/match.entity';
import { Map } from '../../database/entities/map.entity';

@Injectable()
export class DemoUploadService {
  constructor(
    @InjectRepository(StoredFile)
    private readonly repository: Repository<StoredFile>,
    @InjectRepository(Match)
    private readonly matchesRepo: Repository<Match>,
    @InjectRepository(Map)
    private readonly mapsRepo: Repository<Map>,
  ) {}

  async recordUpload(input: {
    filePath: string;
    originalFilename: string | null;
    metaHeaders: Record<string, unknown>;
    contentType?: string | null;
    sizeBytes?: number | null;
    matchzyMatchId?: string | null;
    matchzyMapNumber?: number | null;
  }): Promise<StoredFile> {
    let linkedMatchId: string | null = null;
    let linkedMapId: string | null = null;
    let inferredInUse = false;

    if (input.matchzyMatchId) {
      const match = await this.matchesRepo.findOne({ where: { externalId: input.matchzyMatchId } });
      if (match) {
        linkedMatchId = match.id;
        inferredInUse = !match.completedAt;
        if (typeof input.matchzyMapNumber === 'number') {
          const map = await this.mapsRepo
            .createQueryBuilder('map')
            .where('map.match_id = :matchId', { matchId: match.id })
            .andWhere('(map.matchzy_map_number = :mapNo OR map.map_number = :mapNo)', {
              mapNo: input.matchzyMapNumber,
            })
            .getOne();
          if (map) {
            linkedMapId = map.id;
          }
        }
      }
    }

    const entity = this.repository.create({
      storagePath: input.filePath,
      originalFilename: input.originalFilename,
      metaHeaders: input.metaHeaders,
      contentType: input.contentType ?? null,
      sizeBytes:
        typeof input.sizeBytes === 'number' ? input.sizeBytes.toString() : null,
      matchId: linkedMatchId,
      mapId: linkedMapId,
      matchzyMatchId: input.matchzyMatchId ?? null,
      matchzyMapNumber: input.matchzyMapNumber ?? null,
      isInUse: inferredInUse,
    });
    return this.repository.save(entity);
  }
}
