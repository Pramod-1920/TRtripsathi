import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Auth, AuthSchema } from '../auth/schemas/auth.schema';
import { CloudinaryModule } from '../config/cloudinary/cloudinary.module';
import { UserController } from './user.controller';
import { User, UserSchema } from './schemas/user.schema';
import { UserService } from './user.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Auth.name, schema: AuthSchema },
    ]),
    CloudinaryModule,
    forwardRef(() => AuditModule),
  ],
  controllers: [UserController],
  providers: [UserService],

  // ✅ IMPORTANT FIX HERE
  exports: [UserService, MongooseModule],
})
export class UserModule {}
