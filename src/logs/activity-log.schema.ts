import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { LogAction, UserRole } from '../common/enums';

export type ActivityLogDocument = HydratedDocument<ActivityLog>;

@Schema({ collection: 'activity_logs', timestamps: { createdAt: true, updatedAt: false } })
export class ActivityLog {
  @Prop({ required: true, enum: Object.values(LogAction), index: true })
  action: LogAction;

  @Prop({ required: true, index: true })
  actorId: string;

  @Prop({ required: true, enum: Object.values(UserRole) })
  actorRole: UserRole;

  @Prop({ required: true })
  entityType: string;

  @Prop({ required: true })
  entityId: string;

  /** Datos relevantes de la acción. Nunca contraseñas ni hashes. */
  @Prop({ type: Object, default: {} })
  payload: Record<string, unknown>;

  createdAt?: Date;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);
