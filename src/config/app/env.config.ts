import { ConfigModuleOptions } from '@nestjs/config';

const nodeEnv = process.env.NODE_ENV;

/**
 * Env file loading for ConfigModule.
 * Production reads only process.env; tests use .env.test.
 */
export const envConfig: ConfigModuleOptions = {
  isGlobal: true,
  envFilePath: nodeEnv === 'test' ? '.env.test' : ['.env.development', '.env'],
  ignoreEnvFile: nodeEnv === 'production',
};
