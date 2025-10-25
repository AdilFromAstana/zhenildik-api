import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';

function isPhone(str: string) {
  return str.startsWith('+');
}

function isEmail(str: string) {
  return str.includes('@');
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private repo: Repository<User>,
  ) {}

  async findByIdentifier(identifier: string): Promise<User | null> {
    if (isPhone(identifier)) {
      return this.repo.findOne({ where: { phone: identifier } });
    }
    if (isEmail(identifier)) {
      return this.repo.findOne({ where: { email: identifier } });
    }
    throw new BadRequestException('identifier должен быть email или телефоном');
  }

  async findById(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async createNewUnverifiedUser(opts: {
    identifier: string;
    password: string;
    name?: string;
  }) {
    const { identifier, password } = opts;

    const exists = await this.findByIdentifier(identifier);
    if (exists) {
      throw new ConflictException('Пользователь уже существует');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = this.repo.create({
      email: isEmail(identifier) ? identifier : null,
      phone: isPhone(identifier) ? identifier : null,
      passwordHash,
      isVerified: false,
      pendingOtpCode: null,
      pendingOtpExpiresAt: null,
    });

    return this.repo.save(user);
  }

  async setOtp(userId: number, code: string, expiresAt: Date) {
    await this.repo.update(userId, {
      pendingOtpCode: code,
      pendingOtpExpiresAt: expiresAt,
    });
  }

  async verifyAndActivate(userId: number) {
    await this.repo.update(userId, {
      isVerified: true,
      pendingOtpCode: null,
      pendingOtpExpiresAt: null,
    });
  }

  async updatePassword(userId: number, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.repo.update(userId, { passwordHash });
  }

  async getProfile(id: number) {
    const user = await this.repo.findOne({
      where: { id },
      select: ['id', 'email', 'phone'],
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    return user;
  }
}
