import { suggestExpiry } from './shelf-life.js';

describe('suggestExpiry', () => {
  it('suggests a short DLC for fresh dairy products', () => {
    expect(suggestExpiry(['en:dairies', 'en:fermented-milk-products', 'en:yogurts'])).toEqual({
      days: 21,
      expiryType: 'DLC',
    });
  });

  it('suggests a DDM for shelf-stable groceries', () => {
    expect(suggestExpiry(['en:breakfasts', 'en:spreads', 'en:sweet-spreads'])).toEqual({
      days: 180,
      expiryType: 'DDM',
    });
  });

  it('prefers the storage method over the kind of food (canned fish, frozen meal)', () => {
    expect(suggestExpiry(['en:seafood', 'en:fishes', 'en:canned-foods'])).toEqual({ days: 730, expiryType: 'DDM' });
    expect(suggestExpiry(['en:meals', 'en:frozen-foods'])).toEqual({ days: 180, expiryType: 'DDM' });
  });

  it('prefers the most perishable match over a generic one', () => {
    // Un jus est aussi une boisson : la règle des jus (180 j) l'emporte, pas celle des boissons.
    expect(suggestExpiry(['en:beverages', 'en:fruit-juices'])).toEqual({ days: 180, expiryType: 'DDM' });
    // Un jambon est aussi une viande : la règle de la charcuterie (10 j) l'emporte sur la viande fraîche (3 j).
    expect(suggestExpiry(['en:meats', 'en:prepared-meats', 'en:hams'])).toEqual({ days: 10, expiryType: 'DLC' });
    expect(suggestExpiry(['en:meats', 'en:poultries'])).toEqual({ days: 3, expiryType: 'DLC' });
    expect(suggestExpiry(['en:seafood', 'en:fishes', 'en:smoked-fishes'])).toEqual({ days: 14, expiryType: 'DLC' });
  });

  it('returns null when no category is known', () => {
    expect(suggestExpiry([])).toBeNull();
    expect(suggestExpiry(['en:unknown-category'])).toBeNull();
  });
});
