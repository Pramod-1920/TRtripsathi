import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import crypto from 'crypto';
import { Campaign, CampaignDocument } from './schemas/campaign.schema';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { AuditService } from '../audit/audit.service';
import { User } from '../user/schemas/user.schema';
import { Auth } from '../auth/schemas/auth.schema';

@Injectable()
export class CampaignService {
  constructor(
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(Auth.name)
    private readonly authModel: Model<Auth>,
    private readonly audit: AuditService,
  ) {}

  private generateCampaignCode() {
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `CMP-${suffix}`;
  }

  private async createUniqueCampaignCode() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = this.generateCampaignCode();
      const existing = await this.campaignModel.findOne({ campaignCode: code }).lean();

      if (!existing) {
        return code;
      }
    }

    throw new Error('Unable to generate unique campaign code');
  }

  private async autoCloseExpiredCampaigns() {
    const now = new Date();
    const candidates = await this.campaignModel
      .find({
        deletedByAdmin: false,
        completed: false,
        startDate: { $ne: null },
      })
      .select('_id startDate durationDays')
      .lean();

    const toClose: Types.ObjectId[] = [];

    for (const campaign of candidates) {
      if (!campaign.startDate) {
        continue;
      }

      const durationDays = Math.max(1, Number(campaign.durationDays ?? 1));
      const startTime = new Date(campaign.startDate).getTime();
      const endTime = startTime + durationDays * 24 * 60 * 60 * 1000;

      if (now.getTime() >= endTime) {
        toClose.push(campaign._id as Types.ObjectId);
      }
    }

    if (toClose.length > 0) {
      await this.campaignModel.updateMany(
        { _id: { $in: toClose } },
        { $set: { completed: true } },
      );
    }
  }

  private buildCreatorName(profile?: Partial<User> | null, fallback?: string) {
    if (!profile) {
      return fallback ?? 'Unknown';
    }

    const fullName = [profile.firstName, profile.middleName, profile.lastName]
      .filter((part) => typeof part === 'string' && part.trim().length > 0)
      .join(' ')
      .trim();

    return fullName || fallback || 'Unknown';
  }

  private async enrichWithCreator(items: Array<Record<string, any>>) {
    if (items.length === 0) {
      return items;
    }

    const hostIds = Array.from(
      new Set(
        items
          .map((item) => String(item.hostId ?? ''))
          .filter((id) => id.length > 0),
      ),
    );

    if (hostIds.length === 0) {
      return items;
    }

    const objectIds = hostIds.map((id) => new Types.ObjectId(id));

    const [hosts, profiles] = await Promise.all([
      this.authModel
        .find({ _id: { $in: objectIds } })
        .select('_id phoneNumber role')
        .lean(),
      this.userModel
        .find({ authId: { $in: objectIds } })
        .select('authId firstName middleName lastName')
        .lean(),
    ]);

    const hostMap = new Map(hosts.map((host) => [String(host._id), host]));
    const profileMap = new Map(
      profiles.map((profile) => [String(profile.authId), profile]),
    );

    return items.map((item) => {
      const hostId = String(item.hostId ?? '');
      const host = hostMap.get(hostId);
      const profile = profileMap.get(hostId);
      const phoneNumber = host?.phoneNumber ?? null;

      return {
        ...item,
        creator: {
          name: this.buildCreatorName(profile as Partial<User>, phoneNumber ?? 'Unknown'),
          role: host?.role ?? 'user',
          phoneNumber,
        },
      };
    });
  }

  async createCampaign(dto: CreateCampaignDto, hostId: string) {
    const campaignCode = await this.createUniqueCampaignCode();

    const created = await this.campaignModel.create({
      campaignCode,
      ...dto,
      hostId: new Types.ObjectId(hostId),
    });
    await this.audit.logEvent({
      type: 'campaign.create',
      campaignId: created._id.toString(),
      hostId,
    });
    return this.getCampaignById(created._id.toString());
  }

  async listCampaigns(page = 1, limit = 20) {
    await this.autoCloseExpiredCampaigns();

    const skip = (page - 1) * limit;
    const rawItems = await this.campaignModel
      .find({ deletedByAdmin: false })
      .skip(skip)
      .limit(limit)
      .lean();
    const items = await this.enrichWithCreator(rawItems as Array<Record<string, any>>);
    const total = await this.campaignModel.countDocuments({
      deletedByAdmin: false,
    });
    return {
      items,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getCampaignById(id: string) {
    await this.autoCloseExpiredCampaigns();

    const item = await this.campaignModel.findById(id).lean();
    if (!item || item.deletedByAdmin)
      throw new NotFoundException('Campaign not found');

    const [enriched] = await this.enrichWithCreator([item as Record<string, any>]);
    return enriched;
  }

  async updateCampaign(
    id: string,
    dto: UpdateCampaignDto,
    requesterId: string,
    isAdmin = false,
  ) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign || campaign.deletedByAdmin)
      throw new NotFoundException('Campaign not found');

    if (!isAdmin && campaign.hostId.toString() !== requesterId) {
      throw new ForbiddenException('Not allowed to edit this campaign');
    }

    Object.assign(campaign, dto);
    await campaign.save();
    await this.audit.logEvent({
      type: 'campaign.update',
      campaignId: id,
      requesterId,
    });
    return this.getCampaignById(id);
  }

  async adminDeleteCampaign(
    id: string,
    adminId: string,
    reason?: string,
    userModel?: Model<any>,
  ) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign) throw new NotFoundException('Campaign not found');

    campaign.deletedByAdmin = true;
    await campaign.save();

    // mark host profile with admin flag if userModel provided
    try {
      if (userModel) {
        await userModel.findOneAndUpdate(
          { authId: campaign.hostId },
          {
            $push: {
              adminFlags: {
                type: 'campaign_deleted',
                campaignId: campaign._id.toString(),
                reason,
                date: new Date(),
              },
            },
          },
        );
      }
    } catch (error) {
      // best-effort: log to console for visibility
      // avoid failing admin delete if host update fails

      console.warn(
        'Failed to mark host adminFlags for deleted campaign',
        error,
      );
    }

    await this.audit.logEvent({
      type: 'campaign.delete_by_admin',
      campaignId: id,
      adminId,
      reason,
    });
    return { message: 'Campaign deleted by admin' };
  }

  async hardDeleteCampaign(id: string) {
    // permanently remove
    await this.campaignModel.findByIdAndDelete(id);
    await this.audit.logEvent({ type: 'campaign.hard_delete', campaignId: id });
    return { message: 'Campaign permanently removed' };
  }
}
