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
    port: config.get<number>('POSTGRES_PORT', 5433),
    username: config.get<string>('POSTGRES_USER', 'parking'),
    password: config.get<string>('POSTGRES_PASSWORD', 'parking'),
    database: config.get<string>('POSTGRES_DB', 'parking'),
    autoLoadEntities: true,
    // Development only; production should rely on migrations
    synchronize: true,
  }),
};
