import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameMetadata, GameLaunchConfig, DEFAULT_GAME_LAUNCH_CONFIG } from '../types/game';
import { autoDetectAndScrapeGame } from '../services/gameScraper';

interface GameState {
  games: GameMetadata[];
  selectedGameId: string | null;
  searchQuery: string;
  filterMode: 'all' | 'favorites' | 'recent';
  sortBy: 'name' | 'recent' | 'playtime' | 'rating';
  isLoading: boolean;
  isDirectBootEnabled: boolean;
  globalLaunchConfig: GameLaunchConfig;

  // Actions
  loadLibrary: () => Promise<void>;
  setDirectBootEnabled: (enabled: boolean) => Promise<void>;
  updateGameLaunchConfig: (gameId: string, config: Partial<GameLaunchConfig>) => Promise<void>;
  resetGameLaunchConfig: (gameId: string) => Promise<void>;
  updateGlobalLaunchConfig: (config: Partial<GameLaunchConfig>) => Promise<void>;
  addGame: (game: GameMetadata) => Promise<void>;
  updateGameMetadata: (id: string, partial: Partial<GameMetadata>) => Promise<void>;
  syncPendingGamesSilently: () => Promise<void>;
  removeGame: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  setSelectedGame: (id: string | null) => void;
  recordPlaySession: (id: string, additionalMinutes?: number) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setFilterMode: (mode: 'all' | 'favorites' | 'recent') => void;
  setSortBy: (sort: 'name' | 'recent' | 'playtime' | 'rating') => void;
  clearAllGames: () => Promise<void>;
}

const STORAGE_KEY = '@nx_library_games_collection';
const DIRECT_BOOT_KEY = '@nx_direct_boot_enabled';
const GLOBAL_CONFIG_KEY = '@nx_global_launch_config';

export const useGameStore = create<GameState>((set, get) => ({
  games: [],
  selectedGameId: null,
  searchQuery: '',
  filterMode: 'all',
  sortBy: 'recent',
  isLoading: true,
  isDirectBootEnabled: true,
  globalLaunchConfig: DEFAULT_GAME_LAUNCH_CONFIG,

  loadLibrary: async () => {
    try {
      const [stored, storedDirectBoot, storedGlobalConfig] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(DIRECT_BOOT_KEY),
        AsyncStorage.getItem(GLOBAL_CONFIG_KEY),
      ]);

      const isDirectBoot = storedDirectBoot !== null ? storedDirectBoot === 'true' : true;
      let globalConfig: GameLaunchConfig = DEFAULT_GAME_LAUNCH_CONFIG;
      if (storedGlobalConfig) {
        try {
          globalConfig = { ...DEFAULT_GAME_LAUNCH_CONFIG, ...JSON.parse(storedGlobalConfig) };
        } catch { }
      }

      if (stored) {
        const parsed: GameMetadata[] = JSON.parse(stored);
        // Filter out any previous dummy/example games that start with "default_"
        const userGames = parsed
          .filter((g) => !g.id.startsWith('default_'))
          .map((g) => {
            if (Array.isArray(g.screenshots)) {
              g.screenshots = g.screenshots
                .filter((s) => typeof s === 'string' && !s.endsWith('/screen/0'))
                .map((s) => s.replace(/^http:\/\//, 'https://'));
              if (g.screenshots.length === 0 && g.titleId) {
                g.screenshots = [
                  `https://api.nlib.cc/nx/${g.titleId}/screen/1`,
                  `https://api.nlib.cc/nx/${g.titleId}/screen/2`,
                  `https://api.nlib.cc/nx/${g.titleId}/screen/3`,
                  `https://api.nlib.cc/nx/${g.titleId}/screen/4`,
                ];
              }
            }
            return g;
          });
        set({
          games: userGames,
          selectedGameId: userGames.length > 0 ? userGames[0].id : null,
          isLoading: false,
          isDirectBootEnabled: isDirectBoot,
          globalLaunchConfig: globalConfig,
        });
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(userGames));
        get().syncPendingGamesSilently().catch(() => {});
      } else {
        // Starts completely empty
        set({
          games: [],
          selectedGameId: null,
          isLoading: false,
          isDirectBootEnabled: isDirectBoot,
          globalLaunchConfig: globalConfig,
        });
      }
    } catch (err) {
      console.warn('[GameStore] Error loading library:', err);
      set({
        games: [],
        selectedGameId: null,
        isLoading: false,
        isDirectBootEnabled: true,
        globalLaunchConfig: DEFAULT_GAME_LAUNCH_CONFIG,
      });
    }
  },

  setDirectBootEnabled: async (enabled: boolean) => {
    set({ isDirectBootEnabled: enabled });
    await AsyncStorage.setItem(DIRECT_BOOT_KEY, enabled ? 'true' : 'false');
  },

  updateGameLaunchConfig: async (gameId: string, config: Partial<GameLaunchConfig>) => {
    const updated = get().games.map((g) => {
      if (g.id !== gameId) return g;
      const currentConfig = g.launchConfig || {};
      return {
        ...g,
        launchConfig: {
          ...currentConfig,
          ...config,
        },
      };
    });
    set({ games: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  resetGameLaunchConfig: async (gameId: string) => {
    const updated = get().games.map((g) => {
      if (g.id !== gameId) return g;
      const { launchConfig, ...rest } = g;
      return rest;
    });
    set({ games: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  updateGlobalLaunchConfig: async (config: Partial<GameLaunchConfig>) => {
    const updated = { ...get().globalLaunchConfig, ...config };
    set({ globalLaunchConfig: updated });
    await AsyncStorage.setItem(GLOBAL_CONFIG_KEY, JSON.stringify(updated));
  },

  addGame: async (game: GameMetadata) => {
    const updated = [game, ...get().games.filter((g) => g.titleId !== game.titleId)];
    set({ games: updated, selectedGameId: game.id });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  updateGameMetadata: async (id: string, partial: Partial<GameMetadata>) => {
    const updated = get().games.map((g) => (g.id === id ? { ...g, ...partial } : g));
    set({ games: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  syncPendingGamesSilently: async () => {
    const { games } = get();
    const pending = games.filter(
      (g) =>
        g.needsMetadataSync ||
        (g.titleId && (g.screenshots.length === 0 || g.coverUrl.includes('dummyimage')))
    );

    if (pending.length === 0) return;

    let hasChanges = false;
    const updated = [...get().games];

    for (let i = 0; i < updated.length; i++) {
      const g = updated[i];
      const needsSync =
        g.needsMetadataSync ||
        (g.titleId && (g.screenshots.length === 0 || g.coverUrl.includes('dummyimage')));

      if (!needsSync) continue;

      try {
        const query = g.titleId || g.title;
        const result = await autoDetectAndScrapeGame(query, g.titleId ? undefined : g.title);
        if (result && result.source === 'nintendo_api' && result.metadata) {
          updated[i] = {
            ...g,
            title: result.metadata.title || g.title,
            coverUrl: result.metadata.coverUrl || g.coverUrl,
            heroUrl: result.metadata.heroUrl || g.heroUrl,
            screenshots:
              result.metadata.screenshots && result.metadata.screenshots.length > 0
                ? result.metadata.screenshots
                : g.screenshots,
            publisher: result.metadata.publisher || g.publisher,
            developer: result.metadata.developer || g.developer,
            genre: result.metadata.genre || g.genre,
            description: result.metadata.description || g.description,
            releaseDate: result.metadata.releaseDate || g.releaseDate,
            needsMetadataSync: false,
          };
          hasChanges = true;
        }
      } catch (e) {
        // Silently skip if network unreachable
      }
    }

    if (hasChanges) {
      set({ games: updated });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  },

  removeGame: async (id: string) => {
    const updated = get().games.filter((g) => g.id !== id);
    const newSelected = updated.length > 0 ? updated[0].id : null;
    set({ games: updated, selectedGameId: newSelected });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  toggleFavorite: async (id: string) => {
    const updated = get().games.map((g) =>
      g.id === id ? { ...g, isFavorite: !g.isFavorite } : g
    );
    set({ games: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  setSelectedGame: (id: string | null) => {
    set({ selectedGameId: id });
  },

  recordPlaySession: async (id: string, additionalMinutes = 15) => {
    const updated = get().games.map((g) =>
      g.id === id
        ? {
            ...g,
            lastPlayed: new Date().toISOString(),
            playTimeMinutes: g.playTimeMinutes + additionalMinutes,
          }
        : g
    );
    set({ games: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setFilterMode: (mode) => set({ filterMode: mode }),
  setSortBy: (sort) => set({ sortBy: sort }),
  clearAllGames: async () => {
    set({ games: [], selectedGameId: null });
    await AsyncStorage.removeItem(STORAGE_KEY);
  },
}));
