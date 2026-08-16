import { Types } from 'mongoose';
import { UserService } from './user.service';

describe('UserService rank badges', () => {
  it('backfills every configured badge through the current rank', async () => {
    const profileId = new Types.ObjectId();
    const badgeService = {
      awardBadge: jest.fn().mockResolvedValue({}),
    };
    const service = new UserService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      badgeService as never,
    );
    const definitions = ['F', 'E', 'D', 'C'].map((rankCode) => ({
      rankCode,
      imageUrl: `https://example.com/rank-${rankCode.toLowerCase()}.png`,
      name: rankCode,
    }));

    await (service as any).ensureRankBadgesAwarded(
      String(profileId),
      'D',
      definitions,
    );

    expect(badgeService.awardBadge).toHaveBeenCalledTimes(3);
    expect(badgeService.awardBadge).toHaveBeenCalledWith(
      String(profileId),
      'D',
      'rank',
      'D',
      'Unlocked by reaching Rank D',
      'https://example.com/rank-d.png',
    );
  });

  it('awards the built-in Rank F badge when no artwork is configured', async () => {
    const profileId = new Types.ObjectId();
    const badgeService = {
      awardBadge: jest.fn().mockResolvedValue({}),
    };
    const extraModel = {
      find: jest.fn(() => ({
        sort: jest.fn().mockResolvedValue([]),
      })),
    };
    const service = new UserService(
      {} as never,
      {} as never,
      extraModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      badgeService as never,
    );

    await (service as any).ensureRankBadgesAwarded(String(profileId), 'F');

    expect(badgeService.awardBadge).toHaveBeenCalledWith(
      String(profileId),
      'F',
      'rank',
      'Rank F',
      'Unlocked by reaching Rank F',
      '',
    );
  });
});
