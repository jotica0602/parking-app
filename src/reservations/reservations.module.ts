import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogsModule } from '../logs/logs.module';
import { ParkingSession } from '../sessions/parking-session.entity';
import { SpotsModule } from '../spots/spots.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { Reservation } from './reservation.entity';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation, ParkingSession]),
    VehiclesModule,
    SpotsModule,
    LogsModule,
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
