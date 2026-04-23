import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import { csrfMiddleware } from './security/csrf.middleware';
import { adminHeadersMiddleware } from './security/headers.middleware';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common/pipes/validation.pipe';
import { Connection } from 'mongoose';

function getPortFromEnv(): number {
  const envPort = process.env.PORT;

  if (!envPort) {
    throw new Error('PORT is required in .env file');
  }

  const port = Number(envPort);
  if (Number.isNaN(port)) {
    throw new Error('PORT in .env must be a valid number');
  }

  return port;
}

function getFrontendUrlFromEnv(): string {
  const frontendUrl = process.env.FRONTEND_URL?.trim();

  if (!frontendUrl) {
    throw new Error('FRONTEND_URL is required in .env file');
  }

  return frontendUrl;
}

function logMongoConnectionStatus(app: INestApplication): void {
  const mongooseConnection = app.get<Connection>(getConnectionToken());

  if (mongooseConnection.readyState === 1) {
    console.log(
      `=== MONGODB CONNECTED SUCCESSFULLY: ${mongooseConnection.name} ===`,
    );
    return;
  }

  console.log(
    `=== MONGODB CONNECTION STATUS: readyState=${mongooseConnection.readyState} ===`,
  );
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const frontendUrl = getFrontendUrlFromEnv();

  app.use(helmet());
  app.use(cookieParser());
  // ensure body parsing for sendBeacon JSON payloads (small bodies)
  app.use(bodyParser.json({ limit: '16kb' }));

  // Apply admin security headers globally (safe conservative policy)
  app.use(adminHeadersMiddleware);

  // Rate-limit auth endpoints (in-memory fallback using express-rate-limit)
  // In production consider replacing with a Redis-backed limiter for cross-process limits.
  const minuteLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.setHeader('Retry-After', String(60));
      res
        .status(429)
        .json({ message: 'Too many requests (per-minute). Try again later.' });
    },
  });

  const hourLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.setHeader('Retry-After', String(60 * 60));
      res
        .status(429)
        .json({ message: 'Too many requests (per-hour). Try again later.' });
    },
  });

  // apply both limiters in sequence to auth endpoints
  app.use('/auth/login', minuteLimiter, hourLimiter);
  app.use('/auth/signup', minuteLimiter, hourLimiter);
  app.use('/auth/refresh', minuteLimiter, hourLimiter);
  app.use('/auth/logout', minuteLimiter, hourLimiter);

  // CSRF middleware for state-changing endpoints (double-submit cookie)
  app.use(csrfMiddleware);

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('TRtripsathi API')
    .setDescription('API documentation for TRtripsathi backend')
    .setVersion('1.0')
    .addCookieAuth('access_token', undefined, 'access_token')
    .addCookieAuth('refresh_token', undefined, 'refresh_token')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide JWT access token',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = getPortFromEnv();
  await app.listen(port);
  console.log(`Server is running on port http://localhost:${port}`);
  console.log(
    `Swagger documentation available at http://localhost:${port}/api/docs`,
  );

  logMongoConnectionStatus(app);
}
void bootstrap();
