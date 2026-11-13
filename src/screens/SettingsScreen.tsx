import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Switch,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import { getAppLanguagePreference, setAppLanguage, SupportedLanguage } from '../i18n';
import { useGamepad } from '../hooks/useGamepad';
import { useGameStore } from '../state/useGameStore';
import { useFocusStore } from '../state/useFocusStore';
import { ControllerButton } from '../types/gamepad';
import { checkForAppUpdates, AppReleaseInfo, getCurrentAppVersion } from '../services/updateService';
import { setDeadzone } from '../../modules/nx-gamecontroller';
import {
  pickLiveContainerFolder,
  isLiveContainerLinked,
  unlinkLiveContainer,
  ensureGameDirectBoot,
  extractContainerFolder,
  mapLaunchConfigToEnv,
  writeGameEnvConfig,
  isNxNativeBundle,
} from '../../modules/nx-livecontainer';
import { ThemeMode, useAppTheme } from '../theme/ThemeProvider';
import { CustomTheme } from '../theme/ThemeProvider';
import { ThemeEditorModal } from '../components/common/ThemeEditorModal';

export type SettingsSection =
  | 'support'
  | 'appearance'
  | 'language'
  | 'orientation'
  | 'controllers'
  | 'livecontainer'
  | 'storage'
  | 'about';

interface SettingsScreenProps {
  onBackPress?: () => void;
  onShowOnboarding?: () => void;
  initialSection?: SettingsSection;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBackPress,
  onShowOnboarding,
  initialSection = 'support',
}) => {
  const { t } = useTranslation();
  const {
    colors,
    mode: themeMode,
    setMode: setThemeMode,
    customThemes,
    activeCustomThemeId,
    activateCustomTheme,
    deleteCustomTheme,
  } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const appVersion = getCurrentAppVersion();

  const SECTIONS: SettingsSection[] = [
    'support',
    'appearance',
    'language',
    'orientation',
    'controllers',
    'livecontainer',
    'storage',
    'about',
  ];

  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const [focusZone, setFocusZone] = useState<'sidebar' | 'content'>('sidebar');
  const [focusedContentIndex, setFocusedContentIndex] = useState(0);
  const [languagePreference, setLanguagePreference] = useState<SupportedLanguage>(getAppLanguagePreference());

  const sidebarScrollRef = React.useRef<any>(null);
  const detailScrollRef = React.useRef<any>(null);

  React.useEffect(() => {
    setActiveSection(initialSection);
    setFocusedContentIndex(0);
  }, [initialSection]);

  const activeSectionIndex = SECTIONS.indexOf(activeSection);

  // Auto-scroll sidebar when activeSection changes
  React.useEffect(() => {
    if (isLandscape) {
      sidebarScrollRef.current?.scrollTo({ y: Math.max(0, activeSectionIndex * 48 - 60), animated: true });
    } else {
      sidebarScrollRef.current?.scrollTo({ x: Math.max(0, activeSectionIndex * 105 - 60), animated: true });
    }
  }, [activeSectionIndex, isLandscape]);

  // Auto-scroll detail panel when focusedContentIndex changes
  React.useEffect(() => {
    if (focusZone === 'content') {
      let targetY = 0;
      if (activeSection === 'livecontainer') {
        targetY = Math.max(0, focusedContentIndex * 65 - 80);
      } else if (activeSection === 'support') {
        targetY = focusedContentIndex === 0 ? 0 : 130;
      } else if (activeSection === 'about') {
        targetY = focusedContentIndex === 0 ? 0 : focusedContentIndex * 60;
      } else {
        targetY = Math.max(0, focusedContentIndex * 54 - 60);
      }
      detailScrollRef.current?.scrollTo({ y: targetY, animated: true });
    }
  }, [focusZone, focusedContentIndex, activeSection]);

  const { isControllerTestActive, setControllerTestActive } = useFocusStore();
  const lastBTapTimeRef = React.useRef<number>(0);

  // Turn off controller test when unmounting or leaving controllers tab
  React.useEffect(() => {
    if (activeSection !== 'controllers') {
      setControllerTestActive(false);
    }
    return () => {
      setControllerTestActive(false);
    };
  }, [activeSection, setControllerTestActive]);

  // Update check state
  const [updateStatus, setUpdateStatus] = useState<
    'idle' | 'checking' | 'up_to_date' | 'update_available' | 'error'
  >('idle');
  const [latestRelease, setLatestRelease] = useState<AppReleaseInfo | null>(null);
  const hasCheckedUpdatesRef = React.useRef(false);

  const handleCheckForUpdates = React.useCallback(async () => {
    try {
      setUpdateStatus('checking');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const info = await checkForAppUpdates();
      setLatestRelease(info);
      setUpdateStatus(info.isNewer ? 'update_available' : 'up_to_date');
    } catch (e) {
      console.warn('[Settings] Failed to check for app updates:', e);
      setUpdateStatus('error');
    }
  }, []);

  React.useEffect(() => {
    if (activeSection === 'about' && !hasCheckedUpdatesRef.current) {
      hasCheckedUpdatesRef.current = true;
      handleCheckForUpdates();
    }
  }, [activeSection, handleCheckForUpdates]);
  const {
    games,
    clearAllGames,
    isDirectBootEnabled,
    setDirectBootEnabled,
    globalLaunchConfig,
    updateGlobalLaunchConfig,
  } = useGameStore();
  const [currentDeadzone, setCurrentDeadzone] = useState(15);
  const [orientationMode, setOrientationMode] = useState<'auto' | 'landscape' | 'portrait'>('auto');
  const [liveContainerStatus, setLiveContainerStatus] = useState(isLiveContainerLinked());
  const [isThemeEditorVisible, setIsThemeEditorVisible] = useState(false);
  const [editingTheme, setEditingTheme] = useState<CustomTheme | null>(null);

  const handleLinkLiveContainer = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    try {
      const result = await pickLiveContainerFolder();
      if (result.isLinked) {
        setLiveContainerStatus(isLiveContainerLinked());
        // Auto-configure all existing games right away!
        for (const game of games) {
          const folder = game.containerFolder || extractContainerFolder(game.launchUrl);
          if (folder && isNxNativeBundle(game.bundleName)) {
            ensureGameDirectBoot(folder, undefined, game.bundleName).catch((error) => {
              console.warn('[Settings] Could not configure direct boot:', error);
            });
          }
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
        Alert.alert(t('common.success'), t('settings.liveContainerLinkedSuccess'));
      }
    } catch (e: any) {
      console.warn('Error linking LiveContainer folder:', e);
      Alert.alert(t('common.error'), t('settings.liveContainerLinkError'));
    }
  };

  const handleToggleDirectBoot = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    await setDirectBootEnabled(value);
    if (value && liveContainerStatus.isLinked) {
      for (const game of games) {
        const folder = game.containerFolder || extractContainerFolder(game.launchUrl);
        if (folder && isNxNativeBundle(game.bundleName)) {
          ensureGameDirectBoot(folder, undefined, game.bundleName).catch((error) => {
            console.warn('[Settings] Could not configure direct boot:', error);
          });
        }
      }
    }
  };

  const handleUnlinkLiveContainer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    unlinkLiveContainer();
    setLiveContainerStatus(isLiveContainerLinked());
  };

  const handleLanguageChange = async (lang: SupportedLanguage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    await setAppLanguage(lang);
    setLanguagePreference(getAppLanguagePreference());
  };

  const handleApplyDefaultsToAll = async () => {
    if (!liveContainerStatus.isLinked) {
      Alert.alert(t('common.error'), t('contextMenu.linkLiveContainerForDirectBoot'));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    let count = 0;
    let failures = 0;
    const envMap = mapLaunchConfigToEnv(globalLaunchConfig);
    for (const game of games) {
      const folder = game.containerFolder || extractContainerFolder(game.launchUrl);
      if (folder && isNxNativeBundle(game.bundleName)) {
        try {
          const result = await writeGameEnvConfig(folder, envMap, game.bundleName);
          if (result.success) count++;
          else failures++;
        } catch (error) {
          failures++;
          console.warn(`[Settings] Could not apply defaults to ${game.bundleName}:`, error);
        }
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    Alert.alert(
      failures > 0 ? t('common.error') : t('common.success'),
      t('settings.appliedDefaultsToAll', { count, failed: failures })
    );
  };

  const handleThemeChange = async (mode: ThemeMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    try {
      await setThemeMode(mode);
    } catch (error) {
      console.warn('[Settings] Could not save theme preference:', error);
      Alert.alert(t('common.error'), t('settings.themeSaveError'));
    }
  };

  const handleSelectCustomTheme = async (themeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await activateCustomTheme(themeId);
    } catch (error) {
      console.warn('[Settings] Could not activate custom theme:', error);
      Alert.alert(t('common.error'), t('settings.themeSaveError'));
    }
  };

  const handleDeleteCustomTheme = (theme: CustomTheme) => {
    Alert.alert(
      t('settings.themeDelete'),
      t('settings.themeDeleteConfirm', { name: theme.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            deleteCustomTheme(theme.id).catch((error) => {
              console.warn('[Settings] Could not delete custom theme:', error);
              Alert.alert(t('common.error'), t('settings.themeSaveError'));
            });
          },
        },
      ]
    );
  };

  const handleOrientationChange = async (mode: 'auto' | 'landscape' | 'portrait') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    setOrientationMode(mode);
    try {
      if (mode === 'auto') {
        await ScreenOrientation.unlockAsync();
      } else if (mode === 'landscape') {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } else if (mode === 'portrait') {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    } catch (e) {
      console.warn('Orientation change error:', e);
    }
  };

  const handleDeadzoneChange = (value: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    setCurrentDeadzone(value);
    setDeadzone(value / 100);
  };

  const handleClearCache = async () => {
    try {
      const cacheDir = `${FileSystem.documentDirectory}covers/`;
      const dirInfo = await FileSystem.getInfoAsync(cacheDir);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(cacheDir, { idempotent: true });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      Alert.alert(t('common.success'), t('settings.cacheCleared'));
    } catch (e) {
      console.warn('Error clearing cache:', e);
    }
  };

  const getContentItemCount = React.useCallback((): number => {
    switch (activeSection) {
      case 'support':
        return 2;
      case 'appearance':
        return 4 + customThemes.length;
      case 'language':
        return 3;
      case 'orientation':
        return 3;
      case 'controllers':
        return 4;
      case 'livecontainer':
        return liveContainerStatus.isLinked ? 8 : 7;
      case 'storage':
        return 2;
      case 'about':
        return updateStatus === 'update_available' ? 3 : 2;
      default:
        return 0;
    }
  }, [activeSection, customThemes.length, liveContainerStatus.isLinked, updateStatus]);

  const executeContentAction = React.useCallback(
    (index: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      switch (activeSection) {
        case 'support':
          if (index === 0) {
            Linking.openURL('https://github.com/CesarGarza55/NXHorizon').catch(() => {});
          } else if (index === 1) {
            onShowOnboarding?.();
          }
          break;
        case 'appearance': {
          const modes: ThemeMode[] = ['system', 'light', 'dark'];
          if (modes[index]) handleThemeChange(modes[index]);
          else if (index === 3) {
            setEditingTheme(null);
            setIsThemeEditorVisible(true);
          } else if (index > 3 && customThemes[index - 4]) {
            handleSelectCustomTheme(customThemes[index - 4].id);
          }
          break;
        }
        case 'language': {
          const langs: SupportedLanguage[] = ['auto', 'es', 'en'];
          if (langs[index]) handleLanguageChange(langs[index]);
          break;
        }
        case 'orientation': {
          const orientations: ('auto' | 'landscape' | 'portrait')[] = ['auto', 'landscape', 'portrait'];
          if (orientations[index]) handleOrientationChange(orientations[index]);
          break;
        }
        case 'controllers':
          if (index === 0) {
            setControllerTestActive(!isControllerTestActive);
          } else if (index === 1) {
            handleDeadzoneChange(10);
          } else if (index === 2) {
            handleDeadzoneChange(15);
          } else if (index === 3) {
            handleDeadzoneChange(20);
          }
          break;
        case 'livecontainer': {
          const idxOffset = liveContainerStatus.isLinked ? 1 : 0;
          if (index === 0) {
            handleLinkLiveContainer();
          } else if (liveContainerStatus.isLinked && index === 1) {
            handleUnlinkLiveContainer();
          } else if (index === 1 + idxOffset) {
            handleToggleDirectBoot(!isDirectBootEnabled);
          } else if (index === 2 + idxOffset) {
            const nextMode = globalLaunchConfig.opMode === 'handheld' ? 'docked' : 'handheld';
            updateGlobalLaunchConfig({ opMode: nextMode });
          } else if (index === 3 + idxOffset) {
            const nextFps = globalLaunchConfig.fpsTarget === 0 ? 30 : globalLaunchConfig.fpsTarget === 30 ? 60 : 0;
            updateGlobalLaunchConfig({ fpsTarget: nextFps });
          } else if (index === 4 + idxOffset) {
            updateGlobalLaunchConfig({ metalHud: !globalLaunchConfig.metalHud });
          } else if (index === 5 + idxOffset) {
            updateGlobalLaunchConfig({ phoneMotion: !globalLaunchConfig.phoneMotion });
          } else if (index === 6 + idxOffset) {
            handleApplyDefaultsToAll();
          }
          break;
        }
        case 'storage':
          if (index === 0) {
            handleClearCache();
          } else if (index === 1) {
            Alert.alert(
              t('common.delete'),
              t('settings.resetLibraryConfirm'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.delete'), style: 'destructive', onPress: clearAllGames },
              ]
            );
          }
          break;
        case 'about':
          if (updateStatus === 'update_available') {
            if (index === 0 && latestRelease?.downloadUrl) {
              Linking.openURL(latestRelease.downloadUrl).catch(() => {});
            } else if (index === 1) {
              handleCheckForUpdates();
            } else if (index === 2) {
              Linking.openURL('https://github.com/CesarGarza55/NXHorizon').catch(() => {});
            }
          } else {
            if (index === 0) {
              handleCheckForUpdates();
            } else if (index === 1) {
              Linking.openURL('https://github.com/CesarGarza55/NXHorizon').catch(() => {});
            }
          }
          break;
      }
    },
    [
      activeSection,
      onShowOnboarding,
      handleThemeChange,
      handleLanguageChange,
      handleOrientationChange,
      isControllerTestActive,
      setControllerTestActive,
      handleDeadzoneChange,
      liveContainerStatus.isLinked,
      handleLinkLiveContainer,
      handleUnlinkLiveContainer,
      handleToggleDirectBoot,
      isDirectBootEnabled,
      globalLaunchConfig,
      updateGlobalLaunchConfig,
      handleApplyDefaultsToAll,
      handleClearCache,
      t,
      clearAllGames,
      updateStatus,
      latestRelease,
      handleCheckForUpdates,
    ]
  );

  const handleContentLeftRight = React.useCallback(
    (dir: 'left' | 'right') => {
      if (activeSection === 'livecontainer') {
        const idxOffset = liveContainerStatus.isLinked ? 1 : 0;
        if (focusedContentIndex === 1 + idxOffset) {
          handleToggleDirectBoot(!isDirectBootEnabled);
        } else if (focusedContentIndex === 2 + idxOffset) {
          const target = dir === 'left' ? 'handheld' : 'docked';
          updateGlobalLaunchConfig({ opMode: target });
        } else if (focusedContentIndex === 3 + idxOffset) {
          if (dir === 'right') {
            const next = globalLaunchConfig.fpsTarget === 0 ? 30 : globalLaunchConfig.fpsTarget === 30 ? 60 : 0;
            updateGlobalLaunchConfig({ fpsTarget: next });
          } else {
            const prev = globalLaunchConfig.fpsTarget === 0 ? 60 : globalLaunchConfig.fpsTarget === 60 ? 30 : 0;
            updateGlobalLaunchConfig({ fpsTarget: prev });
          }
        } else if (focusedContentIndex === 4 + idxOffset) {
          updateGlobalLaunchConfig({ metalHud: !globalLaunchConfig.metalHud });
        } else if (focusedContentIndex === 5 + idxOffset) {
          updateGlobalLaunchConfig({ phoneMotion: !globalLaunchConfig.phoneMotion });
        }
      } else if (activeSection === 'controllers') {
        if (dir === 'left' && focusedContentIndex > 1) {
          const nextIdx = focusedContentIndex - 1;
          setFocusedContentIndex(nextIdx);
          handleDeadzoneChange(nextIdx === 1 ? 10 : 15);
        } else if (dir === 'right' && focusedContentIndex >= 1 && focusedContentIndex < 3) {
          const nextIdx = focusedContentIndex + 1;
          setFocusedContentIndex(nextIdx);
          handleDeadzoneChange(nextIdx === 2 ? 15 : 20);
        }
      }
    },
    [
      activeSection,
      liveContainerStatus.isLinked,
      focusedContentIndex,
      handleToggleDirectBoot,
      isDirectBootEnabled,
      updateGlobalLaunchConfig,
      globalLaunchConfig,
      handleDeadzoneChange,
    ]
  );

  const handleGamepadDirection = React.useCallback(
    (dir: 'left' | 'right' | 'up' | 'down') => {
      if (activeSection === 'controllers' && isControllerTestActive) {
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      if (focusZone === 'sidebar') {
        const currentIdx = SECTIONS.indexOf(activeSection);
        if (isLandscape) {
          if (dir === 'up') {
            const nextIdx = Math.max(0, currentIdx - 1);
            setActiveSection(SECTIONS[nextIdx]);
            setFocusedContentIndex(0);
          } else if (dir === 'down') {
            const nextIdx = Math.min(SECTIONS.length - 1, currentIdx + 1);
            setActiveSection(SECTIONS[nextIdx]);
            setFocusedContentIndex(0);
          } else if (dir === 'right') {
            setFocusZone('content');
            setFocusedContentIndex(0);
          }
        } else {
          // Portrait: horizontal sidebar
          if (dir === 'left') {
            const nextIdx = Math.max(0, currentIdx - 1);
            setActiveSection(SECTIONS[nextIdx]);
            setFocusedContentIndex(0);
          } else if (dir === 'right') {
            const nextIdx = Math.min(SECTIONS.length - 1, currentIdx + 1);
            setActiveSection(SECTIONS[nextIdx]);
            setFocusedContentIndex(0);
          } else if (dir === 'down') {
            setFocusZone('content');
            setFocusedContentIndex(0);
          }
        }
      } else {
        // focusZone === 'content'
        const maxItems = getContentItemCount();
        if (dir === 'up') {
          if (focusedContentIndex === 0) {
            if (!isLandscape) {
              setFocusZone('sidebar');
            }
          } else {
            setFocusedContentIndex((prev) => Math.max(0, prev - 1));
          }
        } else if (dir === 'down') {
          setFocusedContentIndex((prev) => Math.min(maxItems - 1, prev + 1));
        } else if (dir === 'left') {
          const idxOffset = liveContainerStatus.isLinked ? 1 : 0;
          const isHorizontalLiveItem =
            activeSection === 'livecontainer' &&
            [2 + idxOffset, 3 + idxOffset, 4 + idxOffset, 5 + idxOffset].includes(focusedContentIndex);
          const isHorizontalControllerItem =
            activeSection === 'controllers' && focusedContentIndex >= 1 && focusedContentIndex <= 3;

          if (isHorizontalLiveItem || isHorizontalControllerItem) {
            handleContentLeftRight('left');
          } else if (isLandscape) {
            setFocusZone('sidebar');
          }
        } else if (dir === 'right') {
          handleContentLeftRight('right');
        }
      }
    },
    [
      activeSection,
      isControllerTestActive,
      focusZone,
      isLandscape,
      SECTIONS,
      getContentItemCount,
      focusedContentIndex,
      liveContainerStatus.isLinked,
      handleContentLeftRight,
    ]
  );

  const handleGamepadButtonPress = React.useCallback(
    (button: ControllerButton) => {
      if (activeSection === 'controllers' && isControllerTestActive) {
        if (button === 'B') {
          const now = Date.now();
          if (now - lastBTapTimeRef.current < 750) {
            setControllerTestActive(false);
            return;
          }
          lastBTapTimeRef.current = now;
        }
        return;
      }

      if (button === 'B') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        if (focusZone === 'content') {
          setFocusZone('sidebar');
        } else {
          onBackPress?.();
        }
      } else if (button === 'A') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        if (focusZone === 'sidebar') {
          setFocusZone('content');
          setFocusedContentIndex(0);
        } else {
          executeContentAction(focusedContentIndex);
        }
      }
    },
    [
      activeSection,
      isControllerTestActive,
      focusZone,
      onBackPress,
      executeContentAction,
      focusedContentIndex,
      setControllerTestActive,
      customThemes,
    ]
  );

  const { controllers, activeController, isConnected, lastPressedButton } = useGamepad({
    onDirection: handleGamepadDirection,
    onButtonPress: handleGamepadButtonPress,
  });

  const renderSidebarItem = (id: SettingsSection, label: string) => {
    const isSelected = activeSection === id;
    const isSidebarFocused = focusZone === 'sidebar' && isSelected;
    return (
      <Pressable
        key={id}
        style={({ pressed }) => [
          styles.menuItem,
          isSelected
            ? [
                styles.menuItemSelected,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: isSidebarFocused ? colors.accent : colors.border,
                },
                isSidebarFocused && styles.menuItemSelectedGlow,
              ]
            : styles.menuItemDefault,
          pressed && styles.menuItemPressed,
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
          setActiveSection(id);
          setFocusZone('sidebar');
          setFocusedContentIndex(0);
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: isSelected }}
      >
        {isSelected && (
          <View
            style={[
              styles.selectedAccentTick,
              { backgroundColor: isSidebarFocused ? colors.accentStrong : colors.textSecondary },
            ]}
          />
        )}
        <Text
          style={[
            styles.menuItemText,
            { color: colors.textSecondary },
            isSelected && [styles.menuItemTextSelected, { color: colors.text }],
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1. Header Bar: Gear Icon + System Settings */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: colors.background,
            paddingTop: isLandscape ? Math.max(insets.top, 4) : insets.top + 4,
            paddingLeft: Math.max(insets.left, isLandscape ? 28 : 20),
            paddingRight: Math.max(insets.right, isLandscape ? 28 : 20),
            minHeight: (isLandscape ? 44 : 48) + (isLandscape ? Math.max(insets.top, 0) : insets.top),
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="settings-sharp" size={24} color={colors.text} style={{ marginRight: 10 }} />
          <Text style={[styles.titleText, { color: colors.text }]}>{t('settings.title')}</Text>
        </View>
      </View>

      {/* Hairline Divider below Header Bar */}
      <View style={[styles.headerDivider, { backgroundColor: colors.border }]} />

      {/* 2. Main Body: Split View (Sidebar + Detail Panel) */}
      <View style={[styles.bodyLayout, isLandscape && styles.bodyLayoutLandscape]}>
        {/* Left Sidebar Menu */}
        <ScrollView
          ref={sidebarScrollRef}
          horizontal={!isLandscape}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          style={[
            styles.sidebar,
            {
              backgroundColor: colors.background,
              borderRightColor: colors.border,
              borderBottomColor: colors.border,
              width: isLandscape ? 230 + Math.max(insets.left, 0) : undefined,
              paddingLeft: isLandscape ? Math.max(insets.left, 8) : 0,
            },
            isLandscape ? styles.sidebarLandscape : styles.sidebarPortrait,
          ]}
          contentContainerStyle={
            isLandscape
              ? styles.sidebarContentLandscape
              : [
                styles.sidebarContentPortrait,
                {
                  paddingLeft: Math.max(insets.left, 16),
                  paddingRight: Math.max(insets.right, 16),
                },
              ]
          }
        >
          {/* Group 1 */}
          {renderSidebarItem('support', t('settings.support'))}
          {renderSidebarItem('appearance', t('settings.appearance'))}
          {renderSidebarItem('language', t('settings.language'))}
          {renderSidebarItem('orientation', t('settings.orientationTitle'))}

          {/* Group Divider */}
          {isLandscape && <View style={[styles.menuGroupDivider, { backgroundColor: colors.border }]} />}

          {/* Group 2 */}
          {renderSidebarItem('controllers', t('settings.gamepad'))}
          {renderSidebarItem('livecontainer', 'LiveContainer')}
          {renderSidebarItem('storage', t('settings.storage'))}
          {renderSidebarItem('about', t('settings.about'))}
        </ScrollView>

        {/* Right Detail Content Panel */}
        <ScrollView
          ref={detailScrollRef}
          style={[styles.detailPanel, { backgroundColor: colors.background }]}
          contentContainerStyle={[
            styles.detailContent,
            {
              paddingLeft: isLandscape ? 24 : Math.max(insets.left, 20),
              paddingRight: Math.max(insets.right, isLandscape ? 32 : 20),
              paddingBottom: Math.max(insets.bottom, 36),
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* SECTION: Support / Health & Safety (Matches Reference Photo Exactly) */}
          {activeSection === 'support' && (
            <View style={styles.sectionContainer}>
              <Text style={[styles.supportHeaderDescription, { color: colors.text }]}>
                {t('settings.supportDesc')}
              </Text>

              {/* Center Help Card matching the Nintendo support box */}
              <View
                style={[
                  styles.supportCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.supportIllustrationCircle}>
                  <Ionicons name="logo-github" size={38} color={colors.accentStrong} />
                </View>
                <Pressable
                  accessibilityRole="link"
                  style={[
                    styles.supportLinkWrap,
                    focusZone === 'content' && focusedContentIndex === 0 && [styles.focusedContentCard, { borderColor: colors.accent }],
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                    setFocusedContentIndex(0);
                    Linking.openURL('https://github.com/CesarGarza55/NXHorizon').catch(() => { });
                  }}
                >
                  <Text style={[styles.supportUrlText, { color: colors.accentStrong }]}>
                    github.com/CesarGarza55/NXHorizon
                  </Text>
                </Pressable>
                <Text style={[styles.supportOrgText, { color: colors.textSecondary }]}>
                  NX Horizon OS for iOS & LiveContainer
                </Text>
                <Text style={[styles.supportSubText, { color: colors.textMuted }]}>
                  Compilación de IPAs independientes y arranque directo
                </Text>

                <Pressable
                  style={({ pressed }) => [
                    styles.openGuideBtn,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                    focusZone === 'content' && focusedContentIndex === 1 && [styles.focusedContentCard, { borderColor: colors.accent }],
                    pressed && styles.openGuideBtnPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.viewOnboardingBtn')}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                    setFocusedContentIndex(1);
                    onShowOnboarding?.();
                  }}
                >
                  <Ionicons name="book-outline" size={17} color={colors.accent} style={{ marginRight: 8 }} />
                  <Text style={[styles.openGuideBtnText, { color: colors.text }]}>
                    {t('settings.viewOnboardingBtn')}
                  </Text>
                </Pressable>
              </View>

              {/* Subsection: Safety Precautions & Standalone IPA rule */}
              <View style={[styles.subSectionHeader, { borderTopColor: colors.border }]}>
                <Text style={[styles.subSectionTitle, { color: colors.text }]}>
                  ▲ {t('settings.supportSafetyTitle')}
                </Text>
                <Text style={[styles.subSectionDesc, { color: colors.textSecondary }]}>
                  {t('settings.supportSafetyDesc')}
                </Text>
              </View>

              {/* Subsection: System Status */}
              <View style={[styles.subSectionHeader, { borderTopColor: colors.border }]}>
                <Text style={[styles.subSectionTitle, { color: colors.text }]}>
                  {t('settings.status')}
                </Text>
                <View style={styles.statusRowItem}>
                  <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>LiveContainer:</Text>
                  <Text style={[styles.statusValue, { color: liveContainerStatus.isLinked ? colors.success : colors.textMuted }]}>
                    {liveContainerStatus.isLinked ? (liveContainerStatus.folderName || t('settings.livecontainerStatusLinkedShort')) : t('settings.livecontainerStatusUnlinked')}
                  </Text>
                </View>
                <View style={styles.statusRowItem}>
                  <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>{t('settings.directBootStatusLabel')}</Text>
                  <Text style={[styles.statusValue, { color: isDirectBootEnabled ? colors.success : colors.textMuted }]}>
                    {isDirectBootEnabled ? t('settings.directBootActiveFullscreen') : t('settings.directBootDisabled')}
                  </Text>
                </View>
                <View style={styles.statusRowItem}>
                  <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>{t('settings.versionLabel')}</Text>
                  <Text style={[styles.statusValue, { color: colors.text }]}>{t('settings.versionValue', { version: appVersion })}</Text>
                </View>
              </View>
            </View>
          )}

          {/* SECTION: Appearance */}
          {activeSection === 'appearance' && (
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.appearance')}</Text>
              <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
                {t('settings.themeDescription')}
              </Text>
              <View style={[styles.optionsList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {([
                  ['system', 'settings.themeSystem'],
                  ['light', 'settings.themeLight'],
                  ['dark', 'settings.themeDark'],
                ] as const).map(([mode, label], index) => {
                  const isFocused = focusZone === 'content' && focusedContentIndex === index;
                  const isSelected = activeCustomThemeId === null && themeMode === mode;
                  return (
                    <Pressable
                      key={mode}
                      style={[
                        styles.optionRow,
                        index < 2 && styles.optionRowBorder,
                        { borderBottomColor: colors.border },
                        isFocused && [styles.focusedOptionRow, { backgroundColor: colors.accentSurface, borderColor: colors.accent }],
                      ]}
                      onPress={() => {
                        setFocusedContentIndex(index);
                        handleThemeChange(mode);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {isFocused && (
                          <View style={[styles.selectedAccentTick, { backgroundColor: colors.accentStrong }]} />
                        )}
                        <Text
                          style={[
                            styles.optionLabel,
                            { color: colors.text },
                          (isSelected || isFocused) && { color: colors.accentStrong, fontWeight: '700' },
                          ]}
                        >
                          {t(label)}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                      )}
                    </Pressable>
                  );
                })}
                <Pressable
                  style={[
                    styles.optionRow,
                    styles.optionRowBorder,
                    { borderBottomColor: colors.border },
                    focusZone === 'content' && focusedContentIndex === 3 && [
                      styles.focusedOptionRow,
                      { backgroundColor: colors.accentSurface, borderColor: colors.accent },
                    ],
                  ]}
                  onPress={() => {
                    setFocusedContentIndex(3);
                    setEditingTheme(null);
                    setIsThemeEditorVisible(true);
                  }}
                  accessibilityRole="button"
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="color-palette-outline" size={19} color={colors.accent} />
                    <Text style={[styles.optionLabel, { color: colors.text }]}>
                      {t('settings.createTheme')}
                    </Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
                </Pressable>
              </View>

              {customThemes.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 22 }]}>
                    {t('settings.customThemes')}
                  </Text>
                  <View style={[styles.optionsList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {customThemes.map((theme, index) => {
                      const focusIndex = index + 4;
                      const isFocused = focusZone === 'content' && focusedContentIndex === focusIndex;
                      const isSelected = activeCustomThemeId === theme.id;
                      return (
                        <View
                          key={theme.id}
                          style={[
                            styles.optionRow,
                            index < customThemes.length - 1 && styles.optionRowBorder,
                            { borderBottomColor: colors.border },
                            isFocused && [
                              styles.focusedOptionRow,
                              { backgroundColor: colors.accentSurface, borderColor: colors.accent },
                            ],
                          ]}
                        >
                          <Pressable
                            style={{ flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                            onPress={() => {
                              setFocusedContentIndex(focusIndex);
                              handleSelectCustomTheme(theme.id);
                            }}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: isSelected }}
                          >
                            <View
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                backgroundColor: theme.colors.accent,
                                borderWidth: 1,
                                borderColor: theme.colors.border,
                              }}
                            />
                            <Text
                              style={[
                                styles.optionLabel,
                                { color: isSelected || isFocused ? colors.accentStrong : colors.text },
                              ]}
                              numberOfLines={1}
                            >
                              {theme.name}
                            </Text>
                            {isSelected && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
                          </Pressable>
                          <Pressable
                            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                            onPress={() => {
                              setEditingTheme(theme);
                              setIsThemeEditorVisible(true);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={t('settings.editTheme')}
                          >
                            <Ionicons name="pencil-outline" size={17} color={colors.accent} />
                          </Pressable>
                          <Pressable
                            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                            onPress={() => handleDeleteCustomTheme(theme)}
                            accessibilityRole="button"
                            accessibilityLabel={t('settings.themeDelete')}
                          >
                            <Ionicons name="trash-outline" size={17} color={colors.destructive} />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          )}

          {/* SECTION: Language */}
          {activeSection === 'language' && (
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.language')}</Text>
              <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
                {t('settings.languageDescription')}
              </Text>

              <View style={[styles.optionsList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {[
                  { id: 'auto' as SupportedLanguage, label: t('settings.languageSystem') },
                  { id: 'es' as SupportedLanguage, label: 'Español' },
                  { id: 'en' as SupportedLanguage, label: 'English' },
                ].map((item, index) => {
                  const isFocused = focusZone === 'content' && focusedContentIndex === index;
                  const isSelected = languagePreference === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.optionRow,
                        index < 2 && styles.optionRowBorder,
                        { borderBottomColor: colors.border },
                        isFocused && [styles.focusedOptionRow, { backgroundColor: colors.accentSurface, borderColor: colors.accent }],
                      ]}
                      onPress={() => {
                        setFocusedContentIndex(index);
                        handleLanguageChange(item.id);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {isFocused && (
                          <View style={[styles.selectedAccentTick, { backgroundColor: colors.accentStrong }]} />
                        )}
                        <Text
                          style={[
                            styles.optionLabel,
                            { color: colors.text },
                            (isSelected || isFocused) && { color: colors.accentStrong, fontWeight: '700' },
                          ]}
                        >
                          {item.label}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* SECTION: Orientation */}
          {activeSection === 'orientation' && (
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.orientationTitle')}</Text>
              <View style={[styles.optionsList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {[
                  { id: 'auto' as const, label: t('settings.orientationAuto') },
                  { id: 'landscape' as const, label: t('settings.orientationLandscape') },
                  { id: 'portrait' as const, label: t('settings.orientationPortrait') },
                ].map((item, index) => {
                  const isFocused = focusZone === 'content' && focusedContentIndex === index;
                  const isSelected = orientationMode === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.optionRow,
                        index < 2 && styles.optionRowBorder,
                        { borderBottomColor: colors.border },
                        isFocused && [styles.focusedOptionRow, { backgroundColor: colors.accentSurface, borderColor: colors.accent }],
                      ]}
                      onPress={() => {
                        setFocusedContentIndex(index);
                        handleOrientationChange(item.id);
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {isFocused && (
                          <View style={[styles.selectedAccentTick, { backgroundColor: colors.accentStrong }]} />
                        )}
                        <Text
                          style={[
                            styles.optionLabel,
                            { color: colors.text },
                            (isSelected || isFocused) && { color: colors.accentStrong, fontWeight: '700' },
                          ]}
                        >
                          {item.label}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* SECTION: Controllers */}
          {activeSection === 'controllers' && (
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.gamepad')}</Text>
              <View style={[styles.controllerStatusBox, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                <View
                  style={[
                    styles.statusDot,
                    isConnected ? styles.statusDotOnline : styles.statusDotOffline,
                  ]}
                />
                <Text style={[styles.statusText, { color: colors.text }]}>
                  {isConnected ? t('settings.gamepadConnected') : t('settings.gamepadDisconnected')}
                </Text>
              </View>

              {activeController && (
                <View style={[styles.controllerMetaBox, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={[styles.metaLine, { color: colors.textSecondary }]}>
                    {t('settings.gamepadName', { name: activeController.vendorName })}
                  </Text>
                  <Text style={[styles.metaLine, { color: colors.textSecondary }]}>
                    {typeof activeController.batteryLevel === 'number' ? (
                      <>
                        {t('settings.batteryLevel', { percent: activeController.batteryLevel }).split(activeController.batteryLevel.toString())[0]}
                        <Text
                          style={{
                            color:
                              activeController.batteryLevel <= 10
                                ? '#FF3B30'
                                : activeController.batteryLevel <= 20
                                ? '#FF9500'
                                : colors.text,
                            fontWeight: '700',
                          }}
                        >
                          {activeController.batteryLevel}%
                        </Text>
                      </>
                    ) : (
                      t('settings.batteryUnknown')
                    )}
                  </Text>
                </View>
              )}

              {/* Diagnostics Box */}
              <View style={[styles.diagnosticsContainer, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <Text style={[styles.diagnosticsTitle, { color: colors.textMuted }]}>{t('settings.diagnostics')}</Text>
                  <Pressable
                    style={[
                      styles.testToggleBadge,
                      {
                        backgroundColor: isControllerTestActive ? colors.accentSurface : colors.surfaceSecondary,
                        borderColor: isControllerTestActive ? colors.accent : colors.border,
                      },
                      focusZone === 'content' && focusedContentIndex === 0 && [styles.focusedContentCard, { borderColor: colors.accent }],
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setFocusedContentIndex(0);
                      setControllerTestActive(!isControllerTestActive);
                    }}
                  >
                    <Text
                      style={[
                        styles.testToggleBadgeText,
                        { color: isControllerTestActive ? colors.accentStrong : colors.textSecondary },
                      ]}
                    >
                      {isControllerTestActive ? t('settings.controllerTestFinish') : t('settings.controllerTestBtn')}
                    </Text>
                  </Pressable>
                </View>
                <View style={[styles.buttonVisualizerBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Text style={[styles.buttonVisualizerText, { color: colors.accentStrong }]}>
                    {lastPressedButton || '---'}
                  </Text>
                </View>
                {isControllerTestActive ? (
                  <Text style={[styles.diagnosticsInstructionText, { color: colors.accentStrong }]}>
                    {t('settings.controllerTestInstruction')}
                  </Text>
                ) : null}
              </View>

              {/* Deadzone selector */}
              <Text style={[styles.deadzoneTitle, { color: colors.textSecondary }]}>{t('settings.deadzone')}</Text>
              <Text style={[styles.deadzoneDesc, { color: colors.textMuted }]}>
                {t('settings.deadzoneDesc')}
              </Text>
              <View style={styles.deadzoneRow}>
                {[10, 15, 20].map((val, idx) => {
                  const chipIndex = idx + 1;
                  const isFocused = focusZone === 'content' && focusedContentIndex === chipIndex;
                  return (
                    <Pressable
                      key={val}
                      style={[
                        styles.deadzoneChip,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                        currentDeadzone === val && { borderColor: colors.accent, backgroundColor: colors.accentSurface },
                        isFocused && [styles.focusedContentCard, { borderColor: colors.accent }],
                      ]}
                      onPress={() => {
                        setFocusedContentIndex(chipIndex);
                        handleDeadzoneChange(val);
                      }}
                    >
                      <Text
                        style={[
                          styles.deadzoneChipText,
                          { color: colors.textSecondary },
                          (currentDeadzone === val || isFocused) && { color: colors.accentStrong, fontWeight: '700' },
                        ]}
                      >
                        {t('settings.deadzoneValue', { value: val })}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* SECTION: LiveContainer */}
          {activeSection === 'livecontainer' && (() => {
            const idxOffset = liveContainerStatus.isLinked ? 1 : 0;
            return (
              <View style={styles.sectionContainer}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>LiveContainer</Text>
                <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
                  {t('settings.livecontainerDesc')}
                </Text>

                <View style={[styles.optionsList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.optionRow, styles.optionRowBorder, { borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={[styles.optionLabel, { color: colors.text }]}>{t('settings.status')}</Text>
                      <Text style={[styles.optionSubText, { color: colors.textSecondary }]}>
                        {liveContainerStatus.isLinked
                          ? t('settings.livecontainerStatusLinked', { folder: liveContainerStatus.folderName })
                          : t('settings.livecontainerStatusUnlinked')}
                      </Text>
                    </View>
                    <View style={[styles.badge, { borderColor: colors.accent, backgroundColor: colors.accentSurface }]}>
                      <Text style={[styles.badgeText, { color: colors.accentStrong }]}>
                        {liveContainerStatus.isLinked ? t('settings.livecontainerStatusLinkedBadge') : t('settings.livecontainerStatusUnlinkedBadge')}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    style={[
                      styles.optionRow,
                      styles.optionRowBorder,
                      { borderBottomColor: colors.border },
                      focusZone === 'content' && focusedContentIndex === 0 && [styles.focusedOptionRow, { backgroundColor: colors.accentSurface, borderColor: colors.accent }],
                    ]}
                    onPress={() => {
                      setFocusedContentIndex(0);
                      handleLinkLiveContainer();
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {focusZone === 'content' && focusedContentIndex === 0 && (
                        <View style={[styles.selectedAccentTick, { backgroundColor: colors.accentStrong }]} />
                      )}
                      <Text style={[styles.optionLabel, { color: colors.accentStrong }]}>
                        {liveContainerStatus.isLinked
                          ? t('settings.changeLiveContainerFolder')
                          : t('settings.linkLiveContainer')}
                      </Text>
                    </View>
                    <Ionicons name="folder-open-outline" size={18} color={colors.accentStrong} />
                  </Pressable>

                  {liveContainerStatus.isLinked && (
                    <Pressable
                      style={[
                        styles.optionRow,
                        styles.optionRowBorder,
                        { borderBottomColor: colors.border },
                        focusZone === 'content' && focusedContentIndex === 1 && [styles.focusedOptionRow, { backgroundColor: colors.accentSurface, borderColor: colors.accent }],
                      ]}
                      onPress={() => {
                        setFocusedContentIndex(1);
                        handleUnlinkLiveContainer();
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {focusZone === 'content' && focusedContentIndex === 1 && (
                          <View style={[styles.selectedAccentTick, { backgroundColor: colors.accentStrong }]} />
                        )}
                        <Text style={[styles.optionLabel, { color: colors.destructive }]}>
                          {t('settings.unlinkLiveContainer')}
                        </Text>
                      </View>
                      <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                    </Pressable>
                  )}

                  <Pressable
                    style={[
                      styles.optionRow,
                      focusZone === 'content' && focusedContentIndex === (1 + idxOffset) && [styles.focusedOptionRow, { backgroundColor: colors.accentSurface, borderColor: colors.accent }],
                    ]}
                    onPress={() => {
                      setFocusedContentIndex(1 + idxOffset);
                      handleToggleDirectBoot(!isDirectBootEnabled);
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {focusZone === 'content' && focusedContentIndex === (1 + idxOffset) && (
                          <View style={[styles.selectedAccentTick, { backgroundColor: colors.accentStrong }]} />
                        )}
                        <Text style={[styles.optionLabel, { color: colors.text }]}>
                          {t('settings.directBootTitle')}
                        </Text>
                      </View>
                      <Text style={[styles.optionSubText, { color: colors.textSecondary }]}>
                        {t('settings.directBootDesc')}
                      </Text>
                    </View>
                    <Switch
                      value={isDirectBootEnabled}
                      onValueChange={handleToggleDirectBoot}
                      trackColor={{ false: colors.border, true: colors.accent }}
                      thumbColor={colors.surface}
                    />
                  </Pressable>
                </View>

                {/* Emulation & Performance Defaults Card */}
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>
                  {t('settings.performanceDefaultsTitle')}
                </Text>
                <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
                  {t('settings.performanceDefaultsDesc')}
                </Text>

                <View style={[styles.optionsList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {/* Console Mode */}
                  <Pressable
                    style={[
                      styles.optionRow,
                      styles.optionRowBorder,
                      { borderBottomColor: colors.border },
                      focusZone === 'content' && focusedContentIndex === (2 + idxOffset) && [styles.focusedOptionRow, { backgroundColor: colors.accentSurface, borderColor: colors.accent }],
                    ]}
                    onPress={() => {
                      setFocusedContentIndex(2 + idxOffset);
                      const nextMode = globalLaunchConfig.opMode === 'handheld' ? 'docked' : 'handheld';
                      updateGlobalLaunchConfig({ opMode: nextMode });
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {focusZone === 'content' && focusedContentIndex === (2 + idxOffset) && (
                          <View style={[styles.selectedAccentTick, { backgroundColor: colors.accentStrong }]} />
                        )}
                        <Text style={[styles.optionLabel, { color: colors.text }]}>
                          {t('gameConfig.modeHeading')}
                        </Text>
                      </View>
                      <Text style={[styles.optionSubText, { color: colors.textSecondary }]}>
                        {globalLaunchConfig.opMode === 'handheld' ? `${t('gameConfig.modeHandheld')} (720p)` : `${t('gameConfig.modeDocked')} (1080p)`}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Pressable
                        style={[
                          styles.badge,
                          globalLaunchConfig.opMode === 'handheld'
                            ? { borderColor: colors.accent, backgroundColor: colors.accentSurface }
                            : { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
                        ]}
                        onPress={() => {
                          setFocusedContentIndex(2 + idxOffset);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                          updateGlobalLaunchConfig({ opMode: 'handheld' });
                        }}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            {
                              color: globalLaunchConfig.opMode === 'handheld' ? colors.accentStrong : colors.textSecondary,
                              fontWeight: globalLaunchConfig.opMode === 'handheld' ? '700' : '500',
                            },
                          ]}
                        >
                          {t('gameConfig.modeHandheld')}
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.badge,
                          globalLaunchConfig.opMode === 'docked'
                            ? { borderColor: colors.accent, backgroundColor: colors.accentSurface }
                            : { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
                        ]}
                        onPress={() => {
                          setFocusedContentIndex(2 + idxOffset);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                          updateGlobalLaunchConfig({ opMode: 'docked' });
                        }}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            {
                              color: globalLaunchConfig.opMode === 'docked' ? colors.accentStrong : colors.textSecondary,
                              fontWeight: globalLaunchConfig.opMode === 'docked' ? '700' : '500',
                            },
                          ]}
                        >
                          {t('gameConfig.modeDocked')}
                        </Text>
                      </Pressable>
                    </View>
                  </Pressable>

                  {/* FPS Target */}
                  <Pressable
                    style={[
                      styles.optionRow,
                      styles.optionRowBorder,
                      { borderBottomColor: colors.border },
                      focusZone === 'content' && focusedContentIndex === (3 + idxOffset) && [styles.focusedOptionRow, { backgroundColor: colors.accentSurface, borderColor: colors.accent }],
                    ]}
                    onPress={() => {
                      setFocusedContentIndex(3 + idxOffset);
                      const nextFps = globalLaunchConfig.fpsTarget === 0 ? 30 : globalLaunchConfig.fpsTarget === 30 ? 60 : 0;
                      updateGlobalLaunchConfig({ fpsTarget: nextFps });
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {focusZone === 'content' && focusedContentIndex === (3 + idxOffset) && (
                          <View style={[styles.selectedAccentTick, { backgroundColor: colors.accentStrong }]} />
                        )}
                        <Text style={[styles.optionLabel, { color: colors.text }]}>
                          {t('gameConfig.fpsHeading')}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {[
                        { val: 0, label: 'Auto' },
                        { val: 30, label: '30' },
                        { val: 60, label: '60' },
                      ].map((item) => {
                        const isActive = globalLaunchConfig.fpsTarget === item.val;
                        return (
                          <Pressable
                            key={item.val}
                            style={[
                              styles.badge,
                              isActive
                                ? { borderColor: colors.accent, backgroundColor: colors.accentSurface }
                                : { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
                            ]}
                            onPress={() => {
                              setFocusedContentIndex(3 + idxOffset);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                              updateGlobalLaunchConfig({ fpsTarget: item.val as 0 | 30 | 60 });
                            }}
                          >
                            <Text
                              style={[
                                styles.badgeText,
                                {
                                  color: isActive ? colors.accentStrong : colors.textSecondary,
                                  fontWeight: isActive ? '700' : '500',
                                },
                              ]}
                            >
                              {item.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </Pressable>

                  {/* Metal Performance HUD Toggle */}
                  <Pressable
                    style={[
                      styles.optionRow,
                      styles.optionRowBorder,
                      { borderBottomColor: colors.border },
                      focusZone === 'content' && focusedContentIndex === (4 + idxOffset) && [styles.focusedOptionRow, { backgroundColor: colors.accentSurface, borderColor: colors.accent }],
                    ]}
                    onPress={() => {
                      setFocusedContentIndex(4 + idxOffset);
                      updateGlobalLaunchConfig({ metalHud: !globalLaunchConfig.metalHud });
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {focusZone === 'content' && focusedContentIndex === (4 + idxOffset) && (
                          <View style={[styles.selectedAccentTick, { backgroundColor: colors.accentStrong }]} />
                        )}
                        <Text style={[styles.optionLabel, { color: colors.text }]}>
                          {t('gameConfig.metalHudTitle')}
                        </Text>
                      </View>
                      <Text style={[styles.optionSubText, { color: colors.textSecondary }]}>
                        {t('gameConfig.metalHudDesc')}
                      </Text>
                    </View>
                    <Switch
                      value={globalLaunchConfig.metalHud}
                      onValueChange={(val) => {
                        setFocusedContentIndex(4 + idxOffset);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                        updateGlobalLaunchConfig({ metalHud: val });
                      }}
                      trackColor={{ false: colors.border, true: colors.accent }}
                      thumbColor={colors.surface}
                    />
                  </Pressable>

                  {/* Gyroscope Motion Toggle */}
                  <Pressable
                    style={[
                      styles.optionRow,
                      styles.optionRowBorder,
                      { borderBottomColor: colors.border },
                      focusZone === 'content' && focusedContentIndex === (5 + idxOffset) && [styles.focusedOptionRow, { backgroundColor: colors.accentSurface, borderColor: colors.accent }],
                    ]}
                    onPress={() => {
                      setFocusedContentIndex(5 + idxOffset);
                      updateGlobalLaunchConfig({ phoneMotion: !globalLaunchConfig.phoneMotion });
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {focusZone === 'content' && focusedContentIndex === (5 + idxOffset) && (
                          <View style={[styles.selectedAccentTick, { backgroundColor: colors.accentStrong }]} />
                        )}
                        <Text style={[styles.optionLabel, { color: colors.text }]}>
                          {t('gameConfig.motionTitle')}
                        </Text>
                      </View>
                      <Text style={[styles.optionSubText, { color: colors.textSecondary }]}>
                        {t('gameConfig.motionDesc')}
                      </Text>
                    </View>
                    <Switch
                      value={globalLaunchConfig.phoneMotion}
                      onValueChange={(val) => {
                        setFocusedContentIndex(5 + idxOffset);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                        updateGlobalLaunchConfig({ phoneMotion: val });
                      }}
                      trackColor={{ false: colors.border, true: colors.accent }}
                      thumbColor={colors.surface}
                    />
                  </Pressable>

                  {/* Apply Defaults to All Games Button */}
                  <Pressable
                    style={[
                      styles.optionRow,
                      focusZone === 'content' && focusedContentIndex === (6 + idxOffset) && [styles.focusedOptionRow, { backgroundColor: colors.accentSurface, borderColor: colors.accent }],
                    ]}
                    onPress={() => {
                      setFocusedContentIndex(6 + idxOffset);
                      handleApplyDefaultsToAll();
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {focusZone === 'content' && focusedContentIndex === (6 + idxOffset) && (
                          <View style={[styles.selectedAccentTick, { backgroundColor: colors.accentStrong }]} />
                        )}
                        <Text style={[styles.optionLabel, { color: colors.accentStrong }]}>
                          {t('settings.applyDefaultsToAllGames')}
                        </Text>
                      </View>
                      <Text style={[styles.optionSubText, { color: colors.textSecondary }]}>
                        {t('settings.applyDefaultsToAllGamesDesc')}
                      </Text>
                    </View>
                    <Ionicons name="sparkles" size={18} color={colors.accentStrong} />
                  </Pressable>
                </View>
              </View>
            );
          })()}

          {/* SECTION: Storage & Cache */}
          {activeSection === 'storage' && (
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.storage')}</Text>
              <View style={[styles.optionsList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Pressable
                  style={[
                    styles.optionRow,
                    styles.optionRowBorder,
                    { borderBottomColor: colors.border },
                    focusZone === 'content' && focusedContentIndex === 0 && [styles.focusedOptionRow, { backgroundColor: colors.accentSurface, borderColor: colors.accent }],
                  ]}
                  onPress={() => {
                    setFocusedContentIndex(0);
                    handleClearCache();
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {focusZone === 'content' && focusedContentIndex === 0 && (
                      <View style={[styles.selectedAccentTick, { backgroundColor: colors.accentStrong }]} />
                    )}
                    <Text style={[styles.optionLabel, { color: colors.text }]}>
                      {t('settings.clearCoverCache')}
                    </Text>
                  </View>
                  <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
                </Pressable>

                <Pressable
                  style={[
                    styles.optionRow,
                    focusZone === 'content' && focusedContentIndex === 1 && [styles.focusedOptionRow, { backgroundColor: colors.accentSurface, borderColor: colors.accent }],
                  ]}
                  onPress={() => {
                    setFocusedContentIndex(1);
                    Alert.alert(
                      t('common.delete'),
                      t('settings.resetLibraryConfirm'),
                      [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: t('common.delete'), style: 'destructive', onPress: clearAllGames },
                      ]
                    );
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {focusZone === 'content' && focusedContentIndex === 1 && (
                      <View style={[styles.selectedAccentTick, { backgroundColor: colors.accentStrong }]} />
                    )}
                    <Text style={[styles.optionLabel, { color: colors.destructive }]}>
                      {t('settings.resetLibrary')}
                    </Text>
                  </View>
                  <Ionicons name="refresh-outline" size={18} color={colors.destructive} />
                </Pressable>
              </View>
            </View>
          )}

          {/* SECTION: About Console (Expanded & Detailed) */}
          {activeSection === 'about' && (
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.aboutTitle')}</Text>

              {/* Console Version Card */}
              <View
                style={[
                  styles.aboutHeaderCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.aboutVersionRow}>
                  <Text style={[styles.aboutVersionText, { color: colors.text }]}>
                    {t('settings.version', { version: appVersion })}
                  </Text>
                  <View
                    style={[
                      styles.aboutStatusBadge,
                      updateStatus === 'update_available'
                        ? { backgroundColor: colors.accentSurface, borderColor: colors.accent }
                        : updateStatus === 'up_to_date'
                        ? { backgroundColor: 'rgba(69, 201, 149, 0.15)', borderColor: colors.success }
                        : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.aboutStatusText,
                        {
                          color:
                            updateStatus === 'update_available'
                              ? colors.accentStrong
                              : updateStatus === 'up_to_date'
                              ? colors.success
                              : colors.textSecondary,
                        },
                      ]}
                    >
                      {updateStatus === 'checking'
                        ? t('settings.checkingUpdatesBadge')
                        : updateStatus === 'update_available'
                        ? t('settings.updateAvailableBadge')
                        : updateStatus === 'up_to_date'
                        ? t('settings.upToDateBadge')
                        : 'OFFLINE'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.aboutSubtitleText, { color: colors.textSecondary }]}>
                  {t('settings.aboutSubtitle')}
                </Text>

                {/* Live update status info and action buttons */}
                <View style={[styles.updateActionContainer, { borderTopColor: colors.border }]}>
                  {updateStatus === 'update_available' && latestRelease && (
                    <View style={styles.updateAvailableBox}>
                      <Text style={[styles.updateAvailableTitle, { color: colors.accentStrong }]}>
                        {t('settings.newVersionAvailable', { version: latestRelease.version })}
                      </Text>
                      {latestRelease.releaseNotes ? (
                        <Text style={[styles.updateNotesText, { color: colors.textSecondary }]} numberOfLines={3}>
                          {latestRelease.releaseNotes}
                        </Text>
                      ) : null}
                      <Pressable
                        style={[
                          styles.downloadBtn,
                          { backgroundColor: colors.accent },
                          focusZone === 'content' && focusedContentIndex === 0 && [styles.focusedContentCard, { borderColor: colors.accent }],
                        ]}
                        onPress={() => {
                          setFocusedContentIndex(0);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                          if (latestRelease.downloadUrl) {
                            Linking.openURL(latestRelease.downloadUrl).catch(() => {});
                          }
                        }}
                      >
                        <Ionicons name="cloud-download-outline" size={16} color="#000" />
                        <Text style={styles.downloadBtnText}>
                          {t('settings.downloadUpdate')}
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  {updateStatus === 'up_to_date' && (
                    <Text style={[styles.upToDateSubtext, { color: colors.textMuted }]}>
                      {t('settings.latestVersionInstalled')}
                    </Text>
                  )}

                  <Pressable
                    style={[
                      styles.checkUpdatesBtnRow,
                      focusZone === 'content' &&
                        focusedContentIndex === (updateStatus === 'update_available' ? 1 : 0) && [
                          styles.focusedContentCard,
                          { borderColor: colors.accent, paddingHorizontal: 8, paddingVertical: 4 },
                        ],
                    ]}
                    onPress={() => {
                      setFocusedContentIndex(updateStatus === 'update_available' ? 1 : 0);
                      handleCheckForUpdates();
                    }}
                    disabled={updateStatus === 'checking'}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={14}
                      color={updateStatus === 'checking' ? colors.textMuted : colors.accentStrong}
                    />
                    <Text
                      style={[
                        styles.checkUpdatesBtnText,
                        { color: updateStatus === 'checking' ? colors.textMuted : colors.accentStrong },
                      ]}
                    >
                      {updateStatus === 'checking'
                        ? t('settings.checkingUpdatesBadge')
                        : t('settings.checkUpdatesBtn')}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Main Description */}
              <Text style={[styles.aboutBodyText, { color: colors.textSecondary }]}>
                {t('settings.aboutDescription')}
              </Text>

              {/* Key Features List */}
              <View style={[styles.subSectionHeader, { borderTopColor: colors.border }]}>
                <Text style={[styles.subSectionTitle, { color: colors.text }]}>
                  {t('settings.aboutKeyFeatures')}
                </Text>
              </View>

              <View
                style={[
                  styles.optionsList,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={[styles.featureItemRow, styles.optionRowBorder, { borderBottomColor: colors.border }]}>
                  <View style={styles.featureIconWrap}>
                    <Ionicons name="game-controller-outline" size={18} color={colors.accentStrong} />
                  </View>
                  <Text style={[styles.featureItemText, { color: colors.text }]}>
                    {t('settings.aboutFeature1')}
                  </Text>
                </View>

                <View style={[styles.featureItemRow, styles.optionRowBorder, { borderBottomColor: colors.border }]}>
                  <View style={styles.featureIconWrap}>
                    <Ionicons name="flash-outline" size={18} color={colors.accentStrong} />
                  </View>
                  <Text style={[styles.featureItemText, { color: colors.text }]}>
                    {t('settings.aboutFeature2')}
                  </Text>
                </View>

                <View style={[styles.featureItemRow, styles.optionRowBorder, { borderBottomColor: colors.border }]}>
                  <View style={styles.featureIconWrap}>
                    <Ionicons name="images-outline" size={18} color={colors.accentStrong} />
                  </View>
                  <Text style={[styles.featureItemText, { color: colors.text }]}>
                    {t('settings.aboutFeature3')}
                  </Text>
                </View>

                <View style={styles.featureItemRow}>
                  <View style={styles.featureIconWrap}>
                    <Ionicons name="color-palette-outline" size={18} color={colors.accentStrong} />
                  </View>
                  <Text style={[styles.featureItemText, { color: colors.text }]}>
                    {t('settings.aboutFeature4')}
                  </Text>
                </View>
              </View>

              {/* Requirements & Packaging */}
              <View style={[styles.subSectionHeader, { borderTopColor: colors.border }]}>
                <Text style={[styles.subSectionTitle, { color: colors.text }]}>
                  ▲ {t('settings.aboutRequirementsTitle')}
                </Text>
                <Text style={[styles.subSectionDesc, { color: colors.textSecondary }]}>
                  {t('settings.aboutRequirementsDesc')}
                </Text>
              </View>

              {/* Author & Repository */}
              <View style={[styles.subSectionHeader, { borderTopColor: colors.border }]}>
                <Text style={[styles.subSectionTitle, { color: colors.text }]}>
                  {t('settings.aboutDeveloperTitle')}
                </Text>
              </View>

              <View
                style={[
                  styles.optionsList,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={[styles.optionRow, styles.optionRowBorder, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, { color: colors.text }]}>
                      {t('settings.aboutDeveloperName')}
                    </Text>
                    <Text style={[styles.optionSubText, { color: colors.textSecondary }]}>
                      {t('settings.developerRole')}
                    </Text>
                  </View>
                  <Ionicons name="person-circle-outline" size={24} color={colors.textSecondary} />
                </View>

                <Pressable
                  style={[
                    styles.optionRow,
                    focusZone === 'content' &&
                      focusedContentIndex === (updateStatus === 'update_available' ? 2 : 1) && [
                        styles.focusedOptionRow,
                        { backgroundColor: colors.accentSurface, borderColor: colors.accent },
                      ],
                  ]}
                  accessibilityRole="link"
                  onPress={() => {
                    setFocusedContentIndex(updateStatus === 'update_available' ? 2 : 1);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                    Linking.openURL('https://github.com/CesarGarza55/NXHorizon').catch(() => { });
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {focusZone === 'content' &&
                        focusedContentIndex === (updateStatus === 'update_available' ? 2 : 1) && (
                          <View style={[styles.selectedAccentTick, { backgroundColor: colors.accentStrong }]} />
                        )}
                      <Text style={[styles.optionLabel, { color: colors.accentStrong }]}>
                        {t('settings.aboutRepoLabel')}
                      </Text>
                    </View>
                    <Text style={[styles.optionSubText, { color: colors.textSecondary }]}>
                      github.com/CesarGarza55/NXHorizon
                    </Text>
                  </View>
                  <Ionicons name="open-outline" size={18} color={colors.accentStrong} />
                </Pressable>
              </View>

              {/* Legal Disclaimer */}
              <View style={[styles.subSectionHeader, { borderTopColor: colors.border }]}>
                <Text style={[styles.subSectionTitle, { color: colors.textSecondary }]}>
                  {t('settings.aboutDisclaimerTitle')}
                </Text>
              </View>

              <View
                style={[
                  styles.disclaimerBox,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
                  {t('settings.aboutDisclaimerDesc')}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
      <ThemeEditorModal
        visible={isThemeEditorVisible}
        theme={editingTheme}
        onClose={() => {
          setIsThemeEditorVisible(false);
          setEditingTheme(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerDivider: {
    height: 1,
    width: '100%',
  },
  bodyLayout: {
    flex: 1,
  },
  bodyLayoutLandscape: {
    flexDirection: 'row',
  },
  sidebar: {
    flexGrow: 0,
  },
  sidebarLandscape: {
    width: 250,
    borderRightWidth: 1,
  },
  sidebarPortrait: {
    height: 54,
    borderBottomWidth: 1,
  },
  sidebarContentLandscape: {
    paddingVertical: 12,
  },
  sidebarContentPortrait: {
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  menuItemDefault: {
    paddingHorizontal: 26,
    paddingVertical: 10,
  },
  menuItemSelected: {
    marginHorizontal: 14,
    marginVertical: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderRadius: 2,
    position: 'relative',
  },
  menuItemSelectedGlow: {
    shadowColor: '#00D2FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 6,
  },
  focusedContentCard: {
    borderWidth: 2,
    borderRadius: 6,
    shadowColor: '#00D2FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 6,
  },
  focusedOptionRow: {
    borderWidth: 2,
    borderRadius: 6,
    shadowColor: '#00D2FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
    elevation: 4,
  },
  supportLinkWrap: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 4,
  },
  menuItemPressed: {
    opacity: 0.8,
  },
  selectedAccentTick: {
    width: 3.5,
    height: 18,
    borderRadius: 1,
    marginRight: 8,
  },
  menuItemText: {
    fontSize: 14.5,
    fontWeight: '500',
  },
  menuItemTextSelected: {
    fontWeight: '700',
  },
  menuGroupDivider: {
    height: 1,
    marginHorizontal: 22,
    marginVertical: 10,
  },
  detailPanel: {
    flex: 1,
  },
  detailContent: {
    paddingHorizontal: 30,
    paddingVertical: 22,
  },
  sectionContainer: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  supportHeaderDescription: {
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 6,
  },
  supportCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 4,
    borderWidth: 1,
    marginVertical: 4,
  },
  supportIllustrationCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  supportUrlText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  supportOrgText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  supportSubText: {
    fontSize: 11.5,
    marginBottom: 14,
  },
  openGuideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4,
  },
  openGuideBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  openGuideBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  subSectionHeader: {
    borderTopWidth: 1,
    paddingTop: 16,
    gap: 6,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  subSectionDesc: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  statusRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  statusLabel: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  optionsList: {
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  optionRowBorder: {
    borderBottomWidth: 1,
  },
  optionLabel: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  optionSubText: {
    fontSize: 11.5,
    marginTop: 2,
  },
  controllerStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOnline: {
    backgroundColor: '#10B981',
  },
  statusDotOffline: {
    backgroundColor: '#888888',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  controllerMetaBox: {
    padding: 14,
    borderRadius: 6,
    gap: 4,
  },
  metaLine: {
    fontSize: 12,
  },
  diagnosticsContainer: {
    padding: 14,
    borderRadius: 6,
    alignItems: 'center',
    gap: 8,
  },
  diagnosticsTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  buttonVisualizerBox: {
    paddingVertical: 6,
    paddingHorizontal: 22,
    borderRadius: 4,
    borderWidth: 1,
  },
  buttonVisualizerText: {
    fontSize: 16,
    fontFamily: 'Courier',
    fontWeight: '700',
  },
  testToggleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  testToggleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  diagnosticsInstructionText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  updateActionContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  updateAvailableBox: {
    marginBottom: 8,
  },
  updateAvailableTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  updateNotesText: {
    fontSize: 12,
    marginBottom: 8,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 5,
    alignSelf: 'flex-start',
    gap: 6,
  },
  downloadBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#000',
  },
  upToDateSubtext: {
    fontSize: 12,
    marginBottom: 6,
  },
  checkUpdatesBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  checkUpdatesBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deadzoneTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  deadzoneDesc: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
    marginBottom: 8,
  },
  deadzoneRow: {
    flexDirection: 'row',
    gap: 8,
  },
  deadzoneChip: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
  },
  deadzoneChipText: {
    fontSize: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Courier',
  },
  aboutHeaderCard: {
    padding: 16,
    borderRadius: 6,
    borderWidth: 1,
    gap: 6,
  },
  aboutVersionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aboutVersionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  aboutStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  aboutStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  aboutSubtitleText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  aboutBodyText: {
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 2,
  },
  featureItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  featureIconWrap: {
    marginTop: 2,
  },
  featureItemText: {
    fontSize: 12.5,
    lineHeight: 18,
    flex: 1,
  },
  disclaimerBox: {
    padding: 14,
    borderRadius: 6,
    borderWidth: 1,
  },
  disclaimerText: {
    fontSize: 11.5,
    lineHeight: 17,
  },
  aboutSubText: {
    fontSize: 12.5,
  },
});
