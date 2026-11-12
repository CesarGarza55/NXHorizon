import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  GameMetadata,
  GameLaunchConfig,
  DEFAULT_GAME_LAUNCH_CONFIG,
} from '../../types/game';
import { useAppTheme } from '../../theme/ThemeProvider';
import { useGameStore } from '../../state/useGameStore';
import {
  readGameEnvConfig,
  writeGameEnvConfig,
  mapLaunchConfigToEnv,
  parseEnvToLaunchConfig,
  extractContainerFolder,
} from '../../../modules/nx-livecontainer';
import { useGamepad } from '../../hooks/useGamepad';

interface GameConfigModalProps {
  game: GameMetadata | null;
  visible: boolean;
  onClose: () => void;
  onPlay?: (game: GameMetadata) => void;
}

const LANGUAGES = [
  { code: 'auto', labelKey: 'gameConfig.langAuto' },
  { code: 'es-ES', label: 'Español (es-ES)' },
  { code: 'en-US', label: 'English (en-US)' },
  { code: 'ja-JP', label: '日本語 (ja-JP)' },
  { code: 'fr-FR', label: 'Français (fr-FR)' },
  { code: 'de-DE', label: 'Deutsch (de-DE)' },
  { code: 'it-IT', label: 'Italiano (it-IT)' },
];

export const GameConfigModal: React.FC<GameConfigModalProps> = ({
  game,
  visible,
  onClose,
  onPlay,
}) => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const availableModalHeight = Math.max(
    320,
    height - (insets.top + insets.bottom + (isLandscape ? 24 : 40))
  );
  const modalHeight = isLandscape
    ? Math.min(availableModalHeight, 460)
    : Math.min(availableModalHeight, 620);

  const { globalLaunchConfig, updateGameLaunchConfig, resetGameLaunchConfig } = useGameStore();

  const [config, setConfig] = useState<GameLaunchConfig>(DEFAULT_GAME_LAUNCH_CONFIG);
  const [isSaving, setIsSaving] = useState(false);

  // Controller focus row:
  // 0 = Mode, 1 = FPS, 2 = Scale, 3 = Upscaler, 4 = Metal HUD, 5 = Gyro, 6 = Language, 7 = Footer Buttons
  const [focusedRow, setFocusedRow] = useState(0);
  // Footer button: 0 = Reset, 1 = Cancel, 2 = Save, 3 = Save & Play
  const [focusedFooterBtn, setFocusedFooterBtn] = useState(3);

  const scrollRef = useRef<any>(null);

  // Sync initial config whenever modal opens or game changes
  useEffect(() => {
    if (!visible || !game) return;

    setFocusedRow(0);
    setFocusedFooterBtn(onPlay ? 3 : 2);

    const initialConfig: GameLaunchConfig = {
      ...globalLaunchConfig,
      ...(game.launchConfig || {}),
    };
    setConfig(initialConfig);

    const folder = game.containerFolder || extractContainerFolder(game.launchUrl);
    if (folder) {
      readGameEnvConfig(folder).then((env) => {
        if (env && Object.keys(env).length > 0) {
          const parsed = parseEnvToLaunchConfig(env);
          setConfig((prev) => ({
            ...prev,
            ...parsed,
          }));
        }
      }).catch(() => { });
    }
  }, [visible, game, globalLaunchConfig, onPlay]);

  const handleSave = useCallback(
    async (bootAfterSave = false) => {
      if (!game) return;
      setIsSaving(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });

      try {
        await updateGameLaunchConfig(game.id, config);

        const folder = game.containerFolder || extractContainerFolder(game.launchUrl);
        if (folder) {
          const envMap = mapLaunchConfigToEnv(config);
          await writeGameEnvConfig(folder, envMap);
        }

        setIsSaving(false);
        onClose();

        if (bootAfterSave && onPlay) {
          setTimeout(() => {
            onPlay(game);
          }, 120);
        }
      } catch (err) {
        setIsSaving(false);
        console.warn('[GameConfigModal] Save error:', err);
        Alert.alert(t('common.error'), t('gameConfig.saveError'));
      }
    },
    [game, config, updateGameLaunchConfig, onClose, onPlay, t]
  );

  const handleResetDefaults = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    setConfig(DEFAULT_GAME_LAUNCH_CONFIG);
    if (game) {
      resetGameLaunchConfig(game.id).catch(() => { });
    }
  }, [game, resetGameLaunchConfig]);

  // Full Gamepad Navigation within Modal
  useGamepad({
    onDirection: (dir) => {
      if (!visible) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      if (dir === 'up') {
        if (focusedRow === 7 && !isLandscape) {
          if (focusedFooterBtn === 0 || focusedFooterBtn === 1) {
            setFocusedFooterBtn(focusedFooterBtn === 0 ? 2 : 3);
            return;
          }
        }
        setFocusedRow((r) => {
          const next = Math.max(0, r - 1);
          scrollRef.current?.scrollTo({ y: next * 75, animated: true });
          return next;
        });
      } else if (dir === 'down') {
        if (focusedRow === 7 && !isLandscape) {
          if (focusedFooterBtn === 2 || focusedFooterBtn === 3) {
            setFocusedFooterBtn(focusedFooterBtn === 2 ? 0 : 1);
            return;
          }
        }
        setFocusedRow((r) => {
          const next = Math.min(7, r + 1);
          scrollRef.current?.scrollTo({ y: next * 75, animated: true });
          return next;
        });
      } else if (dir === 'left' || dir === 'right') {
        const step = dir === 'right' ? 1 : -1;
        switch (focusedRow) {
          case 0: // Mode
            setConfig((c) => ({ ...c, opMode: c.opMode === 'handheld' ? 'docked' : 'handheld' }));
            break;
          case 1: { // FPS: 0 -> 30 -> 60
            const fpsOptions: (0 | 30 | 60)[] = [0, 30, 60];
            const curIdx = fpsOptions.indexOf(config.fpsTarget);
            const nextIdx = (curIdx + step + fpsOptions.length) % fpsOptions.length;
            setConfig((c) => ({ ...c, fpsTarget: fpsOptions[nextIdx] }));
            break;
          }
          case 2: { // Render Scale: 0.5 -> 0.75 -> 1.0
            const scaleOptions: (0.5 | 0.75 | 1.0)[] = [0.5, 0.75, 1.0];
            const curIdx = scaleOptions.indexOf(config.renderScale);
            const nextIdx = (curIdx + step + scaleOptions.length) % scaleOptions.length;
            setConfig((c) => ({ ...c, renderScale: scaleOptions[nextIdx] }));
            break;
          }
          case 3: // Upscaler
            setConfig((c) => ({ ...c, upscaler: c.upscaler === 'metalfx' ? 'linear' : 'metalfx' }));
            break;
          case 4: // Metal HUD
            setConfig((c) => ({ ...c, metalHud: !c.metalHud }));
            break;
          case 5: // Phone Motion
            setConfig((c) => ({ ...c, phoneMotion: !c.phoneMotion }));
            break;
          case 6: { // Language
            const curIdx = LANGUAGES.findIndex((l) => l.code === (config.language || 'auto'));
            const nextIdx = (curIdx + step + LANGUAGES.length) % LANGUAGES.length;
            setConfig((c) => ({ ...c, language: LANGUAGES[nextIdx].code }));
            break;
          }
          case 7: { // Footer buttons
            if (!isLandscape) {
              if (focusedFooterBtn === 2 || focusedFooterBtn === 3) {
                setFocusedFooterBtn(focusedFooterBtn === 2 ? 3 : 2);
              } else {
                setFocusedFooterBtn(focusedFooterBtn === 0 ? 1 : 0);
              }
            } else {
              const maxBtn = onPlay ? 3 : 2;
              setFocusedFooterBtn((b) => (b + step + maxBtn + 1) % (maxBtn + 1));
            }
            break;
          }
        }
      }
    },
    onButtonPress: (button) => {
      if (!visible) return;
      if (button === 'B') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        onClose();
      } else if (button === 'A') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        if (focusedRow === 0) {
          setConfig((c) => ({ ...c, opMode: c.opMode === 'handheld' ? 'docked' : 'handheld' }));
        } else if (focusedRow === 1) {
          const fpsOptions: (0 | 30 | 60)[] = [0, 30, 60];
          const nextIdx = (fpsOptions.indexOf(config.fpsTarget) + 1) % fpsOptions.length;
          setConfig((c) => ({ ...c, fpsTarget: fpsOptions[nextIdx] }));
        } else if (focusedRow === 2) {
          const scaleOptions: (0.5 | 0.75 | 1.0)[] = [0.5, 0.75, 1.0];
          const nextIdx = (scaleOptions.indexOf(config.renderScale) + 1) % scaleOptions.length;
          setConfig((c) => ({ ...c, renderScale: scaleOptions[nextIdx] }));
        } else if (focusedRow === 3) {
          setConfig((c) => ({ ...c, upscaler: c.upscaler === 'metalfx' ? 'linear' : 'metalfx' }));
        } else if (focusedRow === 4) {
          setConfig((c) => ({ ...c, metalHud: !c.metalHud }));
        } else if (focusedRow === 5) {
          setConfig((c) => ({ ...c, phoneMotion: !c.phoneMotion }));
        } else if (focusedRow === 6) {
          const curIdx = LANGUAGES.findIndex((l) => l.code === (config.language || 'auto'));
          const nextIdx = (curIdx + 1) % LANGUAGES.length;
          setConfig((c) => ({ ...c, language: LANGUAGES[nextIdx].code }));
        } else if (focusedRow === 7) {
          if (focusedFooterBtn === 0) handleResetDefaults();
          else if (focusedFooterBtn === 1) onClose();
          else if (focusedFooterBtn === 2) handleSave(false);
          else if (focusedFooterBtn === 3) handleSave(true);
        }
      } else if (button === 'START' || button === 'SELECT') {
        handleSave(true);
      }
    },
  });

  if (!visible || !game) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
      onRequestClose={onClose}
    >
      <StatusBar hidden />
      {/* Edge-to-edge backdrop filling the entire screen */}
      <View
        style={[
          styles.backdrop,
          {
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            paddingLeft: Math.max(insets.left, isLandscape ? 32 : 16),
            paddingRight: Math.max(insets.right, isLandscape ? 32 : 16),
            paddingTop: Math.max(insets.top, isLandscape ? 16 : 24),
            paddingBottom: Math.max(insets.bottom, isLandscape ? 16 : 24),
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View
          style={[
            styles.modalCard,
            isLandscape ? styles.modalCardLandscape : styles.modalCardPortrait,
            {
              height: modalHeight,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              {game.coverUrl ? (
                <Image
                  source={{ uri: game.coverUrl }}
                  style={[styles.headerThumb, { borderColor: colors.border }]}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={[styles.headerThumbFallback, { backgroundColor: colors.surfaceSecondary }]}>
                  <Ionicons name="game-controller" size={20} color={colors.accent} />
                </View>
              )}
              <View style={styles.headerInfo}>
                <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                  {game.title}
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                  {t('gameConfig.subtitle')}
                </Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: colors.surfaceSecondary },
                pressed && { opacity: 0.7 },
              ]}
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          {/* Scrollable Form */}
          <ScrollView
            ref={scrollRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {/* Row 0: Console Mode */}
            <View
              style={[
                styles.sectionBlock,
                focusedRow === 0 && [styles.focusedRowBox, { borderColor: colors.accent }],
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="hardware-chip-outline" size={17} color={colors.accent} />
                <Text style={[styles.sectionHeading, { color: colors.text }]}>
                  {t('gameConfig.modeHeading')}
                </Text>
                {focusedRow === 0 && (
                  <View style={[styles.focusPill, { backgroundColor: colors.accentSurface }]}>
                    <Text style={[styles.focusPillText, { color: colors.accentStrong }]}>◀ ▶ D-PAD</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
                {t('gameConfig.modeDesc')}
              </Text>
              <View style={styles.segmentedRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.segmentButton,
                    config.opMode === 'handheld'
                      ? [styles.segmentActive, { borderColor: colors.accent, backgroundColor: colors.accentSurface }]
                      : [styles.segmentInactive, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }],
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                    setFocusedRow(0);
                    setConfig((prev) => ({ ...prev, opMode: 'handheld' }));
                  }}
                >
                  <Ionicons
                    name="phone-portrait-outline"
                    size={17}
                    color={config.opMode === 'handheld' ? colors.accent : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: config.opMode === 'handheld' ? colors.accent : colors.text,
                        fontWeight: config.opMode === 'handheld' ? '700' : '500',
                      },
                    ]}
                  >
                    {t('gameConfig.modeHandheld')} (720p)
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.segmentButton,
                    config.opMode === 'docked'
                      ? [styles.segmentActive, { borderColor: colors.accent, backgroundColor: colors.accentSurface }]
                      : [styles.segmentInactive, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }],
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                    setFocusedRow(0);
                    setConfig((prev) => ({ ...prev, opMode: 'docked' }));
                  }}
                >
                  <Ionicons
                    name="tv-outline"
                    size={17}
                    color={config.opMode === 'docked' ? colors.accent : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: config.opMode === 'docked' ? colors.accent : colors.text,
                        fontWeight: config.opMode === 'docked' ? '700' : '500',
                      },
                    ]}
                  >
                    {t('gameConfig.modeDocked')} (1080p)
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Row 1: FPS Target */}
            <View
              style={[
                styles.sectionBlock,
                focusedRow === 1 && [styles.focusedRowBox, { borderColor: colors.accent }],
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="speedometer-outline" size={17} color={colors.accent} />
                <Text style={[styles.sectionHeading, { color: colors.text }]}>
                  {t('gameConfig.fpsHeading')}
                </Text>
                {focusedRow === 1 && (
                  <View style={[styles.focusPill, { backgroundColor: colors.accentSurface }]}>
                    <Text style={[styles.focusPillText, { color: colors.accentStrong }]}>◀ ▶ D-PAD</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
                {t('gameConfig.fpsDesc')}
              </Text>
              <View style={styles.segmentedRow}>
                {[
                  { val: 0, label: t('gameConfig.fpsAuto') },
                  { val: 30, label: '30 FPS' },
                  { val: 60, label: '60 FPS' },
                ].map((item) => {
                  const isActive = config.fpsTarget === item.val;
                  return (
                    <Pressable
                      key={item.val}
                      style={({ pressed }) => [
                        styles.segmentButton,
                        isActive
                          ? [styles.segmentActive, { borderColor: colors.accent, backgroundColor: colors.accentSurface }]
                          : [styles.segmentInactive, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }],
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                        setFocusedRow(1);
                        setConfig((prev) => ({ ...prev, fpsTarget: item.val as 0 | 30 | 60 }));
                      }}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          {
                            color: isActive ? colors.accent : colors.text,
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

            {/* Row 2: Render Scale */}
            <View
              style={[
                styles.sectionBlock,
                focusedRow === 2 && [styles.focusedRowBox, { borderColor: colors.accent }],
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="resize-outline" size={17} color={colors.accent} />
                <Text style={[styles.sectionHeading, { color: colors.text }]}>
                  {t('gameConfig.scaleHeading')}
                </Text>
                {focusedRow === 2 && (
                  <View style={[styles.focusPill, { backgroundColor: colors.accentSurface }]}>
                    <Text style={[styles.focusPillText, { color: colors.accentStrong }]}>◀ ▶ D-PAD</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
                {t('gameConfig.scaleDesc')}
              </Text>
              <View style={styles.segmentedRow}>
                {[
                  { val: 0.5, label: '50% (Eco)' },
                  { val: 0.75, label: '75%' },
                  { val: 1.0, label: '100% (Native)' },
                ].map((item) => {
                  const isActive = config.renderScale === item.val;
                  return (
                    <Pressable
                      key={item.val}
                      style={({ pressed }) => [
                        styles.segmentButton,
                        isActive
                          ? [styles.segmentActive, { borderColor: colors.accent, backgroundColor: colors.accentSurface }]
                          : [styles.segmentInactive, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }],
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                        setFocusedRow(2);
                        setConfig((prev) => ({ ...prev, renderScale: item.val as 0.5 | 0.75 | 1.0 }));
                      }}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          {
                            color: isActive ? colors.accent : colors.text,
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

            {/* Row 3: Upscaler */}
            <View
              style={[
                styles.sectionBlock,
                focusedRow === 3 && [styles.focusedRowBox, { borderColor: colors.accent }],
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="sparkles-outline" size={17} color={colors.accent} />
                <Text style={[styles.sectionHeading, { color: colors.text }]}>
                  {t('gameConfig.upscalerHeading')}
                </Text>
                {focusedRow === 3 && (
                  <View style={[styles.focusPill, { backgroundColor: colors.accentSurface }]}>
                    <Text style={[styles.focusPillText, { color: colors.accentStrong }]}>◀ ▶ D-PAD</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
                {t('gameConfig.upscalerDesc')}
              </Text>
              <View style={styles.segmentedRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.segmentButton,
                    config.upscaler === 'metalfx'
                      ? [styles.segmentActive, { borderColor: colors.accent, backgroundColor: colors.accentSurface }]
                      : [styles.segmentInactive, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }],
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                    setFocusedRow(3);
                    setConfig((prev) => ({ ...prev, upscaler: 'metalfx' }));
                  }}
                >
                  <Ionicons
                    name="flash-outline"
                    size={16}
                    color={config.upscaler === 'metalfx' ? colors.accent : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: config.upscaler === 'metalfx' ? colors.accent : colors.text,
                        fontWeight: config.upscaler === 'metalfx' ? '700' : '500',
                      },
                    ]}
                  >
                    Apple MetalFX
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.segmentButton,
                    config.upscaler === 'linear'
                      ? [styles.segmentActive, { borderColor: colors.accent, backgroundColor: colors.accentSurface }]
                      : [styles.segmentInactive, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }],
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                    setFocusedRow(3);
                    setConfig((prev) => ({ ...prev, upscaler: 'linear' }));
                  }}
                >
                  <Ionicons
                    name="contrast-outline"
                    size={16}
                    color={config.upscaler === 'linear' ? colors.accent : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: config.upscaler === 'linear' ? colors.accent : colors.text,
                        fontWeight: config.upscaler === 'linear' ? '700' : '500',
                      },
                    ]}
                  >
                    Bilinear (Linear)
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Row 4 & 5: Toggles (Metal HUD & Gyro Motion) */}
            <View
              style={[
                styles.sectionBlock,
                (focusedRow === 4 || focusedRow === 5) && [styles.focusedRowBox, { borderColor: colors.accent }],
              ]}
            >
              <View style={[styles.toggleRow, { borderBottomColor: colors.border }]}>
                <View style={styles.toggleInfo}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="analytics-outline" size={17} color={colors.accent} />
                    <Text style={[styles.toggleTitle, { color: colors.text }]}>
                      {t('gameConfig.metalHudTitle')}
                    </Text>
                    {focusedRow === 4 && (
                      <View style={[styles.focusPill, { backgroundColor: colors.accentSurface }]}>
                        <Text style={[styles.focusPillText, { color: colors.accentStrong }]}>A: TOGGLE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>
                    {t('gameConfig.metalHudDesc')}
                  </Text>
                </View>
                <Switch
                  value={config.metalHud}
                  onValueChange={(val) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                    setFocusedRow(4);
                    setConfig((prev) => ({ ...prev, metalHud: val }));
                  }}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="sync-circle-outline" size={17} color={colors.accent} />
                    <Text style={[styles.toggleTitle, { color: colors.text }]}>
                      {t('gameConfig.motionTitle')}
                    </Text>
                    {focusedRow === 5 && (
                      <View style={[styles.focusPill, { backgroundColor: colors.accentSurface }]}>
                        <Text style={[styles.focusPillText, { color: colors.accentStrong }]}>A: TOGGLE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>
                    {t('gameConfig.motionDesc')}
                  </Text>
                </View>
                <Switch
                  value={config.phoneMotion}
                  onValueChange={(val) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                    setFocusedRow(5);
                    setConfig((prev) => ({ ...prev, phoneMotion: val }));
                  }}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Row 6: Language */}
            <View
              style={[
                styles.sectionBlock,
                focusedRow === 6 && [styles.focusedRowBox, { borderColor: colors.accent }],
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="globe-outline" size={17} color={colors.accent} />
                <Text style={[styles.sectionHeading, { color: colors.text }]}>
                  {t('gameConfig.langHeading')}
                </Text>
                {focusedRow === 6 && (
                  <View style={[styles.focusPill, { backgroundColor: colors.accentSurface }]}>
                    <Text style={[styles.focusPillText, { color: colors.accentStrong }]}>◀ ▶ D-PAD</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
                {t('gameConfig.langDesc')}
              </Text>
              <View style={styles.langGrid}>
                {LANGUAGES.map((lang) => {
                  const isActive = (config.language || 'auto') === lang.code;
                  const label = lang.label || (lang.labelKey ? t(lang.labelKey) : lang.code);
                  return (
                    <Pressable
                      key={lang.code}
                      style={({ pressed }) => [
                        styles.langChip,
                        isActive
                          ? [styles.langChipActive, { borderColor: colors.accent, backgroundColor: colors.accentSurface }]
                          : [styles.langChipInactive, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }],
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                        setFocusedRow(6);
                        setConfig((prev) => ({ ...prev, language: lang.code }));
                      }}
                    >
                      <Text
                        style={[
                          styles.langChipText,
                          {
                            color: isActive ? colors.accent : colors.text,
                            fontWeight: isActive ? '700' : '500',
                          },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Row 7: Footer Actions */}
          <View
            style={[
              styles.footer,
              isLandscape ? styles.footerLandscape : styles.footerPortrait,
              { borderTopColor: colors.border },
            ]}
          >
            {isLandscape ? (
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.resetButton,
                    { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
                    focusedRow === 7 && focusedFooterBtn === 0 && styles.focusedButtonOutline,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={handleResetDefaults}
                  accessibilityRole="button"
                >
                  <Ionicons name="refresh-outline" size={15} color={colors.textSecondary} />
                  <Text style={[styles.resetButtonText, { color: colors.textSecondary }]}>
                    {t('gameConfig.resetDefaults')}
                  </Text>
                </Pressable>

                <View style={styles.footerRight}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionBtn,
                      { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
                      focusedRow === 7 && focusedFooterBtn === 1 && styles.focusedButtonOutline,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={onClose}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.actionBtnText, { color: colors.text }]}>
                      {t('common.cancel')}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.actionBtn,
                      styles.actionBtnPrimary,
                      { backgroundColor: colors.accent },
                      focusedRow === 7 && focusedFooterBtn === 2 && styles.focusedButtonOutline,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => handleSave(false)}
                    accessibilityRole="button"
                    disabled={isSaving}
                  >
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    <Text style={[styles.actionBtnTextPrimary, { color: '#FFFFFF' }]}>
                      {t('common.save')}
                    </Text>
                  </Pressable>

                  {onPlay && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionBtn,
                        styles.actionBtnLaunch,
                        { backgroundColor: colors.accentStrong },
                        focusedRow === 7 && focusedFooterBtn === 3 && styles.focusedButtonOutline,
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => handleSave(true)}
                      accessibilityRole="button"
                      disabled={isSaving}
                    >
                      <Ionicons name="play" size={16} color="#FFFFFF" />
                      <Text style={[styles.actionBtnTextPrimary, { color: '#FFFFFF' }]}>
                        {t('gameConfig.saveAndPlay')}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </>
            ) : (
              /* Portrait 2-Row Grid that completely prevents overflow */
              <View style={styles.portraitFooterStack}>
                <View style={styles.portraitFooterRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionBtn,
                      styles.portraitBtn,
                      styles.actionBtnPrimary,
                      { backgroundColor: colors.accent },
                      focusedRow === 7 && focusedFooterBtn === 2 && styles.focusedButtonOutline,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => handleSave(false)}
                    accessibilityRole="button"
                    disabled={isSaving}
                  >
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    <Text style={[styles.actionBtnTextPrimary, { color: '#FFFFFF' }]}>
                      {t('common.save')}
                    </Text>
                  </Pressable>

                  {onPlay && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionBtn,
                        styles.portraitBtn,
                        styles.actionBtnLaunch,
                        { backgroundColor: colors.accentStrong },
                        focusedRow === 7 && focusedFooterBtn === 3 && styles.focusedButtonOutline,
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => handleSave(true)}
                      accessibilityRole="button"
                      disabled={isSaving}
                    >
                      <Ionicons name="play" size={16} color="#FFFFFF" />
                      <Text style={[styles.actionBtnTextPrimary, { color: '#FFFFFF' }]}>
                        {t('gameConfig.saveAndPlay')}
                      </Text>
                    </Pressable>
                  )}
                </View>

                <View style={styles.portraitFooterRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.resetButton,
                      styles.portraitBtn,
                      { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
                      focusedRow === 7 && focusedFooterBtn === 0 && styles.focusedButtonOutline,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={handleResetDefaults}
                    accessibilityRole="button"
                  >
                    <Ionicons name="refresh-outline" size={14} color={colors.textSecondary} />
                    <Text
                      style={[styles.resetButtonText, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {t('gameConfig.resetDefaults')}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.actionBtn,
                      styles.portraitBtn,
                      { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
                      focusedRow === 7 && focusedFooterBtn === 1 && styles.focusedButtonOutline,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={onClose}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.actionBtnText, { color: colors.text }]}>
                      {t('common.cancel')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  modalCardLandscape: {
    width: '90%',
    maxWidth: 780,
  },
  modalCardPortrait: {
    width: '95%',
    maxWidth: 480,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  headerThumb: {
    width: 38,
    height: 38,
    borderRadius: 4,
    borderWidth: 1,
    marginRight: 10,
  },
  headerThumbFallback: {
    width: 38,
    height: 38,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
    flexShrink: 1,
    width: '100%',
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  sectionBlock: {
    gap: 8,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  focusedRowBox: {
    backgroundColor: 'rgba(0, 210, 255, 0.08)',
  },
  focusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  focusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sectionDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1.5,
    gap: 6,
  },
  segmentActive: {
    borderWidth: 2,
  },
  segmentInactive: {},
  segmentText: {
    fontSize: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
    gap: 4,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleSubtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  langChipActive: {
    borderWidth: 2,
  },
  langChipInactive: {},
  langChipText: {
    fontSize: 11,
  },
  footer: {
    borderTopWidth: 1,
  },
  footerLandscape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  footerPortrait: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
  },
  portraitFooterStack: {
    width: '100%',
    gap: 8,
  },
  portraitFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  portraitBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 40,
    paddingHorizontal: 8,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionBtnPrimary: {
    borderWidth: 0,
  },
  actionBtnLaunch: {
    borderWidth: 0,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionBtnTextPrimary: {
    fontSize: 12,
    fontWeight: '700',
  },
  focusedButtonOutline: {
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#00D2FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 8,
  },
});
