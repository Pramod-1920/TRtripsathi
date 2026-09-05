import { Injectable, Logger } from '@nestjs/common';

type CacheEntry = { ts: number; data: unknown };

@Injectable()
export class AdminWeatherService {
  private readonly logger = new Logger(AdminWeatherService.name);
  private geocodeCache: Map<string, CacheEntry> = new Map();
  private weatherCache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 1000 * 60 * 60 * 24; // 24h

  private now() {
    return Date.now();
  }

  private isFresh(entry?: CacheEntry) {
    return !!entry && this.now() - entry.ts < this.CACHE_TTL;
  }

  async geocode(q: string): Promise<unknown[]> {
    const key = q.trim().toLowerCase();
    const cached = this.geocodeCache.get(key);
    if (this.isFresh(cached)) return cached!.data as unknown[];
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`;
    this.logger.debug(`Geocoding ${q}`);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'TRtripsathi-Admin/1.0 (+https://example.local)',
      },
    });
    const body = (await res.json()) as unknown[];
    this.geocodeCache.set(key, { ts: this.now(), data: body });
    return body;
  }

  async weatherFor(
    lat: string | number,
    lon: string | number,
  ): Promise<unknown> {
    const key = `${lat}:${lon}`;
    const cached = this.weatherCache.get(key);
    if (this.isFresh(cached)) return cached!.data;
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('hourly', 'temperature_2m,precipitation,weathercode');
    url.searchParams.set(
      'daily',
      'temperature_2m_max,temperature_2m_min,precipitation_sum',
    );
    url.searchParams.set('timezone', 'UTC');

    this.logger.debug(`Fetching weather ${lat},${lon}`);
    const res = await fetch(url.toString());
    const body = (await res.json()) as unknown;
    this.weatherCache.set(key, { ts: this.now(), data: body });
    return body;
  }
}
