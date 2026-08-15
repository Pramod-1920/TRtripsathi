import { Types } from 'mongoose';
import { UserService } from './user.service';

describe('UserService photo-verification appeals', () => {
  const authId = new Types.ObjectId();
  const profileId = new Types.ObjectId();

  function setup(status: 'pending' | 'approved' | 'rejected', appealCount = 0) {
    const request: Record<string, any> = {
      requestCode: 'PVR-APPEAL-1',
      status,
      kind: 'solo' as const,
      url: 'https://res.cloudinary.com/test/image/upload/evidence.jpg',
      evidenceHash: 'same-original-evidence-hash',
      appealCount,
      reviewNote: 'The landmark was unclear in the submitted photograph.',
      reviewedAt: new Date(),
      reviewedByAuthId: new Types.ObjectId(),
    };
    const profile = {
      _id: profileId,
      authId,
      photoVerificationRequests: [request],
    };
    const snapshot = () => ({
      ...profile,
      photoVerificationRequests: profile.photoVerificationRequests.map(
        (entry) => ({ ...entry }),
      ),
    });
    const userModel = {
      findOneAndUpdate: jest.fn(async (_filter, update) => {
        if (request.status !== 'rejected' || request.appealCount >= 1) {
          return null;
        }
        request.status = 'pending';
        request.appealNote =
          update.$set['photoVerificationRequests.$[request].appealNote'];
        request.appealedAt =
          update.$set['photoVerificationRequests.$[request].appealedAt'];
        request.appealCount += 1;
        delete request.reviewedAt;
        delete request.reviewedByAuthId;
        return snapshot();
      }),
      findOne: jest.fn(async () => snapshot()),
    };
    const service = new UserService(
      userModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      undefined,
    );
    return { request, service, userModel };
  }

  it('returns one rejected request to pending review', async () => {
    const { request, service } = setup('rejected');

    const result = await service.appealPhotoVerificationRequest(
      authId.toString(),
      request.requestCode,
      'The entrance sign is visible when the image is viewed at full size.',
    );

    expect(result.request).toMatchObject({
      status: 'pending',
      appealCount: 1,
      evidenceHash: 'same-original-evidence-hash',
      url: request.url,
    });
    expect(result.request.reviewedAt).toBeUndefined();
    expect(result.request.reviewedByAuthId).toBeUndefined();
  });

  it.each(['pending', 'approved'] as const)(
    'blocks an appeal while the request is %s',
    async (status) => {
      const { request, service } = setup(status);

      await expect(
        service.appealPhotoVerificationRequest(
          authId.toString(),
          request.requestCode,
          'Please reconsider this evidence after checking the full image.',
        ),
      ).rejects.toThrow('Only a rejected request can be appealed');
    },
  );

  it('blocks a second appeal after the one-appeal limit', async () => {
    const { request, service } = setup('rejected', 1);

    await expect(
      service.appealPhotoVerificationRequest(
        authId.toString(),
        request.requestCode,
        'Please reconsider this evidence after checking the full image.',
      ),
    ).rejects.toThrow('already been appealed');
  });

  it('allows exactly one winner during simultaneous appeal requests', async () => {
    const { request, service, userModel } = setup('rejected');
    const results = await Promise.allSettled([
      service.appealPhotoVerificationRequest(
        authId.toString(),
        request.requestCode,
        'The first concurrent appeal provides enough useful detail.',
      ),
      service.appealPhotoVerificationRequest(
        authId.toString(),
        request.requestCode,
        'The second concurrent appeal provides enough useful detail.',
      ),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(request.appealCount).toBe(1);
    expect(request.evidenceHash).toBe('same-original-evidence-hash');
    expect(userModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });
});
