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
    @CurrentUser() user: any,
  ) {
    return this.chatService.createOrGetPersonToPersonChat(
      user._id.toString(),
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
    @CurrentUser() user: any,
  ) {
    return this.chatService.createGroupChat(
      user._id.toString(),
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
  @ApiOperation({ summary: 'Create a campaign group chat (auto-deletes 24h after campaign)' })
  async createCampaignGroupChat(
    @Body() dto: CreateCampaignGroupChatDto,
    @CurrentUser() user: any,
  ) {
    return this.chatService.createCampaignGroupChat(
      user._id.toString(),
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
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.chatService.getUserConversations(
      user._id.toString(),
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
  async getUnreadConversations(@CurrentUser() user: any) {
    return this.chatService.getUnreadConversations(user._id.toString());
  }

  /**
   * Get chat group details
   */
  @Get('groups/:chatGroupId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get chat group details' })
  async getChatGroup(@Param('chatGroupId') chatGroupId: string) {
    return this.chatService.getChatGroup(chatGroupId);
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
    @CurrentUser() user: any,
  ) {
    return this.chatService.addMembers(
      chatGroupId,
      dto.memberIds,
      user._id.toString(),
    );
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
    @CurrentUser() user: any,
  ) {
    return this.chatService.removeMember(
      chatGroupId,
      dto.memberId,
      user._id.toString(),
    );
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
    @CurrentUser() user: any,
  ) {
    await this.chatService.leaveGroup(chatGroupId, user._id.toString());
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
    @CurrentUser() user: any,
  ) {
    return this.chatService.sendMessage(
      dto.chatGroupId,
      user._id.toString(),
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
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.chatService.getMessages(
      chatGroupId,
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
    @CurrentUser() user: any,
  ) {
    await this.chatService.markMessagesAsRead(
      dto.messageIds,
      user._id.toString(),
    );
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
    @CurrentUser() user: any,
  ) {
    const count = await this.chatService.getUnreadCount(
      chatGroupId,
      user._id.toString(),
    );
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
    @CurrentUser() user: any,
  ) {
    return this.chatService.editMessage(
      messageId,
      dto.content,
      user._id.toString(),
    );
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
    @CurrentUser() user: any,
  ) {
    return this.chatService.deleteMessage(
      messageId,
      user._id.toString(),
      dto.reason,
    );
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
    @Query('query') query: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.chatService.searchMessages(
      chatGroupId,
      query,
      parseInt(page),
      parseInt(limit),
    );
  }
}
