import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Reservation } from '../reservations/reservation.entity';
import { ParkingSpot } from '../spots/parking-spot.entity';
import { Vehicle } from '../vehicles/vehicle.entity';

@Entity('parking_sessions')
export class ParkingSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  vehicleId: string;

  @ManyToOne(() => Vehicle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column()
  spotId: string;

  @ManyToOne(() => ParkingSpot, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'spotId' })
  spot: ParkingSpot;

  @Column({ nullable: true })
  reservationId?: string;

  @ManyToOne(() => Reservation, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reservationId' })
  reservation?: Reservation;

  @Column({ type: 'timestamptz' })
  enteredAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  exitedAt?: Date | null;
}
