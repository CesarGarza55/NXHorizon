import { requireNativeModule } from 'expo-modules-core';
import { GameLaunchConfig, DEFAULT_GAME_LAUNCH_CONFIG } from '../../src/types/game';

interface LinkStatus {
  isLinked: boolean;
  folderName: string;
  folderPath: string;
}

interface PickResult {
  isLinked: boolean;
  folderName?: string;
  folderPath?: string;
  cancelled?: boolean;
}

interface WriteConfigResult {
  success: boolean;
  containerFolder?: string;
  envPath?: string;
  appliedConfig?: Record<string, string>;
}

let NxLiveContainer: any = null;

try {
  NxLiveContainer = requireNativeModule('NxLiveContainer');
} catch (e) {
  // Gracefully fallback when running in Expo Go or non-native web/sim
}

export interface BatteryStatus {
  level: number; // 0 to 100
  isCharging: boolean;
  state: number;
}

export interface NetworkStatus {
  isConnected: boolean;
  isWifi: boolean;
  isCellular: boolean;
}

export function getBatteryStatus(): BatteryStatus {
  if (NxLiveContainer?.getBatteryStatus) {
    try {
      return NxLiveContainer.getBatteryStatus();
    } catch {}
  }
  return { level: 100, isCharging: false, state: 0 };
}

export function getNetworkStatus(): NetworkStatus {
  if (NxLiveContainer?.getNetworkStatus) {
    try {
      return NxLiveContainer.getNetworkStatus();
    } catch {}
  }
  return { isConnected: true, isWifi: true, isCellular: false };
}

export function addBatteryListener(listener: (status: BatteryStatus) => void) {
  return NxLiveContainer?.addListener?.('onBatteryChanged', listener);
}

export function addNetworkListener(listener: (status: NetworkStatus) => void) {
  return NxLiveContainer?.addListener?.('onNetworkChanged', listener);
}

export function isLiveContainerModuleAvailable(): boolean {
  return !!NxLiveContainer;
}

export async function pickLiveContainerFolder(): Promise<PickResult> {
  if (!NxLiveContainer?.pickLiveContainerFolder) {
    return { isLinked: false };
  }
  try {
    return await NxLiveContainer.pickLiveContainerFolder();
  } catch (error) {
    console.warn('[NxLiveContainer] pickLiveContainerFolder error:', error);
    throw error;
  }
}

export function isLiveContainerLinked(): LinkStatus {
  if (!NxLiveContainer?.isLinked) {
    return { isLinked: false, folderName: '', folderPath: '' };
  }
  try {
    return NxLiveContainer.isLinked();
  } catch (error) {
    console.warn('[NxLiveContainer] isLinked error:', error);
    return { isLinked: false, folderName: '', folderPath: '' };
  }
}

export function unlinkLiveContainer(): boolean {
  if (!NxLiveContainer?.unlinkFolder) return false;
  try {
    return NxLiveContainer.unlinkFolder();
  } catch (error) {
    console.warn('[NxLiveContainer] unlinkFolder error:', error);
    return false;
  }
}

export async function writeGameEnvConfig(
  containerFolder: string,
  config: Record<string, string> = {}
): Promise<WriteConfigResult> {
  if (!NxLiveContainer?.writeGameEnvConfig) {
    return { success: false };
  }
  try {
    return await NxLiveContainer.writeGameEnvConfig(containerFolder, config);
  } catch (error) {
    console.warn(`[NxLiveContainer] writeGameEnvConfig error for ${containerFolder}:`, error);
    return { success: false };
  }
}

export async function readGameEnvConfig(
  containerFolder: string
): Promise<Record<string, string>> {
  if (!NxLiveContainer?.readGameEnvConfig) {
    return {};
  }
  try {
    return await NxLiveContainer.readGameEnvConfig(containerFolder);
  } catch (error) {
    console.warn(`[NxLiveContainer] readGameEnvConfig error for ${containerFolder}:`, error);
    return {};
  }
}

/**
 * Extract container folder UUID from bare name or livecontainer launch URL
 */
export function extractContainerFolder(input?: string): string | undefined {
  if (!input) return undefined;
  if (!input.includes('://')) return input;
  try {
    const q = input.indexOf('?');
    if (q !== -1) {
      const params = new URLSearchParams(input.substring(q + 1));
      const val = params.get('container-folder-name');
      if (val) return val;
    }
  } catch {}
  return undefined;
}

/**
 * Attempt to open a LiveContainer URL using private API / LSApplicationWorkspace to avoid SpringBoard confirmation alert when possible
 */
export async function openLiveContainerGame(launchUrl: string): Promise<boolean> {
  if (NxLiveContainer?.openLiveContainerUrl) {
    try {
      const res = await NxLiveContainer.openLiveContainerUrl(launchUrl);
      if (res) return true;
    } catch (e) {
      console.warn('[NxLiveContainer] Native openLiveContainerUrl error:', e);
    }
  }
  return false;
}

/**
 * Map GameLaunchConfig fields to nxnative / NX2Apple environment variable map
 */
export function mapLaunchConfigToEnv(config?: Partial<GameLaunchConfig>): Record<string, string> {
  const c = { ...DEFAULT_GAME_LAUNCH_CONFIG, ...(config || {}) };
  const isDocked = c.opMode === 'docked';
  const fpsStr = String(c.fpsTarget ?? 0);

  const env: Record<string, string> = {
    DM_LAUNCHER: '0',
    DM_FULLSCREEN: '1',
    DM_SAVED_CHOICES: '1',
    DM_OPMODE: isDocked ? '1' : '0',
    DM_OPERATION_MODE: isDocked ? 'docked' : 'handheld',
    DM_FPS: fpsStr,
    DM_FPS_TARGET: fpsStr,
    DM_MAX_FPS: fpsStr,
    DM_FRAME_RATE: fpsStr,
    DM_RENDER_SCALE: String(c.renderScale),
    DM_UPSCALER: c.upscaler,
    DM_METAL_HUD: c.metalHud ? '1' : '0',
    DM_PHONE_MOTION: c.phoneMotion ? '1' : '0',
    DM_MOTION: c.phoneMotion ? '1' : '0',
  };
  if (c.language && c.language !== 'auto') {
    env.DM_LANG = c.language;
  }
  return env;
}

/**
 * Parse an existing env.txt key-value map into a GameLaunchConfig object
 */
export function parseEnvToLaunchConfig(env: Record<string, string>): Partial<GameLaunchConfig> {
  const config: Partial<GameLaunchConfig> = {};
  if (env.DM_OPMODE === 'docked' || env.DM_OPMODE === '1') {
    config.opMode = 'docked';
  } else if (env.DM_OPMODE === 'handheld' || env.DM_OPMODE === '0') {
    config.opMode = 'handheld';
  }
  const fpsStr = env.DM_FPS_TARGET || env.DM_FPS || env.DM_MAX_FPS || env.DM_FRAME_RATE;
  if (fpsStr !== undefined) {
    const fps = parseInt(fpsStr, 10);
    if (fps === 0 || fps === 30 || fps === 60) {
      config.fpsTarget = fps as 0 | 30 | 60;
    }
  }
  if (env.DM_RENDER_SCALE !== undefined) {
    const scale = parseFloat(env.DM_RENDER_SCALE);
    if (scale === 0.5 || scale === 0.75 || scale === 1.0) {
      config.renderScale = scale as 0.5 | 0.75 | 1.0;
    }
  }
  if (env.DM_UPSCALER === 'metalfx' || env.DM_UPSCALER === 'linear') {
    config.upscaler = env.DM_UPSCALER;
  }
  if (env.DM_METAL_HUD !== undefined) {
    config.metalHud = env.DM_METAL_HUD === '1';
  }
  if (env.DM_PHONE_MOTION !== undefined) {
    config.phoneMotion = env.DM_PHONE_MOTION !== '0';
  }
  if (env.DM_LANG) {
    config.language = env.DM_LANG;
  }
  return config;
}

/**
 * Convenience helper to ensure DM_LAUNCHER=0 and performance config is written before booting a game
 */
export async function ensureGameDirectBoot(
  target?: string,
  extraConfig?: Record<string, string>
): Promise<boolean> {
  const containerFolder = extractContainerFolder(target);
  if (!containerFolder) return false;
  const status = isLiveContainerLinked();
  if (!status.isLinked) return false;

  const result = await writeGameEnvConfig(containerFolder, {
    DM_LAUNCHER: '0',
    DM_FULLSCREEN: '1',
    DM_SAVED_CHOICES: '1',
    ...(extraConfig || {})
  });

  return result.success;
}
