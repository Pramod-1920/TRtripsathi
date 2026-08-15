import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { Report, ReportSchema } from './schemas/report.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { Auth, AuthSchema } from '../auth/schemas/auth.schema';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    NotificationModule,
    MongooseModule.forFeature([
      { name: Report.name, schema: ReportSchema },
      { name: User.name, schema: UserSchema },
      { name: Auth.name, schema: AuthSchema },
    ]),
  ],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
