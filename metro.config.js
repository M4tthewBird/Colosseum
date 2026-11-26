// Metro: Expo's default config, minus folders that are not app code. The Gemini picture kit alone
// is over 200 MB of originals; watching it ran the dev server out of memory (2026-11-26).
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const notApp = ['gemini-obrazky', 'claude-design-hra', 'colosseum-game-visuals', 'dist'].map(
  (folder) => new RegExp(`^${escape(path.join(__dirname, folder))}[\\\\/].*`),
);
const blockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(blockList) ? blockList : blockList ? [blockList] : []),
  ...notApp,
];

module.exports = config;
