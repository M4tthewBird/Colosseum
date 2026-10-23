import { isNetworkError } from './errors';

describe('isNetworkError', () => {
  it('recognizes browser and React Native network failures', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new TypeError('Load failed'))).toBe(true);
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
    expect(isNetworkError(new Error('NetworkError when attempting to fetch resource.'))).toBe(true);
  });

  it('does not blame the network for server answers', () => {
    expect(
      isNetworkError(
        new Error('new row violates row-level security policy for table "forum_posts"'),
      ),
    ).toBe(false);
    expect(isNetworkError(new Error('value too long for type character varying(80)'))).toBe(false);
  });
});
