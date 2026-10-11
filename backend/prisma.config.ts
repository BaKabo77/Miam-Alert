import { defineConfig, env } from 'prisma/config';

// DATABASE_URL est injectée par Docker Compose (env_file), pas de dotenv.
// env() échoue immédiatement si la variable manque, au lieu de continuer avec undefined.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
