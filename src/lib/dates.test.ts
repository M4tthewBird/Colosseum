import {
  formatClock,
  formatDuration,
  fromLocalDate,
  isInWeek,
  isoWeekday,
  startOfWeek,
  toLocalDate,
  weeksBetween,
} from './dates';

describe('week boundaries', () => {
  it('starts on Monday 00:00 local time', () => {
    const sunday = new Date(2025, 8, 28, 23, 59); // Sun 28 Sep 2025
    const ws = startOfWeek(sunday);
    expect(ws.getDay()).toBe(1);
    expect(ws.getDate()).toBe(22);
    expect(ws.getHours()).toBe(0);
  });

  it('keeps Monday in its own week', () => {
    const monday = new Date(2025, 8, 29, 0, 0);
    expect(startOfWeek(monday).getDate()).toBe(29);
  });

  it('puts Sunday 23:59 in the week and Monday 00:00 in the next', () => {
    const ws = startOfWeek(new Date(2025, 8, 24));
    expect(isInWeek(new Date(2025, 8, 28, 23, 59), ws)).toBe(true);
    expect(isInWeek(new Date(2025, 8, 29, 0, 0), ws)).toBe(false);
  });

  it('numbers weekdays from Monday', () => {
    expect(isoWeekday(new Date(2025, 8, 29))).toBe(1);
    expect(isoWeekday(new Date(2025, 8, 28))).toBe(7);
  });

  it('counts weeks between dates', () => {
    expect(weeksBetween(new Date(2025, 8, 1), new Date(2025, 8, 21))).toBe(2);
  });

  it('round-trips local dates', () => {
    expect(toLocalDate(fromLocalDate('2025-03-30'))).toBe('2025-03-30');
  });
});

describe('formatting', () => {
  it('formats durations', () => {
    expect(formatDuration(58 * 60000)).toBe('58 min');
    expect(formatDuration(62 * 60000)).toBe('1 h 02 min');
  });
  it('formats clocks', () => {
    expect(formatClock(768)).toBe('12:48');
    expect(formatClock(3725)).toBe('1:02:05');
  });
});
