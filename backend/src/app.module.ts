import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AlertsModule } from './alerts/alerts.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { throttlerOptions } from './common/throttling.js';
import { createValidationPipe } from './common/validation.js';
import { validateEnv } from './config/env.validation.js';
import { HealthController } from './health/health.controller.js';
import { MailModule } from './mail/mail.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { LoggingThrottlerGuard } from './common/logging-throttler.guard.js';
import { UsersModule } from './users/users.module.js';
import { PantryModule } from './pantry/pantry.module.js';
import { ProductsModule } from './products/products.module.js';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      ignoreEnvFile: true,
      cache: true,
    }),
    ThrottlerModule.forRoot(throttlerOptions),
    // Active les tâches planifiées (@Cron) de l'application.
    ScheduleModule.forRoot(),
    PrismaModule,
    MailModule,
    UsersModule,
    AuthModule,
    ProductsModule,
    AlertsModule,
    PantryModule
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: LoggingThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
