import { memberDisplayName } from './member-name.js';

describe('memberDisplayName', () => {
  const email = 'marie@example.test';

  it('uses the first and last names when both are set', () => {
    expect(memberDisplayName({ firstName: 'Marie', lastName: 'Curie', email })).toBe('Marie Curie');
  });

  it('uses whichever name is set', () => {
    expect(memberDisplayName({ firstName: 'Marie', lastName: null, email })).toBe('Marie');
    expect(memberDisplayName({ firstName: null, lastName: 'Curie', email })).toBe('Curie');
  });

  it('falls back to the email only when no name is set', () => {
    expect(memberDisplayName({ firstName: null, lastName: null, email })).toBe(email);
  });
});
