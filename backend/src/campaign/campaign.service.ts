import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Campaign, CampaignDocument } from './schemas/campaign.schema';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CampaignService {
  constructor(
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    private readonly audit: AuditService,
  ) {}

  async createCampaign(dto: CreateCampaignDto, hostId: string) {
    const created = await this.campaignModel.create({
      ...dto,
      hostId: new Types.ObjectId(hostId),
    });
    await this.audit.logEvent({
      type: 'campaign.create',
      campaignId: created._id.toString(),
      hostId,
    });
    return created;
  }

  async listCampaigns(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const items = await this.campaignModel
      .find({ deletedByAdmin: false })
      .skip(skip)
      .limit(limit)
      .lean();
    const total = await this.campaignModel.countDocuments({
      deletedByAdmin: false,
    });
    return {
      items,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getCampaignById(id: string) {
    const item = await this.campaignModel.findById(id).lean();
    if (!item || item.deletedByAdmin)
      throw new NotFoundException('Campaign not found');
    return item;
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
    return campaign;
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
