import { ConfigService } from '@nestjs/config';
import { BadGatewayException, HttpException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { TmdbService } from './tmdb.service';

describe('TmdbService', () => {
  const config = {
    get: jest.fn(
      (key: string) =>
        ({
          TMDB_API_KEY: 'test-key',
          TMDB_BASE_URL: 'https://tmdb.test/3',
          TMDB_TIMEOUT_MS: '1000',
        })[key],
    ),
  } as unknown as ConfigService;
  const redis = { getClient: () => null } as unknown as RedisService;
  let service: TmdbService;

  beforeEach(() => {
    service = new TmdbService(config, redis);
    jest.restoreAllMocks();
  });

  it('caches a successful paginated response', async () => {
    const request = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ page: 1, results: [{ id: 1 }] }),
    } as Response);

    await service.popular('movie', 1, 'en-US');
    await service.popular('movie', 1, 'en-US');

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('maps TMDB rate limiting to a clean 429 exception', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: false, status: 429 } as Response);
    await expect(
      service.trending('movie', 1, 'en-US'),
    ).rejects.toMatchObject<HttpException>({ status: 429 });
  });

  it('rejects malformed responses', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => null,
    } as Response);
    await expect(service.countries('en-US')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
