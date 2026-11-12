import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  useWindowDimensions,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { GameCartridgeCover } from '../common/GameCartridgeCover';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GameMetadata } from '../../types/game';
import { useGameStore } from '../../state/useGameStore';
import { useFocusStore } from '../../state/useFocusStore';
import { useAppTheme } from '../../theme/ThemeProvider';

interface GameLibraryGridProps {
  onGameSelect: (game: GameMetadata) => void;
  onLongPress: (game: GameMetadata) => void;
  onImportPress: () => void;
  onBackPress: () => void;
}

export const GameLibraryGrid: React.FC<GameLibraryGridProps> = ({
  onGameSelect,
  onLongPress,
  onImportPress,
  onBackPress,
}) => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const insets = useSafeAreaInsets();
  const columnCount = isLandscape ? (width >= 1000 ? 6 : 5) : 2;
  const paddingLeft = Math.max(insets.left, isLandscape ? 28 : 16);
  const paddingRight = Math.max(insets.right, isLandscape ? 28 : 16);
  const gap = isLandscape ? 14 : 12;
  const cardSize = (width - paddingLeft - paddingRight - gap * (columnCount - 1)) / columnCount;

  const {
    games,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
    selectedGameId,
    setSelectedGame,
  } = useGameStore();
  const { setFocusedNode } = useFocusStore();

  const filteredGames = games.filter((game) => {
    const matchesSearch =
      !searchQuery.trim() ||
      game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.publisher.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (game.titleId && game.titleId.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterMode === 'favorites') return game.isFavorite;
    if (filterMode === 'recent') return game.lastPlayed !== null;
    return true;
  });

  const handleCardPress = (game: GameMetadata) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedGame(game.id);
    setFocusedNode(game.id, false);
    onGameSelect(game);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Switch All Software Header Bar */}
      <View
        style={[
          styles.headerBar,
          !isLandscape && styles.headerBarPortrait,
          {
            paddingTop: isLandscape ? Math.max(insets.top, 8) : insets.top + 6,
            paddingLeft,
            paddingRight,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Pressable
            style={({ pressed }) => [
              styles.backBtn,
              pressed && { backgroundColor: colors.surfaceSecondary },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onBackPress();
            }}
          >
            <View style={[styles.backCircle, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Ionicons name="chevron-back" size={16} color={colors.text} />
            </View>
            <Text style={[styles.backText, { color: colors.textSecondary }]}>{t('common.back')}</Text>
          </Pressable>

          <Text style={[styles.allSoftwareTitle, { color: colors.text }]}>{t('library.title')}</Text>
          <Text style={[styles.gameCountBadge, { color: colors.textMuted }]}>
            {filteredGames.length} / {games.length}
          </Text>
        </View>

        {/* Search Input & Add Button */}
        <View style={[styles.headerRight, !isLandscape && styles.headerRightPortrait]}>
          <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.textMuted} style={{ marginRight: 6 }} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={t('library.searchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.accent}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
              pressed && { opacity: 0.8 },
            ]}
            onPress={onImportPress}
            hitSlop={6}
          >
            <Ionicons name="add" size={22} color={colors.accent} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />

      {/* Grid of Square Software Tiles */}
      <FlatList
        data={filteredGames}
        keyExtractor={(item) => item.id}
        numColumns={columnCount}
        key={`grid_${columnCount}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContainer,
          {
            paddingLeft,
            paddingRight,
            paddingBottom: Math.max(insets.bottom, 28),
            flexGrow: filteredGames.length === 0 ? 1 : undefined,
          },
        ]}
        columnWrapperStyle={{ gap }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name={filterMode === 'favorites' ? 'heart-outline' : games.length === 0 ? 'game-controller-outline' : 'search-outline'}
              size={42}
              color={colors.accentStrong}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {games.length === 0
                ? t('home.noGamesTitle')
                : filterMode === 'favorites'
                  ? t('library.emptyFavorites')
                  : t('library.emptySearch')}
            </Text>
            {games.length === 0 && (
              <>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('home.noGamesSubtitle')}</Text>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.emptyAction,
                    { backgroundColor: colors.accentStrong },
                    pressed && styles.emptyActionPressed,
                  ]}
                  onPress={onImportPress}
                >
                  <Ionicons name="add" size={18} color={colors.surface} />
                  <Text style={[styles.emptyActionText, { color: colors.surface }]}>{t('home.importFirstGame')}</Text>
                </Pressable>
              </>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const isSelected = item.id === selectedGameId;
          return (
            <Pressable
              style={({ pressed }) => [
                styles.gridCard,
                { backgroundColor: colors.surfaceSecondary },
                { width: cardSize, height: cardSize },
                isSelected && styles.gridCardSelected,
                isSelected && { borderColor: colors.accent },
                pressed && styles.gridCardPressed,
              ]}
              onPress={() => handleCardPress(item)}
              onLongPress={() => onLongPress(item)}
              delayLongPress={350}
            >
              <GameCartridgeCover
                game={item}
                style={styles.gridCover}
                contentFit="cover"
                showSyncBadge={true}
                iconSize={cardSize > 120 ? 32 : 24}
              />
              {isSelected && <View style={styles.switchCursorFrame} />}
            </Pressable>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2D2D2D',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  headerBarPortrait: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 4,
    borderRadius: 22,
  },
  backBtnPressed: {
    backgroundColor: '#3E3E3E',
  },
  backCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#444444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#666666',
  },
  backText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CCCCCC',
  },
  allSoftwareTitle: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  gameCountBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E8E',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  headerRightPortrait: {
    width: '100%',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#3D3D3D',
    minWidth: 0,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: '#F0F0F0',
    fontSize: 13,
    padding: 0,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#383838',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4D4D4D',
  },
  addBtnPressed: {
    backgroundColor: '#505050',
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#383838',
    marginBottom: 16,
  },
  listContainer: {
    paddingBottom: 32,
    gap: 14,
  },
  gridCard: {
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  gridCardSelected: {
    borderWidth: 3.5,
    borderColor: '#00D2FF',
    borderRadius: 8,
  },
  gridCardPressed: {
    transform: [{ scale: 0.96 }],
  },
  gridCover: {
    width: '100%',
    height: '100%',
  },
  switchCursorFrame: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 4,
  },
  favoriteBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#E60012',
    borderRadius: 8,
    padding: 3,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    color: '#B3B7BA',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 360,
  },
  emptyAction: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    backgroundColor: '#087F9C',
    borderRadius: 24,
    marginTop: 6,
  },
  emptyActionPressed: {
    backgroundColor: '#066A83',
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
