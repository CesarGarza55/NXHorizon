import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { GameCartridgeCover } from '../components/common/GameCartridgeCover';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { GameMetadata, getLocalizedDescription, getLocalizedGenre } from '../types/game';
import { useGameStore } from '../state/useGameStore';
import { useAppTheme } from '../theme/ThemeProvider';
import { useGamepad } from '../hooks/useGamepad';
import { searchCatalogCandidates, GameCatalogEntry } from '../services/gameDatabase';
import { scrapeGameByTitleId } from '../services/gameScraper';

interface GameDetailScreenProps {
  game: GameMetadata;
  onBack: () => void;
  onLaunch: (game: GameMetadata) => void;
  onOpenConfig: (game: GameMetadata) => void;
  onRefreshMetadata?: (game: GameMetadata) => void;
}

const TITLE_ID_PATTERN = /^0100[a-f0-9]{12}$/i;

export const GameDetailScreen: React.FC<GameDetailScreenProps> = ({
  game,
  onBack,
  onLaunch,
  onOpenConfig,
  onRefreshMetadata,
}) => {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const { removeGame, recordPlaySession, updateGameMetadata, toggleFavorite } = useGameStore();

  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  // Gamepad focus index: 0 = Launch, 1 = Config, 2 = Favorite, 3 = Re-identify, 4 = Delete
  const [focusedActionIdx, setFocusedActionIdx] = useState(0);

  // ScrollView refs for controller auto-scrolling
  const portraitScrollRef = React.useRef<any>(null);
  const landscapeLeftScrollRef = React.useRef<any>(null);
  const landscapeRightScrollRef = React.useRef<any>(null);
  const [portraitScrollY, setPortraitScrollY] = useState(0);
  const [landscapeRightY, setLandscapeRightY] = useState(0);

  // Auto-scroll action button into view when focusedActionIdx changes
  React.useEffect(() => {
    if (isLandscape) {
      let targetY = 0;
      if (focusedActionIdx === 1) targetY = 45;
      else if (focusedActionIdx === 2) targetY = 105;
      else if (focusedActionIdx === 3) targetY = 165;
      else if (focusedActionIdx === 4) targetY = 230;
      landscapeLeftScrollRef.current?.scrollTo({ y: targetY, animated: true });
    } else {
      let targetY = 0;
      if (focusedActionIdx === 1) targetY = 60;
      else if (focusedActionIdx === 2) targetY = 120;
      else if (focusedActionIdx === 3) targetY = 180;
      else if (focusedActionIdx === 4) targetY = 240;
      portraitScrollRef.current?.scrollTo({ y: targetY, animated: true });
      setPortraitScrollY(targetY);
    }
  }, [focusedActionIdx, isLandscape]);

  // Re-identification States
  const [isReidentifyVisible, setIsReidentifyVisible] = useState(false);
  const [reidentifyQuery, setReidentifyQuery] = useState('');
  const [reidentifyCandidates, setReidentifyCandidates] = useState<GameCatalogEntry[]>([]);
  const [isReidentifying, setIsReidentifying] = useState(false);

  const handleOpenReidentify = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setReidentifyQuery(game.title);
    setReidentifyCandidates(searchCatalogCandidates(game.title));
    setIsReidentifyVisible(true);
  }, [game.title]);

  const handleReidentifyQueryChange = (text: string) => {
    setReidentifyQuery(text);
    if (text.trim().length >= 2) {
      setReidentifyCandidates(searchCatalogCandidates(text));
    }
  };

  const handleApplyTitleId = async (titleId: string) => {
    try {
      setIsReidentifying(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const meta = await scrapeGameByTitleId(titleId, {
        launchUrl: game.launchUrl,
        bundleName: game.bundleName,
        containerFolder: game.containerFolder,
      });
      await updateGameMetadata(game.id, {
        title: meta.title,
        titleId: meta.titleId,
        normalizedTitle: meta.normalizedTitle,
        coverUrl: meta.coverUrl,
        heroUrl: meta.heroUrl,
        screenshots: meta.screenshots,
        publisher: meta.publisher,
        developer: meta.developer,
        genre: meta.genre,
        description: meta.description,
        localizedDescriptions: meta.localizedDescriptions,
        localizedGenres: meta.localizedGenres,
        releaseDate: meta.releaseDate,
        needsMetadataSync: meta.needsMetadataSync,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setIsReidentifyVisible(false);
    } catch (err) {
      console.warn('Reidentify candidate error:', err);
    } finally {
      setIsReidentifying(false);
    }
  };

  const handleApplyCandidate = (candidate: GameCatalogEntry) => {
    return handleApplyTitleId(candidate.titleId);
  };

  const handleApplyCustomName = async (customName: string) => {
    const clean = customName.trim();
    if (!clean) return;
    try {
      setIsReidentifying(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await updateGameMetadata(game.id, {
        title: clean,
        normalizedTitle: clean.toLowerCase(),
        needsMetadataSync: true,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setIsReidentifyVisible(false);
    } catch (err) {
      console.warn('Reidentify custom error:', err);
    } finally {
      setIsReidentifying(false);
    }
  };

  const handleSubmitReidentifyQuery = () => {
    const query = reidentifyQuery.trim();
    if (TITLE_ID_PATTERN.test(query)) {
      handleApplyTitleId(query);
    } else if (reidentifyCandidates.length === 1) {
      handleApplyCandidate(reidentifyCandidates[0]);
    } else if (reidentifyCandidates.length === 0) {
      handleApplyCustomName(query);
    }
  };

  const handleLaunch = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    recordPlaySession(game.id, 15);
    onLaunch(game);
  }, [game, onLaunch, recordPlaySession]);

  const handleDelete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert(
      t('details.confirmDeleteTitle'),
      t('details.confirmDeleteMessage', { title: game.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            await removeGame(game.id);
            onBack();
          },
        },
      ]
    );
  }, [game, removeGame, onBack, t]);

  const handleActionExecute = useCallback(
    (idx: number) => {
      switch (idx) {
        case 0:
          handleLaunch();
          break;
        case 1:
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onOpenConfig(game);
          break;
        case 2:
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          toggleFavorite(game.id);
          break;
        case 3:
          handleOpenReidentify();
          break;
        case 4:
          handleDelete();
          break;
      }
    },
    [handleLaunch, onOpenConfig, game, handleOpenReidentify, handleDelete, toggleFavorite]
  );

  // Full Gamepad Controls with auto-scroll support
  useGamepad({
    onDirection: (dir) => {
      if (selectedScreenshot) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (dir === 'up') {
        if (!isLandscape && portraitScrollY > 240) {
          // If scrolled down in portrait past action buttons, scroll back up to button 4
          portraitScrollRef.current?.scrollTo({ y: 240, animated: true });
          setPortraitScrollY(240);
        } else {
          setFocusedActionIdx((prev) => Math.max(0, prev - 1));
        }
      } else if (dir === 'down') {
        if (focusedActionIdx < 4) {
          setFocusedActionIdx((prev) => Math.min(4, prev + 1));
        } else if (!isLandscape) {
          // In portrait, if already at button 4, pressing down scrolls the page down to view metadata/screenshots/description
          const nextY = Math.min(portraitScrollY + 200, 1000);
          portraitScrollRef.current?.scrollTo({ y: nextY, animated: true });
          setPortraitScrollY(nextY);
        }
      } else if (dir === 'left') {
        if (isLandscape) {
          // In landscape, left scrolls right column content up
          setLandscapeRightY((prev) => {
            const next = Math.max(0, prev - 160);
            landscapeRightScrollRef.current?.scrollTo({ y: next, animated: true });
            return next;
          });
        } else {
          setFocusedActionIdx((prev) => Math.max(0, prev - 1));
        }
      } else if (dir === 'right') {
        if (isLandscape) {
          // In landscape, right scrolls right column content down
          setLandscapeRightY((prev) => {
            const next = prev + 160;
            landscapeRightScrollRef.current?.scrollTo({ y: next, animated: true });
            return next;
          });
        } else {
          setFocusedActionIdx((prev) => Math.min(4, prev + 1));
        }
      }
    },
    onButtonPress: (button) => {
      if (selectedScreenshot) {
        setSelectedScreenshot(null);
        return;
      }
      if (button === 'B') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onBack();
      } else if (button === 'A') {
        handleActionExecute(focusedActionIdx);
      } else if (button === 'START' || button === 'SELECT' || button === 'X') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onOpenConfig(game);
      }
    },
  });

  // Action Buttons Component
  const renderActionButtons = () => (
    <View style={styles.actionButtonsCol}>
      <Pressable
        style={({ pressed }) => [
          styles.actionBtnPrimary,
          { backgroundColor: colors.accent },
          focusedActionIdx === 0 && styles.actionBtnFocused,
          pressed && { opacity: 0.85 },
        ]}
        onPress={() => {
          setFocusedActionIdx(0);
          handleLaunch();
        }}
        accessibilityRole="button"
      >
        <View style={styles.btnGlyphCircle}>
          <Text style={[styles.btnGlyphLetter, { color: colors.accent }]}>A</Text>
        </View>
        <Text style={styles.actionBtnPrimaryText}>{t('contextMenu.playNow')}</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.actionBtnSecondary,
          { backgroundColor: colors.surface, borderColor: colors.border },
          focusedActionIdx === 1 && [styles.actionBtnFocusedSecondary, { borderColor: colors.accent }],
          pressed && { borderColor: colors.accent },
        ]}
        onPress={() => {
          setFocusedActionIdx(1);
          onOpenConfig(game);
        }}
        accessibilityRole="button"
      >
        <Ionicons name="options-outline" size={17} color={colors.accent} />
        <Text style={[styles.actionBtnSecondaryText, { color: colors.text }]}>
          {t('contextMenu.gameConfig')}
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.actionBtnSecondary,
          { backgroundColor: colors.surface, borderColor: colors.border },
          focusedActionIdx === 2 && [styles.actionBtnFocusedSecondary, { borderColor: colors.accent }],
          pressed && { borderColor: colors.accent },
        ]}
        onPress={() => {
          setFocusedActionIdx(2);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          toggleFavorite(game.id);
        }}
        accessibilityRole="button"
        accessibilityLabel={t(game.isFavorite ? 'details.removeFromFavorites' : 'details.addToFavorites')}
      >
        <Ionicons
          name={game.isFavorite ? 'heart' : 'heart-outline'}
          size={17}
          color={game.isFavorite ? colors.destructive : colors.accent}
        />
        <Text style={[styles.actionBtnSecondaryText, { color: colors.text }]}>
          {t(game.isFavorite ? 'details.removeFromFavorites' : 'details.addToFavorites')}
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.actionBtnSecondary,
          { backgroundColor: colors.surface, borderColor: colors.border },
          focusedActionIdx === 3 && [styles.actionBtnFocusedSecondary, { borderColor: colors.accent }],
          pressed && { borderColor: colors.accent },
        ]}
        onPress={() => {
          setFocusedActionIdx(3);
          handleOpenReidentify();
        }}
        accessibilityRole="button"
      >
        <Ionicons name="sync-outline" size={17} color={colors.accent} />
        <Text style={[styles.actionBtnSecondaryText, { color: colors.text }]}>
          {t('details.reidentify')}
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.actionBtnSecondary,
          { backgroundColor: colors.surface, borderColor: colors.border },
          focusedActionIdx === 4 && [styles.actionBtnFocusedSecondary, { borderColor: colors.destructive }],
          pressed && { borderColor: colors.destructive },
        ]}
        onPress={() => {
          setFocusedActionIdx(4);
          handleDelete();
        }}
        accessibilityRole="button"
      >
        <Ionicons name="trash-outline" size={17} color={colors.destructive} />
        <Text style={[styles.actionBtnSecondaryText, { color: colors.destructive }]}>
          {t('details.deleteGame')}
        </Text>
      </Pressable>
    </View>
  );

  // Pending Sync Banner
  const renderPendingSyncBanner = () => {
    if (!game.needsMetadataSync) return null;
    return (
      <View style={[styles.pendingSyncCard, { backgroundColor: colors.surface, borderColor: '#FFA500' }]}>
        <View style={styles.pendingSyncHeader}>
          <Ionicons name="cloud-offline-outline" size={18} color="#FFA500" />
          <Text style={[styles.pendingSyncTitle, { color: colors.text }]}>
            {t('details.pendingSyncTitle')}
          </Text>
        </View>
        <Text style={[styles.pendingSyncDesc, { color: colors.textSecondary }]}>
          {t('details.pendingSyncDesc')}
        </Text>
        {onRefreshMetadata && (
          <Pressable
            style={({ pressed }) => [
              styles.syncNowBtn,
              { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
              pressed && { borderColor: colors.accent },
            ]}
            onPress={() => onRefreshMetadata(game)}
            accessibilityRole="button"
          >
            <Ionicons name="sync-outline" size={14} color={colors.accent} />
            <Text style={[styles.syncNowBtnText, { color: colors.accent }]}>
              {t('details.retrySync')}
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  // Metadata Cards Component (Always consistent 3-4 cards)
  const renderMetadataCards = () => (
    <View style={styles.metadataCardsRow}>
      <View style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.metaLabel, { color: colors.textMuted }]}>{t('details.developer')}</Text>
        <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={1}>
          {game.developer || t('details.unknown')}
        </Text>
      </View>

      <View style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.metaLabel, { color: colors.textMuted }]}>{t('details.releaseDate')}</Text>
        <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={1}>
          {game.releaseDate || t('details.unknown')}
        </Text>
      </View>

      <View style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.metaLabel, { color: colors.textMuted }]}>{t('details.playTime')}</Text>
        <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={1}>
          {game.playTimeMinutes > 0
            ? t('common.hoursAndMinutes', {
                hours: Math.floor(game.playTimeMinutes / 60),
                minutes: game.playTimeMinutes % 60,
              })
            : t('details.neverPlayed')}
        </Text>
      </View>
    </View>
  );

  // Screenshots Gallery Component (With elegant empty state)
  const renderScreenshots = () => {
    const validScreenshots = (game.screenshots || [])
      .filter((s) => typeof s === 'string' && !s.endsWith('/screen/0'))
      .map((s) => s.replace(/^http:\/\//, 'https://'));

    return (
      <View style={styles.screenshotsSection}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="images-outline" size={18} color={colors.accent} />
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            {t('details.screenshots')}
          </Text>
        </View>
        {validScreenshots.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.screenshotsScrollContent}
          >
            {validScreenshots.map((shot, idx) => (
              <Pressable
                key={shot || idx}
                style={({ pressed }) => [
                  styles.screenshotCard,
                  { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => setSelectedScreenshot(shot)}
              >
                <Image
                  source={{ uri: shot }}
                  style={styles.screenshotImage}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.emptyScreenshotsCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Ionicons name="images-outline" size={28} color={colors.textMuted} />
            <Text style={[styles.emptyScreenshotsTitle, { color: colors.text }]}>
              {t('details.noScreenshots')}
            </Text>
            <Text style={[styles.emptyScreenshotsDesc, { color: colors.textMuted }]}>
              {t('details.noScreenshotsDesc')}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Hero Banner Component
  const renderHeroBanner = (isLandscapeLayout: boolean) => {
    if (game.heroUrl) {
      return (
        <View style={isLandscapeLayout ? styles.heroBannerWrap : styles.portraitHeroBanner}>
          <Image
            source={{ uri: game.heroUrl }}
            style={styles.heroBannerImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
          <View style={[styles.heroBannerOverlay, { backgroundColor: colors.overlay }]} />
        </View>
      );
    }
    return (
      <View
        style={[
          isLandscapeLayout ? styles.heroBannerWrap : styles.portraitHeroBanner,
          styles.heroBannerPlaceholder,
          { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
        ]}
      >
        <Ionicons name="game-controller-outline" size={54} color={colors.border} style={styles.heroWatermark} />
        <View style={styles.heroPlaceholderContent}>
          <Text style={[styles.heroPlaceholderTitle, { color: colors.textMuted }]} numberOfLines={1}>
            {game.title}
          </Text>
        </View>
      </View>
    );
  };

  // Description Section
  const renderDescription = () => {
    const localizedDesc = getLocalizedDescription(game, i18n.language);
    return (
      <View style={styles.descriptionSection}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            {t('details.aboutGame')}
          </Text>
        </View>
        <Text
          style={[
            styles.descriptionText,
            { color: localizedDesc ? colors.textSecondary : colors.textMuted },
            !localizedDesc && styles.emptyDescriptionText,
          ]}
        >
          {localizedDesc || t('details.noDescription')}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Header Bar */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: isLandscape ? Math.max(insets.top, 4) : insets.top + 4,
            paddingLeft: Math.max(insets.left, isLandscape ? 28 : 20),
            paddingRight: Math.max(insets.right, isLandscape ? 28 : 20),
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            minHeight: (isLandscape ? 44 : 48) + (isLandscape ? Math.max(insets.top, 0) : insets.top),
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.headerBtn,
            { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
            pressed && { opacity: 0.7 },
          ]}
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.headerBtnText, { color: colors.text }]}>{t('common.back')}</Text>
        </Pressable>

        <Text style={[styles.topBarTitle, { color: colors.text }]} numberOfLines={1}>
          {game.title}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.headerBtn,
            { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
            pressed && { borderColor: colors.accent },
          ]}
          onPress={() => onOpenConfig(game)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('contextMenu.gameConfig')}
        >
          <Ionicons name="options-outline" size={16} color={colors.accent} />
          <Text style={[styles.headerBtnText, { color: colors.accent }]}>
            {t('common.options')}
          </Text>
        </Pressable>
      </View>

      {/* Main Content: Responsive Split Layout in Landscape, Single Column in Portrait */}
      {isLandscape ? (
        <View style={styles.landscapeContainer}>
          {/* Left Column: Fixed Cover, Title & Actions */}
          <View
            style={[
              styles.leftColumn,
              {
                width: 220 + Math.max(insets.left, 0),
                paddingLeft: Math.max(insets.left, 20),
                borderRightColor: colors.border,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <ScrollView
              ref={landscapeLeftScrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.leftColumnScroll}
            >
              <GameCartridgeCover
                game={game}
                style={styles.landscapeCover}
                contentFit="cover"
                showSyncBadge={false}
                iconSize={36}
              />

              <View style={styles.titleBlock}>
                <View style={styles.genreRow}>
                  <Text style={[styles.genreText, { color: colors.accentStrong }]}>
                    {(getLocalizedGenre(game, i18n.language) || 'Nintendo Switch').toUpperCase()}
                  </Text>
                  {game.titleId && (
                    <View style={[styles.titleIdTag, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                      <Text style={[styles.titleIdText, { color: colors.textSecondary }]}>{game.titleId}</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.gameTitleText, { color: colors.text }]} numberOfLines={2}>
                  {game.title}
                </Text>
                <Text style={[styles.gamePublisherText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {game.publisher}
                </Text>
              </View>

              {renderActionButtons()}
            </ScrollView>
          </View>

          {/* Right Column: Hero Banner, Metadata, Screenshots & Description */}
          <ScrollView
            ref={landscapeRightScrollRef}
            style={styles.rightColumn}
            contentContainerStyle={[
              styles.rightColumnScroll,
              {
                paddingLeft: 20,
                paddingRight: Math.max(insets.right, 28),
                paddingBottom: Math.max(insets.bottom, 24),
              },
            ]}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(e) => setLandscapeRightY(e.nativeEvent.contentOffset.y)}
          >
            {renderPendingSyncBanner()}
            {renderHeroBanner(true)}
            {renderMetadataCards()}
            {renderScreenshots()}
            {renderDescription()}
          </ScrollView>
        </View>
      ) : (
        /* Portrait Mode: Spacious vertical scroll without collisions */
        <ScrollView
          ref={portraitScrollRef}
          style={styles.portraitScroll}
          contentContainerStyle={[
            styles.portraitScrollContent,
            {
              paddingLeft: Math.max(insets.left, 20),
              paddingRight: Math.max(insets.right, 20),
              paddingBottom: Math.max(insets.bottom, 40),
            },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => setPortraitScrollY(e.nativeEvent.contentOffset.y)}
        >
          {renderPendingSyncBanner()}
          {renderHeroBanner(false)}

          {/* Cover & Title Block */}
          <View style={styles.portraitHeaderRow}>
            <GameCartridgeCover
              game={game}
              style={styles.portraitCover}
              contentFit="cover"
              showSyncBadge={false}
              iconSize={30}
            />
            <View style={styles.portraitTitleBlock}>
              <View style={styles.genreRow}>
                <Text style={[styles.genreText, { color: colors.accentStrong }]}>
                  {(getLocalizedGenre(game, i18n.language) || 'Nintendo Switch').toUpperCase()}
                </Text>
                {game.titleId && (
                  <View style={[styles.titleIdTag, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                    <Text style={[styles.titleIdText, { color: colors.textSecondary }]}>{game.titleId}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.gameTitleText, { color: colors.text }]} numberOfLines={2}>
                {game.title}
              </Text>
              <Text style={[styles.gamePublisherText, { color: colors.textSecondary }]} numberOfLines={1}>
                {game.publisher}
              </Text>
            </View>
          </View>

          {renderActionButtons()}
          {renderMetadataCards()}
          {renderScreenshots()}
          {renderDescription()}
        </ScrollView>
      )}

      {/* Fullscreen Screenshot Modal */}
      <Modal
        visible={selectedScreenshot !== null}
        transparent
        animationType="fade"
        supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
        onRequestClose={() => setSelectedScreenshot(null)}
      >
        <View style={styles.fullscreenBackdrop}>
          <Pressable
            style={[
              styles.fullscreenCloseBtn,
              {
                top: Math.max(insets.top, 24),
                right: Math.max(insets.right, 24),
              },
            ]}
            onPress={() => setSelectedScreenshot(null)}
            hitSlop={14}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
          {selectedScreenshot ? (
            <Image
              source={{ uri: selectedScreenshot }}
              style={styles.fullscreenImg}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          ) : null}
        </View>
      </Modal>

      {/* Re-identify / Change Game Modal */}
      <Modal
        visible={isReidentifyVisible}
        transparent
        animationType="fade"
        supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
        onRequestClose={() => setIsReidentifyVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.reidentifyKeyboardAvoiding}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.reidentifyBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsReidentifyVisible(false)} />
            <View
              style={[
                styles.reidentifyModalCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  maxHeight: Math.min(520, height - insets.top - insets.bottom - 32),
                  maxWidth: isLandscape ? 620 : 390,
                },
              ]}
            >
              <View style={[styles.reidentifyHeader, { borderBottomColor: colors.border }]}>
                <View style={styles.reidentifyHeaderLeft}>
                  <Ionicons name="sync-circle" size={22} color={colors.accent} />
                  <Text style={[styles.reidentifyTitle, { color: colors.text }]}>
                    {t('details.reidentifyTitle')}
                  </Text>
                </View>
                <Pressable onPress={() => setIsReidentifyVisible(false)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </Pressable>
              </View>

              <Text style={[styles.reidentifyDesc, { color: colors.textSecondary }]}>
                {t('details.reidentifyDesc')}
              </Text>

              <View style={styles.reidentifySearchRow}>
                <TextInput
                  style={[styles.reidentifyInput, { backgroundColor: colors.surfaceSecondary, color: colors.text, borderColor: colors.border }]}
                  placeholder={t('import.namePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={reidentifyQuery}
                  onChangeText={handleReidentifyQueryChange}
                  autoCapitalize="none"
                  returnKeyType="search"
                  autoCorrect={false}
                  onSubmitEditing={handleSubmitReidentifyQuery}
                />
                <Pressable
                  style={[styles.reidentifySearchBtn, { backgroundColor: colors.accent }]}
                  onPress={handleSubmitReidentifyQuery}
                  disabled={!reidentifyQuery.trim() || isReidentifying}
                >
                  {isReidentifying ? (
                    <ActivityIndicator size="small" color={colors.surface} />
                  ) : (
                    <Ionicons name="search" size={18} color={colors.surface} />
                  )}
                </Pressable>
              </View>

              {/* Candidate List */}
              <ScrollView
                style={styles.reidentifyListScroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {reidentifyCandidates.map((cand) => (
                  <Pressable
                    key={cand.titleId}
                    style={({ pressed }) => [
                      styles.candidateItem,
                      { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                      pressed && { borderColor: colors.accent },
                    ]}
                    onPress={() => handleApplyCandidate(cand)}
                  >
                    <View style={[styles.candidateIconBadge, { backgroundColor: colors.surface }]}>
                      <Ionicons name="game-controller-outline" size={16} color={colors.accent} />
                    </View>
                    <View style={styles.candidateDetails}>
                      <Text style={[styles.candidateTitle, { color: colors.text }]} numberOfLines={1}>
                        {cand.title}
                      </Text>
                      <Text style={[styles.candidateSub, { color: colors.textMuted }]}>
                        {cand.publisher} • {cand.releaseDate?.slice(0, 4) || 'Switch'} • ID: {cand.titleId.slice(-6)}
                      </Text>
                    </View>
                    <Ionicons name="checkmark-circle-outline" size={18} color={colors.accent} />
                  </Pressable>
                ))}

                {reidentifyQuery.trim().length > 0 && !TITLE_ID_PATTERN.test(reidentifyQuery.trim()) && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.manualFallbackBtn,
                      { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                      pressed && { borderColor: colors.accent },
                    ]}
                    onPress={() => handleApplyCustomName(reidentifyQuery)}
                  >
                    <Ionicons name="pencil" size={14} color={colors.textSecondary} />
                    <Text style={[styles.manualFallbackBtnText, { color: colors.text }]}>
                      {t('import.useManualNameBtn')}: "{reidentifyQuery.trim()}"
                    </Text>
                  </Pressable>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  headerBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  topBarTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: 12,
  },
  landscapeContainer: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  leftColumn: {
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingRight: 14,
    paddingTop: 12,
  },
  leftColumnScroll: {
    paddingBottom: 24,
    gap: 12,
  },
  landscapeCover: {
    width: 105,
    height: 105,
    borderRadius: 8,
    borderWidth: 1.5,
    alignSelf: 'center',
  },
  titleBlock: {
    gap: 4,
  },
  genreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  genreText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  titleIdTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  titleIdText: {
    fontSize: 9.5,
    fontFamily: 'Courier',
    fontWeight: '600',
  },
  gameTitleText: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 21,
  },
  gamePublisherText: {
    fontSize: 12,
  },
  actionButtonsCol: {
    gap: 8,
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 6,
    gap: 8,
  },
  actionBtnFocused: {
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#00D2FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 8,
  },
  btnGlyphCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGlyphLetter: {
    fontSize: 11,
    fontWeight: '800',
  },
  actionBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    gap: 6,
  },
  actionBtnFocusedSecondary: {
    borderWidth: 2.5,
    shadowColor: '#00D2FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 6,
  },
  actionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rightColumn: {
    flex: 1,
    paddingLeft: 20,
    paddingTop: 16,
  },
  rightColumnScroll: {
    gap: 20,
  },
  heroBannerWrap: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  heroBannerImage: {
    width: '100%',
    height: '100%',
  },
  heroBannerOverlay: {
    ...StyleSheet.absoluteFill,
    opacity: 0.35,
  },
  heroBannerPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  heroWatermark: {
    position: 'absolute',
    opacity: 0.18,
  },
  heroPlaceholderContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  heroPlaceholderTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pendingSyncCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 6,
  },
  pendingSyncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingSyncTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  pendingSyncDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  syncNowBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 4,
  },
  syncNowBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  metadataCardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metaCard: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  metaLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  screenshotsSection: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
  },
  screenshotsScrollContent: {
    gap: 12,
    paddingRight: 16,
  },
  screenshotCard: {
    width: 200,
    height: 112,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  screenshotImage: {
    width: '100%',
    height: '100%',
  },
  emptyScreenshotsCard: {
    padding: 22,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyScreenshotsTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyScreenshotsDesc: {
    fontSize: 11.5,
    textAlign: 'center',
  },
  descriptionSection: {
    gap: 8,
  },
  descriptionText: {
    fontSize: 13,
    lineHeight: 20,
  },
  emptyDescriptionText: {
    fontStyle: 'italic',
  },
  portraitScroll: {
    flex: 1,
  },
  portraitScrollContent: {
    paddingTop: 16,
    gap: 18,
  },
  portraitHeroBanner: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  portraitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  portraitCover: {
    width: 86,
    height: 86,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  portraitTitleBlock: {
    flex: 1,
    gap: 4,
  },
  fullscreenBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 24,
    zIndex: 20,
    padding: 8,
  },
  fullscreenImg: {
    width: '92%',
    height: '84%',
  },
  reidentifyBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  reidentifyKeyboardAvoiding: {
    flex: 1,
  },
  reidentifyModalCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
    flexShrink: 1,
  },
  reidentifyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  reidentifyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reidentifyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  reidentifyDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  reidentifySearchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  reidentifyInput: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    borderWidth: 1,
  },
  reidentifySearchBtn: {
    width: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reidentifyListScroll: {
    maxHeight: 220,
    flexShrink: 1,
  },
  candidateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 9,
    borderRadius: 6,
    borderWidth: 1,
    gap: 8,
    marginBottom: 6,
  },
  candidateIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateDetails: {
    flex: 1,
  },
  candidateTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  candidateSub: {
    fontSize: 10.5,
  },
  manualFallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 8,
  },
  manualFallbackBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
