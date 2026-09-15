import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSpotDto } from './dto/create-spot.dto';
import { UpdateSpotDto } from './dto/update-spot.dto';
import { ParkingSpot } from './parking-spot.entity';

@Injectable()
export class SpotsService {
  constructor(
    @InjectRepository(ParkingSpot)
    private readonly spotsRepository: Repository<ParkingSpot>,
  ) {}

  async create(dto: CreateSpotDto): Promise<ParkingSpot> {
    const existing = await this.spotsRepository.findOneBy({ code: dto.code });
    if (existing) {
      throw new ConflictException('A parking spot with that code already exists');
    }
    const spot = this.spotsRepository.create(dto);
    return this.spotsRepository.save(spot);
  }

  findAll(): Promise<ParkingSpot[]> {
    return this.spotsRepository.find({ order: { code: 'ASC' } });
  }

  async findById(id: string): Promise<ParkingSpot> {
    const spot = await this.spotsRepository.findOneBy({ id });
    if (!spot) {
      throw new NotFoundException('Parking spot not found');
    }
    return spot;
  }

  async update(id: string, dto: UpdateSpotDto): Promise<ParkingSpot> {
    const spot = await this.findById(id);

    if (dto.code && dto.code !== spot.code) {
      const existing = await this.spotsRepository.findOneBy({ code: dto.code });
      if (existing) {
        throw new ConflictException(
          'A parking spot with that code already exists',
        );
      }
    }

    const changes = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );
    Object.assign(spot, changes);
    return this.spotsRepository.save(spot);
  }

  async remove(id: string): Promise<void> {
    const spot = await this.findById(id);
    await this.spotsRepository.remove(spot);
  }
}
