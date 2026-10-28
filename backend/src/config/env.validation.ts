import { plainToInstance, Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number;

  @Matches(/^postgres(ql)?:\/\//)
  DATABASE_URL: string;

  // 32 caractères minimum : un secret court se casse par force brute hors ligne
  // (il suffit d'un seul token intercepté pour tester des secrets).
  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  // Liste blanche d'origines CORS. @IsUrl rejette "*", qui ouvrirait l'API à tous les sites.
  @Transform(({ value }: { value: string }) =>
    value.split(',').map((origin) => origin.trim()),
  )
  @IsUrl(
    { require_tld: false, require_protocol: true, protocols: ['http', 'https'] },
    { each: true },
  )
  CORS_ORIGINS: string[];

  // Nombre de reverse proxys devant l'API (1 en production derrière Caddy, 0 en dev).
  // Facultatif : sans proxy, X-Forwarded-For est ignoré (voir common/trust-proxy.ts).
  @IsInt()
  @Min(0)
  @Max(3)
  TRUST_PROXY: number = 0;

  // Facultatif : adresse de surveillance prévenue après la tâche des alertes de 9 h (healthchecks.io).
  // HTTPS uniquement. Une valeur vide (variable présente mais non renseignée) équivaut à l'absence.
  @Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  ALERTS_HEALTHCHECK_URL?: string;

  // Adresse publique du front : sert à construire les liens envoyés par email.
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ['http', 'https'] })
  APP_URL: string;

  // Serveur d'envoi d'emails (Mailpit en développement, Brevo en production).
  @IsString()
  SMTP_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT: number;

  // Facultatifs : Mailpit n'exige pas d'identifiants, Brevo si.
  @Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  SMTP_PASSWORD?: string;

  // Adresse d'expédition (domaine dont les enregistrements SPF/DKIM autorisent l'envoi).
  @IsEmail()
  MAIL_FROM: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(env, { skipMissingProperties: false });

  if (errors.length > 0) {
    // On affiche le nom de la variable et la règle non respectée, jamais la valeur :
    // ce pourrait être un secret, qui finirait alors dans les logs.
    const details = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('; ');
    throw new Error(`Invalid environment variables: ${details}`);
  }

  return env;
}
