import fs from 'fs';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  const model = {
    create: jest.fn(),
  };
  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditService(model as any);
  });

  it('builds action, actor, entity, and date filters', () => {
    const filter = (service as any).buildFilter({
      action: 'campaign.',
      actorId: 'admin-1',
      entityType: 'campaign',
      entityId: 'CMP-1',
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-16T23:59:59.000Z',
    });

    expect(filter).toMatchObject({
      type: { $regex: '^campaign\\.', $options: 'i' },
      actorId: 'admin-1',
      entityType: 'campaign',
      entityId: 'CMP-1',
      timestamp: {
        $gte: new Date('2026-08-01T00:00:00.000Z'),
        $lte: new Date('2026-08-16T23:59:59.000Z'),
      },
    });
  });

  it.each([
    ['moderation.report_status_changed', 'reportId', 'report'],
    ['places.hierarchy_changed', 'placeId', 'place'],
    ['campaign.approve', 'campaignCode', 'campaign'],
    ['admin.review_photo_verification', 'requestCode', 'photo_verification'],
    ['admin.add_xp', 'profileId', 'profile'],
  ])(
    'persists and normalizes %s events',
    async (type, entityField, entityType) => {
      jest.spyOn(fs.promises, 'appendFile').mockResolvedValue(undefined);
      model.create.mockResolvedValue({});

      await service.logEvent({
        type,
        actorId: 'admin-1',
        [entityField]: 'entity-1',
      });

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type,
          actorId: 'admin-1',
          entityType,
          entityId: 'entity-1',
        }),
      );
    },
  );
});
