import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getConnectionToken } from '@nestjs/mongoose';
import { MetricsService } from './observability/metrics.service';
import { RedisService } from './redis/redis.service';

describe('AppController', () => {
  let appController: AppController;
  let app: TestingModule;

  beforeEach(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        MetricsService,
        {
          provide: RedisService,
          useValue: {
            health: jest
              .fn()
              .mockResolvedValue({ configured: false, connected: true }),
          },
        },
        {
          provide: getConnectionToken(),
          useValue: { readyState: 1, name: 'test' },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return the configured greeting', () => {
      expect(appController.getHello()).toBe('Hello Pramod');
    });
  });

  describe('operations', () => {
    it('reports liveness and database readiness', () => {
      expect(appController.getLiveness().status).toBe('ok');
      expect(appController.getHealth()).toMatchObject({
        status: 'ok',
        database: { connected: true, readyState: 1, name: 'test' },
      });
    });

    it('returns bounded request and process metrics', () => {
      expect(appController.getMetrics()).toMatchObject({
        requests: { total: 0, active: 0, serverErrors: 0 },
        process: { node: expect.any(String), memoryBytes: expect.any(Object) },
      });
    });

    it('returns HTTP 503 when MongoDB is unavailable', async () => {
      const connection = app.get(getConnectionToken());
      connection.readyState = 0;
      const response = { status: jest.fn() } as any;

      await expect(appController.getReadiness(response)).resolves.toMatchObject(
        {
          status: 'degraded',
          database: { connected: false },
        },
      );
      expect(response.status).toHaveBeenCalledWith(503);
    });

    it('returns HTTP 503 when configured Redis is unavailable', async () => {
      const redis = app.get(RedisService);
      redis.health.mockResolvedValue({ configured: true, connected: false });
      const response = { status: jest.fn() } as any;

      await expect(appController.getReadiness(response)).resolves.toMatchObject(
        {
          status: 'degraded',
          redis: { configured: true, connected: false },
        },
      );
      expect(response.status).toHaveBeenCalledWith(503);
    });

    it('protects metrics with the configured monitoring token', () => {
      const previous = process.env.MONITORING_TOKEN;
      process.env.MONITORING_TOKEN = 'monitor-secret';
      try {
        expect(() => appController.getMetrics()).toThrow(
          'Invalid monitoring token',
        );
        expect(() => appController.getMetrics('wrong')).toThrow(
          'Invalid monitoring token',
        );
        expect(appController.getMetrics('monitor-secret')).toHaveProperty(
          'requests',
        );
      } finally {
        if (previous === undefined) delete process.env.MONITORING_TOKEN;
        else process.env.MONITORING_TOKEN = previous;
      }
    });
  });
});
