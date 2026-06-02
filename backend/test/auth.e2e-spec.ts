import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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
    expect(res.body.message).toMatch(/Role cannot be set during signup/);
  });
});
