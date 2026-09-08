import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { LogAction } from '../../common/enums';

export class QueryLogsDto {
  @IsOptional()
  @IsEnum(LogAction)
  action?: LogAction;

  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
