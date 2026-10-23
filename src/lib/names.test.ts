import { limitNameWords, nameWords } from './names';

describe('limitNameWords', () => {
  it('keeps one or two words as typed', () => {
    expect(limitNameWords('Jan')).toBe('Jan');
    expect(limitNameWords('Jan ')).toBe('Jan ');
    expect(limitNameWords('Jan Novák')).toBe('Jan Novák');
  });

  it('does not start a third word', () => {
    expect(limitNameWords('Jan Novák ')).toBe('Jan Novák ');
    expect(limitNameWords('Jan Novák P')).toBe('Jan Novák ');
  });

  it('never glues a third word onto the second', () => {
    let typed = '';
    for (const ch of 'Jan Petr Novák') typed = limitNameWords(typed + ch);
    expect(typed.trim()).toBe('Jan Petr');
  });

  it('cuts a pasted longer name to two words', () => {
    expect(limitNameWords('Jan Petr Novák').trim()).toBe('Jan Petr');
  });

  it('collapses extra and leading spaces', () => {
    expect(limitNameWords('  Jan    Novák')).toBe('Jan Novák');
    expect(limitNameWords('Jan  ')).toBe('Jan ');
  });

  it('counts a hyphenated name as one word', () => {
    expect(limitNameWords('Anna-Marie Nováková')).toBe('Anna-Marie Nováková');
    expect(nameWords('Anna-Marie Nováková')).toHaveLength(2);
  });
});
