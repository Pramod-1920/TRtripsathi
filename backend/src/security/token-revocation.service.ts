import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

/**
 * TokenRevocationService provides a best-effort revocation store.
 * If Redis is available it uses Redis, otherwise it falls back to an in-memory map.
 * The in-memory map is ephemeral and only suitable for single-process dev workloads.
 */
@Injectable()
export class TokenRevocationService {
  private readonly logger = new Logger(TokenRevocationService.name);
  private readonly inMemory = new Map<string, number>(); // token -> expiryTimestamp

  constructor(private readonly redis: RedisService) {}

  private getClient(): any | null {
    try {
      return this.redis.getClient();
    } catch {
      return null;
    }
  }

  private cleanupExpired() {
    const now = Date.now();
    for (const [token, exp] of this.inMemory.entries()) {
      if (exp <= now) this.inMemory.delete(token);
    }
  }

  // Revoke a token string (store it with TTL equal to token expiry seconds)
  async revokeToken(token: string, ttlSeconds = 60 * 60 * 24 * 7) {
    const client = this.getClient();
    if (client) {
      try {
        const key = `revoked_tokens:${token}`;
        await client.set(key, '1', 'EX', ttlSeconds);
        return;
      } catch (e) {
        this.logger.warn(
          'Failed to write revoked token to Redis, falling back to memory',
          e,
        );
      }
    }

    // fallback to in-memory store
    const expiry = Date.now() + ttlSeconds * 1000;
    this.inMemory.set(token, expiry);
  }

  async isRevoked(token: string) {
    if (!token) return true;
    const client = this.getClient();
    if (client) {
      try {
        const key = `revoked_tokens:${token}`;
        const val = await client.get(key);
        return !!val;
      } catch (e) {
        this.logger.warn(
          'Failed to read revoked token from Redis, falling back to memory',
          e,
        );
      }
    }

    this.cleanupExpired();
    return this.inMemory.has(token);
  }
}
