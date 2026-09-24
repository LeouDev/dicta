import {
  normalizeUsername,
  suggestUsername,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateUsername,
} from '../validation';

describe('normalizeUsername', () => {
  it('lowercases, strips @ and invalid characters', () => {
    expect(normalizeUsername('  @Leou.Dev!  ')).toBe('leou.dev');
    expect(normalizeUsername('Hello World')).toBe('helloworld');
  });

  it('caps length at 30', () => {
    expect(normalizeUsername('a'.repeat(40))).toHaveLength(30);
  });
});

describe('validateUsername', () => {
  it.each(['leou', 'galileo_uuu', 'a.b_c9'])('accepts %s', (u) => {
    expect(validateUsername(u)).toBeNull();
  });

  it.each([
    ['ab', /at least/i],
    ['has space', /letters, numbers/i],
    ['.leading', /start or end/i],
    ['trailing_', /start or end/i],
    ['two..dots', /two periods/i],
    ['UPPER', /letters, numbers/i],
  ])('rejects %s', (u, message) => {
    expect(validateUsername(u)).toMatch(message);
  });
});

describe('validateEmail', () => {
  it('accepts a normal address and trims', () => {
    expect(validateEmail(' me@example.com ')).toBeNull();
  });

  it.each(['', 'me@', 'me@example', 'me example.com'])('rejects %p', (e) => {
    expect(validateEmail(e)).not.toBeNull();
  });
});

describe('validatePassword', () => {
  it('requires 8 characters', () => {
    expect(validatePassword('1234567')).not.toBeNull();
    expect(validatePassword('12345678')).toBeNull();
  });
});

describe('validateDisplayName', () => {
  it('requires non-blank names up to 50 characters', () => {
    expect(validateDisplayName('   ')).not.toBeNull();
    expect(validateDisplayName('Leou')).toBeNull();
    expect(validateDisplayName('x'.repeat(51))).not.toBeNull();
  });
});

describe('suggestUsername', () => {
  it('derives from a display name or email', () => {
    expect(suggestUsername('Mara Vell')).toBe('maravell');
    expect(suggestUsername('mara.vell@example.com')).toBe('mara.vell');
    expect(suggestUsername('_x_')).toBe('x');
  });
});
