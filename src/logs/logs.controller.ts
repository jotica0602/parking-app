import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { QueryLogsDto } from './dto/query-logs.dto';
import { LogsService } from './logs.service';

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  // Use case 4 from the spec: log access, admin only
  @Get()
  @Roles(UserRole.ADMIN)
  findAll(@Query() query: QueryLogsDto) {
    return this.logsService.findAll(query);
  }
}
