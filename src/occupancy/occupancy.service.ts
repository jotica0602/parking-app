import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { ReservationStatus, SpotOccupancyStatus } from '../common/enums';
import { Reservation } from '../reservations/reservation.entity';
import { ReservationsService } from '../reservations/reservations.service';
import { ParkingSession } from '../sessions/parking-session.entity';
import { ParkingSpot } from '../spots/parking-spot.entity';

export interface OccupancySpotView {
  id: string;
  code: string;
  floor?: number;
  type: string;
  status: SpotOccupancyStatus;
  sessionId?: string;
  reservationId?: string;
}

export interface OccupancyResponse {
  generatedAt: string;
  totals: {
    total: number;
    occupied: number;
    reserved: number;
    free: number;
  };
  spots: OccupancySpotView[];
}

@Injectable()
export class OccupancyService {
  constructor(
    @InjectRepository(ParkingSpot)
    private readonly spotsRepository: Repository<ParkingSpot>,
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
    @InjectRepository(ParkingSession)
    private readonly sessionsRepository: Repository<ParkingSession>,
    private readonly reservationsService: ReservationsService,
  ) {}

  async getCurrentOccupancy(): Promise<OccupancyResponse> {
    await this.reservationsService.expireOverdueReservations();
    const now = new Date();
    const [spots, openSessions, activeReservations] = await Promise.all([
      this.spotsRepository.find({ order: { code: 'ASC' } }),
      this.sessionsRepository.find({ where: { exitedAt: IsNull() } }),
      this.reservationsRepository.find({
        where: {
          status: ReservationStatus.CONFIRMED,
          startAt: LessThanOrEqual(now),
          endAt: MoreThan(now),
        },
      }),
    ]);

    const sessionBySpot = new Map(
      openSessions.map((session) => [session.spotId, session]),
    );
    const reservationBySpot = new Map(
      activeReservations.map((reservation) => [reservation.spotId, reservation]),
    );

    const views: OccupancySpotView[] = spots.map((spot) => {
      const session = sessionBySpot.get(spot.id);
      if (session) {
        return {
          id: spot.id,
          code: spot.code,
          floor: spot.floor,
          type: spot.type,
          status: SpotOccupancyStatus.OCCUPIED,
          sessionId: session.id,
          reservationId: session.reservationId,
        };
      }

      const reservation = reservationBySpot.get(spot.id);
      if (reservation) {
        return {
          id: spot.id,
          code: spot.code,
          floor: spot.floor,
          type: spot.type,
          status: SpotOccupancyStatus.RESERVED,
          reservationId: reservation.id,
        };
      }

      return {
        id: spot.id,
        code: spot.code,
        floor: spot.floor,
        type: spot.type,
        status: SpotOccupancyStatus.FREE,
      };
    });

    return {
      generatedAt: now.toISOString(),
      totals: {
        total: views.length,
        occupied: views.filter((s) => s.status === SpotOccupancyStatus.OCCUPIED)
          .length,
        reserved: views.filter((s) => s.status === SpotOccupancyStatus.RESERVED)
          .length,
        free: views.filter((s) => s.status === SpotOccupancyStatus.FREE).length,
      },
      spots: views,
    };
  }
}
