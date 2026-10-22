import { isValidEan } from './ean.js';

describe('isValidEan', () => {
  it.each(['3017620422003', '5449000000996', '96385074'])('accepts the valid code %s', (code) => {
    expect(isValidEan(code)).toBe(true);
  });

  it.each([
    ['a wrong check digit', '3017620422004'],
    ['a wrong check digit (EAN-8)', '12345678'],
    ['a 12-digit code', '301762042200'],
    ['letters', '30176204220AB'],
    ['an empty string', ''],
    ['a path traversal attempt', '../../admin'],
  ])('rejects %s', (_label, code) => {
    expect(isValidEan(code)).toBe(false);
  });
});
