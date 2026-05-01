import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Report } from './schemas/report.schema';
import {
  CreateReportDto,
  UpdateReportStatusDto,
  AssignReportDto,
  ReportStatsDto,
} from './dto/report.dto';

@Injectable()
export class ReportService {
  constructor(
    @InjectModel(Report.name)
    private reportModel: Model<Report>,
  ) {}

  /**
   * Create a new report
   */
  async createReport(
    targetId: string,
    reporterId: string,
    createDto: CreateReportDto,
  ): Promise<Report> {
    // Prevent self-reporting
    if (createDto.targetType === 'user' && targetId === reporterId) {
      throw new BadRequestException('Cannot report yourself');
    }

    const report = new this.reportModel({
      reporterId: new Types.ObjectId(reporterId),
      targetId: new Types.ObjectId(targetId),
      targetType: createDto.targetType,
      reason: createDto.reason,
      description: createDto.description,
      status: 'open',
    });

    return report.save();
  }

  /**
   * Get all open reports (for moderators)
   */
  async getOpenReports(page = 1, limit = 20): Promise<{
    data: Report[];
    total: number;
  }> {
    const total = await this.reportModel.countDocuments({ status: 'open' });

    const data = await this.reportModel
      .find({ status: 'open' })
      .populate('reporterId', 'firstName lastName phoneNumber')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { data, total };
  }

  /**
   * Get all reports (admin/moderator only)
   */
  async getAllReports(
    status?: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Report[]; total: number }> {
    const query: any = {};
    if (status) {
      query.status = status;
    }

    const total = await this.reportModel.countDocuments(query);

    const data = await this.reportModel
      .find(query)
      .populate('reporterId', 'firstName lastName')
      .populate('assignedTo', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { data, total };
  }

  /**
   * Get reports for a specific user/trip
   */
  async getReportsForTarget(
    targetId: string,
    targetType: string,
  ): Promise<Report[]> {
    return this.reportModel
      .find({
        targetId: new Types.ObjectId(targetId),
        targetType,
      })
      .populate('reporterId', 'firstName lastName')
      .sort({ createdAt: -1 });
  }

  /**
   * Update report status
   * Admin/moderator can investigate, resolve, or dismiss reports
   */
  async updateReportStatus(
    reportId: string,
    updateDto: UpdateReportStatusDto,
  ): Promise<Report> {
    const report = await this.reportModel.findById(reportId);

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    report.status = updateDto.status;
    if (updateDto.resolution) {
      report.resolution = updateDto.resolution;
    }
    if (
      updateDto.status === 'resolved' ||
      updateDto.status === 'dismissed'
    ) {
      report.resolvedAt = new Date();
    }
    report.updatedAt = new Date();

    return report.save();
  }

  /**
   * Assign report to a moderator
   */
  async assignReport(
    reportId: string,
    assignDto: AssignReportDto,
  ): Promise<Report> {
    const report = await this.reportModel.findById(reportId);

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    report.assignedTo = new Types.ObjectId(assignDto.moderatorId);
    report.updatedAt = new Date();

    return report.save();
  }

  /**
   * Get reports assigned to a moderator
   */
  async getAssignedReports(moderatorId: string, page = 1, limit = 20): Promise<{
    data: Report[];
    total: number;
  }> {
    const modIdObj = new Types.ObjectId(moderatorId);
    const total = await this.reportModel.countDocuments({
      assignedTo: modIdObj,
      status: 'investigating',
    });

    const data = await this.reportModel
      .find({ assignedTo: modIdObj, status: 'investigating' })
      .populate('reporterId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { data, total };
  }

  /**
   * Get report statistics
   */
  async getReportStats(): Promise<ReportStatsDto> {
    const allReports = await this.reportModel.find();

    const statusCounts = {
      open: allReports.filter((r) => r.status === 'open').length,
      investigating: allReports.filter((r) => r.status === 'investigating')
        .length,
      resolved: allReports.filter((r) => r.status === 'resolved').length,
      dismissed: allReports.filter((r) => r.status === 'dismissed').length,
    };

    const reasonCounts: Record<string, number> = {};
    allReports.forEach((report) => {
      reasonCounts[report.reason] = (reasonCounts[report.reason] || 0) + 1;
    });

    const topReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalReports: allReports.length,
      openReports: statusCounts.open,
      investigatingReports: statusCounts.investigating,
      resolvedReports: statusCounts.resolved,
      dismissedReports: statusCounts.dismissed,
      topReasons,
    };
  }
}
