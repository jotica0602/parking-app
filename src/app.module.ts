import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { envConfig } from './config/app/env.config';
import { mongooseAsyncConfig } from './config/database/mongoose.config';
import { typeOrmAsyncConfig } from './config/database/typeorm.config';
import { LogsModule } from './logs/logs.module';
import { OccupancyModule } from './occupancy/occupancy.module';
import { ReservationsModule } from './reservations/reservations.module';
import { SessionsModule } from './sessions/sessions.module';
import { SpotsModule } from './spots/spots.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot(envConfig),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    MongooseModule.forRootAsync(mongooseAsyncConfig),
    AuthModule,
    UsersModule,
    LogsModule,
    VehiclesModule,
    SpotsModule,
    ReservationsModule,
    SessionsModule,
    OccupancyModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
