import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Body,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../auth/constants/roles.enum';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Post('push-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register this device for push notifications' })
  registerPushToken(
    @CurrentUser('userId') userId: string,
    @Body() body: RegisterPushTokenDto,
  ) {
    return this.notificationService.registerPushToken(
      userId,
      body.token,
      body.platform,
    );
  }

  @Delete('push-token/:token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unregister this device from push notifications' })
  unregisterPushToken(
    @CurrentUser('userId') userId: string,
    @Param('token') token: string,
  ) {
    return this.notificationService.unregisterPushToken(userId, token);
  }

  /**
   * Get unread notifications for current user
   */
  @Get('unread')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get unread notifications' })
  async getUnreadNotifications(
    @CurrentUser('userId') userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.notificationService.getUnreadNotifications(
      userId,
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
    @CurrentUser('userId') userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.notificationService.getAllNotifications(
      userId,
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
  async getUnreadCount(@CurrentUser('userId') userId: string) {
    const count = await this.notificationService.getUnreadCount(userId);
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
  async markAllAsRead(@CurrentUser('userId') userId: string) {
    await this.notificationService.markAllAsRead(userId);
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
