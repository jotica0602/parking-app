import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { mongooseAsyncConfig } from './config/mongoose.config';
import { typeOrmAsyncConfig } from './config/typeorm.config';
import { LogsModule } from './logs/logs.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // PostgreSQL: business entities
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),

    // MongoDB: activity logs
    MongooseModule.forRootAsync(mongooseAsyncConfig),

    AuthModule,
    UsersModule,
    LogsModule,
  ],
})
export class AppModule {}
