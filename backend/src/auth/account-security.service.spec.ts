import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { AccountSecurityService } from './account-security.service';
import { AuthCodeDeliveryService } from './auth-code-delivery.service';
import { Auth } from './schemas/auth.schema';

describe('AccountSecurityService OTP routing', () => {
  const registeredEmail = 'registered@example.com';
  const authId = new Types.ObjectId();
  const account = {
    _id: authId,
    email: `  ${registeredEmail.toUpperCase()}  `,
    phoneNumber: '9841234567',
    isActive: true,
    emailVerifiedAt: null,
    phoneVerifiedAt: null,
  } as unknown as Auth;

  const createdChallenges: Array<Record<string, unknown>> = [];
  const authModel = {
    findById: jest.fn().mockResolvedValue(account),
    findOne: jest.fn().mockResolvedValue(account),
  };
  const challengeModel = {
    findOne: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    }),
    countDocuments: jest.fn().mockResolvedValue(0),
    updateMany: jest.fn().mockResolvedValue({ acknowledged: true }),
    create: jest.fn().mockImplementation((value) => {
      createdChallenges.push(value as Record<string, unknown>);
      return Promise.resolve(value);
    }),
    deleteOne: jest.fn().mockResolvedValue({ acknowledged: true }),
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

  let service: AccountSecurityService;

  beforeEach(() => {
    jest.clearAllMocks();
    createdChallenges.length = 0;
    service = new AccountSecurityService(
      authModel as never,
      challengeModel as never,
      config as unknown as ConfigService,
      delivery as unknown as AuthCodeDeliveryService,
    );
  });

  it('sends account verification to the authenticated account registered email', async () => {
    const result = await service.requestContactVerification(
      authId.toString(),
      'email',
    );

    expect(authModel.findById).toHaveBeenCalledWith(authId.toString());
    expect(delivery.send).toHaveBeenCalledTimes(1);
    const [channel, destination, code, purpose] = delivery.send.mock.calls[0];
    expect(channel).toBe('email');
    expect(destination).toBe(registeredEmail);
    expect(code).toMatch(/^\d{6}$/);
    expect(purpose).toBe('verify_email');
    expect(result).toMatchObject({
      channel: 'email',
      destination: 're***@example.com',
      expiresInSeconds: 180,
    });
    const expiresAt = createdChallenges[0].expiresAt as Date;
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(179_000);
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(180_000);
  });

  it('sends phone-initiated recovery to that account registered email', async () => {
    const result = await service.forgotPassword('9841234567');

    expect(authModel.findOne).toHaveBeenCalledWith({
      phoneNumber: '9841234567',
      isActive: { $ne: false },
    });
    const [channel, destination, code, purpose] = delivery.send.mock.calls[0];
    expect(channel).toBe('email');
    expect(destination).toBe(registeredEmail);
    expect(code).toMatch(/^\d{6}$/);
    expect(purpose).toBe('reset_password');
    expect(result.expiresInSeconds).toBe(180);
  });
});
