import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LogAction, SYSTEM_ACTOR_ROLE, UserRole } from '../common/enums';
import { ActivityLog } from './activity-log.schema';
import { QueryLogsDto } from './dto/query-logs.dto';

export interface RecordLogInput {
  action: LogAction;
  actorId: string;
  actorRole: UserRole | typeof SYSTEM_ACTOR_ROLE;
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

  // Records a critical action. Called by the business services
  async record(input: RecordLogInput): Promise<void> {
    await this.logModel.create({ ...input, payload: input.payload ?? {} });
  }

  // Use case 4: log query, admin only.
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
    // lean() returns plain objects, serializable without Mongoose internals
    const docs = await this.logModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()
      .exec();
    return docs.map((doc) => ({ ...doc, _id: String(doc._id) }));
  }
}
