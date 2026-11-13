import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Alert,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';

import { initializeI18n } from './src/i18n';
import { useGameStore } from './src/state/useGameStore';
import { useFocusStore } from './src/state/useFocusStore';
import { useGamepad } from './src/hooks/useGamepad';
import { GameMetadata } from './src/types/game';
import { AppReleaseInfo, checkForAppUpdates } from './src/services/updateService';

import { SwitchTopBar } from './src/components/switch/SwitchTopBar';
import { SwitchBottomDock } from './src/components/switch/SwitchBottomDock';
import { SwitchPromptBar } from './src/components/switch/SwitchPromptBar';
import { GameCarousel } from './src/components/carousel/GameCarousel';
import { GameLibraryGrid } from './src/components/library/GameLibraryGrid';
import { SettingsScreen, SettingsSection } from './src/screens/SettingsScreen';
import { GameDetailScreen } from './src/screens/GameDetailScreen';
import { GameContextMenu } from './src/components/common/GameContextMenu';
import { GameConfigModal } from './src/components/common/GameConfigModal';
import { ImportGameModal } from './src/components/common/ImportGameModal';
import { OnboardingModal } from './src/components/common/OnboardingModal';
import { autoDetectAndScrapeGame } from './src/services/gameScraper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ensureGameDirectBoot,
  extractContainerFolder,
  openLiveContainerGame,
  mapLaunchConfigToEnv,
  addNetworkListener,
} from './modules/nx-livecontainer';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeProvider';

function MainNavigator() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { t } = useTranslation();

  const {
    games,
    selectedGameId,
    setSelectedGame,
    setSearchQuery,
    setFilterMode,
    loadLibrary,
    toggleFavorite,
    updateGameMetadata,
    syncPendingGamesSilently,
    removeGame,
    recordPlaySession,
    isDirectBootEnabled,
    globalLaunchConfig,
  } = useGameStore();

  const {
    activeScreen,
    setActiveScreen,
    focusZone,
    setFocusZone,
    focusedDockIndex,
    setFocusedDockIndex,
    isControllerTestActive,
  } = useFocusStore();

  const [contextMenuGame, setContextMenuGame] = useState<GameMetadata | null>(null);
  const [configModalGame, setConfigModalGame] = useState<GameMetadata | null>(null);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [isOnboardingVisible, setIsOnboardingVisible] = useState(false);
  const [isOnboardingResolved, setIsOnboardingResolved] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('support');
  const [pendingHomeUpdate, setPendingHomeUpdate] = useState<AppReleaseInfo | null>(null);
  const hasCheckedHomeUpdatesRef = useRef(false);
  const hasShownHomeUpdateRef = useRef(false);

  const openSettings = (section: SettingsSection = 'support') => {
    setSettingsSection(section);
    setActiveScreen('settings');
  };

  const openLibrary = () => {
    setSearchQuery('');
    setFilterMode('all');
    setActiveScreen('library');
  };

  const openFavorites = () => {
    setSearchQuery('');
    setFilterMode('favorites');
    const firstFavorite = games.find((game) => game.isFavorite);
    if (firstFavorite) setSelectedGame(firstFavorite.id);
    setActiveScreen('library');
  };

  useEffect(() => {
    AsyncStorage.getItem('@nx_has_seen_onboarding').then((val) => {
      if (val !== 'true') {
        setIsOnboardingVisible(true);
      }
      setIsOnboardingResolved(true);
    }).catch((error) => {
      console.warn('[Home] Failed to load onboarding state:', error);
      setIsOnboardingResolved(true);
    });
  }, []);

  useEffect(() => {
    if (
      activeScreen !== 'home' ||
      !isOnboardingResolved ||
      isOnboardingVisible ||
      hasCheckedHomeUpdatesRef.current
    ) {
      return;
    }

    hasCheckedHomeUpdatesRef.current = true;
    checkForAppUpdates()
      .then((release) => {
        if (release.isNewer) setPendingHomeUpdate(release);
      })
      .catch((error) => {
        console.warn('[Home] Failed to check for app updates:', error);
      });
  }, [activeScreen, isOnboardingResolved, isOnboardingVisible]);

  useEffect(() => {
    if (
      !pendingHomeUpdate ||
      activeScreen !== 'home' ||
      !isOnboardingResolved ||
      isOnboardingVisible ||
      hasShownHomeUpdateRef.current
    ) {
      return;
    }

    hasShownHomeUpdateRef.current = true;
    Alert.alert(
      t('settings.updateAvailableTitle'),
      t('settings.newVersionAvailable', { version: pendingHomeUpdate.version }),
      [
        {
          text: t('settings.downloadUpdate'),
          onPress: () => {
            if (pendingHomeUpdate.downloadUrl) {
              Linking.openURL(pendingHomeUpdate.downloadUrl).catch((error) => {
                console.warn('[Home] Failed to open update download:', error);
              });
            }
          },
        },
        { text: t('common.close'), style: 'cancel' },
      ]
    );
  }, [activeScreen, isOnboardingResolved, isOnboardingVisible, pendingHomeUpdate, t]);

  const handleCloseOnboarding = async () => {
    setIsOnboardingVisible(false);
    await AsyncStorage.setItem('@nx_has_seen_onboarding', 'true');
  };

  // Enable dynamic rotation on startup
  useEffect(() => {
    ScreenOrientation.unlockAsync().catch((err) => {
      console.warn('ScreenOrientation unlock error:', err);
    });
  }, []);

  const selectedGame = games.find((g) => g.id === selectedGameId) || games[0] || null;

  const handleGameLaunch = async (game: GameMetadata) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    recordPlaySession(game.id, 20);

    if (game.launchUrl) {
      if (isDirectBootEnabled) {
        const folder = game.containerFolder || extractContainerFolder(game.launchUrl);
        if (folder) {
          try {
            const mergedConfig = {
              ...globalLaunchConfig,
              ...(game.launchConfig || {}),
            };
            const envMap = mapLaunchConfigToEnv(mergedConfig);
            await ensureGameDirectBoot(folder, envMap);
            await new Promise((resolve) => setTimeout(resolve, 60));
          } catch (err) {
            console.warn('[LiveContainer] Could not pre-write env.txt:', err);
          }
        }
      }

      // 1. Try native silent launch via LSApplicationWorkspace to avoid SpringBoard alert
      const openedNatively = await openLiveContainerGame(game.launchUrl);
      if (openedNatively) return;

      // 2. Fallback to standard openURL
      try {
        await Linking.openURL(game.launchUrl);
        return;
      } catch (e) {
        console.warn('Error launching LiveContainer URL directly:', e);
        Alert.alert(
          t('common.error'),
          t('details.liveContainerLaunchError', { launchUrl: game.launchUrl })
        );
        return;
      }
    }

    Alert.alert(
      t('common.play'),
      `${t('details.launchGame')}: ${game.title}\n\n[${t('details.titleId')}: ${game.titleId || 'N/A'}]`
    );
  };

  const handleRefreshMetadata = async (game: GameMetadata) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const scrapeQuery = game.titleId || game.title;
      const result = await autoDetectAndScrapeGame(scrapeQuery, game.titleId ? undefined : game.title);
      if (result.metadata) {
        await updateGameMetadata(game.id, {
          coverUrl: result.metadata.coverUrl,
          heroUrl: result.metadata.heroUrl,
          screenshots: result.metadata.screenshots,
          publisher: result.metadata.publisher,
          developer: result.metadata.developer,
          genre: result.metadata.genre,
          description: result.metadata.description,
          releaseDate: result.metadata.releaseDate,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert(t('common.success'), t('import.autoDetectSuccess'));
      }
    } catch (e) {
      console.warn('Error refreshing metadata:', e);
      Alert.alert(t('common.error'), t('import.importFailed'));
    }
  };

  const handleGamepadDirection = (dir: 'left' | 'right' | 'up' | 'down') => {
    if (contextMenuGame || configModalGame) return;

    if (activeScreen === 'settings') {
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
      const currentIdx = SECTIONS.indexOf(settingsSection);
      if (dir === 'up' && currentIdx > 0) {
        openSettings(SECTIONS[currentIdx - 1]);
      } else if (dir === 'down' && currentIdx < SECTIONS.length - 1) {
        openSettings(SECTIONS[currentIdx + 1]);
      }
      return;
    }

    if (activeScreen === 'library') {
      if (games.length === 0) return;
      const currentIdx = games.findIndex((g) => g.id === selectedGameId);
      const colCount = isLandscape ? 5 : 2;

      if (dir === 'left' && currentIdx > 0) {
        setSelectedGame(games[currentIdx - 1].id);
      } else if (dir === 'right' && currentIdx < games.length - 1) {
        setSelectedGame(games[currentIdx + 1].id);
      } else if (dir === 'up' && currentIdx - colCount >= 0) {
        setSelectedGame(games[currentIdx - colCount].id);
      } else if (dir === 'down' && currentIdx + colCount < games.length) {
        setSelectedGame(games[currentIdx + colCount].id);
      }
      return;
    }

    if (activeScreen === 'home') {
      if (focusZone === 'carousel') {
        const currentIdx = games.findIndex((g) => g.id === selectedGameId);

        if (dir === 'left') {
          if (currentIdx > 0) {
            setSelectedGame(games[currentIdx - 1].id);
          } else if (currentIdx === -1 && games.length > 0) {
            setSelectedGame(games[0].id);
          }
        } else if (dir === 'right') {
          if (currentIdx < games.length - 1 && currentIdx >= 0) {
            setSelectedGame(games[currentIdx + 1].id);
          } else if (currentIdx === -1 && games.length > 0) {
            setSelectedGame(games[0].id);
          }
        } else if (dir === 'down') {
          setFocusZone('dock');
        }
      } else if (focusZone === 'dock') {
        if (dir === 'up') {
          setFocusZone('carousel');
        } else if (dir === 'left') {
          setFocusedDockIndex(Math.max(0, focusedDockIndex - 1));
        } else if (dir === 'right') {
          setFocusedDockIndex(Math.min(5, focusedDockIndex + 1));
        }
      }
    }
  };

  const handleGamepadSelect = () => {
    if (configModalGame) return;

    if (contextMenuGame) {
      handleGameLaunch(contextMenuGame);
      setContextMenuGame(null);
      return;
    }

    if (activeScreen === 'details') {
      if (selectedGame) {
        handleGameLaunch(selectedGame);
      }
      return;
    }

    if (activeScreen === 'settings') {
      if (settingsSection === 'support') {
        setIsOnboardingVisible(true);
      }
      return;
    }

    if (activeScreen === 'library') {
      if (selectedGame) {
        handleGameLaunch(selectedGame);
      }
      return;
    }

    if (activeScreen === 'home') {
      if (focusZone === 'carousel') {
        if (selectedGame) {
          handleGameLaunch(selectedGame);
        }
      } else if (focusZone === 'dock') {
        switch (focusedDockIndex) {
          case 0:
            setIsOnboardingVisible(true);
            break;
          case 1:
            setIsImportModalVisible(true);
            break;
          case 2:
            openLibrary();
            break;
          case 3:
            openSettings('controllers');
            break;
          case 4:
            openSettings('support');
            break;
          case 5:
            openFavorites();
            break;
        }
      }
    }
  };

  const handleGamepadBack = () => {
    if (configModalGame) {
      setConfigModalGame(null);
      return;
    }
    if (contextMenuGame) {
      setContextMenuGame(null);
      return;
    }
    if (isOnboardingVisible) {
      setIsOnboardingVisible(false);
      return;
    }
    if (isImportModalVisible) {
      setIsImportModalVisible(false);
      return;
    }
    if (activeScreen === 'settings' && isControllerTestActive) {
      // Gamepad button test / diagnostics is active! Do NOT navigate back on B tap!
      return;
    }
    if (activeScreen === 'details') {
      setActiveScreen('home');
      return;
    }
    if (activeScreen !== 'home') {
      setActiveScreen('home');
      return;
    }
    if (focusZone === 'dock') {
      setFocusZone('carousel');
    }
  };

  const handleGamepadOptions = () => {
    if (configModalGame) return;
    if (activeScreen === 'details' && selectedGame) {
      setConfigModalGame(selectedGame);
    } else if (activeScreen === 'home' && selectedGame) {
      setActiveScreen('details');
    } else if (activeScreen === 'library' && selectedGame) {
      setActiveScreen('details');
    }
  };

  const { isConnected } = useGamepad({
    onDirection: handleGamepadDirection,
    onSelect: handleGamepadSelect,
    onBack: handleGamepadBack,
    onOptions: handleGamepadOptions,
  });

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    const sub = addNetworkListener((status) => {
      if (status?.isConnected) {
        syncPendingGamesSilently().catch(() => {});
      }
    });
    return () => sub?.remove?.();
  }, [syncPendingGamesSilently]);

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background },
      ]}
    >
      <StatusBar hidden />

      {activeScreen !== 'settings' && activeScreen !== 'details' && (
        <SwitchTopBar
          isLandscape={isLandscape}
          isConnected={isConnected}
          onProfilePress={() => openSettings()}
        />
      )}

      <View style={styles.body}>
        {activeScreen === 'home' && (
          <View
            style={[
              styles.homeLayout,
              {
                paddingLeft: Math.max(insets.left, isLandscape ? 28 : 16),
                paddingRight: Math.max(insets.right, isLandscape ? 28 : 16),
                paddingTop: isLandscape ? 0 : 4,
                paddingBottom: isLandscape ? 0 : 8,
              },
            ]}
          >
            {games.length === 0 ? (
              <View style={styles.emptyHome}>
                <View style={[styles.emptyHomeIcon, { backgroundColor: colors.accentSurface }]}>
                  <Ionicons name="game-controller-outline" size={34} color={colors.accent} />
                </View>
                <Text style={[styles.emptyHomeTitle, { color: colors.text }]}>{t('home.noGamesTitle')}</Text>
                <Text style={[styles.emptyHomeSubtitle, { color: colors.textSecondary }]}>{t('home.noGamesSubtitle')}</Text>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.emptyHomeAction,
                    { backgroundColor: colors.accentStrong },
                    pressed && styles.emptyHomeActionPressed,
                  ]}
                  onPress={() => setIsImportModalVisible(true)}
                >
                  <Ionicons name="add" size={20} color={colors.surface} />
                  <Text style={[styles.emptyHomeActionText, { color: colors.surface }]}>{t('home.importFirstGame')}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.carouselContainer}>
                  <GameCarousel
                    onGameLaunch={handleGameLaunch}
                    onImportPress={() => setIsImportModalVisible(true)}
                    onLongPress={(game) => {
                      setSelectedGame(game.id);
                      setActiveScreen('details');
                    }}
                  />
                </View>

                {/* Circular Dock directly under the carousel */}
                <View style={styles.dockContainer}>
                  <SwitchBottomDock
                    onAddPress={() => setIsImportModalVisible(true)}
                    onControllersPress={() => openSettings('controllers')}
                    onSettingsPress={() => openSettings('support')}
                    onLibraryPress={openLibrary}
                    onNewsPress={() => setIsOnboardingVisible(true)}
                    onFavoritesPress={openFavorites}
                    activeScreen={activeScreen}
                    focusedDockIndex={focusedDockIndex}
                    isGamepadFocused={focusZone === 'dock'}
                  />
                </View>
              </>
            )}
          </View>
        )}

        {activeScreen === 'library' && (
          <GameLibraryGrid
            onGameSelect={handleGameLaunch}
            onLongPress={(game) => {
              setSelectedGame(game.id);
              setActiveScreen('details');
            }}
            onImportPress={() => setIsImportModalVisible(true)}
            onBackPress={() => setActiveScreen('home')}
          />
        )}

        {activeScreen === 'details' && selectedGame && (
          <GameDetailScreen
            game={selectedGame}
            onBack={() => setActiveScreen('home')}
            onLaunch={handleGameLaunch}
            onOpenConfig={(g) => setConfigModalGame(g)}
            onRefreshMetadata={handleRefreshMetadata}
          />
        )}

        {activeScreen === 'settings' && (
          <SettingsScreen
            onBackPress={() => setActiveScreen('home')}
            onShowOnboarding={() => setIsOnboardingVisible(true)}
            initialSection={settingsSection}
          />
        )}
      </View>

      {/* 3. Authentic Nintendo Switch Horizontal Hairline Divider */}
      <View style={[styles.bottomDivider, { backgroundColor: colors.border }]} />

      {/* 4. Bottom Prompt Bar: Left: Console Glyph | Right: (+) Opciones & (A) OK */}
      <SwitchPromptBar
        activeScreen={activeScreen}
        hasSelectedGame={Boolean(selectedGame)}
        onBackPress={() => setActiveScreen('home')}
        onOptionsPress={
          selectedGame
            ? () => {
                if (activeScreen === 'details') {
                  setConfigModalGame(selectedGame);
                } else {
                  setActiveScreen('details');
                }
              }
            : undefined
        }
        onStartPress={selectedGame ? () => handleGameLaunch(selectedGame) : undefined}
        onImportPress={() => setIsImportModalVisible(true)}
        bottomInset={insets.bottom}
      />

      {/* Fullscreen Onboarding Guide (First launch & Settings re-trigger) */}
      <OnboardingModal
        visible={isOnboardingVisible}
        onClose={handleCloseOnboarding}
      />

      {/* Options Context Menu (Pressing + or Long-Press) */}
      <GameContextMenu
        game={contextMenuGame}
        visible={contextMenuGame !== null}
        onClose={() => setContextMenuGame(null)}
        onPlay={handleGameLaunch}
        onOpenConfig={(g) => {
          setContextMenuGame(null);
          setConfigModalGame(g);
        }}
        onRefreshMetadata={handleRefreshMetadata}
        onDelete={(g) => removeGame(g.id)}
      />

      {/* Per-Game Emulation & Performance Settings Modal */}
      <GameConfigModal
        game={configModalGame}
        visible={configModalGame !== null}
        onClose={() => setConfigModalGame(null)}
        onPlay={handleGameLaunch}
      />

      {/* Add Game Modal with LiveContainer link support & guide */}
      <ImportGameModal
        visible={isImportModalVisible}
        onClose={() => setIsImportModalVisible(false)}
      />
    </View>
  );
}

export default function App() {
  const [isI18nReady, setIsI18nReady] = useState(false);

  useEffect(() => {
    initializeI18n().then(() => {
      setIsI18nReady(true);
    });
  }, []);

  if (!isI18nReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <SafeAreaProvider>
          <MainNavigator />
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#202020',
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    overflow: 'hidden',
  },
  homeLayout: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 0,
    overflow: 'hidden',
  },
  dockContainer: {
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomDivider: {
    height: 1,
    width: '100%',
  },
  emptyHome: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  emptyHomeIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#21343B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyHomeTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyHomeSubtitle: {
    color: '#B3B7BA',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 340,
  },
  emptyHomeAction: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#087F9C',
    paddingHorizontal: 20,
    borderRadius: 24,
    marginTop: 6,
  },
  emptyHomeActionPressed: {
    backgroundColor: '#066A83',
    transform: [{ scale: 0.98 }],
  },
  emptyHomeActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  carouselContainer: {
    width: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
