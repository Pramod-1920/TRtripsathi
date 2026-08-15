import { Types } from 'mongoose';
import { UserService } from './user.service';

describe('UserService XP concurrency', () => {
  it('applies one profile increment for concurrent awards with one context key', async () => {
    const profileId = new Types.ObjectId();
    const ledgerId = new Types.ObjectId();
    const state = {
      _id: profileId,
      xp: 0,
      totalXp: 0,
      xpHistory: [] as Array<Record<string, unknown>>,
    };
    const userModel = {
      findOneAndUpdate: jest.fn(async (_filter, update) => {
        const entry = update.$push.xpHistory as Record<string, unknown>;
        if (
          state.xpHistory.some((item) => item.contextKey === entry.contextKey)
        ) {
          return null;
        }
        state.totalXp += Number(update.$inc?.totalXp ?? 0);
        state.xpHistory.push(entry);
        return { ...state, xpHistory: [...state.xpHistory] };
      }),
      findById: jest.fn(async () => ({
        ...state,
        xpHistory: [...state.xpHistory],
      })),
    };
    const xpLedger = {
      reserveXpAward: jest.fn(async () => ({
        ledger: { _id: ledgerId, xpAmount: 40 },
        created: true,
      })),
      markXpAwardApplied: jest.fn().mockResolvedValue(undefined),
    };
    const service = new UserService(
      userModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      xpLedger as never,
      undefined,
    );
    const entry = {
      eventKey: 'standalone_place_verified',
      ruleCode: 'SYS-STANDALONE-PLACE-V1',
      ruleName: 'Verified standalone place visit',
      points: 40,
      contextKey: 'standalone_place_verified:kathmandu:kathmandu:pashupati',
      context: {},
      awardedAt: new Date(),
    };

    const results = await Promise.all([
      (service as any).applyLedgerBackedXpAward(String(profileId), entry),
      (service as any).applyLedgerBackedXpAward(String(profileId), entry),
    ]);

    expect(results.filter((result) => result.applied)).toHaveLength(1);
    expect(state.totalXp).toBe(40);
    expect(state.xpHistory).toHaveLength(1);
    expect(xpLedger.markXpAwardApplied).toHaveBeenCalledTimes(2);
  });

  it('claims a pending photo review only once during concurrent approvals', async () => {
    const profileId = new Types.ObjectId();
    const authId = new Types.ObjectId();
    const adminId = new Types.ObjectId();
    const state = {
      _id: profileId,
      authId,
      photoVerificationRequests: [
        {
          requestCode: 'PHOTO-1',
          status: 'pending',
          kind: 'solo',
        },
      ],
    };
    const snapshot = () => ({
      ...state,
      photoVerificationRequests: state.photoVerificationRequests.map(
        (request) => ({ ...request }),
      ),
    });
    const userModel = {
      findById: jest.fn(async () => snapshot()),
      findOneAndUpdate: jest.fn(async (_filter, update) => {
        const request = state.photoVerificationRequests[0];
        if (request.status !== 'pending') {
          return null;
        }
        request.status = update.$set[
          'photoVerificationRequests.$[request].status'
        ] as 'pending';
        return snapshot();
      }),
    };
    const service = new UserService(
      userModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { recordVisit: jest.fn() } as never,
      {} as never,
      undefined,
    );
    jest
      .spyOn(service as any, 'awardStandalonePlaceVerificationXp')
      .mockResolvedValue({ totalAwarded: 0, idempotent: true });

    const results = await Promise.all([
      service.reviewPhotoVerificationRequest(
        String(profileId),
        'PHOTO-1',
        { status: 'approved' },
        String(adminId),
      ),
      service.reviewPhotoVerificationRequest(
        String(profileId),
        'PHOTO-1',
        { status: 'approved' },
        String(adminId),
      ),
    ]);

    expect(results.filter((result) => !result.idempotent)).toHaveLength(1);
    expect(results.filter((result) => result.idempotent)).toHaveLength(1);
    expect(state.photoVerificationRequests[0].status).toBe('approved');
  });
});
