import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

type CacheEntry = { expiresAt: number; value: unknown };

@Injectable()
export class TmdbService {
  private readonly memory = new Map<string, CacheEntry>();
  private readonly maxMemoryEntries = 200;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async trending(
    mediaType: 'movie' | 'tv' | 'all',
    page: number,
    language: string,
  ) {
    return this.get(`/trending/${mediaType}/day`, { page, language }, 900);
  }

  async popular(mediaType: 'movie' | 'tv', page: number, language: string) {
    return this.get(`/${mediaType}/popular`, { page, language }, 1800);
  }

  async search(
    query: string,
    mediaType: 'movie' | 'tv' | 'all',
    page: number,
    language: string,
  ) {
    const path = mediaType === 'all' ? '/search/multi' : `/search/${mediaType}`;
    return this.get(path, { query, page, language, include_adult: false }, 300);
  }

  async countries(language: string) {
    return this.get('/configuration/countries', { language }, 86400);
  }

  async country(
    code: string,
    mediaType: 'movie' | 'tv',
    category: string,
    page: number,
    language: string,
  ) {
    const params: Record<string, unknown> = {
      with_origin_country: code,
      page,
      language,
      include_adult: false,
      sort_by:
        category === 'top_rated' ? 'vote_average.desc' : 'popularity.desc',
    };
    if (category === 'animation') params.with_genres = 16;
    if (category === 'drama') params.with_genres = 18;
    if (category === 'top_rated') params['vote_count.gte'] = 50;
    return this.get(`/discover/${mediaType}`, params, 1800);
  }

  async details(id: number, mediaType: 'movie' | 'tv', language: string) {
    return this.get(
      `/${mediaType}/${id}`,
      {
        language,
        append_to_response: 'credits,videos,watch/providers',
      },
      3600,
    );
  }

  async similar(
    id: number,
    mediaType: 'movie' | 'tv',
    page: number,
    language: string,
  ) {
    return this.get(`/${mediaType}/${id}/similar`, { page, language }, 1800);
  }

  async videos(id: number, mediaType: 'movie' | 'tv', language: string) {
    return this.get(`/${mediaType}/${id}/videos`, { language }, 3600);
  }

  private async get(
    path: string,
    params: Record<string, unknown>,
    ttlSeconds: number,
  ): Promise<any> {
    const apiKey = this.config.get<string>('TMDB_API_KEY')?.trim();
    if (!apiKey)
      throw new ServiceUnavailableException(
        'Movie discovery is not configured',
      );
    const baseUrl =
      this.config.get<string>('TMDB_BASE_URL')?.trim() ||
      'https://api.themoviedb.org/3';
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) =>
      query.set(key, String(value)),
    );
    query.set('api_key', apiKey);
    const cacheKey = `tmdb:${path}:${query.toString().replace(apiKey, 'key')}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached !== null) return cached;

    const timeoutMs = Number(
      this.config.get<string>('TMDB_TIMEOUT_MS') ?? 8000,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}${path}?${query}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (response.status === 404)
        throw new NotFoundException('Movie or series not found');
      if (response.status === 429)
        throw new HttpException(
          'Movie service rate limit reached',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      if (response.status === 401)
        throw new ServiceUnavailableException(
          'Movie service configuration is invalid',
        );
      if (!response.ok)
        throw new BadGatewayException(
          'Movie service is temporarily unavailable',
        );
      const value: unknown = await response.json();
      if (value === null || typeof value !== 'object')
        throw new BadGatewayException(
          'Movie service returned an invalid response',
        );
      await this.cacheSet(cacheKey, value, ttlSeconds);
      return value;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new GatewayTimeoutException('Movie service timed out');
      }
      if (
        error instanceof NotFoundException ||
        error instanceof HttpException ||
        error instanceof ServiceUnavailableException ||
        error instanceof BadGatewayException
      )
        throw error;
      throw new BadGatewayException('Unable to reach the movie service');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async cacheGet(key: string): Promise<unknown | null> {
    const client = this.redis.getClient();
    if (client) {
      try {
        const raw = await client.get(key);
        if (raw) return JSON.parse(raw) as unknown;
      } catch {
        /* use memory fallback */
      }
    }
    const entry = this.memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return entry.value;
  }

  private async cacheSet(key: string, value: unknown, ttlSeconds: number) {
    const client = this.redis.getClient();
    if (client) {
      try {
        await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        return;
      } catch {
        /* keep local fallback */
      }
    }
    if (this.memory.size >= this.maxMemoryEntries) {
      const oldest = this.memory.keys().next().value as string | undefined;
      if (oldest) this.memory.delete(oldest);
    }
    this.memory.set(key, { expiresAt: Date.now() + ttlSeconds * 1000, value });
  }
}
