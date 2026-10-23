import { qrPath } from './qr';

describe('qrPath', () => {
  it('encodes a friend link', () => {
    const { size, path } = qrPath('https://m4tthewbird.github.io/Colosseum/add/matyas');
    // Version 4 (33×33) or close; always odd, at least 21.
    expect(size).toBeGreaterThanOrEqual(21);
    expect(size % 2).toBe(1);
    expect(path.startsWith('M0 0h7v1h-7z')).toBe(true); // top row of the top-left finder
  });

  it('is the same for the same text', () => {
    expect(qrPath('abc').path).toBe(qrPath('abc').path);
    expect(qrPath('abc').path).not.toBe(qrPath('abd').path);
  });
});
