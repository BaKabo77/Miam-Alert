import { Matches } from 'class-validator';
import { EMAIL_TOKEN_PATTERN } from '../email-verification.service.js';

export class VerifyEmailDto {
  // Format exact d'un jeton émis par l'API : tout autre contenu est rejeté avant la base.
  @Matches(EMAIL_TOKEN_PATTERN)
  token: string;
}
