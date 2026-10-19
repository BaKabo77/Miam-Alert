import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/setup/global-setup.ts'],
    // Pendant les tests, l'application utilise la base de test à la place de la base de dev.
    env: process.env.DATABASE_URL_TEST ? { DATABASE_URL: process.env.DATABASE_URL_TEST } : {},
    // Les fichiers de test partagent la même base : on les exécute l'un après l'autre
    // pour qu'un test ne vide pas les tables pendant qu'un autre les utilise.
    fileParallelism: false,
  },
});
