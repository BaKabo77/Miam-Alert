import { toProductData } from './open-food-facts.mapper.js';

const BARCODE = '3017620422003';

// Réponse réelle d'Open Food Facts pour ce produit (champs demandés uniquement).
const nutella = {
  product_name: 'Nutella',
  product_name_fr: 'Nutella',
  brands: 'Nutella, Ferrero',
  image_front_url: 'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.879.400.jpg',
  categories_tags: ['en:Petit-déjeuners', 'en:breakfasts', 'en:spreads'],
  nutriscore_grade: 'e',
};

describe('toProductData', () => {
  it('maps and cleans a real product', () => {
    expect(toProductData(BARCODE, nutella)).toEqual({
      barcode: BARCODE,
      name: 'Nutella',
      brand: 'Nutella',
      imageUrl: nutella.image_front_url,
      category: 'en:breakfasts',
      // "en:Petit-déjeuners" est mal formé (majuscule, accent) : écarté.
      categories: ['en:breakfasts', 'en:spreads'],
      nutriscore: 'E',
    });
  });

  it('keeps a bounded list of well-formed, unique category tags', () => {
    const tags = ['en:spreads', 'en:spreads', '<script>', 42, `en:${'x'.repeat(200)}`, ...Array.from({ length: 50 }, (_, i) => `en:tag-${i}`)];
    const categories = toProductData(BARCODE, { ...nutella, categories_tags: tags })?.categories ?? [];

    expect(categories[0]).toBe('en:spreads');
    expect(new Set(categories).size).toBe(categories.length);
    expect(categories).toHaveLength(30);
    expect(categories.every((tag) => /^en:[a-z0-9-]+$/.test(tag) && tag.length <= 100)).toBe(true);
  });

  it('returns null when the product has no usable name', () => {
    expect(toProductData(BARCODE, { ...nutella, product_name: '  ', product_name_fr: undefined })).toBeNull();
  });

  it.each([null, 'a string', 42, ['an', 'array']])('returns null for a non-object payload (%s)', (raw) => {
    expect(toProductData(BARCODE, raw)).toBeNull();
  });

  it('removes control characters and bounds the length of texts', () => {
    const product = toProductData(BARCODE, {
      product_name: `Lait\u0000\u001b[31m ${'x'.repeat(500)}`,
    });

    expect(product?.name).not.toMatch(/\p{Cc}/u);
    expect(product?.name.length).toBe(200);
  });

  it.each([
    ['an http image', 'http://images.openfoodfacts.org/a.jpg'],
    ['an image from another domain', 'https://evil.example/a.jpg'],
    ['a look-alike domain', 'https://images.openfoodfacts.org.evil.example/a.jpg'],
    ['a javascript url', 'javascript:alert(1)'],
    ['a non-string value', { url: 'https://images.openfoodfacts.org/a.jpg' }],
  ])('drops %s', (_label, imageUrl) => {
    expect(toProductData(BARCODE, { ...nutella, image_front_url: imageUrl })?.imageUrl).toBeNull();
  });

  it('drops an unknown nutriscore', () => {
    expect(toProductData(BARCODE, { ...nutella, nutriscore_grade: 'unknown' })?.nutriscore).toBeNull();
  });

  it('drops fields of the wrong type instead of storing them', () => {
    const product = toProductData(BARCODE, {
      product_name: 'Lait',
      brands: ['not', 'a', 'string'],
      categories_tags: 'en:dairies',
      nutriscore_grade: 3,
    });

    expect(product).toEqual({
      barcode: BARCODE,
      name: 'Lait',
      brand: null,
      imageUrl: null,
      category: null,
      categories: [],
      nutriscore: null,
    });
  });
});
