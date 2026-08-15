import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../auth/constants/roles.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditService } from './audit.service';

@ApiTags('audit')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin, Role.Moderator)
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('events')
  @ApiOperation({ summary: 'List append-only operational audit events' })
  list(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('type') type?: string,
  ) {
    return this.audit.listEvents({
      page: Number(page),
      limit: Number(limit),
      type: type?.trim() || undefined,
    });
  }
}
