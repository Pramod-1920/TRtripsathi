import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../auth/constants/roles.enum';
import {
  CreatePersonToPersonChatDto,
  CreateGroupChatDto,
  CreateCampaignGroupChatDto,
  SendMessageDto,
  EditMessageDto,
  MarkMessageAsReadDto,
  DeleteMessageDto,
  AddMembersToGroupDto,
  RemoveMemberDto,
} from './dto/chat.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  // ==================== CHAT GROUP ENDPOINTS ====================

  /**
   * Create or get person-to-person chat
   */
  @Post('conversations/person-to-person')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or get person-to-person chat' })
  async createPersonToPersonChat(
    @Body() dto: CreatePersonToPersonChatDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.chatService.createOrGetPersonToPersonChat(
      userId,
      dto.recipientId,
    );
  }

  /**
   * Create a group chat
   */
  @Post('groups')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a group chat' })
  async createGroupChat(
    @Body() dto: CreateGroupChatDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.chatService.createGroupChat(
      userId,
      dto.name,
      dto.description,
      dto.memberIds,
    );
  }

  /**
   * Create a campaign group chat
   */
  @Post('groups/campaign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a campaign group chat (auto-deletes 24h after campaign)',
  })
  async createCampaignGroupChat(
    @Body() dto: CreateCampaignGroupChatDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.chatService.createCampaignGroupChat(
      userId,
      dto.campaignId,
      dto.name,
      dto.memberIds,
      new Date(dto.deleteAtTimestamp),
    );
  }

  /**
   * Get user's conversations
   */
  @Get('conversations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all user conversations' })
  async getConversations(
    @CurrentUser('userId') userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.chatService.getUserConversations(
      userId,
      parseInt(page),
      parseInt(limit),
    );
  }

  /**
   * Get unread conversations
   */
  @Get('conversations/unread')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get conversations with unread messages' })
  async getUnreadConversations(@CurrentUser('userId') userId: string) {
    return this.chatService.getUnreadConversations(userId);
  }

  /**
   * Get chat group details
   */
  @Get('groups/:chatGroupId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get chat group details' })
  async getChatGroup(
    @Param('chatGroupId') chatGroupId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.chatService.getChatGroup(chatGroupId, userId);
  }

  /**
   * Add members to group
   */
  @Patch('groups/:chatGroupId/members/add')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add members to group chat' })
  async addMembers(
    @Param('chatGroupId') chatGroupId: string,
    @Body() dto: AddMembersToGroupDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.chatService.addMembers(chatGroupId, dto.memberIds, userId);
  }

  /**
   * Remove member from group
   */
  @Patch('groups/:chatGroupId/members/remove')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove member from group chat' })
  async removeMember(
    @Param('chatGroupId') chatGroupId: string,
    @Body() dto: RemoveMemberDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.chatService.removeMember(chatGroupId, dto.memberId, userId);
  }

  /**
   * Leave group chat
   */
  @Post('groups/:chatGroupId/leave')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Leave a group chat' })
  async leaveGroup(
    @Param('chatGroupId') chatGroupId: string,
    @CurrentUser('userId') userId: string,
  ) {
    await this.chatService.leaveGroup(chatGroupId, userId);
    return { message: 'Left group chat' };
  }

  // ==================== MESSAGE ENDPOINTS ====================

  /**
   * Send a message
   */
  @Post('messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a message' })
  async sendMessage(
    @Body() dto: SendMessageDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.chatService.sendMessage(
      dto.chatGroupId,
      userId,
      dto.messageType,
      dto.content,
      dto.attachmentUrl,
      dto.metadata,
    );
  }

  /**
   * Get messages for a chat
   */
  @Get('messages/:chatGroupId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get messages in a chat' })
  async getMessages(
    @Param('chatGroupId') chatGroupId: string,
    @CurrentUser('userId') userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.chatService.getMessages(
      chatGroupId,
      userId,
      parseInt(page),
      parseInt(limit),
    );
  }

  /**
   * Mark messages as read
   */
  @Patch('messages/mark-read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark messages as read' })
  async markMessagesAsRead(
    @Body() dto: MarkMessageAsReadDto,
    @CurrentUser('userId') userId: string,
  ) {
    await this.chatService.markMessagesAsRead(dto.messageIds, userId);
    return { message: 'Messages marked as read' };
  }

  /**
   * Get unread count for a chat
   */
  @Get('messages/:chatGroupId/unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get unread message count' })
  async getUnreadCount(
    @Param('chatGroupId') chatGroupId: string,
    @CurrentUser('userId') userId: string,
  ) {
    const count = await this.chatService.getUnreadCount(chatGroupId, userId);
    return { unreadCount: count };
  }

  /**
   * Edit a message
   */
  @Patch('messages/:messageId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit a message' })
  async editMessage(
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.chatService.editMessage(messageId, dto.content, userId);
  }

  /**
   * Delete a message
   */
  @Delete('messages/:messageId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a message' })
  async deleteMessage(
    @Param('messageId') messageId: string,
    @Body() dto: DeleteMessageDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.chatService.deleteMessage(messageId, userId, dto.reason);
  }

  /**
   * Search messages in a chat
   */
  @Get('messages/:chatGroupId/search')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search messages in a chat' })
  async searchMessages(
    @Param('chatGroupId') chatGroupId: string,
    @CurrentUser('userId') userId: string,
    @Query('query') query: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.chatService.searchMessages(
      chatGroupId,
      userId,
      query,
      parseInt(page),
      parseInt(limit),
    );
  }
}
