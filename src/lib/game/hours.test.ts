import {
  formatMinutes,
  houseItemBlock,
  houseName,
  houseUpgradeBlock,
  houseUpgradeMinutes,
} from './hours';

describe('formatMinutes', () => {
  it('shows whole hours, hours and minutes, or minutes', () => {
    expect(formatMinutes(0)).toBe('0 min');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(360)).toBe('6 h');
    expect(formatMinutes(144)).toBe('2 h 24 min');
    expect(formatMinutes(2280.9)).toBe('38 h');
    expect(formatMinutes(-5)).toBe('0 min');
  });
});

describe('your house', () => {
  it('costs 10, 25, 50 and 100 hours for levels 2 to 5', () => {
    expect(houseUpgradeMinutes(1)).toBe(600);
    expect(houseUpgradeMinutes(2)).toBe(1500);
    expect(houseUpgradeMinutes(4)).toBe(6000);
    expect(houseUpgradeMinutes(5)).toBeNull();
    expect(houseName(1)).toBe('Hut');
    expect(houseName(5)).toBe('Palace');
  });

  it('says why it cannot be upgraded', () => {
    expect(houseUpgradeBlock({ level: 1, minutes: 599, items: [] })).toBe(
      'You need 10 h of your own',
    );
    expect(houseUpgradeBlock({ level: 1, minutes: 600, items: [] })).toBeNull();
    expect(houseUpgradeBlock({ level: 5, minutes: 9999, items: [] })).toBe(
      'Your house is at the top level',
    );
  });

  it('builds things by the house from level 2, each once, for 5 hours', () => {
    expect(houseItemBlock({ level: 1, minutes: 900, items: [] }, 'hortus')).toBe(
      'Upgrade your house first',
    );
    expect(houseItemBlock({ level: 2, minutes: 299, items: [] }, 'hortus')).toBe(
      'You need 5 h of your own',
    );
    expect(houseItemBlock({ level: 2, minutes: 300, items: [] }, 'hortus')).toBeNull();
    expect(houseItemBlock({ level: 3, minutes: 900, items: ['hortus'] }, 'hortus')).toBe(
      'You have it already',
    );
  });
});
