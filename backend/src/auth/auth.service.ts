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

export type SafeUser = {
  id: string;
  phoneNumber: string;
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
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  async signup(signupData: SignupDto) {
    const phoneNumber = signupData.phoneNumber.trim();

    const userInUse = await this.authModel.findOne({ phoneNumber });
    if (userInUse) {
      throw new BadRequestException('Phone number is already in use');
    }

    const hashedPassword = await bcrypt.hash(signupData.password, 10);
    const createdUser = await this.authModel.create({
      phoneNumber,
      password: hashedPassword,
      role: Role.User,
    });

    await this.userService.createProfile(createdUser._id.toString());

    const tokens = await this.issueTokens(
      createdUser._id.toString(),
      createdUser.phoneNumber,
      createdUser.role,
    );

    await this.storeRefreshToken(createdUser._id.toString(), tokens.refreshToken);

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
      throw new ForbiddenException('Account temporarily locked. Try again later.');
    }

    const passwordMatches = await bcrypt.compare(loginDto.password, user.password);
    if (!passwordMatches) {
      await this.handleFailedLogin(user);
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

    return {
      user: this.toSafeUser(user, profile),
      ...tokens,
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.authModel.findById(userId);

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Access denied');
    }

    const refreshMatches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
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
    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET')?.trim();
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET')?.trim();

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
      providedSecret ?? this.configService.get<string>('JWT_ACCESS_SECRET')?.trim();

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
      providedSecret ?? this.configService.get<string>('JWT_REFRESH_SECRET')?.trim();

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

    await this.authModel.findByIdAndUpdate(userId, {
      refreshTokenHash,
    });
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
