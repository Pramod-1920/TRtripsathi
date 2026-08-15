import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getConnectionToken } from '@nestjs/mongoose';
import { MetricsService } from './observability/metrics.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        MetricsService,
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
  });
});
