-- AlterTable
ALTER TABLE "PantryItem" ADD COLUMN     "ingredientKey" VARCHAR(50);

-- CreateTable
CREATE TABLE "Ingredient" (
    "key" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "isStaple" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "servings" INTEGER NOT NULL,
    "prepMinutes" INTEGER NOT NULL,
    "cookMinutes" INTEGER NOT NULL,
    "vegetarian" BOOLEAN NOT NULL,
    "steps" VARCHAR(500)[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "recipeId" UUID NOT NULL,
    "ingredientKey" VARCHAR(50) NOT NULL,
    "quantity" VARCHAR(50) NOT NULL,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("recipeId","ingredientKey")
);

-- CreateTable
CREATE TABLE "CatalogVersion" (
    "name" VARCHAR(50) NOT NULL,
    "hash" CHAR(64) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogVersion_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_slug_key" ON "Recipe"("slug");

-- CreateIndex
CREATE INDEX "RecipeIngredient_ingredientKey_idx" ON "RecipeIngredient"("ingredientKey");

-- AddForeignKey
ALTER TABLE "PantryItem" ADD CONSTRAINT "PantryItem_ingredientKey_fkey" FOREIGN KEY ("ingredientKey") REFERENCES "Ingredient"("key") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_ingredientKey_fkey" FOREIGN KEY ("ingredientKey") REFERENCES "Ingredient"("key") ON DELETE CASCADE ON UPDATE CASCADE;
