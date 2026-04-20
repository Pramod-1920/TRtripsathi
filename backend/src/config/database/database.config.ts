import { ConfigService } from '@nestjs/config';
import { MongooseModuleOptions } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export function getDatabaseConfig(configService: ConfigService): MongooseModuleOptions {
  const mongoUri = configService.get<string>('MONGODB_URI')?.trim();

  if (!mongoUri) {
    throw new Error('MONGODB_URI is required in .env file');
  }

  return {
    uri: mongoUri,
    connectionFactory: (connection: Connection) => {
      connection.on('disconnected', () => {
        console.log('[MongoDB] Disconnected');
      });

      connection.on('error', (error) => {
        console.error('[MongoDB] Connection error:', error.message);
      });

      return connection;
    },
  };
}
