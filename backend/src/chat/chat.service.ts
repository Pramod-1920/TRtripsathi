import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatGroup } from './schemas/chat-group.schema';
import { ChatMessage } from './schemas/chat-message.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatGroup.name)
    private chatGroupModel: Model<ChatGroup>,
    @InjectModel(ChatMessage.name)
    private chatMessageModel: Model<ChatMessage>,
  ) {}

  // ==================== CHAT GROUP OPERATIONS ====================

  /**
   * Create or get person-to-person chat
   */
  async createOrGetPersonToPersonChat(
    userId: string,
    recipientId: string,
  ): Promise<ChatGroup> {
    const userIdObj = new Types.ObjectId(userId);
    const recipientIdObj = new Types.ObjectId(recipientId);

    if (userId === recipientId) {
      throw new BadRequestException('Cannot chat with yourself');
    }

    // Check if chat already exists
    let chat = await this.chatGroupModel.findOne({
      type: 'person_to_person',
      members: { $all: [userIdObj, recipientIdObj] },
    });

    if (chat) {
      return chat;
    }

    // Create new chat
    const newChat = new this.chatGroupModel({
      type: 'person_to_person',
      members: [userIdObj, recipientIdObj],
      createdBy: userIdObj,
    });

    return newChat.save();
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
    const userIdObj = new Types.ObjectId(userId);
    const memberObjIds = memberIds.map((id) => new Types.ObjectId(id));

    if (!memberObjIds.includes(userIdObj)) {
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
    const userIdObj = new Types.ObjectId(userId);
    const memberObjIds = memberIds.map((id) => new Types.ObjectId(id));

    if (!memberObjIds.includes(userIdObj)) {
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
  ): Promise<{ data: ChatGroup[]; total: number }> {
    const userIdObj = new Types.ObjectId(userId);

    const total = await this.chatGroupModel.countDocuments({
      members: userIdObj,
      isActive: true,
    });

    const data = await this.chatGroupModel
      .find({
        members: userIdObj,
        isActive: true,
      })
      .populate('members', 'name profilePhoto')
      .populate('createdBy', 'name profilePhoto')
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { data, total };
  }

  /**
   * Get chat group details
   */
  async getChatGroup(chatGroupId: string): Promise<ChatGroup> {
    const chat = await this.chatGroupModel
      .findById(chatGroupId)
      .populate('members', 'name email profilePhoto')
      .populate('createdBy', 'name profilePhoto');

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
    const chat = await this.chatGroupModel.findById(chatGroupId);

    if (!chat) {
      throw new NotFoundException('Chat group not found');
    }

    if (chat.type === 'person_to_person') {
      throw new BadRequestException('Cannot add members to person-to-person chat');
    }

    // Check if user is group creator
    if (chat.createdBy.toString() !== userId) {
      throw new BadRequestException('Only group creator can add members');
    }

    const newMemberObjIds = memberIds.map((id) => new Types.ObjectId(id));

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
    const chat = await this.chatGroupModel.findById(chatGroupId);

    if (!chat) {
      throw new NotFoundException('Chat group not found');
    }

    if (chat.type === 'person_to_person') {
      throw new BadRequestException('Cannot remove members from person-to-person chat');
    }

    // Check if user is group creator or is removing themselves
    if (chat.createdBy.toString() !== userId && userId !== memberId) {
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
    const chat = await this.chatGroupModel.findById(chatGroupId);

    if (!chat) {
      throw new NotFoundException('Chat group not found');
    }

    await this.removeMember(chatGroupId, userId, userId);
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
    const chat = await this.chatGroupModel.findById(chatGroupId);

    if (!chat) {
      throw new NotFoundException('Chat group not found');
    }

    const senderIdObj = new Types.ObjectId(senderId);

    // Check if user is member of chat
    if (!chat.members.some((m) => m.toString() === senderId)) {
      throw new BadRequestException('User is not a member of this chat');
    }

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

    return savedMessage.populate('senderId', 'name profilePhoto');
  }

  /**
   * Get messages for a chat group with pagination
   */
  async getMessages(
    chatGroupId: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: ChatMessage[]; total: number }> {
    const chatGroupIdObj = new Types.ObjectId(chatGroupId);

    const total = await this.chatMessageModel.countDocuments({
      chatGroupId: chatGroupIdObj,
      isDeleted: false,
    });

    const data = await this.chatMessageModel
      .find({
        chatGroupId: chatGroupIdObj,
        isDeleted: false,
      })
      .populate('senderId', 'name profilePhoto')
      .populate('readBy', 'name')
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
    const userIdObj = new Types.ObjectId(userId);

    await this.chatMessageModel.updateMany(
      { _id: { $in: messageIds.map((id) => new Types.ObjectId(id)) } },
      {
        $addToSet: { readBy: userIdObj },
      },
    );
  }

  /**
   * Get unread count for a chat group
   */
  async getUnreadCount(chatGroupId: string, userId: string): Promise<number> {
    const userIdObj = new Types.ObjectId(userId);

    return this.chatMessageModel.countDocuments({
      chatGroupId: new Types.ObjectId(chatGroupId),
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
    const message = await this.chatMessageModel.findById(messageId);

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId.toString() !== userId) {
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
    const message = await this.chatMessageModel.findById(messageId);

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId.toString() !== userId) {
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
    query: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: ChatMessage[]; total: number }> {
    const total = await this.chatMessageModel.countDocuments({
      chatGroupId: new Types.ObjectId(chatGroupId),
      content: { $regex: query, $options: 'i' },
      isDeleted: false,
    });

    const data = await this.chatMessageModel
      .find({
        chatGroupId: new Types.ObjectId(chatGroupId),
        content: { $regex: query, $options: 'i' },
        isDeleted: false,
      })
      .populate('senderId', 'name profilePhoto')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { data, total };
  }

  /**
   * Get all unread conversations for a user
   */
  async getUnreadConversations(userId: string): Promise<any[]> {
    const userIdObj = new Types.ObjectId(userId);

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
