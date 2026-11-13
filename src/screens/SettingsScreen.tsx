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
import { setAppLanguage, SupportedLanguage } from '../i18n';
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
} from '../../modules/nx-livecontainer';
import { ThemeMode, useAppTheme } from '../theme/ThemeProvider';

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
  const { t, i18n } = useTranslation();
  const { colors, mode: themeMode, setMode: setThemeMode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);

  React.useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const { isControllerTestActive, setControllerTestActive } = useFocusStore();
  const lastBTapTimeRef = React.useRef<number>(0);

  const handleGamepadButtonPress = React.useCallback(
    (button: ControllerButton) => {
      if (button === 'B' && isControllerTestActive) {
        const now = Date.now();
        // If user double-taps B quickly within 750ms while in test mode, exit test and exit settings
        if (now - lastBTapTimeRef.current < 750) {
          setControllerTestActive(false);
          onBackPress?.();
          return;
        }
        lastBTapTimeRef.current = now;
      }
    },
    [isControllerTestActive, onBackPress, setControllerTestActive]
  );

  const { controllers, activeController, isConnected, lastPressedButton } = useGamepad({
    onButtonPress: handleGamepadButtonPress,
  });

  // When activeSection is controllers, enable test mode so B button is tested without exiting
  React.useEffect(() => {
    if (activeSection === 'controllers') {
      setControllerTestActive(true);
    } else {
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

  const handleLinkLiveContainer = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    try {
      const result = await pickLiveContainerFolder();
      if (result.isLinked) {
        setLiveContainerStatus(isLiveContainerLinked());
        // Auto-configure all existing games right away!
        for (const game of games) {
          const folder = game.containerFolder || extractContainerFolder(game.launchUrl);
          if (folder) {
            ensureGameDirectBoot(folder).catch(() => { });
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
        if (folder) {
          ensureGameDirectBoot(folder).catch(() => { });
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
  };

  const handleApplyDefaultsToAll = async () => {
    if (!liveContainerStatus.isLinked) {
      Alert.alert(t('common.error'), t('contextMenu.linkLiveContainerForDirectBoot'));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    let count = 0;
    const envMap = mapLaunchConfigToEnv(globalLaunchConfig);
    for (const game of games) {
      const folder = game.containerFolder || extractContainerFolder(game.launchUrl);
      if (folder) {
        try {
          await writeGameEnvConfig(folder, envMap);
          count++;
        } catch { }
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    Alert.alert(
      t('common.success'),
      t('settings.appliedDefaultsToAll', { count })
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

  const currentLang = i18n.language;

  const renderSidebarItem = (id: SettingsSection, label: string) => {
    const isSelected = activeSection === id;
    return (
      <Pressable
        key={id}
        style={({ pressed }) => [
          styles.menuItem,
          isSelected ? [styles.menuItemSelected, { borderColor: colors.accent }] : styles.menuItemDefault,
          pressed && styles.menuItemPressed,
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
          setActiveSection(id);
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: isSelected }}
      >
        {isSelected && (
          <View style={[styles.selectedAccentTick, { backgroundColor: colors.accentStrong }]} />
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
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
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
                    pressed && styles.openGuideBtnPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.viewOnboardingBtn')}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
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
                  <Text style={[styles.statusValue, { color: colors.text }]}>{t('settings.versionValue')}</Text>
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
                ] as const).map(([mode, label], index) => (
                  <Pressable
                    key={mode}
                    style={[
                      styles.optionRow,
                      index < 2 && styles.optionRowBorder,
                      { borderBottomColor: colors.border },
                    ]}
                    onPress={() => handleThemeChange(mode)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: themeMode === mode }}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        { color: colors.text },
                        themeMode === mode && { color: colors.accentStrong, fontWeight: '700' },
                      ]}
                    >
                      {t(label)}
                    </Text>
                    {themeMode === mode && (
                      <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                    )}
                  </Pressable>
                ))}
              </View>
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
                <Pressable
                  style={[styles.optionRow, styles.optionRowBorder, { borderBottomColor: colors.border }]}
                  onPress={() => handleLanguageChange('auto')}
                >
                  <Text style={[styles.optionLabel, { color: colors.text }]}>{t('settings.languageSystem')}</Text>
                  <Ionicons name="sparkles" size={16} color={colors.accent} />
                </Pressable>

                <Pressable
                  style={[styles.optionRow, styles.optionRowBorder, { borderBottomColor: colors.border }]}
                  onPress={() => handleLanguageChange('es')}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      { color: colors.text },
                      currentLang.startsWith('es') && { color: colors.accentStrong, fontWeight: '700' },
                    ]}
                  >
                    Español
                  </Text>
                  {currentLang.startsWith('es') && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                  )}
                </Pressable>

                <Pressable
                  style={styles.optionRow}
                  onPress={() => handleLanguageChange('en')}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      { color: colors.text },
                      currentLang.startsWith('en') && { color: colors.accentStrong, fontWeight: '700' },
                    ]}
                  >
                    English
                  </Text>
                  {currentLang.startsWith('en') && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* SECTION: Orientation */}
          {activeSection === 'orientation' && (
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.orientationTitle')}</Text>
              <View style={[styles.optionsList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Pressable
                  style={[styles.optionRow, styles.optionRowBorder, { borderBottomColor: colors.border }]}
                  onPress={() => handleOrientationChange('auto')}
                >
                  <Text style={[styles.optionLabel, { color: colors.text }, orientationMode === 'auto' && { color: colors.accentStrong, fontWeight: '700' }]}>
                    {t('settings.orientationAuto')}
                  </Text>
                  {orientationMode === 'auto' && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
                </Pressable>

                <Pressable
                  style={[styles.optionRow, styles.optionRowBorder, { borderBottomColor: colors.border }]}
                  onPress={() => handleOrientationChange('landscape')}
                >
                  <Text style={[styles.optionLabel, { color: colors.text }, orientationMode === 'landscape' && { color: colors.accentStrong, fontWeight: '700' }]}>
                    {t('settings.orientationLandscape')}
                  </Text>
                  {orientationMode === 'landscape' && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
                </Pressable>

                <Pressable
                  style={styles.optionRow}
                  onPress={() => handleOrientationChange('portrait')}
                >
                  <Text style={[styles.optionLabel, { color: colors.text }, orientationMode === 'portrait' && { color: colors.accentStrong, fontWeight: '700' }]}>
                    {t('settings.orientationPortrait')}
                  </Text>
                  {orientationMode === 'portrait' && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
                </Pressable>
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
                    {activeController.batteryLevel !== null
                      ? t('settings.batteryLevel', { percent: activeController.batteryLevel })
                      : t('settings.batteryUnknown')}
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
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
              <View style={styles.deadzoneRow}>
                {[10, 15, 20].map((val) => (
                  <Pressable
                    key={val}
                    style={[
                      styles.deadzoneChip,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      currentDeadzone === val && { borderColor: colors.accent, backgroundColor: colors.accentSurface },
                    ]}
                    onPress={() => handleDeadzoneChange(val)}
                  >
                    <Text
                      style={[
                        styles.deadzoneChipText,
                        { color: colors.textSecondary },
                        currentDeadzone === val && { color: colors.accentStrong, fontWeight: '700' },
                      ]}
                    >
                      {t('settings.deadzoneValue', { value: val })}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* SECTION: LiveContainer */}
          {activeSection === 'livecontainer' && (
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
                  style={[styles.optionRow, styles.optionRowBorder, { borderBottomColor: colors.border }]}
                  onPress={handleLinkLiveContainer}
                >
                  <Text style={[styles.optionLabel, { color: colors.accentStrong }]}>
                    {liveContainerStatus.isLinked
                      ? t('settings.changeLiveContainerFolder')
                      : t('settings.linkLiveContainer')}
                  </Text>
                  <Ionicons name="folder-open-outline" size={18} color={colors.accentStrong} />
                </Pressable>

                {liveContainerStatus.isLinked && (
                  <Pressable
                    style={[styles.optionRow, styles.optionRowBorder, { borderBottomColor: colors.border }]}
                    onPress={handleUnlinkLiveContainer}
                  >
                    <Text style={[styles.optionLabel, { color: colors.destructive }]}>
                      {t('settings.unlinkLiveContainer')}
                    </Text>
                    <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                  </Pressable>
                )}

                <View style={styles.optionRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.optionLabel, { color: colors.text }]}>
                      {t('settings.directBootTitle')}
                    </Text>
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
                </View>
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
                <View style={[styles.optionRow, styles.optionRowBorder, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.optionLabel, { color: colors.text }]}>
                      {t('gameConfig.modeHeading')}
                    </Text>
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
                </View>

                {/* FPS Target */}
                <View style={[styles.optionRow, styles.optionRowBorder, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.optionLabel, { color: colors.text }]}>
                      {t('gameConfig.fpsHeading')}
                    </Text>
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
                </View>

                {/* Metal Performance HUD Toggle */}
                <View style={[styles.optionRow, styles.optionRowBorder, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.optionLabel, { color: colors.text }]}>
                      {t('gameConfig.metalHudTitle')}
                    </Text>
                    <Text style={[styles.optionSubText, { color: colors.textSecondary }]}>
                      {t('gameConfig.metalHudDesc')}
                    </Text>
                  </View>
                  <Switch
                    value={globalLaunchConfig.metalHud}
                    onValueChange={(val) => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                      updateGlobalLaunchConfig({ metalHud: val });
                    }}
                    trackColor={{ false: colors.border, true: colors.accent }}
                    thumbColor={colors.surface}
                  />
                </View>

                {/* Gyroscope Motion Toggle */}
                <View style={[styles.optionRow, styles.optionRowBorder, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.optionLabel, { color: colors.text }]}>
                      {t('gameConfig.motionTitle')}
                    </Text>
                    <Text style={[styles.optionSubText, { color: colors.textSecondary }]}>
                      {t('gameConfig.motionDesc')}
                    </Text>
                  </View>
                  <Switch
                    value={globalLaunchConfig.phoneMotion}
                    onValueChange={(val) => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                      updateGlobalLaunchConfig({ phoneMotion: val });
                    }}
                    trackColor={{ false: colors.border, true: colors.accent }}
                    thumbColor={colors.surface}
                  />
                </View>

                {/* Apply Defaults to All Games Button */}
                <Pressable
                  style={styles.optionRow}
                  onPress={handleApplyDefaultsToAll}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.optionLabel, { color: colors.accentStrong }]}>
                      {t('settings.applyDefaultsToAllGames')}
                    </Text>
                    <Text style={[styles.optionSubText, { color: colors.textSecondary }]}>
                      {t('settings.applyDefaultsToAllGamesDesc')}
                    </Text>
                  </View>
                  <Ionicons name="sparkles" size={18} color={colors.accentStrong} />
                </Pressable>
              </View>
            </View>
          )}

          {/* SECTION: Storage & Cache */}
          {activeSection === 'storage' && (
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.storage')}</Text>
              <View style={[styles.optionsList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Pressable
                  style={[styles.optionRow, styles.optionRowBorder, { borderBottomColor: colors.border }]}
                  onPress={handleClearCache}
                >
                  <Text style={[styles.optionLabel, { color: colors.text }]}>
                    {t('settings.clearCoverCache')}
                  </Text>
                  <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
                </Pressable>

                <Pressable
                  style={styles.optionRow}
                  onPress={() => {
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
                  <Text style={[styles.optionLabel, { color: colors.destructive }]}>
                    {t('settings.resetLibrary')}
                  </Text>
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
                    {t('settings.version')}
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
                        style={[styles.downloadBtn, { backgroundColor: colors.accent }]}
                        onPress={() => {
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
                    style={styles.checkUpdatesBtnRow}
                    onPress={handleCheckForUpdates}
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
                  style={styles.optionRow}
                  accessibilityRole="link"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                    Linking.openURL('https://github.com/CesarGarza55/NXHorizon').catch(() => { });
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, { color: colors.accentStrong }]}>
                      {t('settings.aboutRepoLabel')}
                    </Text>
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
