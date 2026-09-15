import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';

/**
 * PostgreSQL connection (business entities).
 * Loaded asynchronously so values come from the environment via ConfigService.
 */
export const typeOrmAsyncConfig: TypeOrmModuleAsyncOptions = {
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    host: config.get<string>('POSTGRES_HOST', 'localhost'),
        port: Number(config.get('POSTGRES_PORT', 5432)),
    username: config.get<string>('POSTGRES_USER', 'parking'),
    password: config.get<string>('POSTGRES_PASSWORD', 'parking'),
    database: config.get<string>('POSTGRES_DB', 'parking'),
    autoLoadEntities: true,
    uuidExtension: 'pgcrypto',
    // Development only; production should rely on migrations
    synchronize: true,
  }),
};
