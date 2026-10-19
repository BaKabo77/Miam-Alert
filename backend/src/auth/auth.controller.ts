import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AUTH_THROTTLE } from '../common/throttling.js';
import { AuthService } from './auth.service.js';
import type { UserResponse } from './auth.types.js';
import { RegisterDto } from './dto/register.dto.js';
import { Public } from './public.decorator.js';

@Controller('auth')
@Throttle(AUTH_THROTTLE)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<UserResponse> {
    return this.auth.register(dto);
  }
}
