import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CampaignService } from './campaign.service';

describe('CampaignService minimum participant host decision', () => {
  const hostId = new Types.ObjectId();
  const campaignId = new Types.ObjectId();

  function createService(campaign: Record<string, any>) {
    const campaignModel = {
      findById: jest.fn().mockResolvedValue(campaign),
    };
    const notificationService = {
      createBulkNotifications: jest.fn().mockResolvedValue(undefined),
    };
    const service = new CampaignService(
      campaignModel as never,
      {} as never,
      {} as never,
      { logEvent: jest.fn() } as never,
      {} as never,
      {} as never,
      notificationService as never,
      {} as never,
    );
    return { service, notificationService };
  }

  function openCampaign() {
    return {
      _id: campaignId,
      title: 'Low enrollment trek',
      hostId,
      deletedByAdmin: false,
      approvalStatus: 'approved',
      lifecyclePhase: 'open',
      phaseLocked: false,
      minParticipants: 4,
      participants: [{ userId: new Types.ObjectId(), status: 'accepted' }],
      participantsLocked: false,
      timeline: { nextTransitionAt: new Date(Date.now() - 1000) },
      save: jest.fn().mockResolvedValue(undefined),
    };
  }

  it('pauses instead of cancelling and asks only the host', async () => {
    const campaign = openCampaign();
    const { service, notificationService } = createService(campaign);
    const transition = jest
      .spyOn(service, 'transitionCampaignPhase')
      .mockResolvedValue({} as never);

    await (service as any).processSinglePhaseTransition(campaign);

    expect(campaign.minimumParticipantDecisionRequired).toBe(true);
    expect(campaign.participantsLocked).toBe(true);
    expect(campaign.timeline.nextTransitionAt).toBeNull();
    expect(transition).not.toHaveBeenCalled();
    expect(notificationService.createBulkNotifications).toHaveBeenCalledWith(
      [hostId.toString()],
      'admin_message',
      'Campaign decision required',
      expect.any(String),
      expect.objectContaining({
        action: 'minimum_participants_decision',
        acceptedParticipants: 1,
        minimumParticipants: 4,
      }),
    );
  });

  it.each([
    ['continue', 'planning'],
    ['end', 'cancelled'],
  ] as const)('maps the host %s choice to %s', async (decision, phase) => {
    const campaign = {
      ...openCampaign(),
      minimumParticipantDecisionRequired: true,
    };
    const { service } = createService(campaign);
    const transition = jest
      .spyOn(service, 'transitionCampaignPhase')
      .mockResolvedValue({ lifecyclePhase: phase } as never);

    await service.decideMinimumParticipants(
      campaignId.toString(),
      decision,
      hostId.toString(),
    );

    expect(campaign.minimumParticipantDecisionRequired).toBe(false);
    expect(campaign.minimumParticipantDecision).toBe(decision);
    expect(campaign.minimumParticipantDecisionAt).toBeInstanceOf(Date);
    expect(transition).toHaveBeenCalledWith(
      campaignId.toString(),
      phase,
      hostId.toString(),
      false,
      expect.any(String),
    );
  });

  it('rejects a decision from anyone except the host', async () => {
    const campaign = {
      ...openCampaign(),
      minimumParticipantDecisionRequired: true,
    };
    const { service } = createService(campaign);

    await expect(
      service.decideMinimumParticipants(
        campaignId.toString(),
        'continue',
        new Types.ObjectId().toString(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a choice when no decision is pending', async () => {
    const campaign = openCampaign();
    const { service } = createService(campaign);

    await expect(
      service.decideMinimumParticipants(
        campaignId.toString(),
        'continue',
        hostId.toString(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
