import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { LogAction, UserRole } from '../common/enums';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { LogsService } from '../logs/logs.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly logsService: LogsService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepository.findOneBy({
      email: dto.email,
    });
    if (existing) {
      throw new ConflictException('A user with that email already exists');
    }

    const user = this.usersRepository.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      role: dto.role ?? UserRole.CLIENT,
      passwordHash: await bcrypt.hash(dto.password, 10),
    });
    return this.usersRepository.save(user);
  }

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: AuthUser,
  ): Promise<User> {
    const user = await this.findById(id);

    if (dto.email && dto.email !== user.email) {
      const existing = await this.usersRepository.findOneBy({
        email: dto.email,
      });
      if (existing) {
        throw new ConflictException('A user with that email already exists');
      }
    }

    // Only the actually sent fields (the optional ones come as undefined)
    const { password, ...rest } = dto;
    const changes = Object.fromEntries(
      Object.entries(rest).filter(([, value]) => value !== undefined),
    );
    Object.assign(user, changes);
    if (password) {
      user.passwordHash = await bcrypt.hash(password, 10);
    }
    const saved = await this.usersRepository.save(user);

    const updatedFields = Object.keys(changes);
    if (password) {
      
      updatedFields.push('password');
    }
    await this.logsService.record({
      action: LogAction.USER_UPDATED,
      actorId: actor.userId,
      actorRole: actor.role,
      entityType: 'user',
      entityId: saved.id,
      payload: { updatedFields },
    });

    return saved;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.usersRepository.remove(user);
  }
}
