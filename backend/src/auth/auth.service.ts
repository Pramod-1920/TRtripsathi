import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { Role } from './constants/roles.enum';
import { Auth } from './schemas/auth.schema';
import { User } from '../user/schemas/user.schema';
import { UserService } from '../user/user.service';
import { TokenRevocationService } from '../security/token-revocation.service';
import { AuditService } from '../audit/audit.service';

export type SafeUser = {
  id: string;
  phoneNumber: string;
  email?: string | null;
  role: Role;
  profileCompleted: boolean;
  level?: number;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  age?: number | null;
  profilePhoto?: string | null;
  bio?: string | null;
  location?: string | null;
  province?: string | null;
  district?: string | null;
  landmark?: string | null;
  experienceLevel?: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Auth.name) private readonly authModel: Model<Auth>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly revocation: TokenRevocationService,
    private readonly audit: AuditService,
  ) {}

  async signup(signupData: SignupDto) {
    const phoneNumber = signupData.phoneNumber.trim();
    const requestedRole = signupData.role ?? Role.User;

    if (requestedRole === Role.Admin) {
      throw new ForbiddenException('Admin account creation is disabled');
    }

    const role = Role.User;

    const userInUse = await this.authModel.findOne({ phoneNumber });
    if (userInUse) {
      throw new BadRequestException('Phone number is already in use');
    }

    const hashedPassword = await bcrypt.hash(signupData.password, 10);
    const createdUser = await this.authModel.create({
      phoneNumber,
      password: hashedPassword,
      role,
    });

    await this.userService.createProfile(createdUser._id.toString());

    const tokens = await this.issueTokens(
      createdUser._id.toString(),
      createdUser.phoneNumber,
      createdUser.role,
    );

    await this.storeRefreshToken(
      createdUser._id.toString(),
      tokens.refreshToken,
    );

    // Audit: successful signup/login
    await this.audit.logEvent({
      type: 'auth.signup',
      userId: createdUser._id.toString(),
      phoneNumber: createdUser.phoneNumber,
      role: createdUser.role,
    });

    return {
      user: this.toSafeUser(createdUser),
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const phoneNumber = loginDto.phoneNumber.trim();
    const user = await this.authModel.findOne({ phoneNumber });

    if (!user) {
      throw new UnauthorizedException('Invalid phone number or password');
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      throw new ForbiddenException(
        'Account temporarily locked. Try again later.',
      );
    }

    const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(user.password);
    const passwordMatches = isBcryptHash
      ? await bcrypt.compare(loginDto.password, user.password)
      : loginDto.password === user.password;

    if (passwordMatches && !isBcryptHash) {
      const hashedPassword = await bcrypt.hash(loginDto.password, 10);
      await this.authModel.findByIdAndUpdate(user._id.toString(), {
        password: hashedPassword,
      });
    }

    if (!passwordMatches) {
      // progressive delay based on next failed attempt count: 1s, 2s, 4s (capped at 4s)
      const nextAttempts = (user.failedLoginAttempts ?? 0) + 1;
      const delayMs = Math.min(
        4000,
        1000 * Math.pow(2, Math.max(0, nextAttempts - 1)),
      );
      await this.handleFailedLogin(user);
      // sleep to slow down brute force
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      // audit failed attempt
      await this.audit.logEvent({
        type: 'auth.failed_login',
        userId: user._id.toString(),
        phoneNumber: user.phoneNumber,
      });
      throw new UnauthorizedException('Invalid phone number or password');
    }

    await this.resetLoginFailures(user._id.toString());

    const profile = await this.getOrCreateProfile(user._id.toString());

    const tokens = await this.issueTokens(
      user._id.toString(),
      user.phoneNumber,
      user.role,
    );

    await this.storeRefreshToken(user._id.toString(), tokens.refreshToken);

    // Audit: successful login
    await this.audit.logEvent({
      type: 'auth.login',
      userId: user._id.toString(),
      phoneNumber: user.phoneNumber,
    });

    return {
      user: this.toSafeUser(user, profile),
      ...tokens,
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.authModel.findById(userId);

    if (!user || !user.refreshTokens || user.refreshTokens.length === 0) {
      throw new UnauthorizedException('Access denied');
    }

    // Check blacklist first
    const isRevoked = await this.revocation.isRevoked(refreshToken);
    if (isRevoked) {
      await this.revokeSessions(userId);
      throw new UnauthorizedException('Access denied');
    }

    // Find which stored hash matches the provided refresh token
    let matchedIndex = -1;
    for (let i = 0; i < user.refreshTokens.length; i++) {
      const entry = user.refreshTokens[i] as any;
      const matches = await bcrypt.compare(refreshToken, entry.hash);
      if (matches) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex === -1) {
      // Token not found among stored tokens
      await this.revokeSessions(userId);
      throw new UnauthorizedException('Access denied');
    }

    const tokens = await this.issueTokens(
      user._id.toString(),
      user.phoneNumber,
      user.role,
    );

    // Revoke the previous refresh token (rotation) and store the new one
    try {
      await this.revocation.revokeToken(refreshToken);
    } catch (err) {
      // best-effort
    }

    // Remove the matched stored hash and add the new one (storeRefreshToken handles trimming)
    const matchedHash = (user.refreshTokens[matchedIndex] as any).hash;
    await this.authModel.findByIdAndUpdate(userId, {
      $pull: { refreshTokens: { hash: matchedHash } },
    });
    await this.storeRefreshToken(user._id.toString(), tokens.refreshToken);

    const profile = await this.getOrCreateProfile(user._id.toString());

    return {
      user: this.toSafeUser(user, profile),
      ...tokens,
    };
  }

  async logout(userId: string) {
    await this.revokeSessions(userId);
    await this.audit.logEvent({ type: 'auth.logout', userId });

    return {
      message: 'Logged out successfully',
    };
  }

  private async issueTokens(userId: string, phoneNumber: string, role: Role) {
    const accessSecret = this.configService
      .get<string>('JWT_ACCESS_SECRET')
      ?.trim();
    const refreshSecret = this.configService
      .get<string>('JWT_REFRESH_SECRET')
      ?.trim();

    if (!accessSecret) {
      throw new Error('JWT_ACCESS_SECRET is required in .env file');
    }

    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is required in .env file');
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.getAccessToken(userId, phoneNumber, role, accessSecret),
      this.getRefreshToken(userId, phoneNumber, role, refreshSecret),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async getAccessToken(
    userId: string,
    phoneNumber: string,
    role: Role,
    providedSecret?: string,
  ) {
    const accessSecret =
      providedSecret ??
      this.configService.get<string>('JWT_ACCESS_SECRET')?.trim();

    if (!accessSecret) {
      throw new Error('JWT_ACCESS_SECRET is required in .env file');
    }

    const accessExpiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN')?.trim() || '15m';

    return this.jwtService.signAsync(
      {
        sub: userId,
        phoneNumber,
        role,
      },
      {
        secret: accessSecret,
        expiresIn: accessExpiresIn as never,
      },
    );
  }

  private async getRefreshToken(
    userId: string,
    phoneNumber: string,
    role: Role,
    providedSecret?: string,
  ) {
    const refreshSecret =
      providedSecret ??
      this.configService.get<string>('JWT_REFRESH_SECRET')?.trim();

    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is required in .env file');
    }

    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN')?.trim() || '7d';

    return this.jwtService.signAsync(
      {
        sub: userId,
        phoneNumber,
        role,
      },
      {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn as never,
      },
    );
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const maxSessions = Number(
      this.configService.get<number>('MAX_CONCURRENT_SESSIONS') ?? 3,
    );

    // Push new token hash to the front and trim to maxSessions
    await this.authModel.findByIdAndUpdate(userId, {
      $push: {
        refreshTokens: {
          $each: [{ hash: refreshTokenHash, createdAt: new Date() }],
          $position: 0,
          $slice: maxSessions,
        },
      },
    });
  }

  private async revokeSessions(userId: string) {
    // Clear stored refresh token hashes for this user (effectively logging out all sessions)
    await this.authModel.findByIdAndUpdate(userId, {
      refreshTokens: [],
    });
  }

  private async handleFailedLogin(user: Auth) {
    const nextAttempts = (user.failedLoginAttempts ?? 0) + 1;

    const updatePayload: {
      failedLoginAttempts: number;
      lockUntil?: Date | null;
    } = {
      failedLoginAttempts: nextAttempts,
    };

    if (nextAttempts >= 5) {
      updatePayload.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
    }

    await this.authModel.findByIdAndUpdate(user._id.toString(), updatePayload);
  }

  private async resetLoginFailures(userId: string) {
    await this.authModel.findByIdAndUpdate(userId, {
      failedLoginAttempts: 0,
      lockUntil: null,
    });
  }

  private async getOrCreateProfile(authId: string) {
    try {
      return await this.userService.getProfileByAuthId(authId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return this.userService.createProfile(authId);
      }

      throw error;
    }
  }

  private toSafeUser(user: Auth, profile?: User | null): SafeUser {
    return {
      id: user._id.toString(),
      phoneNumber: user.phoneNumber,
      email: user.email ?? null,
      role: user.role,
      profileCompleted: profile?.profileCompleted ?? false,
      level: profile?.level ?? 1,
      firstName: profile?.firstName ?? null,
      middleName: profile?.middleName ?? null,
      lastName: profile?.lastName ?? null,
      age: profile?.age ?? null,
      profilePhoto: profile?.profilePhoto ?? null,
      bio: profile?.bio ?? null,
      location: profile?.location ?? null,
      province: profile?.province ?? null,
      district: profile?.district ?? null,
      landmark: profile?.landmark ?? null,
      experienceLevel: profile?.experienceLevel ?? 'beginner',
    };
  }
}
