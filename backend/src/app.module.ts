import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CampaignModule } from './campaign/campaign.module';
import { DatabaseModule } from './config/database/database.module';
import { CloudinaryModule } from './config/cloudinary/cloudinary.module';
import { UserModule } from './user/user.module';
import { RedisModule } from './redis/redis.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env', 'backend/.env'],
      isGlobal: true,
    }),
    DatabaseModule,
    CloudinaryModule,
    UserModule,
    AuthModule,
    RedisModule,
    CampaignModule,
    SecurityModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
