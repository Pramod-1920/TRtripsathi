import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CampaignModule } from './campaign/campaign.module';
import { ExtraModule } from './extra/extra.module';
import { DatabaseModule } from './config/database/database.module';
import { CloudinaryModule } from './config/cloudinary/cloudinary.module';
import { UserModule } from './user/user.module';
import { RedisModule } from './redis/redis.module';
import { SecurityModule } from './security/security.module';
import { TripModule } from './trip/trip.module';
import { AchievementModule } from './achievement/achievement.module';
import { ReviewModule } from './review/review.module';
import { ReportModule } from './report/report.module';
import { NotificationModule } from './notification/notification.module';
import { VisitedPlaceModule } from './visited-place/visited-place.module';
import { XpLedgerModule } from './xp-ledger/xp-ledger.module';
import { BadgeModule } from './badge/badge.module';
import { MediaModule } from './media/media.module';
import { ChatModule } from './chat/chat.module';
import { RequestLoggerMiddleware } from './request-logger.middleware';
import { ObservabilityModule } from './observability/observability.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env', 'backend/.env'],
      isGlobal: true,
    }),
    DatabaseModule,
    ObservabilityModule,
    AuditModule,
    CloudinaryModule,
    UserModule,
    AuthModule,
    RedisModule,
    CampaignModule,
    TripModule,
    AchievementModule,
    ReviewModule,
    ReportModule,
    NotificationModule,
    VisitedPlaceModule,
    XpLedgerModule,
    BadgeModule,
    MediaModule,
    ChatModule,
    // Admin utilities
    AdminModule,
    ExtraModule,
    SecurityModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
