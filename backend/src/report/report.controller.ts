import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../auth/constants/roles.enum';
import {
  CreateReportDto,
  UpdateReportStatusDto,
  AssignReportDto,
} from './dto/report.dto';

@ApiTags('reports')
@Controller('reports')
export class ReportController {
  constructor(private reportService: ReportService) {}

  /**
   * Create a new report (user or trip)
   */
  @Post(':targetId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a report for a user or trip' })
  async createReport(
    @Param('targetId') targetId: string,
    @Body() createDto: CreateReportDto,
    @CurrentUser() user: any,
  ) {
    return this.reportService.createReport(
      targetId,
      user._id.toString(),
      createDto,
    );
  }

  /**
   * Get open reports (moderator/admin only)
   */
  @Get('admin/open')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.Moderator)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all open reports (moderator only)' })
  async getOpenReports(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.reportService.getOpenReports(parseInt(page), parseInt(limit));
  }

  /**
   * Get all reports with optional status filter (admin only)
   */
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all reports (admin only)' })
  async getAllReports(
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.reportService.getAllReports(
      status,
      parseInt(page),
      parseInt(limit),
    );
  }

  /**
   * Get report statistics (admin only)
   */
  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get report statistics (admin only)' })
  async getReportStats() {
    return this.reportService.getReportStats();
  }

  /**
   * Get reports for a specific target
   */
  @Get('target/:targetId/:targetType')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.Moderator)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all reports for a user or trip' })
  async getReportsForTarget(
    @Param('targetId') targetId: string,
    @Param('targetType') targetType: string,
  ) {
    return this.reportService.getReportsForTarget(targetId, targetType);
  }

  /**
   * Get reports assigned to current moderator
   */
  @Get('assigned')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.Moderator)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get reports assigned to you' })
  async getAssignedReports(
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.reportService.getAssignedReports(
      user._id.toString(),
      parseInt(page),
      parseInt(limit),
    );
  }

  /**
   * Assign report to moderator
   */
  @Patch(':reportId/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign report to moderator (admin only)' })
  async assignReport(
    @Param('reportId') reportId: string,
    @Body() assignDto: AssignReportDto,
  ) {
    return this.reportService.assignReport(reportId, assignDto);
  }

  /**
   * Update report status
   */
  @Patch(':reportId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.Moderator)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update report status' })
  async updateReportStatus(
    @Param('reportId') reportId: string,
    @Body() updateDto: UpdateReportStatusDto,
  ) {
    return this.reportService.updateReportStatus(reportId, updateDto);
  }
}
