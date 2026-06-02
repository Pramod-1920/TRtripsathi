import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same global validation pipe as main bootstrap so tests exercise
    // whitelist & forbidNonWhitelisted behaviour
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /auth/signup rejects role field', async () => {
    // construct a quasi-unique 10-digit phone number to avoid conflicts
    const phone = '9' + String(Date.now()).slice(-9);

    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ phoneNumber: phone, password: 'Password@1', role: 'admin' })
      .expect(400);

    expect(res.body).toHaveProperty('message');
    // ValidationPipe may reject the unexpected 'role' field before controller runs,
    // or controller may throw. Accept either message by stringifying.
    expect(JSON.stringify(res.body.message)).toMatch(/role|Role cannot be set|should not exist/i);
  });

  it('POST /auth/signup rejects extra (non-whitelisted) fields via ValidationPipe', async () => {
    const phone = '8' + String(Date.now()).slice(-9);

    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ phoneNumber: phone, password: 'Password@1', unexpected: 'value' })
      .expect(400);

    expect(res.body).toHaveProperty('message');
    // message may be string or array depending on Nest version; stringify and assert
    expect(JSON.stringify(res.body.message)).toMatch(/unexpected|non-whitelisted|should not exist/i);
  });
});
