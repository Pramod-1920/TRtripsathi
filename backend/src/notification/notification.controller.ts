import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../auth/constants/roles.enum';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  /**
   * Get unread notifications for current user
   */
  @Get('unread')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get unread notifications' })
  async getUnreadNotifications(
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.notificationService.getUnreadNotifications(
      user._id.toString(),
      parseInt(page),
      parseInt(limit),
    );
  }

  /**
   * Get all notifications for current user
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all notifications' })
  async getAllNotifications(
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.notificationService.getAllNotifications(
      user._id.toString(),
      parseInt(page),
      parseInt(limit),
    );
  }

  /**
   * Get unread count
   */
  @Get('unread/count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@CurrentUser() user: any) {
    const count = await this.notificationService.getUnreadCount(
      user._id.toString(),
    );
    return { unreadCount: count };
  }

  /**
   * Mark notification as read
   */
  @Patch(':notificationId/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Param('notificationId') notificationId: string) {
    return this.notificationService.markAsRead(notificationId);
  }

  /**
   * Mark all notifications as read
   */
  @Patch('mark-all-read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: any) {
    await this.notificationService.markAllAsRead(user._id.toString());
    return { message: 'All notifications marked as read' };
  }

  /**
   * Delete a notification
   */
  @Delete(':notificationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a notification' })
  async deleteNotification(@Param('notificationId') notificationId: string) {
    await this.notificationService.deleteNotification(notificationId);
    return { message: 'Notification deleted' };
  }
}
