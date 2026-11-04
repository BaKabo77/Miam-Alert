import { Matches } from 'class-validator';
import { INVITATION_TOKEN_PATTERN } from '../invitation-token.js';

// Le jeton voyage dans le corps de la requête, jamais dans l'URL : il n'apparaît dans aucun
// journal d'accès.
export class InvitationTokenDto {
  @Matches(INVITATION_TOKEN_PATTERN)
  token: string;
}
