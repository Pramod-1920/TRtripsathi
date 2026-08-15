import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class AdminNotificationState extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Auth', required: true, unique: true })
  adminId: Types.ObjectId;

  @Prop({ type: Date, required: true, default: Date.now })
  lastReadAt: Date;
}

export const AdminNotificationStateSchema = SchemaFactory.createForClass(
  AdminNotificationState,
);
