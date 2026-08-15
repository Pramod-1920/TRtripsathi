import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

export type AuditEventDocument = HydratedDocument<AuditEvent>;

@Schema({ collection: 'audit_events', versionKey: false })
export class AuditEvent {
  @Prop({ required: true, unique: true, index: true }) eventId: string;
  @Prop({ required: true, index: true }) type: string;
  @Prop({ index: true }) actorId?: string;
  @Prop({ index: true }) entityType?: string;
  @Prop({ index: true }) entityId?: string;
  @Prop({ type: SchemaTypes.Mixed, default: {} }) details: Record<
    string,
    unknown
  >;
  @Prop({ required: true, type: Date, index: true }) timestamp: Date;
}

export const AuditEventSchema = SchemaFactory.createForClass(AuditEvent);
AuditEventSchema.index({ timestamp: -1, type: 1 });
AuditEventSchema.index({ timestamp: -1, actorId: 1 });
AuditEventSchema.index({ timestamp: -1, entityType: 1, entityId: 1 });
