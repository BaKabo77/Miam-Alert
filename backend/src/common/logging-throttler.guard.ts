import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Request } from 'express';
import { SecurityLogger } from './security-logger.js';

// Même comportement que le ThrottlerGuard standard, avec en plus une trace de chaque
// dépassement : une rafale de 429 sur /auth/login est le signe d'une attaque par force brute.
@Injectable()
export class LoggingThrottlerGuard extends ThrottlerGuard {
  private readonly security = new SecurityLogger();

  protected override async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest<Request>();
    this.security.warn('rate_limit.exceeded', { ip: request.ip, path: request.path });
    return super.throwThrottlingException(context, throttlerLimitDetail);
  }
}