import { DataSource } from 'typeorm';
import { postgresConnection } from './config/typeorm.options';
import { Reservation } from './reservations/reservation.entity';
import { ParkingSession } from './sessions/parking-session.entity';
import { ParkingSpot } from './spots/parking-spot.entity';
import { User } from './users/user.entity';
import { Vehicle } from './vehicles/vehicle.entity';

/**
 * Standalone DataSource for the TypeORM CLI (generate / run / revert).
 * Does not bootstrap Nest; the CLI initializes the connection itself.
 */
export default new DataSource({
  ...postgresConnection({
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    username: process.env.POSTGRES_USER ?? 'parking',
    password: process.env.POSTGRES_PASSWORD ?? 'parking',
    database: process.env.POSTGRES_DB ?? 'parking_db',
  }),
  entities: [User, Vehicle, ParkingSpot, Reservation, ParkingSession],
});
