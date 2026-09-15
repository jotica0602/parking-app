import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { SpotType } from '../common/enums';

@Entity('parking_spots')
export class ParkingSpot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'int', nullable: true })
  floor?: number;

  @Column({ type: 'enum', enum: SpotType, default: SpotType.STANDARD })
  type: SpotType;
}
