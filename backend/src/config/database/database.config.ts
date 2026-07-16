import { ConfigService } from '@nestjs/config';
import { MongooseModuleOptions } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export function getDatabaseConfig(
  configService: ConfigService,
): MongooseModuleOptions {
  const mongoUri = configService.get<string>('MONGODB_URI')?.trim();
  const connectTimeoutMs = Number(
    configService.get<string>('MONGODB_CONNECT_TIMEOUT_MS') ?? 5000,
  );
  const serverSelectionTimeoutMs = Number(
    configService.get<string>('MONGODB_SERVER_SELECTION_TIMEOUT_MS') ?? 5000,
  );

  if (!mongoUri) {
    throw new Error('MONGODB_URI is required in .env file');
  }

  return {
    uri: mongoUri,
    connectTimeoutMS: Number.isNaN(connectTimeoutMs) ? 5000 : connectTimeoutMs,
    serverSelectionTimeoutMS: Number.isNaN(serverSelectionTimeoutMs)
      ? 5000
      : serverSelectionTimeoutMs,
    connectionFactory: (connection: Connection) => {
      connection.on('connecting', () => {
        console.log('[MongoDB] Connecting...');
      });

      connection.on('connected', () => {
        console.log('[MongoDB] Connected');
      });

      connection.on('disconnected', () => {
        console.log('[MongoDB] Disconnected');
      });

      connection.on('error', (error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[MongoDB] Connection error:', message);
      });

      return connection;
    },
  };
}
