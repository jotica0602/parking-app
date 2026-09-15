import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogsModule } from '../logs/logs.module';
import { Reservation } from '../reservations/reservation.entity';
import { ReservationsModule } from '../reservations/reservations.module';
import { SpotsModule } from '../spots/spots.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { ParkingSession } from './parking-session.entity';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ParkingSession, Reservation]),
    VehiclesModule,
    SpotsModule,
    LogsModule,
    ReservationsModule,
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
