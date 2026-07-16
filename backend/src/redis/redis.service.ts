import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

/**
 * RedisService provides an optional Redis client.
 * If REDIS_URL is not set or the ioredis package is not installed,
 * this service will gracefully operate in a no-op mode and return null from getClient().
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: any | null = null;

  onModuleInit() {
    const url = process.env.REDIS_URL?.trim();
    if (!url) return;

    try {
      // dynamic require to avoid hard dependency on ioredis at build time

      const IORedis = require('ioredis');
      this.client = new IORedis(url);
    } catch (e) {
      // package not present or initialization failed; leave client as null
      this.client = null;
    }
  }

  onModuleDestroy() {
    try {
      if (this.client && typeof this.client.quit === 'function')
        this.client.quit();
    } catch {
      // ignore
    }
  }

  getClient(): any | null {
    return this.client;
  }
}
