import { createHash, randomBytes } from 'node:crypto';
import type { EmailTokenPurpose, Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

// Jetons envoyés par email (vérification de l'adresse, réinitialisation du mot de passe).
// Mêmes garanties pour tous : 32 octets aléatoires, seule l'empreinte SHA-256 en base,
// durée de vie courte, usage unique, un seul jeton valable à la fois par usage.

// Format exact d'un jeton émis ici : tout autre contenu est rejeté avant d'interroger la base.
export const EMAIL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function hashEmailToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Crée un jeton et annule ceux du même usage encore valables : seul le dernier email reçu fonctionne.
// Renvoie null si un jeton a déjà été émis il y a moins de `cooldownMs` (limite d'envoi).
// La ligne du compte est verrouillée (FOR UPDATE) pendant la transaction : deux demandes
// simultanées passent l'une après l'autre. Sans ce verrou, toutes deux liraient « dernier envoi
// il y a plus d'une minute » et enverraient chacune un email : la limite serait contournable en
// envoyant les requêtes en parallèle.
export async function issueEmailToken(
  prisma: PrismaService,
  userId: string,
  purpose: EmailTokenPurpose,
  ttlMs: number,
  cooldownMs = 0,
): Promise<string | null> {
  const token = randomBytes(32).toString('base64url');

  return prisma.$transaction(async (tx) => {
    // Requête paramétrée ($queryRaw et non $queryRawUnsafe) : aucune injection SQL possible.
    await tx.$queryRaw`SELECT 1 FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;

    const now = new Date();
    const last = await tx.emailToken.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (last && now.getTime() - last.createdAt.getTime() < cooldownMs) {
      return null;
    }

    await tx.emailToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: now } });
    await tx.emailToken.create({
      data: { userId, purpose, tokenHash: hashEmailToken(token), createdAt: now, expiresAt: new Date(now.getTime() + ttlMs) },
    });
    return token;
  });
}

// Consomme un jeton à l'intérieur d'une transaction : renvoie l'utilisateur concerné, ou null si le
// jeton est inconnu, d'un autre usage, expiré ou déjà utilisé (tous ces cas sont indiscernables
// pour l'appelant). La condition "usedAt: null" garantit qu'un même lien ouvert deux fois en même
// temps ne sert qu'une fois.
export async function consumeEmailToken(
  tx: Prisma.TransactionClient,
  token: string,
  purpose: EmailTokenPurpose,
): Promise<string | null> {
  const stored = await tx.emailToken.findUnique({
    where: { tokenHash: hashEmailToken(token) },
    select: { id: true, userId: true, purpose: true, expiresAt: true, usedAt: true },
  });
  if (!stored || stored.purpose !== purpose || stored.usedAt || stored.expiresAt <= new Date()) {
    return null;
  }
  const { count } = await tx.emailToken.updateMany({
    where: { id: stored.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1 ? stored.userId : null;
}
