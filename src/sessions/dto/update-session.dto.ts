import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class UpdateSessionDto {
  @IsOptional()
  @IsUUID()
  spotId?: string;

  @IsOptional()
  @IsUUID()
  reservationId?: string;

  @IsOptional()
  @IsISO8601()
  enteredAt?: string;

  @IsOptional()
  @IsISO8601()
  exitedAt?: string;
}
