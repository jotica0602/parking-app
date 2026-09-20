import { ConfigService } from '@nestjs/config';
import { JwtModuleAsyncOptions, JwtSignOptions } from '@nestjs/jwt';

/**
 * JWT signing configuration.
 * JWT_SECRET is required: the app fails fast at startup if it is missing.
 */
export const jwtAsyncConfig: JwtModuleAsyncOptions = {
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.getOrThrow<string>('JWT_SECRET'),
    signOptions: {
      expiresIn: config.get<string>(
        'JWT_EXPIRES_IN',
        '1h',
      ) as JwtSignOptions['expiresIn'],
    },
  }),
};
