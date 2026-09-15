import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class CreateReservationDto {
  @IsUUID()
  vehicleId: string;

  @IsOptional()
  @IsUUID()
  spotId?: string;

  @IsISO8601()
  startAt: string;

  @IsISO8601()
  endAt: string;
}
