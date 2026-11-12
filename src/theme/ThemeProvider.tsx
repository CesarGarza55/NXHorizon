import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  setMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_STORAGE_KEY = '@nx_theme_mode';

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const systemColorScheme = useColorScheme() ?? 'light';
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((storedMode) => {
        if (active && isThemeMode(storedMode)) setModeState(storedMode);
      })
      .catch((error) => {
        console.warn('[Theme] Could not load saved theme preference:', error);
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
    setModeState(nextMode);
  }, []);

  const colorScheme: ColorSchemeName = mode === 'system' ? systemColorScheme : mode;
  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colorScheme: colorScheme === 'dark' ? 'dark' : 'light',
      colors: palettes[colorScheme === 'dark' ? 'dark' : 'light'],
      setMode,
    }),
    [mode, colorScheme, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppTheme must be used within ThemeProvider');
  return context;
}
