import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import {
  LogAction,
  ReservationStatus,
  SYSTEM_ACTOR_ID,
  SYSTEM_ACTOR_ROLE,
  UserRole,
} from '../common/enums';
import { LogsService } from '../logs/logs.service';
import { ParkingSession } from '../sessions/parking-session.entity';
import { SpotsService } from '../spots/spots.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { Reservation } from './reservation.entity';

const reservationRelations = { vehicle: true, spot: true } as const;

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
    @InjectRepository(ParkingSession)
    private readonly sessionsRepository: Repository<ParkingSession>,
    private readonly vehiclesService: VehiclesService,
    private readonly spotsService: SpotsService,
    private readonly logsService: LogsService,
  ) {}

  async create(
    dto: CreateReservationDto,
    actor: AuthUser,
  ): Promise<Reservation> {
    const { startAt, endAt } = this.parseInterval(dto.startAt, dto.endAt);
    const vehicle = await this.vehiclesService.findById(dto.vehicleId);
    this.assertVehicleOwnership(vehicle.ownerId, actor);
    await this.expireOverdueReservations();

    const spotId = dto.spotId
      ? await this.requireAvailableSpot(dto.spotId, startAt, endAt)
      : await this.assignAvailableSpot(startAt, endAt);

    const saved = await this.reservationsRepository.save(
      this.reservationsRepository.create({
        userId: vehicle.ownerId,
        vehicleId: vehicle.id,
        spotId,
        startAt,
        endAt,
        status: ReservationStatus.CONFIRMED,
      }),
    );

    await this.logsService.record({
      action: LogAction.RESERVATION_CREATED,
      actorId: actor.userId,
      actorRole: actor.role,
      entityType: 'reservation',
      entityId: saved.id,
      payload: {
        vehicleId: saved.vehicleId,
        spotId: saved.spotId,
        startAt: saved.startAt.toISOString(),
        endAt: saved.endAt.toISOString(),
      },
    });

    return this.findById(saved.id);
  }

  async findAll(actor: AuthUser): Promise<Reservation[]> {
    await this.expireOverdueReservations();
    const where =
      actor.role === UserRole.CLIENT ? { userId: actor.userId } : {};
    return this.reservationsRepository.find({
      where,
      relations: reservationRelations,
      order: { startAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Reservation> {
    await this.expireOverdueReservations();
    const reservation = await this.reservationsRepository.findOne({
      where: { id },
      relations: reservationRelations,
    });
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }
    return reservation;
  }

  async findByIdForActor(id: string, actor: AuthUser): Promise<Reservation> {
    const reservation = await this.findById(id);
    this.assertCanAccess(reservation, actor);
    return reservation;
  }

  async update(
    id: string,
    dto: UpdateReservationDto,
    actor: AuthUser,
  ): Promise<Reservation> {
    const reservation = await this.findByIdForActor(id, actor);
    if (reservation.status !== ReservationStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed reservations can be updated');
    }

    let vehicleId = reservation.vehicleId;
    if (dto.vehicleId) {
      const vehicle = await this.vehiclesService.findById(dto.vehicleId);
      this.assertVehicleOwnership(vehicle.ownerId, actor);
      vehicleId = vehicle.id;
      reservation.userId = vehicle.ownerId;
      reservation.vehicleId = vehicle.id;
    }

    const startAt = dto.startAt
      ? new Date(dto.startAt)
      : reservation.startAt;
    const endAt = dto.endAt ? new Date(dto.endAt) : reservation.endAt;
    this.assertValidInterval(startAt, endAt);

    const spotId = dto.spotId ?? reservation.spotId;
    if (dto.spotId) {
      await this.spotsService.findById(spotId);
    }
    if (!(await this.isSpotAvailable(spotId, startAt, endAt, reservation.id))) {
      throw new ConflictException(
        'The parking spot is not available for the requested time range',
      );
    }

    await this.reservationsRepository.update(id, {
      userId: reservation.userId,
      vehicleId,
      spotId,
      startAt,
      endAt,
    });
    return this.findById(id);
  }

  async cancel(id: string, actor: AuthUser): Promise<Reservation> {
    const reservation = await this.findByIdForActor(id, actor);
    if (reservation.status !== ReservationStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed reservations can be cancelled');
    }

    reservation.status = ReservationStatus.CANCELLED;
    const saved = await this.reservationsRepository.save(reservation);

    await this.logsService.record({
      action: LogAction.RESERVATION_CANCELLED,
      actorId: actor.userId,
      actorRole: actor.role,
      entityType: 'reservation',
      entityId: saved.id,
      payload: { spotId: saved.spotId, vehicleId: saved.vehicleId },
    });

    return this.findById(saved.id);
  }

  /**
   * Marks confirmed reservations as expired when the slot ended with no
   * parking session (no-show). Called lazily before reads/writes that
   * depend on current availability.
   */
  async expireOverdueReservations(): Promise<void> {
    const now = new Date();
    const overdue = await this.reservationsRepository
      .createQueryBuilder('r')
      .where('r.status = :status', { status: ReservationStatus.CONFIRMED })
      .andWhere('r.endAt <= :now', { now })
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM parking_sessions s
          WHERE s."reservationId" = r.id
        )`,
      )
      .getMany();

    for (const reservation of overdue) {
      reservation.status = ReservationStatus.EXPIRED;
      await this.reservationsRepository.save(reservation);
      await this.logsService.record({
        action: LogAction.RESERVATION_EXPIRED,
        actorId: SYSTEM_ACTOR_ID,
        actorRole: SYSTEM_ACTOR_ROLE,
        entityType: 'reservation',
        entityId: reservation.id,
        payload: {
          spotId: reservation.spotId,
          vehicleId: reservation.vehicleId,
          endAt: reservation.endAt.toISOString(),
        },
      });
    }
  }

  async remove(id: string, actor: AuthUser): Promise<void> {
    const reservation = await this.findByIdForActor(id, actor);
    if (reservation.status === ReservationStatus.CONFIRMED) {
      await this.cancel(id, actor);
      return;
    }
    await this.reservationsRepository.remove(reservation);
  }

  private parseInterval(startAtRaw: string, endAtRaw: string): {
    startAt: Date;
    endAt: Date;
  } {
    const startAt = new Date(startAtRaw);
    const endAt = new Date(endAtRaw);
    this.assertValidInterval(startAt, endAt);
    return { startAt, endAt };
  }

  private assertValidInterval(startAt: Date, endAt: Date): void {
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException('Invalid reservation dates');
    }
    if (endAt <= startAt) {
      throw new BadRequestException('endAt must be after startAt');
    }
  }

  private assertVehicleOwnership(ownerId: string, actor: AuthUser): void {
    if (actor.role === UserRole.ADMIN) {
      return;
    }
    if (ownerId !== actor.userId) {
      throw new ForbiddenException('You can only reserve your own vehicles');
    }
  }

  private assertCanAccess(reservation: Reservation, actor: AuthUser): void {
    if (actor.role === UserRole.ADMIN || actor.role === UserRole.EMPLOYEE) {
      return;
    }
    if (reservation.userId !== actor.userId) {
      throw new ForbiddenException('You can only access your own reservations');
    }
  }

  private async requireAvailableSpot(
    spotId: string,
    startAt: Date,
    endAt: Date,
    exceptReservationId?: string,
  ): Promise<string> {
    await this.spotsService.findById(spotId);
    if (!(await this.isSpotAvailable(spotId, startAt, endAt, exceptReservationId))) {
      throw new ConflictException(
        'The parking spot is not available for the requested time range',
      );
    }
    return spotId;
  }

  private async assignAvailableSpot(
    startAt: Date,
    endAt: Date,
  ): Promise<string> {
    const spots = await this.spotsService.findAll();
    for (const spot of spots) {
      if (await this.isSpotAvailable(spot.id, startAt, endAt)) {
        return spot.id;
      }
    }
    throw new ConflictException(
      'No parking spots available for the requested time range',
    );
  }

  private async isSpotAvailable(
    spotId: string,
    startAt: Date,
    endAt: Date,
    exceptReservationId?: string,
  ): Promise<boolean> {
    const qb = this.reservationsRepository
      .createQueryBuilder('r')
      .where('r.spotId = :spotId', { spotId })
      .andWhere('r.status = :status', { status: ReservationStatus.CONFIRMED })
      .andWhere('r.startAt < :endAt AND r.endAt > :startAt', { startAt, endAt });
    if (exceptReservationId) {
      qb.andWhere('r.id != :exceptId', { exceptId: exceptReservationId });
    }
    if ((await qb.getCount()) > 0) {
      return false;
    }

    const now = new Date();
    if (startAt <= now && now < endAt) {
      const openSessions = await this.sessionsRepository.count({
        where: { spotId, exitedAt: IsNull() },
      });
      if (openSessions > 0) {
        return false;
      }
    }
    return true;
  }
}
