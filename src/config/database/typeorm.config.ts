import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { postgresConnection } from './typeorm.options';

/**
 * PostgreSQL connection (business entities).
 * Schema changes go through migrations, never synchronize.
 */
export const typeOrmAsyncConfig: TypeOrmModuleAsyncOptions = {
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    ...postgresConnection({
      host: config.get<string>('POSTGRES_HOST', 'localhost'),
      port: Number(config.get('POSTGRES_PORT', 5432)),
      username: config.get<string>('POSTGRES_USER', 'parking'),
      password: config.get<string>('POSTGRES_PASSWORD', 'parking'),
      database: config.get<string>('POSTGRES_DB', 'parking_db'),
    }),
    autoLoadEntities: true,
    migrationsRun: true,
  }),
};
