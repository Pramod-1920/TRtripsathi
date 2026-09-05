import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  MinLength,
  MaxLength,
} from 'class-validator';

// ChatGroup DTOs

export class CreatePersonToPersonChatDto {
  @IsString()
  recipientId: string;
}

export class CreateGroupChatDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description: string;

  @IsArray()
  memberIds: string[];
}

export class CreateCampaignGroupChatDto {
  @IsString()
  campaignId: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @IsArray()
  memberIds: string[];

  @IsString()
  deleteAtTimestamp: string; // ISO timestamp 24h after campaign ends
}

export class AddMembersToGroupDto {
  @IsArray()
  memberIds: string[];
}

export class RemoveMemberDto {
  @IsString()
  memberId: string;
}

// ChatMessage DTOs

export class SendMessageDto {
  @IsString()
  chatGroupId: string;

  @IsEnum(['text', 'image', 'file', 'location'])
  messageType: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @IsOptional()
  @IsString()
  attachmentUrl: string;

  @IsOptional()
  metadata: Record<string, any>;
}

export class EditMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;
}

export class MarkMessageAsReadDto {
  @IsArray()
  messageIds: string[];
}

export class DeleteMessageDto {
  @IsOptional()
  @IsString()
  reason: string;
}

// Response DTOs

export class ChatGroupResponseDto {
  _id: string;
  type: string;
  name: string;
  description: string;
  members: any[];
  createdBy: any;
  campaignId?: string;
  tripId?: string;
  groupImageUrl: string;
  isActive: boolean;
  lastMessageAt: Date;
  unreadCount: number;
  lastMessage?: ChatMessageResponseDto;
  createdAt: Date;
  updatedAt: Date;
}

export class ChatMessageResponseDto {
  _id: string;
  chatGroupId: string;
  senderId: any;
  recipientId?: string;
  messageType: string;
  content: string;
  attachmentUrl?: string;
  metadata?: Record<string, any>;
  readBy: any[];
  isRead: boolean;
  isDeleted: boolean;
  editedAt?: Date;
  createdAt: Date;
}

export class ChatConversationDto {
  _id: string;
  type: string;
  otherUser?: any; // For person_to_person
  name?: string; // For groups
  members?: any[];
  lastMessage: ChatMessageResponseDto;
  unreadCount: number;
  updatedAt: Date;
}
