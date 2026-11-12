import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  useWindowDimensions,
  StyleSheet,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { GameCartridgeCover } from '../common/GameCartridgeCover';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { GameMetadata } from '../../types/game';
import { useGameStore } from '../../state/useGameStore';
import { useFocusStore } from '../../state/useFocusStore';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/ThemeProvider';

interface GameCarouselProps {
  onGameLaunch: (game: GameMetadata) => void;
  onLongPress: (game: GameMetadata) => void;
  onImportPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const AddGameTile: React.FC<{ tileSize: number; onPress: () => void }> = ({
  tileSize,
  onPress,
}) => {
  const { colors } = useAppTheme();
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('home.addGameTile')}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.addGameTile,
        {
          width: tileSize,
          height: tileSize,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        pressed && styles.addGameTilePressed,
      ]}
    >
      <View style={[styles.addGameIcon, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name="add" size={30} color={colors.accent} />
      </View>
      <Text style={[styles.addGameLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {t('home.addGameTile')}
      </Text>
    </Pressable>
  );
};

const CarouselTile = React.memo(
  ({
    game,
    isSelected,
    tileSize,
    onPress,
    onLongPress,
    onDoubleTap,
  }: {
    game: GameMetadata;
    isSelected: boolean;
    tileSize: number;
    onPress: () => void;
    onLongPress: () => void;
    onDoubleTap: () => void;
  }) => {
    const { colors } = useAppTheme();
    const scale = useSharedValue(isSelected ? 1.05 : 0.95);
    const lastTapRef = useRef<number>(0);

    useEffect(() => {
      scale.value = withSpring(isSelected ? 1.05 : 0.95, {
        damping: 16,
        stiffness: 150,
      });
    }, [isSelected, scale]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePress = () => {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        onDoubleTap();
      } else {
        onPress();
      }
      lastTapRef.current = now;
    };

    return (
      <AnimatedPressable
        onPress={handlePress}
        onLongPress={onLongPress}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={game.title}
        accessibilityState={{ selected: isSelected }}
        style={[
          styles.tileContainer,
          { backgroundColor: colors.surfaceSecondary },
          { width: tileSize, height: tileSize },
          animatedStyle,
          isSelected && styles.tileSelectedBorder,
          isSelected && { borderColor: colors.accent },
        ]}
      >
        <GameCartridgeCover
          game={game}
          style={styles.coverImage}
          contentFit="cover"
          showSyncBadge={true}
          iconSize={tileSize > 120 ? 32 : 24}
        />
      </AnimatedPressable>
    );
  }
);

export const GameCarousel: React.FC<GameCarouselProps> = ({
  onGameLaunch,
  onLongPress,
  onImportPress,
}) => {
  const flatListRef = useRef<FlatList<any>>(null);
  const { games, selectedGameId, setSelectedGame } = useGameStore();
  const { setFocusedNode } = useFocusStore();
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  const isUserDraggingRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const lastSyncedIndexRef = useRef(-1);

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isLandscape = screenWidth > screenHeight;

  const tileSize = isLandscape
    ? Math.min(screenHeight * 0.38, 146)
    : Math.min(screenWidth * 0.35, 135);

  const insets = useSafeAreaInsets();
  const spacing = isLandscape ? 14 : 14;
  const snapInterval = tileSize + spacing;
  const sideInset = isLandscape
    ? Math.max(insets.left, insets.right, 36)
    : Math.max(20, (screenWidth - tileSize) / 2);

  const selectedGame = games.find((g) => g.id === selectedGameId) || games[0] || null;
  const selectedIndex = games.findIndex((g) => g.id === selectedGameId);

  const scrollToItemIndex = useCallback(
    (index: number, animated = true) => {
      if (index < 0 || index >= games.length) return;
      isProgrammaticScrollRef.current = true;
      flatListRef.current?.scrollToOffset({
        offset: index * snapInterval,
        animated,
      });
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 400);
    },
    [games.length, snapInterval]
  );

  // Sync scroll position when selected game changes (e.g. from Gamepad or initial load)
  useEffect(() => {
    if (
      selectedIndex >= 0 &&
      selectedIndex !== lastSyncedIndexRef.current &&
      !isUserDraggingRef.current
    ) {
      lastSyncedIndexRef.current = selectedIndex;
      scrollToItemIndex(selectedIndex, true);
    }
  }, [selectedIndex, scrollToItemIndex]);

  const handleScrollBegin = () => {
    isUserDraggingRef.current = true;
  };

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      isUserDraggingRef.current = false;
      if (isProgrammaticScrollRef.current) return;

      const offsetX = e.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / snapInterval);

      if (index >= 0 && index < games.length) {
        const target = games[index];
        if (target && target.id !== selectedGameId) {
          lastSyncedIndexRef.current = index;
          setSelectedGame(target.id);
          setFocusedNode(target.id, false);
          Haptics.selectionAsync().catch(() => {});
        }
      }
    },
    [games, selectedGameId, setSelectedGame, setFocusedNode, snapInterval]
  );

  const handleItemPress = (game: GameMetadata, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (game.id === selectedGameId) {
      onGameLaunch(game);
    } else {
      lastSyncedIndexRef.current = index;
      setSelectedGame(game.id);
      setFocusedNode(game.id, false);
      scrollToItemIndex(index, true);
    }
  };

  return (
    <View style={styles.container}>
      {isLandscape && selectedGame && (
        <View
          style={[
            styles.landscapeSectionHeader,
            {
              paddingLeft: Math.max(insets.left, 36),
              paddingRight: Math.max(insets.right, 36),
            },
          ]}
        >
          <Text style={[styles.landscapeSectionTitle, { color: colors.text }]} numberOfLines={1}>
            {selectedGame.title}
          </Text>
        </View>
      )}
      {!isLandscape && (
        <View
          style={[
            styles.portraitSectionHeader,
            {
              paddingLeft: Math.max(insets.left, 24),
              paddingRight: Math.max(insets.right, 24),
            },
          ]}
        >
          <Text style={[styles.portraitSectionTitle, { color: colors.text }]}>{t('home.software').toUpperCase()}</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>
      )}

      <View style={[styles.carouselWrapper, { height: tileSize + 16 }]}>
        <FlatList
          ref={flatListRef}
          data={games}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={snapInterval}
          snapToAlignment="start"
          decelerationRate="fast"
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{
            paddingHorizontal: sideInset,
            alignItems: 'center',
          }}
          onScrollBeginDrag={handleScrollBegin}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          getItemLayout={(_, index) => ({
            length: snapInterval,
            offset: snapInterval * index,
            index,
          })}
          renderItem={({ item, index }) => {
            return (
              <View style={{ width: tileSize, marginRight: spacing }}>
                <CarouselTile
                  game={item}
                  isSelected={item.id === selectedGameId}
                  tileSize={tileSize}
                  onPress={() => handleItemPress(item, index)}
                  onLongPress={() => onLongPress(item)}
                  onDoubleTap={() => onGameLaunch(item)}
                />
              </View>
            );
          }}
          ListFooterComponent={
            <View style={{ width: tileSize, marginRight: spacing }}>
              <AddGameTile tileSize={tileSize} onPress={onImportPress} />
            </View>
          }
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  landscapeSectionHeader: {
    paddingHorizontal: 28,
    marginBottom: 8,
  },
  landscapeSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F2F2F2',
    marginBottom: 8,
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#464646',
  },
  portraitSectionHeader: {
    paddingHorizontal: 22,
    marginBottom: 8,
  },
  portraitSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D5D5D5',
    marginBottom: 7,
  },
  carouselWrapper: {
    justifyContent: 'center',
  },
  tileContainer: {
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#242424',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tileSelectedBorder: {
    borderWidth: 2.5,
    borderColor: '#55D8F4',
    borderRadius: 6,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  addGameTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  addGameTilePressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
  addGameIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGameLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
