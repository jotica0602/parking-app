import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from '../reservations/reservation.entity';
import { ReservationsModule } from '../reservations/reservations.module';
import { ParkingSession } from '../sessions/parking-session.entity';
import { ParkingSpot } from '../spots/parking-spot.entity';
import { OccupancyController } from './occupancy.controller';
import { OccupancyService } from './occupancy.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ParkingSpot, Reservation, ParkingSession]),
    ReservationsModule,
  ],
  controllers: [OccupancyController],
  providers: [OccupancyService],
})
export class OccupancyModule {}
