import { defineConfig } from 'vitest/config';

// Pendant les tests, l'application utilise la base de test à la place de la base de dev.
// DATABASE_URL_TEST_APP (facultative, fournie par la CI) : l'application s'y connecte avec le
// rôle limité de la production (miam_app), les migrations gardant DATABASE_URL_TEST.
const testDatabaseUrl =
  process.env.DATABASE_URL_TEST_APP || process.env.DATABASE_URL_TEST;

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/setup/global-setup.ts'],
    env: testDatabaseUrl ? { DATABASE_URL: testDatabaseUrl } : {},
    // Les fichiers de test partagent la même base : on les exécute l'un après l'autre
    // pour qu'un test ne vide pas les tables pendant qu'un autre les utilise.
    fileParallelism: false,
  },
});
