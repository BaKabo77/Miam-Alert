-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "categories" VARCHAR(100)[] DEFAULT ARRAY[]::VARCHAR(100)[];

-- Produits déjà en cache : leur seule catégorie connue devient le début de la liste
-- (la suggestion de date fonctionnera pour les catégories générales ; la liste complète
-- sera disponible pour les produits récupérés à partir de maintenant).
UPDATE "Product" SET "categories" = ARRAY["category"] WHERE "category" IS NOT NULL;
