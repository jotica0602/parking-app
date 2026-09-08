import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LogAction, UserRole } from '../common/enums';
import { ActivityLog } from './activity-log.schema';
import { QueryLogsDto } from './dto/query-logs.dto';

export interface RecordLogInput {
  action: LogAction;
  actorId: string;
  actorRole: UserRole;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class LogsService {
  constructor(
    @InjectModel(ActivityLog.name)
    private readonly logModel: Model<ActivityLog>,
  ) {}

  /** Registra una acción crítica. Lo llaman los services de negocio. */
  async record(input: RecordLogInput): Promise<void> {
    await this.logModel.create({ ...input, payload: input.payload ?? {} });
  }

  /** Caso de uso 4: consulta de logs, solo admin. */
  async findAll(query: QueryLogsDto): Promise<Record<string, unknown>[]> {
    const filter: Record<string, unknown> = {};
    if (query.action) {
      filter.action = query.action;
    }
    if (query.actorId) {
      filter.actorId = query.actorId;
    }
    if (query.from || query.to) {
      const createdAt: Record<string, Date> = {};
      if (query.from) {
        createdAt.$gte = new Date(query.from);
      }
      if (query.to) {
        createdAt.$lte = new Date(query.to);
      }
      filter.createdAt = createdAt;
    }
    // lean() devuelve objetos planos, serializables sin internals de Mongoose
    const docs = await this.logModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()
      .exec();
    return docs.map((doc) => ({ ...doc, _id: String(doc._id) }));
  }
}
