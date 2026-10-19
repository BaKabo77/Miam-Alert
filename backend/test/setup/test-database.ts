// Garde-fou : les tests e2e vident les tables. Ils refusent de tourner sur une base
// dont le nom ne se termine pas par "_test", pour ne jamais effacer la base de dev ou de prod.
export function assertTestDatabase(url: string | undefined): string {
  if (!url) {
    throw new Error('DATABASE_URL_TEST is not set');
  }

  const databaseName = new URL(url).pathname.slice(1);
  if (!databaseName.endsWith('_test')) {
    throw new Error(`Refusing to run e2e tests on database "${databaseName}"`);
  }

  return url;
}
