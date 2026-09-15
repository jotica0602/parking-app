import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  AuthUser,
  CurrentUser,
} from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ReservationsService } from './reservations.service';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  create(
    @Body() dto: CreateReservationDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.reservationsService.create(dto, actor);
  }

  @Get()
  @Roles(UserRole.CLIENT, UserRole.EMPLOYEE, UserRole.ADMIN)
  findAll(@CurrentUser() actor: AuthUser) {
    return this.reservationsService.findAll(actor);
  }

  @Get(':id')
  @Roles(UserRole.CLIENT, UserRole.EMPLOYEE, UserRole.ADMIN)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.reservationsService.findByIdForActor(id, actor);
  }

  @Put(':id')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReservationDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.reservationsService.update(id, dto, actor);
  }

  @Post(':id/cancel')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.reservationsService.cancel(id, actor);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.reservationsService.remove(id, actor);
  }
}
