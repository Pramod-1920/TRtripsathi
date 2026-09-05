import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHmac, randomInt } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { AuthCodeDeliveryService } from './auth-code-delivery.service';
import {
  AuthChallenge,
  AuthChallengeChannel,
  AuthChallengePurpose,
} from './schemas/auth-challenge.schema';
import { Auth } from './schemas/auth.schema';

const CODE_TTL_MS = 3 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 5;

@Injectable()
export class AccountSecurityService {
  constructor(
    @InjectModel(Auth.name) private readonly authModel: Model<Auth>,
    @InjectModel(AuthChallenge.name)
    private readonly challengeModel: Model<AuthChallenge>,
    private readonly config: ConfigService,
    private readonly delivery: AuthCodeDeliveryService,
  ) {}

  private secret() {
    const value =
      this.config.get<string>('AUTH_OTP_SECRET')?.trim() ||
      (process.env.NODE_ENV !== 'production'
        ? this.config.get<string>('JWT_ACCESS_SECRET')?.trim()
        : undefined);
    if (!value || value.length < 32) {
      throw new Error('AUTH_OTP_SECRET must be at least 32 characters');
    }
    return value;
  }

  private digest(value: string) {
    return createHmac('sha256', this.secret())
      .update(value, 'utf8')
      .digest('hex');
  }

  private normalizePhone(value: string) {
    let digits = value.replace(/\D/g, '');
    if (digits.startsWith('977') && digits.length === 13)
      digits = digits.slice(3);
    if (digits.startsWith('0') && digits.length === 11)
      digits = digits.slice(1);
    return digits;
  }

  private destination(user: Auth, channel: AuthChallengeChannel) {
    if (channel === 'email') {
      const email = user.email?.trim().toLowerCase();
      if (!email) throw new BadRequestException('Add an email address first');
      return email;
    }
    const phone = this.normalizePhone(user.phoneNumber);
    if (!/^9\d{9}$/.test(phone)) {
      throw new BadRequestException('A valid Nepal phone number is required');
    }
    return `+977${phone}`;
  }

  private mask(destination: string, channel: AuthChallengeChannel) {
    if (channel === 'email') {
      const [name, domain] = destination.split('@');
      return `${name.slice(0, 2)}***@${domain}`;
    }
    return `+977******${destination.slice(-4)}`;
  }

  private recoveryResponse(challengeId = new Types.ObjectId().toString()) {
    return {
      message:
        'If the security request is valid, a code has been sent to the registered contact.',
      challengeId,
      expiresInSeconds: CODE_TTL_MS / 1000,
      resendAfterSeconds: RESEND_COOLDOWN_MS / 1000,
    };
  }

  private async padEnumerationSafeResponse(startedAt: number) {
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, 400 - (Date.now() - startedAt))),
    );
  }

  private async enforceRequestLimits(
    authId: Types.ObjectId,
    purpose: AuthChallengePurpose,
  ) {
    const now = new Date();
    const latest = await this.challengeModel
      .findOne({ authId, purpose })
      .sort({ createdAt: -1 })
      .lean();
    if (latest?.resendAvailableAt && latest.resendAvailableAt > now) {
      const retryAfterSeconds = Math.ceil(
        (latest.resendAvailableAt.getTime() - now.getTime()) / 1000,
      );
      throw new HttpException(
        `Wait ${retryAfterSeconds} seconds before requesting another code`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const recentCount = await this.challengeModel.countDocuments({
      authId,
      purpose,
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    });
    if (recentCount >= MAX_REQUESTS_PER_HOUR) {
      throw new HttpException(
        'Too many security codes requested. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async createChallenge(
    user: Auth,
    purpose: AuthChallengePurpose,
    channel: AuthChallengeChannel,
    requestIp?: string,
  ) {
    const authId = user._id;
    await this.enforceRequestLimits(authId, purpose);
    const destination = this.destination(user, channel);
    const code = String(randomInt(100000, 1000000));
    const challengeId = new Types.ObjectId();
    const now = Date.now();

    await this.challengeModel.updateMany(
      { authId, purpose, consumedAt: null },
      { $set: { consumedAt: new Date() } },
    );
    await this.challengeModel.create({
      _id: challengeId,
      authId,
      purpose,
      channel,
      destinationHash: this.digest(destination),
      codeHash: this.digest(`${challengeId.toString()}:${code}`),
      attemptsRemaining: 5,
      expiresAt: new Date(now + CODE_TTL_MS),
      resendAvailableAt: new Date(now + RESEND_COOLDOWN_MS),
      requestIpHash: requestIp ? this.digest(requestIp) : null,
    });

    try {
      await this.delivery.send(channel, destination, code, purpose);
    } catch (error) {
      await this.challengeModel.deleteOne({ _id: challengeId });
      throw error;
    }

    return {
      challengeId: challengeId.toString(),
      channel,
      destination: this.mask(destination, channel),
      expiresInSeconds: CODE_TTL_MS / 1000,
      resendAfterSeconds: RESEND_COOLDOWN_MS / 1000,
      ...(this.delivery.isTestMode() ? { debugCode: code } : {}),
    };
  }

  async requestContactVerification(
    authId: string,
    channel: AuthChallengeChannel,
    requestIp?: string,
  ) {
    const user = await this.authModel.findById(authId);
    if (!user || user.isActive === false) {
      throw new NotFoundException('Account not found');
    }
    if (channel === 'email' && user.emailVerifiedAt) {
      return { alreadyVerified: true, channel };
    }
    if (channel === 'sms' && user.phoneVerifiedAt) {
      return { alreadyVerified: true, channel };
    }
    return this.createChallenge(
      user,
      channel === 'email' ? 'verify_email' : 'verify_phone',
      channel,
      requestIp,
    );
  }

  private async consumeChallenge(
    challengeId: string,
    code: string,
    purposes?: AuthChallengePurpose[],
    expectedAuthId?: string,
    expectedDestinationHash?: string,
  ) {
    if (!Types.ObjectId.isValid(challengeId)) {
      throw new BadRequestException('Invalid or expired security code');
    }
    const challenge = await this.challengeModel.findById(challengeId);
    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.expiresAt <= new Date() ||
      (purposes && !purposes.includes(challenge.purpose)) ||
      (expectedAuthId && challenge.authId.toString() !== expectedAuthId) ||
      (expectedDestinationHash &&
        challenge.destinationHash !== expectedDestinationHash) ||
      challenge.attemptsRemaining < 1
    ) {
      throw new BadRequestException('Invalid or expired security code');
    }
    const matches =
      this.digest(`${challenge._id.toString()}:${code}`) === challenge.codeHash;
    if (!matches) {
      challenge.attemptsRemaining -= 1;
      if (challenge.attemptsRemaining < 1) challenge.consumedAt = new Date();
      await challenge.save();
      throw new BadRequestException('Invalid or expired security code');
    }
    challenge.consumedAt = new Date();
    await challenge.save();
    return challenge;
  }

  async confirmContactVerification(
    authId: string,
    challengeId: string,
    code: string,
  ) {
    const user = await this.authModel.findById(authId);
    if (!user || user.isActive === false) {
      throw new BadRequestException('Invalid or expired security code');
    }
    const challengePreview = Types.ObjectId.isValid(challengeId)
      ? await this.challengeModel.findById(challengeId).lean()
      : null;
    if (!challengePreview) {
      throw new BadRequestException('Invalid or expired security code');
    }
    const currentDestinationHash = this.digest(
      this.destination(user, challengePreview.channel),
    );
    const challenge = await this.consumeChallenge(
      challengeId,
      code,
      ['verify_email', 'verify_phone'],
      authId,
      currentDestinationHash,
    );
    const update =
      challenge.channel === 'email'
        ? { emailVerifiedAt: new Date(), verificationRequired: false }
        : { phoneVerifiedAt: new Date(), verificationRequired: false };
    await this.authModel.findByIdAndUpdate(authId, { $set: update });
    return { verified: true, channel: challenge.channel };
  }

  async forgotPassword(identifier: string, requestIp?: string) {
    const startedAt = Date.now();
    const normalized = identifier.trim().toLowerCase();
    const user = await this.authModel.findOne(
      normalized.includes('@')
        ? { email: normalized, isActive: { $ne: false } }
        : {
            phoneNumber: this.normalizePhone(normalized),
            isActive: { $ne: false },
          },
    );
    const generic = this.recoveryResponse();
    if (!user) {
      await this.padEnumerationSafeResponse(startedAt);
      return generic;
    }
    // When an account has an email address, recovery requested with either
    // email or phone is delivered through the configured email OTP channel.
    // SMS remains a fallback for phone-only accounts.
    const channel: AuthChallengeChannel =
      normalized.includes('@') || Boolean(user.email) ? 'email' : 'sms';
    try {
      const challenge = await this.createChallenge(
        user,
        'reset_password',
        channel,
        requestIp,
      );
      return { ...generic, challengeId: challenge.challengeId };
    } catch {
      return generic;
    }
  }

  async resendPasswordReset(challengeId: string, requestIp?: string) {
    const startedAt = Date.now();
    const generic = this.recoveryResponse();
    if (!Types.ObjectId.isValid(challengeId)) {
      await this.padEnumerationSafeResponse(startedAt);
      return generic;
    }
    const challenge = await this.challengeModel.findById(challengeId).lean();
    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.purpose !== 'reset_password'
    ) {
      await this.padEnumerationSafeResponse(startedAt);
      return generic;
    }
    const user = await this.authModel.findById(challenge.authId);
    let destinationStillCurrent = false;
    try {
      destinationStillCurrent = Boolean(
        user &&
        user.isActive !== false &&
        this.digest(this.destination(user, challenge.channel)) ===
          challenge.destinationHash,
      );
    } catch {
      destinationStillCurrent = false;
    }
    if (!user || !destinationStillCurrent) {
      await this.padEnumerationSafeResponse(startedAt);
      return generic;
    }

    const replacement = await this.createChallenge(
      user,
      'reset_password',
      challenge.channel,
      requestIp,
    );
    return this.recoveryResponse(replacement.challengeId);
  }

  async resetPassword(challengeId: string, code: string, passwordHash: string) {
    const challenge = await this.consumeChallenge(challengeId, code, [
      'reset_password',
    ]);
    const user = await this.authModel.findById(challenge.authId);
    let stillCurrent = false;
    try {
      stillCurrent = Boolean(
        user &&
        user.isActive !== false &&
        this.digest(this.destination(user, challenge.channel)) ===
          challenge.destinationHash,
      );
    } catch {
      stillCurrent = false;
    }
    if (!user || !stillCurrent) {
      throw new BadRequestException('Invalid or expired security code');
    }
    const verificationField =
      challenge.channel === 'email'
        ? { emailVerifiedAt: new Date(), verificationRequired: false }
        : { phoneVerifiedAt: new Date(), verificationRequired: false };
    await this.authModel.findByIdAndUpdate(challenge.authId, {
      $set: {
        password: passwordHash,
        refreshTokenHash: null,
        refreshTokens: [],
        failedLoginAttempts: 0,
        lockUntil: null,
        ...verificationField,
      },
    });
    await this.challengeModel.updateMany(
      { authId: challenge.authId, consumedAt: null },
      { $set: { consumedAt: new Date() } },
    );
    return { message: 'Password reset successfully. Sign in again.' };
  }
}
