import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CampaignService } from './campaign.service';

describe('CampaignService solo campaign access', () => {
  const hostId = new Types.ObjectId();
  const strangerId = new Types.ObjectId();
  const campaignId = new Types.ObjectId();

  function createService(item: Record<string, unknown>) {
    const campaignModel = {
      findById: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue(item),
      })),
    };
    const service = new CampaignService(
      campaignModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    jest
      .spyOn(service as any, 'runVerificationHousekeeping')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'enrichWithCreator')
      .mockImplementation(async (items: unknown[]) => items);
    return { service, campaignModel };
  }

  const soloCampaign = () => ({
    _id: campaignId,
    hostId,
    hikeType: 'solo',
    visibility: 'public',
    deletedByAdmin: false,
  });

  it('hides a solo campaign from another authenticated user', async () => {
    const { service } = createService(soloCampaign());

    await expect(
      service.getCampaignById(String(campaignId), String(strangerId), false),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows the host to view their solo campaign', async () => {
    const campaign = soloCampaign();
    const { service } = createService(campaign);

    await expect(
      service.getCampaignById(String(campaignId), String(hostId), false),
    ).resolves.toBe(campaign);
  });

  it('allows an admin to view another user solo campaign', async () => {
    const campaign = soloCampaign();
    const { service } = createService(campaign);

    await expect(
      service.getCampaignById(String(campaignId), String(strangerId), true),
    ).resolves.toBe(campaign);
  });

  it('does not disclose a solo campaign through the join endpoint', async () => {
    const campaign = {
      ...soloCampaign(),
      approvalStatus: 'approved',
      lifecyclePhase: 'ready',
    };
    const { service, campaignModel } = createService(campaign);
    campaignModel.findById.mockReturnValue(campaign as never);

    await expect(
      service.joinCampaign(String(campaignId), String(strangerId)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps the existing host cannot join behavior', async () => {
    const campaign = {
      ...soloCampaign(),
      approvalStatus: 'approved',
      lifecyclePhase: 'ready',
      participantsLocked: false,
      participants: [],
      joinMode: 'open',
      endDate: null,
      joinOpenDate: null,
    };
    const { service, campaignModel } = createService(campaign);
    campaignModel.findById.mockReturnValue(campaign as never);

    await expect(
      service.joinCampaign(String(campaignId), String(hostId)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
