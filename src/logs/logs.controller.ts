import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { QueryLogsDto } from './dto/query-logs.dto';
import { LogsService } from './logs.service';

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  /** Caso de uso 4 del enunciado: acceso a logs, solo admin. */
  @Get()
  @Roles(UserRole.ADMIN)
  findAll(@Query() query: QueryLogsDto) {
    return this.logsService.findAll(query);
  }
}
