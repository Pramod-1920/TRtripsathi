import { Module, forwardRef } from '@nestjs/common';
import { AuditService } from './audit.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [forwardRef(() => UserModule)], // remove this line if there's no circular dependency
  providers: [AuditService],
  exports: [AuditService], // make AuditService available to UserModule
})
export class AuditModule {}
