import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role } from '../constants/roles.enum';
import { Auth } from '../schemas/auth.schema';

export interface AccessTokenPayload {
  sub: string;
  phoneNumber: string;
  role: Role;
}

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    @InjectModel(Auth.name) private readonly authModel: Model<Auth>,
  ) {
    const secret = configService.get<string>('JWT_ACCESS_SECRET')?.trim();

    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is required in .env file');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: Request) => request?.cookies?.access_token ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: AccessTokenPayload) {
    if (!payload.sub || !payload.phoneNumber || !payload.role) {
      throw new UnauthorizedException('Invalid access token payload');
    }

    const account = await this.authModel
      .findById(payload.sub)
      .select('isActive')
      .lean();

    if (!account || account.isActive === false) {
      throw new UnauthorizedException('Account is inactive');
    }

    return {
      userId: payload.sub,
      phoneNumber: payload.phoneNumber,
      role: payload.role,
    };
  }
}
