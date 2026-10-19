import { PrismaService } from '../../src/prisma/prisma.service.js';
import { assertTestDatabase } from './test-database.js';

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  assertTestDatabase(process.env.DATABASE_URL);

  await prisma.$transaction([
    prisma.pantryItem.deleteMany(),
    prisma.householdMember.deleteMany(),
    prisma.household.deleteMany(),
    prisma.product.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}