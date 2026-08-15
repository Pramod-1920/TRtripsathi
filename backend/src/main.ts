import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import { createAuthLimiters } from './security/redis-rate-limiter';
import { csrfMiddleware } from './security/csrf.middleware';
import { adminHeadersMiddleware } from './security/headers.middleware';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common/pipes/validation.pipe';
import { Connection } from 'mongoose';
import { HttpExceptionFilter } from './http-exception.filter';
import { StructuredLogger } from './observability/structured-logger';

const structuredLogger = new StructuredLogger();

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

function getFrontendUrlsFromEnv(): string[] {
  const frontendUrl = process.env.FRONTEND_URL?.trim();

  if (!frontendUrl) {
    throw new Error('FRONTEND_URL is required in .env file');
  }

  return frontendUrl
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
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

async function waitForMongoConnection(
  app: INestApplication,
  timeoutMs = 30000,
): Promise<void> {
  const mongooseConnection = app.get<Connection>(getConnectionToken());

  if (mongooseConnection.readyState === 1) {
    return;
  }

  let timeoutHandle: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(
        new Error(
          `Timed out waiting for MongoDB connection after ${timeoutMs}ms`,
        ),
      );
    }, timeoutMs);
  });

  try {
    await Promise.race([mongooseConnection.asPromise(), timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: structuredLogger });
  const frontendUrls = getFrontendUrlsFromEnv();

  // Enable CORS first (before other middleware that may affect headers)
  app.enableCors({
    origin: frontendUrls,
    credentials: true,
  });

  app.use(helmet());
  app.use(cookieParser());
  // allow moderate analytics payloads while keeping a bounded request body size
  app.use(bodyParser.json({ limit: '64kb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '64kb' }));

  // Apply admin security headers globally (safe conservative policy)
  app.use(adminHeadersMiddleware);

  // Rate-limit auth endpoints (use Redis-backed store when available, fallback to in-memory)
  const { minuteLimiter, hourLimiter } = await createAuthLimiters();

  // apply both limiters in sequence to auth endpoints
  app.use('/auth/login', minuteLimiter, hourLimiter);
  app.use('/auth/signup', minuteLimiter, hourLimiter);
  app.use('/auth/password', minuteLimiter, hourLimiter);
  app.use('/auth/verification', minuteLimiter, hourLimiter);

  // CSRF middleware for state-changing endpoints (double-submit cookie)
  app.use(csrfMiddleware);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global exception filter for consistent error handling
  app.useGlobalFilters(new HttpExceptionFilter());

  // Setup Swagger documentation (disabled in production)
  if (process.env.NODE_ENV !== 'production') {
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
    console.log('Swagger documentation available at /api/docs (local only)');
  } else {
    console.log('Swagger documentation is disabled in production');
  }

  await waitForMongoConnection(app);

  const port = getPortFromEnv();
  await app.listen(port);
  console.log(`Server is running on port http://localhost:${port}`);

  logMongoConnectionStatus(app);
}
void bootstrap().catch((error: unknown) => {
  structuredLogger.fatal(
    error instanceof Error ? error.message : String(error),
    error instanceof Error ? error.stack : undefined,
    'Bootstrap',
  );
  process.exitCode = 1;
});
