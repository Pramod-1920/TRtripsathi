import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Report } from '../report/schemas/report.schema';
import { Campaign } from '../campaign/schemas/campaign.schema';
import { User } from '../user/schemas/user.schema';
import { Auth } from '../auth/schemas/auth.schema';
import { Role } from '../auth/constants/roles.enum';
import { AdminNotificationState } from './schemas/admin-notification-state.schema';

export type AdminNotificationItem = {
  id: string;
  type: 'report' | 'campaign' | 'photo_verification';
  title: string;
  description: string;
  createdAt: Date;
  status?: string;
  href: string;
};

@Injectable()
export class AdminNotificationService {
  constructor(
    @InjectModel(Report.name) private reportModel: Model<Report>,
    @InjectModel(Campaign.name) private campaignModel: Model<Campaign>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Auth.name) private authModel: Model<Auth>,
    @InjectModel(AdminNotificationState.name)
    private stateModel: Model<AdminNotificationState>,
  ) {}

  private normalizeLimit(limit: number) {
    return Math.min(Math.max(1, Math.floor(Number(limit) || 30)), 100);
  }

  async getNotifications(adminId: string, limit = 30) {
    const safeLimit = this.normalizeLimit(limit);
    const state = await this.stateModel
      .findOne({ adminId: new Types.ObjectId(adminId) })
      .lean();
    const lastReadAt =
      state?.lastReadAt ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const userAuthIds = await this.authModel.distinct('_id', {
      role: Role.User,
    });
    const userProfileIds = await this.userModel.distinct('_id', {
      authId: { $in: userAuthIds },
    });

    const reportFilter = { reporterId: { $in: userProfileIds } };
    const campaignFilter = { hostId: { $in: userAuthIds } };
    const photoBasePipeline = [
      { $match: { authId: { $in: userAuthIds } } },
      { $unwind: '$photoVerificationRequests' },
    ];

    const [
      reports,
      campaigns,
      photos,
      reportUnread,
      campaignUnread,
      photoUnread,
    ] = await Promise.all([
      this.reportModel
        .find(reportFilter)
        .populate('reporterId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(safeLimit)
        .lean(),
      this.campaignModel
        .find(campaignFilter)
        .populate('hostId', 'phoneNumber')
        .sort({ createdAt: -1 })
        .limit(safeLimit)
        .lean(),
      this.userModel.aggregate([
        ...photoBasePipeline,
        { $sort: { 'photoVerificationRequests.submittedAt': -1 } },
        { $limit: safeLimit },
        {
          $project: {
            firstName: 1,
            lastName: 1,
            request: '$photoVerificationRequests',
          },
        },
      ]),
      this.reportModel.countDocuments({
        ...reportFilter,
        createdAt: { $gt: lastReadAt },
      }),
      this.campaignModel.countDocuments({
        ...campaignFilter,
        createdAt: { $gt: lastReadAt },
      }),
      this.userModel.aggregate([
        ...photoBasePipeline,
        {
          $match: {
            'photoVerificationRequests.submittedAt': { $gt: lastReadAt },
          },
        },
        { $count: 'value' },
      ]),
    ]);

    const items: AdminNotificationItem[] = [
      ...reports.map((report: any) => {
        const reporter = report.reporterId;
        const reporterName =
          `${reporter?.firstName ?? ''} ${reporter?.lastName ?? ''}`.trim() ||
          'A traveler';
        return {
          id: `report:${String(report._id)}`,
          type: 'report' as const,
          title:
            report.category === 'feedback'
              ? 'New system feedback'
              : 'New traveler report',
          description: `${reporterName} submitted ${String(report.reason).replaceAll('_', ' ')}.`,
          createdAt: new Date(report.createdAt),
          status: report.status,
          href: '/reports',
        };
      }),
      ...campaigns.map((campaign: any) => ({
        id: `campaign:${String(campaign._id)}`,
        type: 'campaign' as const,
        title: 'Campaign created',
        description: `${campaign.title || campaign.campaignCode} was created by ${campaign.hostId?.phoneNumber ?? 'a traveler'}.`,
        createdAt: new Date(campaign.createdAt),
        status: campaign.approvalStatus ?? campaign.lifecyclePhase,
        href: '/campaigns/details',
      })),
      ...photos.map((photo: any) => {
        const name =
          `${photo.firstName ?? ''} ${photo.lastName ?? ''}`.trim() ||
          'A traveler';
        return {
          id: `photo:${String(photo._id)}:${photo.request.requestCode}`,
          type: 'photo_verification' as const,
          title: 'Photo verification requested',
          description: photo.request.place
            ? `${name} submitted a photo from ${photo.request.place} for review.`
            : `${name} submitted ${photo.request.kind} trip evidence for review.`,
          createdAt: new Date(photo.request.submittedAt),
          status: photo.request.status,
          href: '/photo-verification-queue',
        };
      }),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, safeLimit);

    return {
      items,
      unreadCount:
        reportUnread + campaignUnread + Number(photoUnread[0]?.value ?? 0),
      lastReadAt,
    };
  }

  async markAllRead(adminId: string) {
    const lastReadAt = new Date();
    await this.stateModel.findOneAndUpdate(
      { adminId: new Types.ObjectId(adminId) },
      { $set: { lastReadAt } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return { unreadCount: 0, lastReadAt };
  }
}
