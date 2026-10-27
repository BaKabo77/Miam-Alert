// Les décorateurs de class-validator reposent sur reflect-metadata, chargé d'habitude par Nest.
import 'reflect-metadata';
import { validateEnv } from './env.validation.js';

const VALID = {
  NODE_ENV: 'production',
  PORT: '3000',
  DATABASE_URL: 'postgresql://user:pass@db:5432/app',
  JWT_SECRET: 'x'.repeat(48),
  CORS_ORIGINS: 'https://miam-alert.fr',
};

describe('validateEnv', () => {
  it('accepts a complete configuration, with optional values left out', () => {
    const env = validateEnv(VALID);
    expect(env.TRUST_PROXY).toBe(0);
    expect(env.ALERTS_HEALTHCHECK_URL).toBeUndefined();
  });

  it('treats an empty monitoring URL as not configured', () => {
    expect(validateEnv({ ...VALID, ALERTS_HEALTHCHECK_URL: '' }).ALERTS_HEALTHCHECK_URL).toBeUndefined();
  });

  it.each([
    ['a non-HTTPS monitoring URL', { ALERTS_HEALTHCHECK_URL: 'http://hc-ping.com/abc' }],
    ['a JWT secret shorter than 32 characters', { JWT_SECRET: 'too-short' }],
    ['a wildcard CORS origin', { CORS_ORIGINS: '*' }],
  ])('refuses to start with %s', (_case, override) => {
    expect(() => validateEnv({ ...VALID, ...override })).toThrow(/Invalid environment variables/);
  });

  it('never prints the value of a rejected variable (it could be a secret)', () => {
    const secret = 'short-secret-value';
    expect(() => validateEnv({ ...VALID, JWT_SECRET: secret })).toThrow(expect.not.objectContaining({ message: expect.stringContaining(secret) }));
  });
});
