import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { OccupancyService } from './occupancy.service';

@Controller('occupancy')
export class OccupancyController {
  constructor(private readonly occupancyService: OccupancyService) {}

  @Get()
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  getCurrent() {
    return this.occupancyService.getCurrentOccupancy();
  }
}
