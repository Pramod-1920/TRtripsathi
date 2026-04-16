import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common/pipes/validation.pipe';

function isAddressInUseError(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'EADDRINUSE'
  );
}

function getListeningPort(app: { getHttpServer: () => { address: () => unknown } }): number | null {
  const address = app.getHttpServer().address();
  if (typeof address === 'object' && address !== null && 'port' in address) {
    return (address as { port: number }).port;
  }

  return null;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:true,
      forbidNonWhitelisted:true,
    }),
  );

  const preferredPort = Number(process.env.PORT ?? 5000);

  try {
    await app.listen(preferredPort);
  } catch (error) {
    if (!isAddressInUseError(error)) {
      throw error;
    }

    await app.listen(0);
    const fallbackPort = getListeningPort(app);
    console.warn(
      `Port ${preferredPort} is busy. Started server on port ${fallbackPort ?? 'unknown'}.`,
    );
  }

  const activePort = getListeningPort(app);
  console.log(`Server is running on port ${activePort ?? preferredPort}`);
}
void bootstrap();
