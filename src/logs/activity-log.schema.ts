import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { LogAction, UserRole } from '../common/enums';

export type ActivityLogDocument = HydratedDocument<ActivityLog>;

@Schema({ collection: 'activity_logs', timestamps: { createdAt: true, updatedAt: false } })
export class ActivityLog {
  @Prop({ type: String, required: true, enum: Object.values(LogAction), index: true })
  action: LogAction;

  @Prop({ type: String, required: true, index: true })
  actorId: string;

  @Prop({
    type: String,
    required: true,
    enum: [...Object.values(UserRole), 'system'],
  })
  actorRole: string;

  @Prop({ type: String, required: true })
  entityType: string;

  @Prop({ type: String, required: true })
  entityId: string;

  //Relevant action data. Never passwords or hashes
  @Prop({ type: Object, default: {} })
  payload: Record<string, unknown>;

  createdAt?: Date;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);
