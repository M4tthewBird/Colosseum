import { seenMark, unseenReleases, type Release } from './changelog';

const r = (id: string, date = '2026-10-01', items = 2): Release => ({
  id,
  date,
  title: id,
  items: Array.from({ length: items }, (_, i) => `${id}${i}`),
});
const log = [
  r('d', '2026-10-20'),
  r('c', '2026-10-11'),
  r('b', '2026-10-05'),
  r('a', '2026-10-01'),
];
const ids = (x: Release[]) => x.map((y) => y.id);

describe('unseenReleases', () => {
  it('shows only the newest release when nothing was seen and the last visit is unknown', () => {
    expect(ids(unseenReleases(log, null))).toEqual(['d']);
  });

  it('shows the releases newer than the last one seen, however many', () => {
    expect(ids(unseenReleases(log, seenMark(log[2])))).toEqual(['d', 'c']);
    expect(ids(unseenReleases(log, seenMark(log[3])))).toEqual(['d', 'c', 'b']);
  });

  it('shows nothing when the newest release was seen', () => {
    expect(unseenReleases(log, seenMark(log[0]))).toEqual([]);
  });

  it('shows a seen release again when items were added to it', () => {
    expect(ids(unseenReleases(log, 'd#1'))).toEqual(['d']);
    expect(ids(unseenReleases(log, 'c#1'))).toEqual(['d', 'c']);
  });

  it('treats a mark without a count (older versions) as nothing of it seen', () => {
    expect(ids(unseenReleases(log, 'd'))).toEqual(['d']);
  });

  it('with nothing seen, shows every release since the last visit', () => {
    expect(ids(unseenReleases(log, null, '2026-10-05'))).toEqual(['d', 'c', 'b']);
    expect(ids(unseenReleases(log, null, '2026-10-11'))).toEqual(['d', 'c']);
  });

  it('still shows the newest release when the last visit is after it', () => {
    expect(ids(unseenReleases(log, null, '2026-10-22'))).toEqual(['d']);
  });

  it('treats an unknown id like nothing seen', () => {
    expect(ids(unseenReleases(log, 'gone#3', '2026-10-11'))).toEqual(['d', 'c']);
  });

  it('handles an empty changelog', () => {
    expect(unseenReleases([], null)).toEqual([]);
  });
});
