import { PrismaService } from '../../src/prisma/prisma.service.js';
import { assertTestDatabase } from './test-database.js';

// Vide toutes les tables entre deux tests, pour que chaque test parte d'une base propre.
// Ordre : les tables qui dépendent des autres d'abord (clés étrangères).
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  assertTestDatabase(process.env.DATABASE_URL);

  await prisma.$transaction([
    prisma.refreshToken.deleteMany(),
    prisma.pantryItem.deleteMany(),
    prisma.householdMember.deleteMany(),
    prisma.household.deleteMany(),
    prisma.product.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}