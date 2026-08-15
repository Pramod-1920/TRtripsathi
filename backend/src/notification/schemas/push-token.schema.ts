import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class PushToken extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true })
  token: string;

  @Prop({ type: String, required: true, enum: ['android', 'ios'] })
  platform: string;

  @Prop({ type: Date, default: Date.now })
  lastSeenAt: Date;
}

export const PushTokenSchema = SchemaFactory.createForClass(PushToken);
PushTokenSchema.index({ userId: 1, updatedAt: -1 });
