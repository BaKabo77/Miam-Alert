import { Module } from '@nestjs/common';
import { HouseholdsModule } from '../households/households.module.js';
import { PantryController } from './pantry.controller.js';
import { PantryService } from './pantry.service.js';

@Module({
  // HouseholdsModule exporte HouseholdAccessService, dont PantryService a besoin.
  imports: [HouseholdsModule],
  controllers: [PantryController],
  providers: [PantryService],
})
export class PantryModule {}
