import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { GameRecord } from '../engine/types';
import { load, save } from '../utils/storage';
import type { GameConfig } from './game';

export type Theme = 'system' | 'light' | 'dark';
export type Motion = 'full' | 'reduced';
export type PieceStyle = 'classic' | 'bold';

export interface Settings {
  theme: Theme;
  sound: boolean;
  volume: number;
  motion: Motion;
  pieceStyle: PieceStyle;
  hints: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  sound: true,
  volume: 0.6,
  motion: 'full',
  pieceStyle: 'classic',
  hints: false,
};

export const DEFAULT_CONFIG: GameConfig = {
  mode: 'pve',
  difficulty: 'normal',
  names: { X: 'You', O: 'Normal Bot' },
  human: 'X',
  first: 'X',
  nextFirst: 'alternate',
  bestOf: 1,
};

const MAX_RECORDS = 500;

interface Store {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  records: GameRecord[];
  addRecord: (r: GameRecord) => void;
  clearRecords: () => void;
  lastConfig: GameConfig;
  saveConfig: (c: GameConfig) => void;
}

const StoreContext = createContext<Store | null>(null);

function usePersisted<T>(key: string, initial: () => T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => save(key, value), [key, value]);
  return [value, setValue] as const;
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = usePersisted('settings', () => ({
    ...DEFAULT_SETTINGS,
    ...load<Partial<Settings>>('settings', {}),
  }));
  const [records, setRecords] = usePersisted('records', () => load<GameRecord[]>('records', []));
  const [lastConfig, setLastConfig] = usePersisted('config', () => ({
    ...DEFAULT_CONFIG,
    ...load<Partial<GameConfig>>('config', {}),
  }));

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
    root.dataset.motion = settings.motion;
  }, [settings.theme, settings.motion]);

  const updateSettings = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), [setSettings]);
  const addRecord = useCallback(
    (r: GameRecord) => setRecords((rs) => (rs.some((x) => x.id === r.id) ? rs : [r, ...rs].slice(0, MAX_RECORDS))),
    [setRecords],
  );
  const clearRecords = useCallback(() => setRecords([]), [setRecords]);

  const value = useMemo(
    () => ({ settings, updateSettings, records, addRecord, clearRecords, lastConfig, saveConfig: setLastConfig }),
    [settings, updateSettings, records, addRecord, clearRecords, lastConfig, setLastConfig],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside AppStoreProvider');
  return s;
}
