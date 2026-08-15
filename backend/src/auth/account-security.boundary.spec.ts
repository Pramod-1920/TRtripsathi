import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { AccountSecurityService } from './account-security.service';
import { AuthCodeDeliveryService } from './auth-code-delivery.service';

type ChallengeRecord = Record<string, any> & {
  _id: Types.ObjectId;
  authId: Types.ObjectId;
  save: jest.Mock;
};

describe('AccountSecurityService security boundaries', () => {
  function harness() {
    const account = {
      _id: new Types.ObjectId(),
      email: 'registered@example.com',
      phoneNumber: '9841234567',
      password: 'old-password-hash',
      isActive: true,
      verificationRequired: true,
      emailVerifiedAt: null,
      phoneVerifiedAt: null,
      refreshTokenHash: 'active-refresh-hash',
      refreshTokens: [{ hash: 'another-session', createdAt: new Date() }],
    };
    const challenges: ChallengeRecord[] = [];
    const authModel = {
      findOne: jest.fn(async (filter: Record<string, unknown>) => {
        if (
          filter.email === account.email ||
          filter.phoneNumber === account.phoneNumber
        ) {
          return account;
        }
        return null;
      }),
      findById: jest.fn(async (id: unknown) =>
        String(id) === String(account._id) ? account : null,
      ),
      findByIdAndUpdate: jest.fn(
        async (_id: unknown, update: { $set?: Record<string, unknown> }) => {
          Object.assign(account, update.$set ?? {});
          return account;
        },
      ),
    };
    const challengeModel = {
      findOne: jest.fn((filter: Record<string, unknown>) => ({
        sort: jest.fn(() => ({
          lean: jest.fn(async () =>
            [...challenges]
              .reverse()
              .find(
                (challenge) =>
                  String(challenge.authId) === String(filter.authId) &&
                  challenge.purpose === filter.purpose,
              ),
          ),
        })),
      })),
      countDocuments: jest.fn(
        async (filter: Record<string, any>) =>
          challenges.filter(
            (challenge) =>
              String(challenge.authId) === String(filter.authId) &&
              challenge.purpose === filter.purpose &&
              challenge.createdAt >= filter.createdAt.$gte,
          ).length,
      ),
      updateMany: jest.fn(
        async (filter: Record<string, any>, update: Record<string, any>) => {
          challenges.forEach((challenge) => {
            if (
              String(challenge.authId) === String(filter.authId) &&
              (!filter.purpose || challenge.purpose === filter.purpose) &&
              (filter.consumedAt !== null || !challenge.consumedAt)
            ) {
              Object.assign(challenge, update.$set ?? {});
            }
          });
          return { acknowledged: true };
        },
      ),
      create: jest.fn(async (value: Record<string, any>) => {
        const challenge = {
          ...value,
          createdAt: new Date(),
          consumedAt: value.consumedAt ?? null,
          save: jest.fn().mockResolvedValue(undefined),
        } as ChallengeRecord;
        challenges.push(challenge);
        return challenge;
      }),
      findById: jest.fn((id: unknown) => {
        const challenge =
          challenges.find((item) => String(item._id) === String(id)) ?? null;
        return {
          lean: jest.fn(async () => challenge),
          then: (resolve: (value: ChallengeRecord | null) => unknown) =>
            Promise.resolve(challenge).then(resolve),
        };
      }),
      deleteOne: jest.fn(async (filter: Record<string, unknown>) => {
        const index = challenges.findIndex(
          (item) => String(item._id) === String(filter._id),
        );
        if (index >= 0) challenges.splice(index, 1);
        return { acknowledged: true };
      }),
    };
    const delivery = {
      send: jest.fn().mockResolvedValue(undefined),
      isTestMode: jest.fn().mockReturnValue(false),
    };
    const config = {
      get: jest.fn((key: string) =>
        key === 'AUTH_OTP_SECRET'
          ? 'test-only-otp-secret-that-is-at-least-32-characters'
          : undefined,
      ),
    };
    const service = new AccountSecurityService(
      authModel as never,
      challengeModel as never,
      config as unknown as ConfigService,
      delivery as unknown as AuthCodeDeliveryService,
    );
    const latestCode = () => String(delivery.send.mock.calls.at(-1)?.[2] ?? '');

    return {
      account,
      authModel,
      challenges,
      challengeModel,
      delivery,
      service,
      latestCode,
    };
  }

  it('accepts an unexpired code and rejects an expired code', async () => {
    const active = harness();
    const activeRequest = await active.service.forgotPassword(
      active.account.email,
    );
    active.challenges[0].expiresAt = new Date(Date.now() + 179_000);
    await expect(
      active.service.resetPassword(
        activeRequest.challengeId,
        active.latestCode(),
        'new-password-hash',
      ),
    ).resolves.toMatchObject({
      message: expect.stringContaining('successfully'),
    });

    const expired = harness();
    const expiredRequest = await expired.service.forgotPassword(
      expired.account.email,
    );
    expired.challenges[0].expiresAt = new Date(Date.now() - 1);
    await expect(
      expired.service.resetPassword(
        expiredRequest.challengeId,
        expired.latestCode(),
        'new-password-hash',
      ),
    ).rejects.toThrow('Invalid or expired security code');
  });

  it('locks the challenge on exactly the fifth invalid attempt', async () => {
    const test = harness();
    const request = await test.service.forgotPassword(test.account.email);
    const challenge = test.challenges[0];

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(
        test.service.resetPassword(
          request.challengeId,
          '000000',
          'new-password-hash',
        ),
      ).rejects.toThrow('Invalid or expired security code');
    }
    expect(challenge.attemptsRemaining).toBe(1);
    expect(challenge.consumedAt).toBeNull();

    await expect(
      test.service.resetPassword(
        request.challengeId,
        '000000',
        'new-password-hash',
      ),
    ).rejects.toThrow('Invalid or expired security code');
    expect(challenge.attemptsRemaining).toBe(0);
    expect(challenge.consumedAt).toBeInstanceOf(Date);
    await expect(
      test.service.resetPassword(
        request.challengeId,
        test.latestCode(),
        'new-password-hash',
      ),
    ).rejects.toThrow('Invalid or expired security code');
  });

  it('enforces the 60-second resend cooldown and returns a new challenge', async () => {
    const test = harness();
    const request = await test.service.forgotPassword(test.account.email);

    await expect(
      test.service.resendPasswordReset(request.challengeId),
    ).rejects.toMatchObject({ status: 429 });

    test.challenges[0].resendAvailableAt = new Date(Date.now() - 1);
    const resent = await test.service.resendPasswordReset(request.challengeId);
    expect(resent.challengeId).not.toBe(request.challengeId);
    expect(resent.resendAfterSeconds).toBe(60);
    expect(test.delivery.send).toHaveBeenCalledTimes(2);
  });

  it('uses the same public response shape for existing and missing accounts', async () => {
    const test = harness();
    const existing = await test.service.forgotPassword(test.account.email);
    const missing = await test.service.forgotPassword('missing@example.com');

    expect(Object.keys(existing).sort()).toEqual(Object.keys(missing).sort());
    expect(existing.message).toBe(missing.message);
    expect(existing.expiresInSeconds).toBe(missing.expiresInSeconds);
    expect(existing.resendAfterSeconds).toBe(missing.resendAfterSeconds);
    expect(Types.ObjectId.isValid(existing.challengeId)).toBe(true);
    expect(Types.ObjectId.isValid(missing.challengeId)).toBe(true);
  });

  it('revokes every refresh session after a successful reset', async () => {
    const test = harness();
    const request = await test.service.forgotPassword(test.account.email);

    await test.service.resetPassword(
      request.challengeId,
      test.latestCode(),
      'new-password-hash',
    );

    expect(test.account).toMatchObject({
      password: 'new-password-hash',
      refreshTokenHash: null,
      refreshTokens: [],
      failedLoginAttempts: 0,
      lockUntil: null,
    });
  });

  it('rejects a valid code if the registered destination changed', async () => {
    const test = harness();
    const request = await test.service.forgotPassword(test.account.email);
    test.account.email = 'changed@example.com';

    await expect(
      test.service.resetPassword(
        request.challengeId,
        test.latestCode(),
        'new-password-hash',
      ),
    ).rejects.toThrow('Invalid or expired security code');
    expect(test.account.password).toBe('old-password-hash');
    expect(test.authModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('limits each account and purpose to five codes per hour', async () => {
    const test = harness();

    for (let request = 0; request < 5; request += 1) {
      await test.service.requestContactVerification(
        test.account._id.toString(),
        'email',
      );
      test.challenges.at(-1)!.resendAvailableAt = new Date(Date.now() - 1);
    }

    await expect(
      test.service.requestContactVerification(
        test.account._id.toString(),
        'email',
      ),
    ).rejects.toMatchObject({ status: 429 });
    expect(test.delivery.send).toHaveBeenCalledTimes(5);
  });
});
