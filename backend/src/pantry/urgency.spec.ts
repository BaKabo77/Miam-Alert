import { computeUrgency, daysUntil } from './urgency.js';

const today = new Date('2026-10-20T00:00:00.000Z');
const inDays = (days: number) => new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

describe('daysUntil', () => {
  it('counts whole days, negative when the date is past', () => {
    expect(daysUntil(inDays(0), today)).toBe(0);
    expect(daysUntil(inDays(3), today)).toBe(3);
    expect(daysUntil(inDays(-1), today)).toBe(-1);
  });
});

describe('computeUrgency', () => {
  it('marks a past DLC as expired', () => {
    expect(computeUrgency(inDays(-1), 'DLC', today)).toBe('EXPIRED');
  });

  it('marks a past DDM as past best before, not expired', () => {
    expect(computeUrgency(inDays(-1), 'DDM', today)).toBe('PAST_BEST_BEFORE');
  });

  it('is urgent from today up to 2 days', () => {
    expect(computeUrgency(inDays(0), 'DLC', today)).toBe('URGENT');
    expect(computeUrgency(inDays(2), 'DDM', today)).toBe('URGENT');
  });

  it('is soon from 3 to 7 days', () => {
    expect(computeUrgency(inDays(3), 'DLC', today)).toBe('SOON');
    expect(computeUrgency(inDays(7), 'DLC', today)).toBe('SOON');
  });

  it('is ok beyond 7 days', () => {
    expect(computeUrgency(inDays(8), 'DLC', today)).toBe('OK');
  });
});
