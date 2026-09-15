import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { Vehicle } from './vehicle.entity';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehiclesRepository: Repository<Vehicle>,
  ) {}

  async create(dto: CreateVehicleDto, actor: AuthUser): Promise<Vehicle> {
    const ownerId =
      actor.role === UserRole.ADMIN && dto.ownerId
        ? dto.ownerId
        : actor.userId;

    const existing = await this.vehiclesRepository.findOneBy({
      licensePlate: dto.licensePlate,
    });
    if (existing) {
      throw new ConflictException('A vehicle with that license plate already exists');
    }

    const vehicle = this.vehiclesRepository.create({
      licensePlate: dto.licensePlate,
      brand: dto.brand,
      model: dto.model,
      color: dto.color,
      ownerId,
    });
    return this.vehiclesRepository.save(vehicle);
  }

  findAll(actor: AuthUser): Promise<Vehicle[]> {
    if (actor.role === UserRole.ADMIN) {
      return this.vehiclesRepository.find();
    }
    return this.vehiclesRepository.find({ where: { ownerId: actor.userId } });
  }

  async findById(id: string): Promise<Vehicle> {
    const vehicle = await this.vehiclesRepository.findOneBy({ id });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    return vehicle;
  }

  async findByIdForActor(id: string, actor: AuthUser): Promise<Vehicle> {
    const vehicle = await this.findById(id);
    this.assertCanAccess(vehicle, actor);
    return vehicle;
  }

  async update(
    id: string,
    dto: UpdateVehicleDto,
    actor: AuthUser,
  ): Promise<Vehicle> {
    const vehicle = await this.findByIdForActor(id, actor);

    if (dto.licensePlate && dto.licensePlate !== vehicle.licensePlate) {
      const existing = await this.vehiclesRepository.findOneBy({
        licensePlate: dto.licensePlate,
      });
      if (existing) {
        throw new ConflictException(
          'A vehicle with that license plate already exists',
        );
      }
    }

    const changes = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );
    Object.assign(vehicle, changes);
    return this.vehiclesRepository.save(vehicle);
  }

  async remove(id: string, actor: AuthUser): Promise<void> {
    const vehicle = await this.findByIdForActor(id, actor);
    await this.vehiclesRepository.remove(vehicle);
  }

  private assertCanAccess(vehicle: Vehicle, actor: AuthUser): void {
    if (actor.role === UserRole.ADMIN) {
      return;
    }
    if (vehicle.ownerId !== actor.userId) {
      throw new ForbiddenException('You can only manage your own vehicles');
    }
  }
}
