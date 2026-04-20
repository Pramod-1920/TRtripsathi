import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
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

function logMongoConnectionStatus(app: INestApplication): void {
  const mongooseConnection = app.get<Connection>(getConnectionToken());

  if (mongooseConnection.readyState === 1) {
    console.log(`=== MONGODB CONNECTED SUCCESSFULLY: ${mongooseConnection.name} ===`);
    return;
  }

  console.log(`=== MONGODB CONNECTION STATUS: readyState=${mongooseConnection.readyState} ===`);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = getPortFromEnv();
  await app.listen(port);
  console.log(`Server is running on port http://localhost:${port}`);
  console.log(`Swagger documentation available at http://localhost:${port}/api/docs`);

  logMongoConnectionStatus(app);
}
void bootstrap();
