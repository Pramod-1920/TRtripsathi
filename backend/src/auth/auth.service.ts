import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { createHmac } from 'node:crypto';
import { ClientSession, Connection, Model } from 'mongoose';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { Role } from './constants/roles.enum';
import { Auth } from './schemas/auth.schema';
import { User } from '../user/schemas/user.schema';
import { UserService } from '../user/user.service';

export type SafeUser = {
  id: string;
  phoneNumber: string;
  email?: string | null;
  role: Role;
  profileCompleted: boolean;
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
    @InjectConnection() private readonly connection: Connection,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  async signup(signupData: SignupDto) {
    const phoneNumber = signupData.phoneNumber.trim();
    const email = signupData.email?.trim().toLowerCase() || null;
    const session = await this.connection.startSession();
    let result:
      | { user: SafeUser; accessToken: string; refreshToken: string }
      | undefined;

    try {
      await session.withTransaction(async () => {
        const userInUse = await this.authModel
          .findOne({
            $or: [{ phoneNumber }, ...(email ? [{ email }] : [])],
          })
          .session(session);
        if (userInUse) {
          throw new BadRequestException(
            userInUse.phoneNumber === phoneNumber
              ? 'Phone number is already in use'
              : 'Email address is already in use',
          );
        }

        const hashedPassword = await this.hashPassword(signupData.password);
        const [createdUser] = await this.authModel.create(
          [
            {
              phoneNumber,
              email,
              password: hashedPassword,
              role: Role.User,
            },
          ],
          { session },
        );

        const profile = await this.userService.createProfile(
          createdUser._id.toString(),
          {
            firstName: signupData.firstName ?? null,
            middleName: signupData.middleName ?? null,
            lastName: signupData.lastName ?? null,
            location: signupData.address ?? null,
            gender: signupData.gender ?? null,
            dateOfBirth: signupData.dateOfBirth ?? null,
          },
          session,
        );

        const tokens = await this.issueTokens(
          createdUser._id.toString(),
          createdUser.phoneNumber,
          createdUser.role,
        );
        await this.storeRefreshToken(
          createdUser._id.toString(),
          tokens.refreshToken,
          session,
        );

        result = {
          user: this.toSafeUser(createdUser, profile),
          ...tokens,
        };
      });
    } catch (error) {
      const databaseError = error as {
        code?: number;
        keyPattern?: Record<string, unknown>;
      };
      if (databaseError?.code === 11000) {
        const duplicateEmail = Boolean(databaseError.keyPattern?.email);
        throw new BadRequestException(
          duplicateEmail
            ? 'Email address is already in use'
            : 'Phone number is already in use',
        );
      }
      throw error;
    } finally {
      await session.endSession();
    }

    if (!result) {
      throw new Error('Account creation transaction did not complete');
    }
    return result;
  }

  async login(loginDto: LoginDto) {
    const identifier = (loginDto.email ?? loginDto.phoneNumber ?? '')
      .trim()
      .toLowerCase();
    const user = await this.authModel.findOne(
      identifier.includes('@')
        ? { email: identifier }
        : { phoneNumber: identifier },
    );

    if (!user) {
      throw new UnauthorizedException(
        'Invalid email, phone number, or password',
      );
    }

    if (user.isActive === false) {
      throw new ForbiddenException('This account has been deactivated');
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      throw new ForbiddenException(
        'Account temporarily locked. Try again later.',
      );
    }

    const passwordMatches = await this.verifyPassword(loginDto.password, user);
    if (!passwordMatches) {
      await this.handleFailedLogin(user);
      throw new UnauthorizedException(
        'Invalid email, phone number, or password',
      );
    }

    await this.resetLoginFailures(user._id.toString());

    const profile = await this.getOrCreateProfile(user._id.toString());

    const tokens = await this.issueTokens(
      user._id.toString(),
      user.phoneNumber,
      user.role,
    );

    await this.storeRefreshToken(user._id.toString(), tokens.refreshToken);

    return {
      user: this.toSafeUser(user, profile),
      ...tokens,
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.authModel.findById(userId);

    if (!user || user.isActive === false || !user.refreshTokenHash) {
      throw new UnauthorizedException('Access denied');
    }

    const refreshMatches = await bcrypt.compare(
      refreshToken,
      user.refreshTokenHash,
    );
    if (!refreshMatches) {
      await this.revokeSessions(userId);
      throw new UnauthorizedException('Access denied');
    }

    const tokens = await this.issueTokens(
      user._id.toString(),
      user.phoneNumber,
      user.role,
    );

    await this.storeRefreshToken(user._id.toString(), tokens.refreshToken);

    const profile = await this.getOrCreateProfile(user._id.toString());

    return {
      user: this.toSafeUser(user, profile),
      ...tokens,
    };
  }

  async logout(userId: string) {
    await this.revokeSessions(userId);

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

  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
    session?: ClientSession,
  ) {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

    await this.authModel.findByIdAndUpdate(
      userId,
      { refreshTokenHash },
      session ? { session } : undefined,
    );
  }

  private getPasswordRounds() {
    const configured = Number(
      this.configService.get<string>('PASSWORD_BCRYPT_ROUNDS') ?? 12,
    );
    return Number.isInteger(configured) && configured >= 10 && configured <= 15
      ? configured
      : 12;
  }

  private getPasswordPepper() {
    const pepper = this.configService.get<string>('PASSWORD_PEPPER')?.trim();
    if (!pepper && process.env.NODE_ENV === 'production') {
      throw new Error('PASSWORD_PEPPER is required in production');
    }
    if (pepper && pepper.length < 32) {
      throw new Error('PASSWORD_PEPPER must be at least 32 characters');
    }
    return pepper ?? '';
  }

  private passwordMaterial(password: string) {
    const pepper = this.getPasswordPepper();
    return pepper
      ? createHmac('sha384', pepper).update(password, 'utf8').digest('base64')
      : password;
  }

  private hashPassword(password: string) {
    return bcrypt.hash(
      this.passwordMaterial(password),
      this.getPasswordRounds(),
    );
  }

  private async verifyPassword(password: string, user: Auth) {
    const material = this.passwordMaterial(password);
    let matches = await bcrypt.compare(material, user.password);
    let usedLegacyHash = false;

    // Existing accounts were created without a pepper. Re-hash them after the
    // first successful login so the migration does not lock users out.
    if (!matches && material !== password) {
      matches = await bcrypt.compare(password, user.password);
      usedLegacyHash = matches;
    }
    if (!matches) return false;

    const storedRounds = bcrypt.getRounds(user.password);
    if (usedLegacyHash || storedRounds < this.getPasswordRounds()) {
      await this.authModel.findByIdAndUpdate(user._id, {
        password: await this.hashPassword(password),
      });
    }
    return true;
  }

  private async revokeSessions(userId: string) {
    await this.authModel.findByIdAndUpdate(userId, {
      refreshTokenHash: null,
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
      experienceLevel: profile?.experienceLevel ?? null,
    };
  }
}
