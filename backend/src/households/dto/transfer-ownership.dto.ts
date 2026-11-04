import { IsUUID } from 'class-validator';

export class TransferOwnershipDto {
  // Membre du foyer qui devient propriétaire (vérifié par le service).
  @IsUUID()
  userId: string;
}
