import { ConfigService } from '@nestjs/config';
import { MongooseModuleAsyncOptions } from '@nestjs/mongoose';

/**
 * MongoDB connection (activity logs).
 * Loaded asynchronously so values come from the environment via ConfigService.
 */
export const mongooseAsyncConfig: MongooseModuleAsyncOptions = {
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    uri: config.get<string>(
      'MONGO_URI',
      'mongodb://localhost:27017/parking_logs',
    ),
  }),
};
