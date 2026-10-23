import { unseenReleases, type Release } from './changelog';

const r = (id: string): Release => ({ id, date: '2026-10-01', title: id, items: [] });
const log = [r('d'), r('c'), r('b'), r('a')];

describe('unseenReleases', () => {
  it('shows only the newest release when nothing was seen yet', () => {
    expect(unseenReleases(log, null).map((x) => x.id)).toEqual(['d']);
  });

  it('shows the releases newer than the last one seen', () => {
    expect(unseenReleases(log, 'b').map((x) => x.id)).toEqual(['d', 'c']);
  });

  it('shows nothing when the newest release was seen', () => {
    expect(unseenReleases(log, 'd')).toEqual([]);
  });

  it('treats an unknown id like nothing seen', () => {
    expect(unseenReleases(log, 'gone').map((x) => x.id)).toEqual(['d']);
  });

  it('caps a long backlog', () => {
    expect(unseenReleases(log, 'a', 2).map((x) => x.id)).toEqual(['d', 'c']);
  });

  it('handles an empty changelog', () => {
    expect(unseenReleases([], null)).toEqual([]);
  });
});
