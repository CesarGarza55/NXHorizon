import React from 'react';
import { View, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../theme/ThemeProvider';

export interface SwitchBottomDockProps {
  onAddPress: () => void;
  onControllersPress: () => void;
  onSettingsPress: () => void;
  onLibraryPress: () => void;
  onNewsPress?: () => void;
  onFavoritesPress: () => void;
  activeScreen: string;
  focusedDockIndex?: number;
  isGamepadFocused?: boolean;
}

export const SwitchBottomDock: React.FC<SwitchBottomDockProps> = ({
  onAddPress,
  onControllersPress,
  onSettingsPress,
  onLibraryPress,
  onNewsPress,
  onFavoritesPress,
  activeScreen,
  focusedDockIndex = -1,
  isGamepadFocused = false,
}) => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const handlePress = (action?: () => void) => {
    if (!action) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    action();
  };

  const circleSize = isLandscape ? 44 : 42;
  const iconSize = isLandscape ? 22 : 21;

  const getCircleStyle = (index: number) => {
    const isFocused = isGamepadFocused && focusedDockIndex === index;
    return [
      styles.circleButton,
      {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        width: circleSize,
        height: circleSize,
        borderRadius: circleSize / 2,
      },
      isFocused && [
        styles.circleButtonFocused,
        {
          borderColor: colors.accent,
          shadowColor: colors.accent,
        },
      ],
    ];
  };

  return (
    <View style={styles.dockRow}>
      {/* 0. News / Nintendo Online (Red) */}
      <Pressable
        style={({ pressed }) => [styles.dockItem, pressed && styles.dockItemPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('nav.news')}
        onPress={() => handlePress(onNewsPress)}
        hitSlop={6}
      >
        <View style={getCircleStyle(0)}>
          <Ionicons name="chatbubble-ellipses-outline" size={iconSize} color="#E60012" />
        </View>
      </Pressable>

      {/* 1. Nintendo eShop / Add Game (Orange) */}
      <Pressable
        style={({ pressed }) => [styles.dockItem, pressed && styles.dockItemPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('nav.import')}
        onPress={() => handlePress(onAddPress)}
        hitSlop={6}
      >
        <View style={getCircleStyle(1)}>
          <Ionicons name="bag-handle-outline" size={iconSize} color="#FF7A00" />
        </View>
      </Pressable>

      {/* 2. Album / Library (Cyan / Blue) */}
      <Pressable
        style={({ pressed }) => [styles.dockItem, pressed && styles.dockItemPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('nav.library')}
        accessibilityState={{ selected: activeScreen === 'library' }}
        onPress={() => handlePress(onLibraryPress)}
        hitSlop={6}
      >
        <View style={getCircleStyle(2)}>
          <Ionicons name="images-outline" size={iconSize} color="#00A0E9" />
        </View>
      </Pressable>

      {/* 3. Controllers (Muted / Slate) */}
      <Pressable
        style={({ pressed }) => [styles.dockItem, pressed && styles.dockItemPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('settings.gamepad')}
        accessibilityState={{ selected: activeScreen === 'settings' }}
        onPress={() => handlePress(onControllersPress)}
        hitSlop={6}
      >
        <View style={getCircleStyle(3)}>
          <Ionicons name="game-controller-outline" size={iconSize} color={colors.textSecondary} />
        </View>
      </Pressable>

      {/* 4. System Settings (Gear) */}
      <Pressable
        style={({ pressed }) => [styles.dockItem, pressed && styles.dockItemPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('nav.settings')}
        accessibilityState={{ selected: activeScreen === 'settings' }}
        onPress={() => handlePress(onSettingsPress)}
        hitSlop={6}
      >
        <View style={getCircleStyle(4)}>
          <Ionicons name="settings-outline" size={iconSize} color={colors.textSecondary} />
        </View>
      </Pressable>

      {/* 5. Favorites shortcut */}
      <Pressable
        style={({ pressed }) => [styles.dockItem, pressed && styles.dockItemPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('nav.favorites')}
        onPress={() => handlePress(onFavoritesPress)}
        hitSlop={6}
      >
        <View style={getCircleStyle(5)}>
          <Ionicons name="heart-outline" size={iconSize} color={colors.textSecondary} />
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  dockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 4,
  },
  dockItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockItemPressed: {
    transform: [{ scale: 0.92 }],
  },
  circleButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  circleButtonFocused: {
    borderWidth: 2.5,
    transform: [{ scale: 1.14 }],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 6,
  },
  notificationDot: {
    position: 'absolute',
    top: -5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00A0E9',
  },
});
