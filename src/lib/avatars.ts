/**
 * Profile pictures without a photo: an emoji on a soft tone, stored in profiles.avatar_url as
 * "emoji:<emoji>:<tone>" so no schema change is needed. Avatar renders it. Pure — covered by
 * avatars.test.ts.
 */

export const AVATAR_EMOJIS = [
  '🏋️',
  '💪',
  '🦁',
  '🐺',
  '🦅',
  '🐂',
  '🐻',
  '🦍',
  '🔥',
  '⚡',
  '🏛️',
  '⚔️',
  '🛡️',
  '🏆',
  '👑',
  '🦾',
  '🥇',
  '🏃',
  '🚴',
  '🧘',
  '🥊',
  '🐉',
  '🌋',
  '⭐',
] as const;

/** Soft backgrounds: marble, stone, sky, sage, rose, lavender. */
export const AVATAR_TONES = ['#ECE6DC', '#E2E2E6', '#DCE6F0', '#DDEADF', '#F3E0DE', '#E7DFEE'];

const PREFIX = 'emoji:';

export function emojiAvatar(emoji: string, tone: string): string {
  return `${PREFIX}${emoji}:${tone}`;
}

/** The emoji and tone of an emoji avatar, or null for a photo URL / nothing. */
export function parseEmojiAvatar(
  url: string | null | undefined,
): { emoji: string; tone: string } | null {
  if (!url?.startsWith(PREFIX)) return null;
  const rest = url.slice(PREFIX.length);
  const i = rest.lastIndexOf(':');
  if (i <= 0) return null;
  const tone = rest.slice(i + 1);
  return { emoji: rest.slice(0, i), tone: /^#[0-9a-f]{6}$/i.test(tone) ? tone : AVATAR_TONES[0] };
}

export const isEmojiAvatar = (url: string | null | undefined) => !!parseEmojiAvatar(url);

/** A photo or an emoji has been chosen. */
export const hasPicture = (url: string | null | undefined) => !!url && url.trim() !== '';
