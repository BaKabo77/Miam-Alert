import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UserResponse } from './auth.types.js';
import { RegisterDto } from './dto/register.dto.js';
import { hashPassword } from './password.js';

const DEFAULT_HOUSEHOLD_NAME = 'Mon foyer';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto): Promise<UserResponse> {
    const passwordHash = await hashPassword(dto.password);

    try {

      return await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          memberships: {
            create: { role: 'OWNER', household: { create: { name: DEFAULT_HOUSEHOLD_NAME } } },
          },
        },
        select: { id: true, email: true },
      });
    } catch (error) {

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }
}
