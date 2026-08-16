import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Auth, AuthSchema } from '../auth/schemas/auth.schema';
import { CloudinaryModule } from '../config/cloudinary/cloudinary.module';
import { ExtraItem, ExtraSchema } from '../extra/schemas/extra.schema';
import { UserController } from './user.controller';
import { User, UserSchema } from './schemas/user.schema';
import { UserService } from './user.service';
import { AuditModule } from '../audit/audit.module';
import { BadgeModule } from '../badge/badge.module';
import { ExtraModule } from '../extra/extra.module';
import { VisitedPlaceModule } from '../visited-place/visited-place.module';
import { XpLedgerModule } from '../xp-ledger/xp-ledger.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Auth.name, schema: AuthSchema },
      { name: ExtraItem.name, schema: ExtraSchema },
    ]),
    CloudinaryModule,
    forwardRef(() => AuditModule),
    // Import BadgeModule so UserService can include persisted user badges in profile responses
    forwardRef(() => BadgeModule),
    ExtraModule,
    forwardRef(() => VisitedPlaceModule),
    XpLedgerModule,
  ],
  controllers: [UserController],
  providers: [UserService],

  // ✅ IMPORTANT FIX HERE
  exports: [UserService, MongooseModule],
})
export class UserModule {}
