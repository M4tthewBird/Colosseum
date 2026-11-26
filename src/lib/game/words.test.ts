import { gameWords } from './words';

describe('gameWords', () => {
  it('calls a ludus a clan in server messages', () => {
    expect(gameWords('Your ludus needs 3 members')).toBe('Your clan needs 3 members');
    expect(gameWords('Both ludi are at war')).toBe('Both clans are at war');
  });

  it('keeps capitals and apostrophes', () => {
    expect(gameWords('Ludus is full')).toBe('Clan is full');
    expect(gameWords('LUDUS')).toBe('CLAN');
    expect(gameWords('the ludus’s treasury')).toBe('the clan’s treasury');
    expect(gameWords("the ludus's treasury")).toBe("the clan's treasury");
  });

  it('leaves the other Latin names alone', () => {
    expect(gameWords('Not enough denarii, +25 laurels, +40 gloria')).toBe(
      'Not enough denarii, +25 laurels, +40 gloria',
    );
    expect(gameWords('Your tribe is at war, Bellum starts')).toBe(
      'Your tribe is at war, Bellum starts',
    );
    expect(gameWords('ludusville')).toBe('ludusville');
  });
});
