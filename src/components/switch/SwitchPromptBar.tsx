import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../theme/ThemeProvider';

interface SwitchPromptBarProps {
  activeScreen: string;
  hasSelectedGame?: boolean;
  onBackPress: () => void;
  onOptionsPress?: () => void;
  onStartPress?: () => void;
  onImportPress?: () => void;
  bottomInset?: number;
}

/**
 * Authentic Nintendo Switch Console Handheld Icon
 * Matches the console glyph at the bottom-left of Horizon OS Home Screen.
 */
export const SwitchConsoleGlyph: React.FC<{ color?: string }> = ({ color = '#888888' }) => {
  return (
    <View style={glyphStyles.container} accessibilityLabel="Nintendo Switch">
      {/* Left Joy-Con */}
      <View style={[glyphStyles.joyconLeft, { borderColor: color }]}>
        <View style={[glyphStyles.stick, { backgroundColor: color }]} />
      </View>
      {/* Screen Outline */}
      <View style={[glyphStyles.screen, { borderColor: color }]}>
        <View style={[glyphStyles.screenInner, { backgroundColor: color }]} />
      </View>
      {/* Right Joy-Con */}
      <View style={[glyphStyles.joyconRight, { borderColor: color }]}>
        <View style={[glyphStyles.stick, { backgroundColor: color }]} />
      </View>
    </View>
  );
};

const glyphStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 18,
  },
  joyconLeft: {
    width: 6,
    height: 18,
    borderWidth: 1.5,
    borderRightWidth: 0,
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 1,
  },
  screen: {
    width: 22,
    height: 18,
    borderWidth: 1.5,
    padding: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenInner: {
    width: '100%',
    height: '100%',
    opacity: 0.15,
  },
  joyconRight: {
    width: 6,
    height: 18,
    borderWidth: 1.5,
    borderLeftWidth: 0,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 1,
  },
  stick: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.5,
  },
});

export const SwitchPromptBar: React.FC<SwitchPromptBarProps> = ({
  activeScreen,
  hasSelectedGame = false,
  onBackPress,
  onOptionsPress,
  onStartPress,
  onImportPress,
  bottomInset = 0,
}) => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const handleAction = (cb?: () => void) => {
    if (!cb) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    cb();
  };

  return (
    <View
      style={[
        styles.barContainer,
        {
          paddingLeft: Math.max(insets.left, 28),
          paddingRight: Math.max(insets.right, 28),
          paddingBottom: Math.max(insets.bottom, bottomInset, 10),
        },
      ]}
    >
      {/* Left: Nintendo Switch Handheld Console Glyph */}
      <View style={styles.leftSection}>
        <SwitchConsoleGlyph color={colors.textSecondary} />
      </View>

      {/* Right: Controller Prompts */}
      <View style={styles.rightSection}>
        {activeScreen === 'home' && (
          <>
            {hasSelectedGame && onOptionsPress && (
              <Pressable
                style={({ pressed }) => [styles.promptBtn, pressed && styles.btnPressed]}
                accessibilityRole="button"
                accessibilityLabel={t('common.options')}
                onPress={() => handleAction(onOptionsPress)}
                hitSlop={6}
              >
                <View
                  style={[
                    styles.buttonGlyph,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.glyphText, { color: colors.text }]}>+</Text>
                </View>
                <Text style={[styles.promptLabel, { color: colors.text }]}>
                  {t('common.options')}
                </Text>
              </Pressable>
            )}

            {hasSelectedGame && onStartPress && (
              <Pressable
                style={({ pressed }) => [styles.promptBtn, pressed && styles.btnPressed]}
                accessibilityRole="button"
                accessibilityLabel={t('common.start')}
                onPress={() => handleAction(onStartPress)}
                hitSlop={6}
              >
                <View
                  style={[
                    styles.buttonGlyph,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.glyphText, { color: colors.text }]}>A</Text>
                </View>
                <Text style={[styles.promptLabel, { color: colors.text }]}>
                  {t('common.ok') || 'OK'}
                </Text>
              </Pressable>
            )}

            {!hasSelectedGame && onImportPress && (
              <Pressable
                style={({ pressed }) => [styles.promptBtn, pressed && styles.btnPressed]}
                accessibilityRole="button"
                accessibilityLabel={t('nav.import')}
                onPress={() => handleAction(onImportPress)}
                hitSlop={6}
              >
                <View
                  style={[
                    styles.buttonGlyph,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.glyphText, { color: colors.text }]}>+</Text>
                </View>
                <Text style={[styles.promptLabel, { color: colors.text }]}>
                  {t('nav.import')}
                </Text>
              </Pressable>
            )}
          </>
        )}

        {activeScreen === 'library' && (
          <>
            {onImportPress && (
              <Pressable
                style={({ pressed }) => [styles.promptBtn, pressed && styles.btnPressed]}
                accessibilityRole="button"
                accessibilityLabel={t('nav.import')}
                onPress={() => handleAction(onImportPress)}
                hitSlop={6}
              >
                <View
                  style={[
                    styles.buttonGlyph,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.glyphText, { color: colors.text }]}>+</Text>
                </View>
                <Text style={[styles.promptLabel, { color: colors.text }]}>
                  {t('nav.import')}
                </Text>
              </Pressable>
            )}

            <Pressable
              style={({ pressed }) => [styles.promptBtn, pressed && styles.btnPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              onPress={() => handleAction(onBackPress)}
              hitSlop={6}
            >
              <View
                style={[
                  styles.buttonGlyph,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.glyphText, { color: colors.text }]}>B</Text>
              </View>
              <Text style={[styles.promptLabel, { color: colors.text }]}>
                {t('common.back')}
              </Text>
            </Pressable>
          </>
        )}

        {activeScreen === 'details' && (
          <>
            <Pressable
              style={({ pressed }) => [styles.promptBtn, pressed && styles.btnPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              onPress={() => handleAction(onBackPress)}
              hitSlop={6}
            >
              <View
                style={[
                  styles.buttonGlyph,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.glyphText, { color: colors.text }]}>B</Text>
              </View>
              <Text style={[styles.promptLabel, { color: colors.text }]}>
                {t('common.back')}
              </Text>
            </Pressable>

            {onOptionsPress && (
              <Pressable
                style={({ pressed }) => [styles.promptBtn, pressed && styles.btnPressed]}
                accessibilityRole="button"
                accessibilityLabel={t('common.options')}
                onPress={() => handleAction(onOptionsPress)}
                hitSlop={6}
              >
                <View
                  style={[
                    styles.buttonGlyph,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.glyphText, { color: colors.text }]}>+</Text>
                </View>
                <Text style={[styles.promptLabel, { color: colors.text }]}>
                  {t('common.options')}
                </Text>
              </Pressable>
            )}

            {onStartPress && (
              <Pressable
                style={({ pressed }) => [styles.promptBtn, pressed && styles.btnPressed]}
                accessibilityRole="button"
                accessibilityLabel={t('details.launchGame')}
                onPress={() => handleAction(onStartPress)}
                hitSlop={6}
              >
                <View
                  style={[
                    styles.buttonGlyph,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.glyphText, { color: colors.text }]}>A</Text>
                </View>
                <Text style={[styles.promptLabel, { color: colors.text }]}>
                  {t('details.launchGame')}
                </Text>
              </Pressable>
            )}
          </>
        )}

        {activeScreen === 'settings' && (
          <>
            <Pressable
              style={({ pressed }) => [styles.promptBtn, pressed && styles.btnPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              onPress={() => handleAction(onBackPress)}
              hitSlop={6}
            >
              <View
                style={[
                  styles.buttonGlyph,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.glyphText, { color: colors.text }]}>B</Text>
              </View>
              <Text style={[styles.promptLabel, { color: colors.text }]}>
                {t('common.back')}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.promptBtn, pressed && styles.btnPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('common.ok')}
              onPress={() => handleAction(onBackPress)}
              hitSlop={6}
            >
              <View
                style={[
                  styles.buttonGlyph,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.glyphText, { color: colors.text }]}>A</Text>
              </View>
              <Text style={[styles.promptLabel, { color: colors.text }]}>
                {t('common.ok') || 'OK'}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 26,
    paddingTop: 8,
    minHeight: 40,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  promptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 28,
  },
  btnPressed: {
    opacity: 0.7,
  },
  buttonGlyph: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  glyphText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  promptLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
