import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Role } from '../constants/roles.enum';

export interface RefreshTokenPayload {
  sub: string;
  phoneNumber: string;
  role: Role;
}

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_REFRESH_SECRET')?.trim();

    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is required in .env file');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => request?.cookies?.refresh_token ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  validate(request: Request, payload: RefreshTokenPayload) {
    const refreshToken = request.cookies?.refresh_token as string | undefined;

    if (
      !refreshToken ||
      !payload.sub ||
      !payload.phoneNumber ||
      !payload.role
    ) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    return {
      userId: payload.sub,
      phoneNumber: payload.phoneNumber,
      role: payload.role,
      refreshToken,
    };
  }
}
