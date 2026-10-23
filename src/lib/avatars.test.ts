import { AVATAR_TONES, emojiAvatar, hasPicture, isEmojiAvatar, parseEmojiAvatar } from './avatars';

describe('emoji avatars', () => {
  it('round-trips an emoji and a tone', () => {
    const url = emojiAvatar('🦁', '#DCE6F0');
    expect(url).toBe('emoji:🦁:#DCE6F0');
    expect(parseEmojiAvatar(url)).toEqual({ emoji: '🦁', tone: '#DCE6F0' });
  });

  it('keeps emoji made of several code points', () => {
    expect(parseEmojiAvatar(emojiAvatar('🏋️', '#ECE6DC'))?.emoji).toBe('🏋️');
  });

  it('falls back to the first tone when the tone is broken', () => {
    expect(parseEmojiAvatar('emoji:🔥:red')).toEqual({ emoji: '🔥', tone: AVATAR_TONES[0] });
  });

  it('treats photo URLs as photos', () => {
    const photo = 'https://x.supabase.co/storage/v1/object/public/avatars/u/a.jpg';
    expect(parseEmojiAvatar(photo)).toBeNull();
    expect(isEmojiAvatar(photo)).toBe(false);
    expect(hasPicture(photo)).toBe(true);
  });

  it('knows when nothing is chosen', () => {
    expect(hasPicture(null)).toBe(false);
    expect(hasPicture('')).toBe(false);
    expect(parseEmojiAvatar(null)).toBeNull();
  });
});
