import { needsAlert, summarizeForAlert } from './alert-summary.js';

const today = new Date('2026-10-26T00:00:00.000Z');
const inDays = (days: number) => new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

describe('summarizeForAlert', () => {
  it('counts expired DLC items and urgent items separately', () => {
    const summary = summarizeForAlert(
      [
        { expiryDate: inDays(-2), expiryType: 'DLC' }, // périmé
        { expiryDate: inDays(0), expiryType: 'DLC' }, // aujourd'hui → urgent
        { expiryDate: inDays(2), expiryType: 'DDM' }, // dans 2 jours → urgent
        { expiryDate: inDays(-5), expiryType: 'DDM' }, // DDM dépassée → urgent, pas périmé
        { expiryDate: inDays(5), expiryType: 'DLC' }, // cette semaine → pas d'alerte
        { expiryDate: inDays(90), expiryType: 'DDM' }, // OK → pas d'alerte
      ],
      today,
    );

    expect(summary).toEqual({ expiredCount: 1, urgentCount: 3 });
  });

  it('returns zero counts for an empty inventory', () => {
    expect(summarizeForAlert([], today)).toEqual({ expiredCount: 0, urgentCount: 0 });
  });
});

describe('needsAlert', () => {
  it('is false when nothing is expired or urgent', () => {
    expect(needsAlert({ expiredCount: 0, urgentCount: 0 })).toBe(false);
  });

  it('is true as soon as one item needs attention', () => {
    expect(needsAlert({ expiredCount: 0, urgentCount: 1 })).toBe(true);
    expect(needsAlert({ expiredCount: 1, urgentCount: 0 })).toBe(true);
  });
});
