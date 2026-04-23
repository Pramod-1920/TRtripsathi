import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Auth, AuthSchema } from './schemas/auth.schema';
import { AccessTokenStrategy } from './strategies/access-token.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { RolesGuard } from './guards/roles.guard';
import { UserModule } from '../user/user.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),
    JwtModule.register({}),
    MongooseModule.forFeature([{ name: Auth.name, schema: AuthSchema }]),
    UserModule,
    // security helpers (token revocation, audit)
    // exports TokenRevocationService, AuditService
    SecurityModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessTokenStrategy,
    RefreshTokenStrategy,
    RolesGuard,
  ],
})
export class AuthModule {}
