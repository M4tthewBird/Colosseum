/** A display name is at most two words ("Jan Novák"); a hyphenated name counts as one. */
export const MAX_NAME_WORDS = 2;

export function nameWords(name: string): string[] {
  return name.trim().split(/\s+/).filter(Boolean);
}

/**
 * Applied while typing: collapses repeated spaces and drops anything past the last allowed word
 * (typed or pasted). The space after a full name stays, so typing on adds nothing instead of
 * gluing letters onto the last word. Trim before saving.
 */
export function limitNameWords(input: string, max = MAX_NAME_WORDS): string {
  const text = input.replace(/^\s+/, '').replace(/\s+/g, ' ');
  const words = nameWords(text);
  return words.length <= max ? text : `${words.slice(0, max).join(' ')} `;
}
