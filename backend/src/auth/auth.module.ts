import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EnvironmentVariables } from '../config/env.validation.js';
import { buildJwtOptions } from './jwt.config.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailVerificationService } from './email-verification.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, EmailVerificationService],
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        buildJwtOptions(config.get('JWT_SECRET', { infer: true })),
    }),
  ],
  exports: [JwtModule],
})
export class AuthModule {}
