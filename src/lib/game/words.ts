/**
 * The game's names in the app (Matyáš, 2026-11-26): a ludus is a **clan**. The code, the database
 * and the server still say ludus, so messages from the server go through here before the app
 * shows them. Everything else keeps its Latin name: denarii, laurels, gloria, tribe, domus,
 * Bellum, the ranks and the fighting styles.
 */
const WORDS = /\b(ludus['’]s|ludus|ludi)\b/gi;

/** "Ludus" → "Clan", "ludi" → "clans", keeping capitals and apostrophes. */
export function gameWords(text: string): string {
  return text.replace(WORDS, (word) => {
    const lower = word.toLowerCase();
    const to = lower === 'ludi' ? 'clans' : `clan${word.slice(5)}`;
    if (word.length > 1 && word === word.toUpperCase()) return to.toUpperCase();
    return word[0] === word[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to;
  });
}
