import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ChatMessage extends Document {
  @Prop({ type: Types.ObjectId, ref: 'ChatGroup', required: true })
  chatGroupId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', nullable: true })
  recipientId: Types.ObjectId; // For person_to_person chats

  @Prop({
    type: String,
    required: true,
    enum: ['text', 'image', 'file', 'location'],
  })
  messageType: string;

  @Prop({ type: String, required: true })
  content: string;

  @Prop({ type: String, nullable: true })
  attachmentUrl: string; // Cloudinary URL for images/files

  @Prop({ type: Object, nullable: true })
  metadata: Record<string, any>; // For location: lat/lng, for file: filename/size

  @Prop({ type: [Types.ObjectId], default: [] })
  readBy: Types.ObjectId[]; // Users who have read this message

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean; // Soft delete

  @Prop({ type: String })
  deletedReason: string; // Why message was deleted (user|admin|auto)

  @Prop({ type: Date })
  editedAt: Date;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

// Indexes
ChatMessageSchema.index({ chatGroupId: 1, createdAt: -1 });
ChatMessageSchema.index({ senderId: 1, createdAt: -1 });
ChatMessageSchema.index({ recipientId: 1, createdAt: -1 });
ChatMessageSchema.index({ chatGroupId: 1, isDeleted: 1 });
ChatMessageSchema.index({ readBy: 1 });
