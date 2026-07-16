import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { TokenRevocationService } from './token-revocation.service';
import { AuditService } from '../audit/audit.service';

@Module({
  imports: [RedisModule],
  providers: [TokenRevocationService, AuditService],
  exports: [TokenRevocationService, AuditService],
})
export class SecurityModule {}
