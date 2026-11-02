import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((f) => {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) return files(full);
    return /\.tsx?$/.test(f.name) && full !== __filename ? [full] : [];
  });
}

describe('app copy', () => {
  it('does not name the source of the exercise ratings', () => {
    const named = [...files(path.join(root, 'app')), ...files(path.join(root, 'src'))].filter((f) =>
      /nippard/i.test(fs.readFileSync(f, 'utf8')),
    );
    expect(named).toEqual([]);
  });
});
