import { Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../auth/constants/roles.enum';
import { AdminNotificationService } from './admin-notification.service';

@ApiTags('admin notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
@Controller('admin/notifications')
export class AdminNotificationController {
  constructor(private notificationService: AdminNotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get the unified admin notification feed' })
  getNotifications(
    @CurrentUser('userId') adminId: string,
    @Query('limit') limit = '30',
  ) {
    return this.notificationService.getNotifications(
      adminId,
      parseInt(limit, 10),
    );
  }

  @Patch('read')
  @ApiOperation({ summary: 'Mark all admin notifications as read' })
  markAllRead(@CurrentUser('userId') adminId: string) {
    return this.notificationService.markAllRead(adminId);
  }
}
