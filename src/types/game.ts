export interface GameLaunchConfig {
  opMode: 'handheld' | 'docked';
  fpsTarget: 0 | 30 | 60;
  metalHud: boolean;
  phoneMotion: boolean;
  language: string; // 'auto' | 'es-ES' | 'en-US' | 'ja-JP' | 'fr-FR' | 'de-DE' | 'it-IT'
}

export const DEFAULT_GAME_LAUNCH_CONFIG: GameLaunchConfig = {
  opMode: 'handheld',
  fpsTarget: 0,
  metalHud: false,
  phoneMotion: true,
  language: 'auto',
};

export interface GameMetadata {
  id: string;
  titleId?: string;
  title: string;
  normalizedTitle: string;
  publisher: string;
  developer?: string;
  releaseDate?: string;
  genre: string;
  description: string;
  localizedDescriptions?: Record<string, string>;
  localizedGenres?: Record<string, string>;
  coverUrl: string;
  heroUrl: string;
  screenshots: string[];
  lastPlayed: string | null;
  playTimeMinutes: number;
  isFavorite: boolean;
  rating?: number;
  tags?: string[];
  launchUrl?: string; // livecontainer://livecontainer-launch?...
  bundleName?: string;
  containerFolder?: string;
  appStoreId?: string;
  appStoreUrl?: string;
  customTitle?: string;
  customDescription?: string;
  customCoverUrl?: string;
  launchConfig?: Partial<GameLaunchConfig>;
  needsMetadataSync?: boolean;
}

export type FocusContext = 'home' | 'library' | 'details' | 'settings' | 'modal' | 'context_menu';

export interface SpatialNode {
  id: string;
  context: FocusContext;
  x?: number;
  y?: number;
  onSelect?: () => void;
  onBack?: () => void;
}

export function getLocalizedDescription(game?: GameMetadata | null, lang?: string): string {
  if (!game) return '';
  if (game.customDescription?.trim()) return game.customDescription;
  const currentLang = (lang || 'es').toLowerCase().startsWith('es') ? 'es' : 'en';
  if (game.localizedDescriptions && game.localizedDescriptions[currentLang]) {
    return game.localizedDescriptions[currentLang];
  }
  const fallbackLang = currentLang === 'es' ? 'en' : 'es';
  if (game.localizedDescriptions && game.localizedDescriptions[fallbackLang]) {
    return game.localizedDescriptions[fallbackLang];
  }
  return game.description || '';
}

export function getGameTitle(
  game?: (Pick<GameMetadata, 'title'> & Partial<Pick<GameMetadata, 'customTitle'>>) | null
): string {
  return game?.customTitle?.trim() || game?.title || '';
}

export function getGameCoverUrl(
  game?: (Pick<GameMetadata, 'coverUrl'> & Partial<Pick<GameMetadata, 'customCoverUrl'>>) | null
): string {
  if (!game) return '';
  return game.customCoverUrl !== undefined ? game.customCoverUrl.trim() : game.coverUrl || '';
}

export function getLocalizedGenre(game?: GameMetadata | null, lang?: string): string {
  if (!game) return '';
  const currentLang = (lang || 'es').toLowerCase().startsWith('es') ? 'es' : 'en';
  if (game.localizedGenres && game.localizedGenres[currentLang]) {
    return game.localizedGenres[currentLang];
  }
  const fallbackLang = currentLang === 'es' ? 'en' : 'es';
  if (game.localizedGenres && game.localizedGenres[fallbackLang]) {
    return game.localizedGenres[fallbackLang];
  }
  return game.genre || '';
}
