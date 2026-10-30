import { matchIngredient, normalizeName } from './ingredient-matcher.js';

describe('normalizeName', () => {
  it('lowercases, removes accents and ligatures, and keeps only words', () => {
    expect(normalizeName('Œufs frais (x6)')).toBe('oeufs frais x6');
    expect(normalizeName('Crème fraîche épaisse 30%')).toBe('creme fraiche epaisse 30');
    expect(normalizeName("Huile d'olive")).toBe('huile d olive');
  });
});

describe('matchIngredient', () => {
  it('recognizes a scanned product by its most precise Open Food Facts category', () => {
    expect(matchIngredient({ name: 'Danone', categories: ['en:dairies', 'en:fermented-milk-products', 'en:yogurts'] })).toBe('yogurt');
    // Un jambon est aussi une viande : la catégorie la plus précise l'emporte.
    expect(matchIngredient({ name: 'Herta', categories: ['en:meats', 'en:prepared-meats', 'en:hams'] })).toBe('ham');
    // Le fromage râpé est aussi un fromage.
    expect(matchIngredient({ name: 'Emmental', categories: ['en:dairies', 'en:cheeses', 'en:grated-cheeses'] })).toBe('grated-cheese');
  });

  it('falls back to the name when no category is known', () => {
    expect(matchIngredient({ name: 'Marque X', categories: ['en:unknown-things'] })).toBeNull();
    expect(matchIngredient({ name: 'Yaourt nature', categories: ['en:unknown-things'] })).toBe('yogurt');
  });

  it('recognizes manually typed names, whatever the case, accents and plural', () => {
    expect(matchIngredient({ name: 'Œufs bio' })).toBe('egg');
    expect(matchIngredient({ name: 'oeuf' })).toBe('egg');
    expect(matchIngredient({ name: 'Courgettes' })).toBe('zucchini');
    expect(matchIngredient({ name: 'Crème fraîche' })).toBe('cream');
    expect(matchIngredient({ name: 'Épinards frais' })).toBe('spinach');
  });

  it('prefers the longest keyword when several match', () => {
    expect(matchIngredient({ name: 'Pommes de terre' })).toBe('potato');
    expect(matchIngredient({ name: 'Pommes Golden' })).toBe('apple');
    expect(matchIngredient({ name: 'Lait de coco' })).toBe('coconut-milk');
    expect(matchIngredient({ name: 'Lait demi-écrémé' })).toBe('milk');
    expect(matchIngredient({ name: 'Fromage blanc' })).toBe('fromage-blanc');
    expect(matchIngredient({ name: 'Pain de mie' })).toBe('sandwich-bread');
    expect(matchIngredient({ name: 'Sauce tomate' })).toBe('tomato-sauce');
    expect(matchIngredient({ name: 'Coulis de framboise' })).toBe('red-fruits');
  });

  it('only matches whole words', () => {
    // « pain » ne doit pas reconnaître « painvin », ni « sel » « vaisselle ».
    expect(matchIngredient({ name: 'Painvin' })).toBeNull();
    expect(matchIngredient({ name: 'Liquide vaisselle' })).toBeNull();
    // « pâte à tartiner » n'est pas des pâtes.
    expect(matchIngredient({ name: 'Pâte à tartiner' })).toBeNull();
  });

  it('returns null for an unknown item', () => {
    expect(matchIngredient({ name: 'Croquettes pour chat' })).toBeNull();
    expect(matchIngredient({ name: '' })).toBeNull();
  });
});
