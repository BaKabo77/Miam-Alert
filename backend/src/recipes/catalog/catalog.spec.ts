import { normalizeName } from '../ingredient-matcher.js';
import { INGREDIENTS } from './ingredients.js';
import { RECIPES } from './recipes.js';

// Le catalogue est recopié en base au démarrage : une incohérence ici ferait échouer la
// synchronisation en production. Ces tests l'arrêtent dès la CI.
describe('Recipe catalog', () => {
  const ingredientKeys = new Set(INGREDIENTS.map(({ key }) => key));
  const staples = new Set(INGREDIENTS.filter(({ staple }) => staple).map(({ key }) => key));

  it('has unique ingredient keys, with the lengths allowed by the database', () => {
    expect(ingredientKeys.size).toBe(INGREDIENTS.length);
    for (const { key, name } of INGREDIENTS) {
      expect(key).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(key.length).toBeLessThanOrEqual(50);
      expect(name.length).toBeLessThanOrEqual(100);
    }
  });

  it('writes keywords in their normalized form, without duplicates across ingredients', () => {
    const seen = new Map<string, string>();
    for (const { key, keywords } of INGREDIENTS) {
      for (const keyword of keywords) {
        expect(normalizeName(keyword), `${key} : « ${keyword} »`).toBe(keyword);
        expect(seen.get(keyword), `« ${keyword} » est déjà un mot-clé de ${seen.get(keyword)}`).toBeUndefined();
        seen.set(keyword, key);
      }
    }
  });

  it('never maps an Open Food Facts category to two ingredients', () => {
    const seen = new Map<string, string>();
    for (const { key, offTags = [] } of INGREDIENTS) {
      for (const tag of offTags) {
        expect(tag).toMatch(/^en:[a-z0-9-]+$/);
        expect(seen.get(tag), `${tag} est déjà relié à ${seen.get(tag)}`).toBeUndefined();
        seen.set(tag, key);
      }
    }
  });

  it('has unique recipe slugs and fields within the database limits', () => {
    expect(new Set(RECIPES.map(({ slug }) => slug)).size).toBe(RECIPES.length);
    for (const recipe of RECIPES) {
      expect(recipe.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(recipe.slug.length).toBeLessThanOrEqual(100);
      expect(recipe.title.length).toBeLessThanOrEqual(150);
      expect(recipe.summary.length).toBeLessThanOrEqual(300);
      expect(recipe.servings).toBeGreaterThan(0);
      expect(recipe.prepMinutes).toBeGreaterThan(0);
      expect(recipe.cookMinutes).toBeGreaterThanOrEqual(0);
      expect(recipe.steps.length).toBeGreaterThan(0);
      for (const step of recipe.steps) {
        expect(step.length).toBeLessThanOrEqual(500);
      }
    }
  });

  it('only uses known ingredients, each once per recipe', () => {
    for (const recipe of RECIPES) {
      const keys = recipe.ingredients.map(({ key }) => key);
      expect(new Set(keys).size, recipe.slug).toBe(keys.length);
      for (const { key, quantity } of recipe.ingredients) {
        expect(ingredientKeys.has(key), `${recipe.slug} : ingrédient inconnu « ${key} »`).toBe(true);
        expect(quantity.length).toBeLessThanOrEqual(50);
      }
    }
  });

  // Une recette faite uniquement de basiques (sel, farine...) ne servirait jamais à sauver un produit.
  it('gives every recipe at least one real ingredient (not a staple, not optional)', () => {
    for (const recipe of RECIPES) {
      const required = recipe.ingredients.filter(({ key, optional }) => !optional && !staples.has(key));
      expect(required.length, recipe.slug).toBeGreaterThanOrEqual(1);
    }
  });
});
