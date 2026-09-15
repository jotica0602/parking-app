import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  licensePlate: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  color?: string;

  /** Admin only: assign the vehicle to another user. Clients are always the owner. */
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
