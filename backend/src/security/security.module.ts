import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { TokenRevocationService } from './token-revocation.service';

@Module({
  imports: [RedisModule],
  providers: [TokenRevocationService],
  exports: [TokenRevocationService],
})
export class SecurityModule {}
