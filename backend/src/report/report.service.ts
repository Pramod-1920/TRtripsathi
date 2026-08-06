import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Report } from './schemas/report.schema';
import { User } from '../user/schemas/user.schema';
import {
  CreateReportDto,
  CreateFeedbackDto,
  UpdateReportStatusDto,
  AssignReportDto,
  ReportStatsDto,
} from './dto/report.dto';

@Injectable()
export class ReportService {
  constructor(
    @InjectModel(Report.name)
    private reportModel: Model<Report>,
    @InjectModel(User.name)
    private userModel: Model<User>,
  ) {}

  private async getReporterProfile(authId: string) {
    const profile = await this.userModel
      .findOne({ authId: new Types.ObjectId(authId) })
      .select('_id firstName lastName phoneNumber');

    if (!profile) {
      throw new NotFoundException('Reporter profile not found');
    }

    return profile;
  }

  /**
   * Create a new report
   */
  async createReport(
    targetId: string,
    reporterId: string,
    createDto: CreateReportDto,
  ): Promise<Report> {
    const reporter = await this.getReporterProfile(reporterId);

    // Prevent self-reporting
    if (createDto.targetType === 'user' && targetId === reporter._id.toString()) {
      throw new BadRequestException('Cannot report yourself');
    }

    const report = new this.reportModel({
      reporterId: reporter._id,
      category: 'report',
      targetId: new Types.ObjectId(targetId),
      targetType: createDto.targetType,
      reason: createDto.reason,
      description: createDto.description,
      status: 'open',
    });

    return report.save();
  }

  async createFeedback(
    reporterId: string,
    createDto: CreateFeedbackDto,
  ): Promise<Report> {
    const reporter = await this.getReporterProfile(reporterId);

    const feedback = new this.reportModel({
      reporterId: reporter._id,
      category: 'feedback',
      targetType: 'system',
      reason: createDto.reason,
      description: createDto.description,
      status: 'open',
    });

    return feedback.save();
  }

  private normalizePage(page: number) {
    return Math.max(1, Math.floor(Number(page) || 1));
  }

  private normalizeLimit(limit: number) {
    return Math.min(Math.max(1, Math.floor(Number(limit) || 20)), 100);
  }

  private buildAdminQuery(status?: string, category?: string) {
    const query: Record<string, unknown> = {};

    if (status) {
      query.status = status;
    }

    if (category) {
      query.category = category;
    }

    return query;
  }

  /**
   * Get all open reports (for moderators)
   */
  async getOpenReports(page = 1, limit = 20, category?: string): Promise<{
    data: Report[];
    total: number;
  }> {
    const safePage = this.normalizePage(page);
    const safeLimit = this.normalizeLimit(limit);
    const query = this.buildAdminQuery('open', category);
    const total = await this.reportModel.countDocuments(query);

    const data = await this.reportModel
      .find(query)
      .populate('reporterId', 'firstName lastName phoneNumber')
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit);

    return { data, total };
  }

  /**
   * Get all reports (admin/moderator only)
   */
  async getAllReports(
    status?: string,
    category?: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Report[]; total: number }> {
    const safePage = this.normalizePage(page);
    const safeLimit = this.normalizeLimit(limit);
    const query = this.buildAdminQuery(status, category);

    const total = await this.reportModel.countDocuments(query);

    const data = await this.reportModel
      .find(query)
      .populate('reporterId', 'firstName lastName')
      .populate('assignedTo', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit);

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
  async getReportStats(category?: string): Promise<ReportStatsDto> {
    const match = category ? { category } : {};
    const [statusCounts, topReasons, categoryCounts] = await Promise.all([
      this.reportModel.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.reportModel.aggregate([
        { $match: match },
        { $group: { _id: '$reason', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      this.reportModel.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
    ]);

    const counts = statusCounts.reduce<Record<string, number>>((acc, item) => {
      acc[String(item._id)] = Number(item.count ?? 0);
      return acc;
    }, {});

    const byCategory = categoryCounts.reduce<Record<string, number>>((acc, item) => {
      acc[String(item._id ?? 'report')] = Number(item.count ?? 0);
      return acc;
    }, {});

    const total =
      (counts.open ?? 0) +
      (counts.investigating ?? 0) +
      (counts.resolved ?? 0) +
      (counts.dismissed ?? 0);

    return {
      total,
      open: counts.open ?? 0,
      investigating: counts.investigating ?? 0,
      resolved: counts.resolved ?? 0,
      dismissed: counts.dismissed ?? 0,
      topReasons: topReasons.map((item) => ({
        reason: String(item._id),
        count: Number(item.count ?? 0),
      })),
      byCategory: {
        feedback: byCategory.feedback ?? 0,
        report: byCategory.report ?? 0,
      },
    };
  }
}
