import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Report } from './schemas/report.schema';
import { User } from '../user/schemas/user.schema';
import { Auth } from '../auth/schemas/auth.schema';
import { Role } from '../auth/constants/roles.enum';
import { NotificationService } from '../notification/notification.service';
import { AuditService } from '../audit/audit.service';
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
    @InjectModel(Auth.name)
    private authModel: Model<Auth>,
    private notificationService: NotificationService,
    private readonly audit: AuditService,
  ) {}

  private async getReporterProfile(authId: string) {
    const authObjectId = new Types.ObjectId(authId);
    const account = await this.authModel
      .findOne({
        _id: authObjectId,
        isActive: { $ne: false },
      })
      .select('_id role');
    if (!account) {
      throw new NotFoundException('Reporter profile not found');
    }
    if (account.role !== Role.User) {
      throw new ForbiddenException('Only users can submit reports');
    }

    // Repair older user accounts that have an Auth record but are missing the
    // companion profile required by reports.
    return this.userModel
      .findOneAndUpdate(
        { authId: authObjectId },
        { $setOnInsert: { authId: authObjectId } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .select('_id authId firstName lastName phoneNumber');
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
    if (
      createDto.targetType === 'user' &&
      targetId === reporter._id.toString()
    ) {
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

  async getMyReports(
    reporterId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Report[]; total: number }> {
    const reporter = await this.getReporterProfile(reporterId);
    const safePage = this.normalizePage(page);
    const safeLimit = this.normalizeLimit(limit);
    const query = { reporterId: reporter._id };

    const [data, total] = await Promise.all([
      this.reportModel
        .find(query)
        .select('-reporterId -assignedTo')
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit),
      this.reportModel.countDocuments(query),
    ]);

    return { data, total };
  }

  private normalizePage(page: number) {
    return Math.max(1, Math.floor(Number(page) || 1));
  }

  private normalizeLimit(limit: number) {
    return Math.min(Math.max(1, Math.floor(Number(limit) || 20)), 100);
  }

  private async getUserProfileIds(): Promise<Types.ObjectId[]> {
    const userAuthIds = await this.authModel.distinct('_id', {
      role: Role.User,
    });
    return this.userModel.distinct('_id', {
      authId: { $in: userAuthIds },
    });
  }

  private async buildAdminQuery(status?: string, category?: string) {
    const userProfileIds = await this.getUserProfileIds();
    const query: Record<string, unknown> = {};
    query.reporterId = { $in: userProfileIds };

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
  async getOpenReports(
    page = 1,
    limit = 20,
    category?: string,
  ): Promise<{
    data: Report[];
    total: number;
  }> {
    const safePage = this.normalizePage(page);
    const safeLimit = this.normalizeLimit(limit);
    const query = await this.buildAdminQuery('open', category);
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
    const query = await this.buildAdminQuery(status, category);

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
    const userProfileIds = await this.getUserProfileIds();
    return this.reportModel
      .find({
        reporterId: { $in: userProfileIds },
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
    actorId: string,
  ): Promise<Report> {
    const userProfileIds = await this.getUserProfileIds();
    const report = await this.reportModel.findOne({
      _id: reportId,
      reporterId: { $in: userProfileIds },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const previousStatus = report.status;
    report.status = updateDto.status;
    if (updateDto.resolution) {
      report.resolution = updateDto.resolution;
    }
    if (updateDto.status === 'resolved' || updateDto.status === 'dismissed') {
      report.resolvedAt = new Date();
    }
    report.updatedAt = new Date();

    const saved = await report.save();

    await this.audit.logEvent({
      type: 'moderation.report_status_changed',
      actorId,
      reportId,
      previousStatus,
      nextStatus: saved.status,
      resolutionProvided: Boolean(updateDto.resolution),
    });

    if (previousStatus !== saved.status) {
      const statusLabel =
        saved.status === 'investigating'
          ? 'being reviewed'
          : saved.status === 'resolved'
            ? 'resolved'
            : saved.status === 'dismissed'
              ? 'closed'
              : 'received';
      try {
        await this.notificationService.createNotification(
          saved.reporterId.toString(),
          'report_status_changed',
          'Your report was updated',
          `Your report is now ${statusLabel}.`,
          {
            reportId: saved._id.toString(),
            status: saved.status,
            route: 'report_issue',
          },
        );
      } catch (error) {
        // The moderation action is already committed. A temporary push or
        // notification-store failure must not make the admin retry it.
        console.warn('Report status notification failed:', error);
      }
    }

    return saved;
  }

  /**
   * Assign report to a moderator
   */
  async assignReport(
    reportId: string,
    assignDto: AssignReportDto,
    actorId: string,
  ): Promise<Report> {
    const userProfileIds = await this.getUserProfileIds();
    const report = await this.reportModel.findOne({
      _id: reportId,
      reporterId: { $in: userProfileIds },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    report.assignedTo = new Types.ObjectId(assignDto.moderatorId);
    report.updatedAt = new Date();

    const saved = await report.save();
    await this.audit.logEvent({
      type: 'moderation.report_assigned',
      actorId,
      reportId,
      moderatorId: assignDto.moderatorId,
    });
    return saved;
  }

  /**
   * Get reports assigned to a moderator
   */
  async getAssignedReports(
    moderatorId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    data: Report[];
    total: number;
  }> {
    const modIdObj = new Types.ObjectId(moderatorId);
    const userProfileIds = await this.getUserProfileIds();
    const total = await this.reportModel.countDocuments({
      reporterId: { $in: userProfileIds },
      assignedTo: modIdObj,
      status: 'investigating',
    });

    const data = await this.reportModel
      .find({
        reporterId: { $in: userProfileIds },
        assignedTo: modIdObj,
        status: 'investigating',
      })
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
    const match = await this.buildAdminQuery(undefined, category);
    const allUserReportsMatch = await this.buildAdminQuery();
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
        { $match: allUserReportsMatch },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
    ]);

    const counts = statusCounts.reduce<Record<string, number>>((acc, item) => {
      acc[String(item._id)] = Number(item.count ?? 0);
      return acc;
    }, {});

    const byCategory = categoryCounts.reduce<Record<string, number>>(
      (acc, item) => {
        acc[String(item._id ?? 'report')] = Number(item.count ?? 0);
        return acc;
      },
      {},
    );

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
