import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { LogAction, ReservationStatus } from '../common/enums';
import { LogsService } from '../logs/logs.service';
import { Reservation } from '../reservations/reservation.entity';
import { ReservationsService } from '../reservations/reservations.service';
import { SpotsService } from '../spots/spots.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { ParkingSession } from './parking-session.entity';

const sessionRelations = { vehicle: true, spot: true } as const;

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(ParkingSession)
    private readonly sessionsRepository: Repository<ParkingSession>,
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
    private readonly vehiclesService: VehiclesService,
    private readonly spotsService: SpotsService,
    private readonly logsService: LogsService,
    private readonly reservationsService: ReservationsService,
  ) {}

  async create(
    dto: CreateSessionDto,
    actor: AuthUser,
  ): Promise<ParkingSession> {
    await this.vehiclesService.findById(dto.vehicleId);
    await this.spotsService.findById(dto.spotId);

    // Check if the VEHICLE already has an open parking session
    const openForVehicle = await this.sessionsRepository.count({
      where: { vehicleId: dto.vehicleId, exitedAt: IsNull() },
    });
    if (openForVehicle > 0) {
      throw new ConflictException('This vehicle already has an open parking session');
    }

    // Check if the SPOT already has an open parking session
    const openForSpot = await this.sessionsRepository.count({
      where: { spotId: dto.spotId, exitedAt: IsNull() },
    });
    if (openForSpot > 0) {
      throw new ConflictException('This parking spot already has an open session');
    }

    if (dto.reservationId) {
      await this.reservationsService.expireOverdueReservations();
      const reservation = await this.reservationsRepository.findOneBy({
        id: dto.reservationId,
      });
      if (!reservation) {
        throw new NotFoundException('Reservation not found');
      }
      if (reservation.status !== ReservationStatus.CONFIRMED) {
        throw new BadRequestException(
          'The reservation is no longer confirmed',
        );
      }
      if (reservation.vehicleId !== dto.vehicleId) {
        throw new BadRequestException(
          'The reservation does not belong to this vehicle',
        );
      }
      if (reservation.spotId !== dto.spotId) {
        throw new BadRequestException(
          'The reservation does not match this parking spot',
        );
      }
    }

    const saved = await this.sessionsRepository.save(
      this.sessionsRepository.create({
        vehicleId: dto.vehicleId,
        spotId: dto.spotId,
        reservationId: dto.reservationId,
        enteredAt: dto.enteredAt ? new Date(dto.enteredAt) : new Date(),
      }),
    );

    await this.logsService.record({
      action: LogAction.VEHICLE_ENTRY,
      actorId: actor.userId,
      actorRole: actor.role,
      entityType: 'session',
      entityId: saved.id,
      payload: {
        vehicleId: saved.vehicleId,
        spotId: saved.spotId,
        reservationId: saved.reservationId ?? null,
      },
    });

    return this.findById(saved.id);
  }

  findAll(): Promise<ParkingSession[]> {
    return this.sessionsRepository.find({
      relations: sessionRelations,
      order: { enteredAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<ParkingSession> {
    const session = await this.sessionsRepository.findOne({
      where: { id },
      relations: sessionRelations,
    });
    if (!session) {
      throw new NotFoundException('Parking session not found');
    }
    return session;
  }

  async update(id: string, dto: UpdateSessionDto): Promise<ParkingSession> {
    const session = await this.findById(id);
    const changes = Object.fromEntries(
      Object.entries({
        spotId: dto.spotId,
        reservationId: dto.reservationId,
        enteredAt: dto.enteredAt ? new Date(dto.enteredAt) : undefined,
        exitedAt: dto.exitedAt ? new Date(dto.exitedAt) : undefined,
      }).filter(([, value]) => value !== undefined),
    );
    Object.assign(session, changes);
    await this.sessionsRepository.save(session);
    return this.findById(id);
  }

  async close(id: string, actor: AuthUser): Promise<ParkingSession> {
    const session = await this.findById(id);
    if (session.exitedAt) {
      throw new BadRequestException('This parking session is already closed');
    }

    const exitedAt = new Date();
    session.exitedAt = exitedAt;
    const saved = await this.sessionsRepository.save(session);

    if (saved.reservationId) {
      const reservation = await this.reservationsRepository.findOneBy({
        id: saved.reservationId,
      });
      if (reservation && reservation.status === ReservationStatus.CONFIRMED) {
        reservation.status = ReservationStatus.COMPLETED;
        await this.reservationsRepository.save(reservation);
      }
    }

    await this.logsService.record({
      action: LogAction.VEHICLE_EXIT,
      actorId: actor.userId,
      actorRole: actor.role,
      entityType: 'session',
      entityId: saved.id,
      payload: {
        vehicleId: saved.vehicleId,
        spotId: saved.spotId,
        exitedAt: exitedAt.toISOString(),
      },
    });

    return this.findById(saved.id);
  }

  async remove(id: string): Promise<void> {
    const session = await this.findById(id);
    await this.sessionsRepository.remove(session);
  }
}
