import { Module } from '@nestjs/common';
import { HouseholdsModule } from '../households/households.module.js';
import { PantryController } from './pantry.controller.js';
import { PantryService } from './pantry.service.js';
import { PantryItemController } from './pantry-item.controller.js';

@Module({
  // HouseholdsModule exporte HouseholdAccessService, dont PantryService a besoin.
  imports: [HouseholdsModule],
  controllers: [PantryController,PantryItemController],
  providers: [PantryService],
})
export class PantryModule {}
