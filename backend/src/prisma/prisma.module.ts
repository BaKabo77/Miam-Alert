import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

// @Global : PrismaService est injectable partout sans réimporter ce module dans chaque
// module métier. Une seule instance, donc un seul pool de connexions.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
