import { join } from 'node:path';
import { DataSourceOptions } from 'typeorm';

export type PostgresEnv = {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
};

export const typeOrmMigrations = [
  join(__dirname, '..', 'migrations', '*.{ts,js}'),
];

export function postgresConnection(env: PostgresEnv): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.host,
    port: env.port,
    username: env.username,
    password: env.password,
    database: env.database,
    uuidExtension: 'pgcrypto',
    synchronize: false,
    migrations: typeOrmMigrations,
  };
}
