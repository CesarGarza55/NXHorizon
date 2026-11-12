export interface GameLaunchConfig {
  opMode: 'handheld' | 'docked';
  fpsTarget: 0 | 30 | 60;
  renderScale: 0.5 | 0.75 | 1.0;
  upscaler: 'linear' | 'metalfx';
  metalHud: boolean;
  phoneMotion: boolean;
  language: string; // 'auto' | 'es-ES' | 'en-US' | 'ja-JP' | 'fr-FR' | 'de-DE' | 'it-IT'
}

export const DEFAULT_GAME_LAUNCH_CONFIG: GameLaunchConfig = {
  opMode: 'handheld',
  fpsTarget: 0,
  renderScale: 1.0,
  upscaler: 'metalfx',
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
