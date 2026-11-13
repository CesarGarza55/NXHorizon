import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName, StyleSheet, View, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface AppColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSecondary: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  accent: string;
  accentStrong: string;
  accentSurface: string;
  destructive: string;
  success: string;
  overlay: string;
}

export interface CustomTheme {
  id: string;
  name: string;
  colors: AppColors;
  backgroundImageUri?: string;
}

const palettes: Record<'light' | 'dark', AppColors> = {
  light: {
    background: '#F1F2F3',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceSecondary: '#E8EAEC',
    text: '#24282C',
    textSecondary: '#5D656C',
    textMuted: '#626A70',
    border: '#D5D9DC',
    accent: '#00AFC2',
    accentStrong: '#007482',
    accentSurface: '#DDF5F7',
    destructive: '#C02F3B',
    success: '#11734F',
    overlay: 'rgba(0, 0, 0, 0.48)',
  },
  dark: {
    background: '#181A1C',
    surface: '#202326',
    surfaceElevated: '#292D31',
    surfaceSecondary: '#303438',
    text: '#F4F5F6',
    textSecondary: '#C0C5C9',
    textMuted: '#969EA4',
    border: '#41474C',
    accent: '#00D2FF',
    accentStrong: '#00B8DE',
    accentSurface: '#173640',
    destructive: '#FF5A63',
    success: '#45C995',
    overlay: 'rgba(0, 0, 0, 0.68)',
  },
};

interface ThemeContextValue {
  mode: ThemeMode;
  colorScheme: 'light' | 'dark';
  colors: AppColors;
  customThemes: CustomTheme[];
  activeCustomThemeId: string | null;
  backgroundImageUri?: string;
  setMode: (mode: ThemeMode) => Promise<void>;
  activateCustomTheme: (themeId: string | null) => Promise<void>;
  saveCustomTheme: (theme: CustomTheme) => Promise<void>;
  deleteCustomTheme: (themeId: string) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_STORAGE_KEY = '@nx_theme_mode';
const CUSTOM_THEMES_KEY = '@nx_custom_themes';
const ACTIVE_CUSTOM_THEME_KEY = '@nx_active_custom_theme';

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

function withAlpha(color: string, alpha: number): string {
  const match = color.match(/^#([0-9a-f]{6})$/i);
  if (!match) return color;
  const value = match[1];
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function isCustomTheme(value: unknown): value is CustomTheme {
  if (!value || typeof value !== 'object') return false;
  const theme = value as Partial<CustomTheme>;
  const colorKeys = Object.keys(palettes.light) as (keyof AppColors)[];
  return Boolean(
    typeof theme.id === 'string' &&
    typeof theme.name === 'string' &&
    theme.colors &&
    colorKeys.every((key) => typeof theme.colors?.[key] === 'string') &&
    (theme.backgroundImageUri === undefined || typeof theme.backgroundImageUri === 'string')
  );
}

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const systemColorScheme = useColorScheme() ?? 'light';
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const [activeCustomThemeId, setActiveCustomThemeId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      AsyncStorage.getItem(THEME_STORAGE_KEY),
      AsyncStorage.getItem(CUSTOM_THEMES_KEY),
      AsyncStorage.getItem(ACTIVE_CUSTOM_THEME_KEY),
    ])
      .then(([storedMode, storedThemes, storedActiveTheme]) => {
        if (!active) return;
        if (isThemeMode(storedMode)) setModeState(storedMode);
        if (storedThemes) {
          try {
            const parsed: unknown = JSON.parse(storedThemes);
            if (Array.isArray(parsed)) {
              const validThemes = parsed.filter(isCustomTheme);
              setCustomThemes(validThemes);
              if (validThemes.some((theme) => theme.id === storedActiveTheme)) {
                setActiveCustomThemeId(storedActiveTheme);
              }
            }
          } catch (error) {
            console.warn('[Theme] Could not parse saved custom themes:', error);
          }
        }
      })
      .catch((error) => {
        console.warn('[Theme] Could not load saved theme data:', error);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    Appearance.setColorScheme(mode === 'system' ? 'auto' : mode);
  }, [mode]);

  const setMode = useCallback(async (nextMode: ThemeMode) => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode);
    await AsyncStorage.removeItem(ACTIVE_CUSTOM_THEME_KEY);
    setModeState(nextMode);
    setActiveCustomThemeId(null);
  }, []);

  const colorScheme: ColorSchemeName = mode === 'system' ? systemColorScheme : mode;
  const activeCustomTheme = customThemes.find((theme) => theme.id === activeCustomThemeId) || null;
  const backgroundImageUri = activeCustomTheme?.backgroundImageUri;
  const colors = useMemo<AppColors>(() => {
    const base = palettes[colorScheme === 'dark' ? 'dark' : 'light'];
    if (!activeCustomTheme) return base;
    return {
      ...base,
      ...activeCustomTheme.colors,
      background: backgroundImageUri
        ? withAlpha(activeCustomTheme.colors.background, 0.72)
        : activeCustomTheme.colors.background,
      surface: backgroundImageUri
        ? withAlpha(activeCustomTheme.colors.surface, 0.94)
        : activeCustomTheme.colors.surface,
      surfaceElevated: backgroundImageUri
        ? withAlpha(activeCustomTheme.colors.surfaceElevated, 0.97)
        : activeCustomTheme.colors.surfaceElevated,
      surfaceSecondary: backgroundImageUri
        ? withAlpha(activeCustomTheme.colors.surfaceSecondary, 0.82)
        : activeCustomTheme.colors.surfaceSecondary,
    };
  }, [activeCustomTheme, backgroundImageUri, colorScheme]);

  const activateCustomTheme = useCallback(async (themeId: string | null) => {
    if (themeId && !customThemes.some((theme) => theme.id === themeId)) {
      throw new Error('The selected custom theme does not exist');
    }
    if (themeId) {
      await AsyncStorage.setItem(ACTIVE_CUSTOM_THEME_KEY, themeId);
    } else {
      await AsyncStorage.removeItem(ACTIVE_CUSTOM_THEME_KEY);
    }
    setActiveCustomThemeId(themeId);
  }, [customThemes]);

  const saveCustomTheme = useCallback(async (theme: CustomTheme) => {
    const updated = [...customThemes.filter((item) => item.id !== theme.id), theme];
    await AsyncStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(updated));
    await AsyncStorage.setItem(ACTIVE_CUSTOM_THEME_KEY, theme.id);
    setCustomThemes(updated);
    setActiveCustomThemeId(theme.id);
  }, [customThemes]);

  const deleteCustomTheme = useCallback(async (themeId: string) => {
    const updated = customThemes.filter((theme) => theme.id !== themeId);
    await AsyncStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(updated));
    if (activeCustomThemeId === themeId) {
      await AsyncStorage.removeItem(ACTIVE_CUSTOM_THEME_KEY);
      setActiveCustomThemeId(null);
    }
    setCustomThemes(updated);
  }, [activeCustomThemeId, customThemes]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colorScheme: colorScheme === 'dark' ? 'dark' : 'light',
      colors,
      customThemes,
      activeCustomThemeId,
      backgroundImageUri,
      setMode,
      activateCustomTheme,
      saveCustomTheme,
      deleteCustomTheme,
    }),
    [
      mode,
      colorScheme,
      colors,
      customThemes,
      activeCustomThemeId,
      backgroundImageUri,
      setMode,
      activateCustomTheme,
      saveCustomTheme,
      deleteCustomTheme,
    ]
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {backgroundImageUri ? (
        <Image
          source={{ uri: backgroundImageUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="disk"
        />
      ) : null}
      <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    </View>
  );
};

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppTheme must be used within ThemeProvider');
  return context;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
