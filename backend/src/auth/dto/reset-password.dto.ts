import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { EMAIL_TOKEN_PATTERN } from '../email-tokens.js';

export class ResetPasswordDto {
  @Matches(EMAIL_TOKEN_PATTERN)
  token: string;

  // Mêmes règles qu'à l'inscription.
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword: string;
}
