import type { ComponentType } from 'react';
import TradingApp from './trading-app/App';
import Semantle from './semantle/App';
import Gomoku from './gomoku/App';
import Game2048 from './2048/App';
import EarthExplorer from './earth-explorer/App';
import SpaceExplorer from './space-explorer/App';

export const moduleViews: Record<string, ComponentType> = {
  'trading-app': TradingApp,
  'semantle': Semantle,
  'gomoku': Gomoku,
  '2048': Game2048,
  'earth-explorer': EarthExplorer,
  'space-explorer': SpaceExplorer,
};
