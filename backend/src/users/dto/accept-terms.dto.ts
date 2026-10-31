import { Equals } from 'class-validator';
import { TERMS_VERSION } from '../terms.js';

export class AcceptTermsDto {
  // Version affichée à l'utilisateur : refusée (400) si ce n'est plus celle en vigueur, par
  // exemple depuis une ancienne version de l'application restée en cache.
  @Equals(TERMS_VERSION, { message: 'version must be the current version of the terms' })
  version: string;
}
