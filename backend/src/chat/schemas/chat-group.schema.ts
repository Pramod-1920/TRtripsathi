import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ChatGroup extends Document {
  @Prop({
    type: String,
    required: true,
    enum: ['person_to_person', 'group', 'campaign_group'],
  })
  type: string;

  @Prop({ type: String })
  name: string; // Only for group/campaign_group

  @Prop({ type: String })
  description: string; // Only for group/campaign_group

  @Prop({ type: [Types.ObjectId], ref: 'User', required: true })
  members: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Campaign', nullable: true })
  campaignId: Types.ObjectId; // For campaign_group

  @Prop({ type: Types.ObjectId, ref: 'Trip', nullable: true })
  tripId: Types.ObjectId; // Associated trip if applicable

  @Prop({ type: String })
  groupImageUrl: string; // Cloudinary URL for group avatar

  @Prop({ type: Date })
  deleteAt: Date; // Auto-delete timestamp for campaign groups (24h after campaign ends)

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Date })
  lastMessageAt: Date; // For sorting conversations

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const ChatGroupSchema = SchemaFactory.createForClass(ChatGroup);

// Indexes
ChatGroupSchema.index({ members: 1, type: 1 });
ChatGroupSchema.index({ createdBy: 1, createdAt: -1 });
ChatGroupSchema.index({ campaignId: 1 });
ChatGroupSchema.index({ lastMessageAt: -1 });
ChatGroupSchema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 }); // TTL for campaign groups
