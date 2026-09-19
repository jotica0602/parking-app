import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const API_PREFIX = 'api';

/**
 * Global HTTP pipeline (prefix, validation, serialization).
 * Shared by the bootstrap and the e2e tests so both exercise the same behaviour.
 */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Applies @Exclude() from entities (like the password hash) on all responses
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  return app;
}
