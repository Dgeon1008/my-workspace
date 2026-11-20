export type HarnessModule = {
  id: string;
  moduleKey: string;
  name: string;
  categoryId: string | null;
  position: number;
};

export const harnessModuleDefinitions = [
  {
    id: 'semantle',
    moduleKey: 'semantle',
    name: '꼬맨틀',
    categoryId: 'games',
    legacyNames: ['semantle', '꼬맨틀'],
  },
  {
    id: 'trading-app',
    moduleKey: 'trading-app',
    name: 'Trading App',
    categoryId: 'stocks',
    legacyNames: ['tradingapp', 'trading app', 'trading_app'],
  },
  {
    id: 'gomoku',
    moduleKey: 'gomoku',
    name: '오목',
    categoryId: 'games',
    legacyNames: ['gomoku', '오목'],
  },
  {
    id: '2048',
    moduleKey: '2048',
    name: '2048',
    categoryId: 'games',
    legacyNames: ['2048'],
  },
  {
    id: 'earth-explorer',
    moduleKey: 'earth-explorer',
    name: '지구 탐험',
    categoryId: null,
    legacyNames: ['earth explorer', '지구 탐험', '지구본'],
  },
] as const;
