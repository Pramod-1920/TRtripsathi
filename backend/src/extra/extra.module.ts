import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Auth, AuthSchema } from '../auth/schemas/auth.schema';
import { ExtraController } from './extra.controller';
import { ExtraService } from './extra.service';
import { ExtraItem, ExtraSchema } from './schemas/extra.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExtraItem.name, schema: ExtraSchema },
      { name: Auth.name, schema: AuthSchema },
    ]),
  ],
  controllers: [ExtraController],
  providers: [ExtraService],
  exports: [ExtraService],
})
export class ExtraModule {}