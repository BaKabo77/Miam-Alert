import { execSync } from 'node:child_process';
import { assertTestDatabase } from './test-database.js';

// Exécuté une seule fois avant tous les tests e2e : crée la base de test si besoin
// et lui applique les migrations, pour qu'elle ait toujours le même schéma que le code.
export default function setup(): void {
  const url = assertTestDatabase(process.env.DATABASE_URL_TEST);

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
