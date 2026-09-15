import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class CreateSessionDto {
  @IsUUID()
  vehicleId: string;

  @IsUUID()
  spotId: string;

  @IsOptional()
  @IsUUID()
  reservationId?: string;

  @IsOptional()
  @IsISO8601()
  enteredAt?: string;
}
