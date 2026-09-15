import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { SpotType } from '../../common/enums';

export class CreateSpotDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  floor?: number;

  @IsOptional()
  @IsEnum(SpotType)
  type?: SpotType;
}
