import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatGroup } from './schemas/chat-group.schema';
import { ChatMessage } from './schemas/chat-message.schema';
import { User } from '../user/schemas/user.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatGroup.name)
    private chatGroupModel: Model<ChatGroup>,
    @InjectModel(ChatMessage.name)
    private chatMessageModel: Model<ChatMessage>,
    @InjectModel(User.name)
    private userModel: Model<User>,
  ) {}

  private objectId(value: string, label: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`Invalid ${label}`);
    }
    return new Types.ObjectId(value);
  }

  private async profileIdForAuth(authId: string): Promise<Types.ObjectId> {
    const profile = await this.userModel
      .findOne({ authId: this.objectId(authId, 'account ID') })
      .select('_id')
      .lean();
    if (!profile) throw new NotFoundException('User profile not found');
    return profile._id as Types.ObjectId;
  }

  private async requireMember(chatGroupId: string, authId: string) {
    const [chat, profileId] = await Promise.all([
      this.chatGroupModel.findById(this.objectId(chatGroupId, 'chat ID')),
      this.profileIdForAuth(authId),
    ]);
    if (!chat || !chat.isActive)
      throw new NotFoundException('Chat group not found');
    if (
      !chat.members.some((member) => member.toString() === profileId.toString())
    ) {
      throw new ForbiddenException('You are not a member of this chat');
    }
    return { chat, profileId };
  }

  // ==================== CHAT GROUP OPERATIONS ====================

  /**
   * Create or get person-to-person chat
   */
  async createOrGetPersonToPersonChat(
    userId: string,
    recipientId: string,
  ): Promise<ChatGroup> {
    const userIdObj = await this.profileIdForAuth(userId);
    const recipientIdObj = this.objectId(recipientId, 'recipient ID');

    if (userIdObj.equals(recipientIdObj)) {
      throw new BadRequestException('Cannot chat with yourself');
    }

    const recipient = await this.userModel.exists({
      _id: recipientIdObj,
      profileCompleted: true,
      isActive: { $ne: false },
    });
    if (!recipient) throw new NotFoundException('Recipient not found');

    // Check if chat already exists
    let chat = await this.chatGroupModel.findOne({
      type: 'person_to_person',
      members: { $all: [userIdObj, recipientIdObj] },
    });

    if (chat) {
      return chat.populate('members', 'firstName lastName profilePhoto');
    }

    // Create new chat
    const newChat = new this.chatGroupModel({
      type: 'person_to_person',
      members: [userIdObj, recipientIdObj],
      createdBy: userIdObj,
    });

    const saved = await newChat.save();
    return saved.populate('members', 'firstName lastName profilePhoto');
  }

  /**
   * Create a group chat
   */
  async createGroupChat(
    userId: string,
    name: string,
    description: string,
    memberIds: string[],
    groupImageUrl?: string,
  ): Promise<ChatGroup> {
    const userIdObj = await this.profileIdForAuth(userId);
    const memberObjIds = memberIds.map((id) => this.objectId(id, 'member ID'));

    if (!memberObjIds.some((id) => id.equals(userIdObj))) {
      memberObjIds.push(userIdObj);
    }

    const chat = new this.chatGroupModel({
      type: 'group',
      name,
      description,
      members: memberObjIds,
      createdBy: userIdObj,
      groupImageUrl: groupImageUrl || null,
    });

    return chat.save();
  }

  /**
   * Create a campaign group chat (auto-delete after campaign ends + 24h)
   */
  async createCampaignGroupChat(
    userId: string,
    campaignId: string,
    name: string,
    memberIds: string[],
    deleteAtTimestamp: Date,
  ): Promise<ChatGroup> {
    const userIdObj = await this.profileIdForAuth(userId);
    const memberObjIds = memberIds.map((id) => this.objectId(id, 'member ID'));

    if (!memberObjIds.some((id) => id.equals(userIdObj))) {
      memberObjIds.push(userIdObj);
    }

    const chat = new this.chatGroupModel({
      type: 'campaign_group',
      name,
      members: memberObjIds,
      createdBy: userIdObj,
      campaignId: new Types.ObjectId(campaignId),
      deleteAt: deleteAtTimestamp,
    });

    return chat.save();
  }

  /**
   * Get user's conversations (all chats, sorted by recent)
   */
  async getUserConversations(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Record<string, unknown>[]; total: number }> {
    const userIdObj = await this.profileIdForAuth(userId);

    const total = await this.chatGroupModel.countDocuments({
      members: userIdObj,
      isActive: true,
    });

    const conversations = await this.chatGroupModel
      .find({
        members: userIdObj,
        isActive: true,
      })
      .populate('members', 'firstName lastName profilePhoto')
      .populate('createdBy', 'firstName lastName profilePhoto')
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const chatIds = conversations.map((conversation) => conversation._id);
    const summaries = chatIds.length
      ? await this.chatMessageModel.aggregate<{
          _id: Types.ObjectId;
          lastMessage: ChatMessage;
          unreadCount: number;
        }>([
          {
            $match: {
              chatGroupId: { $in: chatIds },
              isDeleted: false,
            },
          },
          { $sort: { createdAt: -1 } },
          {
            $group: {
              _id: '$chatGroupId',
              lastMessage: { $first: '$$ROOT' },
              unreadCount: {
                $sum: {
                  $cond: [{ $in: [userIdObj, '$readBy'] }, 0, 1],
                },
              },
            },
          },
        ])
      : [];
    const summaryByChat = new Map(
      summaries.map((summary) => [summary._id.toString(), summary]),
    );
    const data = conversations.map((conversation) => {
      const summary = summaryByChat.get(conversation._id.toString());
      return {
        ...conversation.toObject(),
        lastMessage: summary?.lastMessage ?? null,
        unreadCount: summary?.unreadCount ?? 0,
      };
    });

    return { data, total };
  }

  /**
   * Get chat group details
   */
  async getChatGroup(chatGroupId: string, userId: string): Promise<ChatGroup> {
    await this.requireMember(chatGroupId, userId);
    const chat = await this.chatGroupModel
      .findById(chatGroupId)
      .populate('members', 'firstName lastName profilePhoto')
      .populate('createdBy', 'firstName lastName profilePhoto');

    if (!chat) {
      throw new NotFoundException('Chat group not found');
    }

    return chat;
  }

  /**
   * Add members to group chat
   */
  async addMembers(
    chatGroupId: string,
    memberIds: string[],
    userId: string,
  ): Promise<ChatGroup> {
    const actorProfileId = await this.profileIdForAuth(userId);
    const chat = await this.chatGroupModel.findById(chatGroupId);

    if (!chat) {
      throw new NotFoundException('Chat group not found');
    }

    if (chat.type === 'person_to_person') {
      throw new BadRequestException(
        'Cannot add members to person-to-person chat',
      );
    }

    // Check if user is group creator
    if (chat.createdBy.toString() !== actorProfileId.toString()) {
      throw new BadRequestException('Only group creator can add members');
    }

    const newMemberObjIds = memberIds.map((id) =>
      this.objectId(id, 'member ID'),
    );

    // Add new members (avoid duplicates)
    for (const memberId of newMemberObjIds) {
      if (!chat.members.some((m) => m.toString() === memberId.toString())) {
        chat.members.push(memberId);
      }
    }

    return chat.save();
  }

  /**
   * Remove member from group chat
   */
  async removeMember(
    chatGroupId: string,
    memberId: string,
    userId: string,
  ): Promise<ChatGroup> {
    const actorProfileId = await this.profileIdForAuth(userId);
    const chat = await this.chatGroupModel.findById(chatGroupId);

    if (!chat) {
      throw new NotFoundException('Chat group not found');
    }

    if (chat.type === 'person_to_person') {
      throw new BadRequestException(
        'Cannot remove members from person-to-person chat',
      );
    }

    // Check if user is group creator or is removing themselves
    if (
      chat.createdBy.toString() !== actorProfileId.toString() &&
      actorProfileId.toString() !== memberId
    ) {
      throw new BadRequestException('Cannot remove other members');
    }

    chat.members = chat.members.filter((m) => m.toString() !== memberId);

    if (chat.members.length === 0) {
      chat.isActive = false;
    }

    return chat.save();
  }

  /**
   * Leave group chat
   */
  async leaveGroup(chatGroupId: string, userId: string): Promise<void> {
    const profileId = await this.profileIdForAuth(userId);
    const chat = await this.chatGroupModel.findById(chatGroupId);

    if (!chat) {
      throw new NotFoundException('Chat group not found');
    }

    await this.removeMember(chatGroupId, profileId.toString(), userId);
  }

  // ==================== CHAT MESSAGE OPERATIONS ====================

  /**
   * Send a message
   */
  async sendMessage(
    chatGroupId: string,
    senderId: string,
    messageType: string,
    content: string,
    attachmentUrl?: string,
    metadata?: Record<string, any>,
  ): Promise<ChatMessage> {
    const { profileId: senderIdObj } = await this.requireMember(
      chatGroupId,
      senderId,
    );

    const message = new this.chatMessageModel({
      chatGroupId: new Types.ObjectId(chatGroupId),
      senderId: senderIdObj,
      messageType,
      content,
      attachmentUrl: attachmentUrl || null,
      metadata: metadata || {},
      readBy: [senderIdObj], // Sender automatically reads their own message
    });

    const savedMessage = await message.save();

    // Update lastMessageAt in chat group
    await this.chatGroupModel.updateOne(
      { _id: chatGroupId },
      { lastMessageAt: new Date() },
    );

    return savedMessage.populate('senderId', 'firstName lastName profilePhoto');
  }

  /**
   * Get messages for a chat group with pagination
   */
  async getMessages(
    chatGroupId: string,
    userId: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: ChatMessage[]; total: number }> {
    await this.requireMember(chatGroupId, userId);
    const chatGroupIdObj = this.objectId(chatGroupId, 'chat ID');

    const total = await this.chatMessageModel.countDocuments({
      chatGroupId: chatGroupIdObj,
      isDeleted: false,
    });

    const data = await this.chatMessageModel
      .find({
        chatGroupId: chatGroupIdObj,
        isDeleted: false,
      })
      .populate('senderId', 'firstName lastName profilePhoto')
      .populate('readBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { data, total };
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(
    messageIds: string[],
    userId: string,
  ): Promise<void> {
    const userIdObj = await this.profileIdForAuth(userId);
    const objectIds = messageIds.map((id) => this.objectId(id, 'message ID'));
    const messages = await this.chatMessageModel
      .find({ _id: { $in: objectIds } })
      .select('chatGroupId');
    const chatIds = [
      ...new Set(messages.map((message) => message.chatGroupId.toString())),
    ];
    await Promise.all(
      chatIds.map((chatId) => this.requireMember(chatId, userId)),
    );

    await this.chatMessageModel.updateMany(
      { _id: { $in: objectIds } },
      {
        $addToSet: { readBy: userIdObj },
      },
    );
  }

  /**
   * Get unread count for a chat group
   */
  async getUnreadCount(chatGroupId: string, userId: string): Promise<number> {
    const { profileId: userIdObj } = await this.requireMember(
      chatGroupId,
      userId,
    );

    return this.chatMessageModel.countDocuments({
      chatGroupId: this.objectId(chatGroupId, 'chat ID'),
      isDeleted: false,
      readBy: { $ne: userIdObj },
    });
  }

  /**
   * Edit a message
   */
  async editMessage(
    messageId: string,
    content: string,
    userId: string,
  ): Promise<ChatMessage> {
    const profileId = await this.profileIdForAuth(userId);
    const message = await this.chatMessageModel.findById(messageId);

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId.toString() !== profileId.toString()) {
      throw new BadRequestException('Can only edit your own messages');
    }

    message.content = content;
    message.editedAt = new Date();

    return message.save();
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(
    messageId: string,
    userId: string,
    reason = 'user',
  ): Promise<ChatMessage> {
    const profileId = await this.profileIdForAuth(userId);
    const message = await this.chatMessageModel.findById(messageId);

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId.toString() !== profileId.toString()) {
      throw new BadRequestException('Can only delete your own messages');
    }

    message.isDeleted = true;
    message.deletedReason = reason;
    message.content = '[This message was deleted]';

    return message.save();
  }

  /**
   * Search messages in a chat
   */
  async searchMessages(
    chatGroupId: string,
    userId: string,
    query: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: ChatMessage[]; total: number }> {
    await this.requireMember(chatGroupId, userId);
    const chatObjectId = this.objectId(chatGroupId, 'chat ID');
    const normalizedQuery = query?.trim();
    if (!normalizedQuery)
      throw new BadRequestException('Search query is required');
    const escapedQuery = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const total = await this.chatMessageModel.countDocuments({
      chatGroupId: chatObjectId,
      content: { $regex: escapedQuery, $options: 'i' },
      isDeleted: false,
    });

    const data = await this.chatMessageModel
      .find({
        chatGroupId: chatObjectId,
        content: { $regex: escapedQuery, $options: 'i' },
        isDeleted: false,
      })
      .populate('senderId', 'firstName lastName profilePhoto')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { data, total };
  }

  /**
   * Get all unread conversations for a user
   */
  async getUnreadConversations(userId: string): Promise<any[]> {
    const userIdObj = await this.profileIdForAuth(userId);

    return this.chatGroupModel.aggregate([
      {
        $match: {
          members: userIdObj,
          isActive: true,
        },
      },
      {
        $lookup: {
          from: 'chatmessages',
          localField: '_id',
          foreignField: 'chatGroupId',
          as: 'messages',
        },
      },
      {
        $project: {
          _id: 1,
          type: 1,
          name: 1,
          members: 1,
          unreadCount: {
            $size: {
              $filter: {
                input: '$messages',
                as: 'msg',
                cond: {
                  $and: [
                    { $ne: ['$$msg.isDeleted', true] },
                    { $not: { $in: [userIdObj, '$$msg.readBy'] } },
                  ],
                },
              },
            },
          },
        },
      },
      {
        $match: {
          unreadCount: { $gt: 0 },
        },
      },
      {
        $sort: { _id: -1 },
      },
    ]);
  }
}
