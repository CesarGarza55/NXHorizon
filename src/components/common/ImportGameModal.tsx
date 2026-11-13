import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { autoDetectAndScrapeGame, scrapeGameByTitleId, ScrapeResult } from '../../services/gameScraper';
import { searchCatalogCandidates, GameCatalogEntry } from '../../services/gameDatabase';
import { useGameStore } from '../../state/useGameStore';
import { ensureGameDirectBoot, isNxNativeBundle } from '../../../modules/nx-livecontainer';
import { useAppTheme } from '../../theme/ThemeProvider';
import { GameCartridgeCover } from './GameCartridgeCover';
import { GameMetadata } from '../../types/game';
import {
  FEATURED_IOS_APPS,
  IOSAppCatalogEntry,
  lookupIOSAppByBundleId,
  searchIOSApps,
  toIOSAppMetadata,
} from '../../services/iosAppCatalog';

interface ImportGameModalProps {
  visible: boolean;
  onClose: () => void;
}

type ImportMode = 'appStore' | 'liveContainer';

export const ImportGameModal: React.FC<ImportGameModalProps> = ({
  visible,
  onClose,
}) => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { addGame } = useGameStore();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isLandscape = width > height;

  const [inputUrl, setInputUrl] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('appStore');
  const [manualName, setManualName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState(false);
  const [stepMessage, setStepMessage] = useState('');
  const [previewResult, setPreviewResult] = useState<ScrapeResult | null>(null);

  // Candidates & Manual Override States
  const [candidates, setCandidates] = useState<GameCatalogEntry[]>([]);
  const [showCandidatePicker, setShowCandidatePicker] = useState(false);
  const [isManualOffline, setIsManualOffline] = useState(false);
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [appSearchResults, setAppSearchResults] = useState<IOSAppCatalogEntry[]>([]);
  const [isAppSearchLoading, setIsAppSearchLoading] = useState(false);
  const [appSearchError, setAppSearchError] = useState(false);
  const featuredAppMatches = FEATURED_IOS_APPS
    .filter((app) =>
      !appSearchQuery.trim() ||
      app.name.toLowerCase().includes(appSearchQuery.trim().toLowerCase())
    )
    .slice(0, 6);

  const searchAppCatalog = async (query = appSearchQuery) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    setAppSearchQuery(trimmedQuery);
    setAppSearchError(false);
    setIsAppSearchLoading(true);
    try {
      const results = await searchIOSApps(trimmedQuery);
      setAppSearchResults(results);
    } catch (error) {
      console.warn('[AddGameModal] App Store search failed:', error);
      setAppSearchResults([]);
      setAppSearchError(true);
    } finally {
      setIsAppSearchLoading(false);
    }
  };

  const handleSelectIOSApp = (app: IOSAppCatalogEntry, launchUrl?: string) => {
    const preparedApp = FEATURED_IOS_APPS.find(
      (featured) =>
        (featured.bundleId && featured.bundleId.toLowerCase() === app.bundleId?.toLowerCase()) ||
        featured.name.trim().toLowerCase() === app.name.trim().toLowerCase()
    );
    const metadata = toIOSAppMetadata(app, { launchUrl: launchUrl || preparedApp?.launchUrl });
    setPreviewResult({
      detectedCleanName: app.name,
      metadata,
      source: 'custom',
      needsManualName: false,
    });
    setAppSearchQuery('');
    setAppSearchResults([]);
    setAppSearchError(false);
    setShowNamePrompt(false);
    setShowCandidatePicker(false);
    setIsManualOffline(false);
    setImportMode('appStore');
  };

  const handleSelectFeaturedApp = async (name: string, bundleId?: string, launchUrl?: string) => {
    setImportMode('appStore');
    setAppSearchQuery(name);
    setAppSearchResults([]);
    setAppSearchError(false);
    setIsAppSearchLoading(true);
    try {
      if (bundleId) {
        const app = await lookupIOSAppByBundleId(bundleId);
        if (app) {
          handleSelectIOSApp(app, launchUrl);
          return;
        }
      }
      const results = await searchIOSApps(name);
      setAppSearchResults(results);
    } catch (error) {
      console.warn('[AddGameModal] Featured App Store lookup failed:', error);
      setAppSearchError(true);
    } finally {
      setIsAppSearchLoading(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const text = await Clipboard.getStringAsync();
      if (text) {
        setInputUrl(text);
        processUrl(text);
      }
    } catch (e) {
      console.warn('Clipboard read error:', e);
    }
  };

  const processUrl = async (url: string, nameOverride?: string) => {
    if (!url.trim()) return;
    setImportMode('liveContainer');
    setIsProcessing(true);
    setProcessingError(false);
    setPreviewResult(null);
    setShowCandidatePicker(false);

    setStepMessage(t('import.searchingMetadata'));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      setTimeout(() => {
        setStepMessage(t('import.fetchingArt'));
      }, 250);

      const scrapeResult = await autoDetectAndScrapeGame(url, nameOverride);

      if (scrapeResult.metadata.bundleName && !scrapeResult.metadata.titleId) {
        try {
          const app = await lookupIOSAppByBundleId(scrapeResult.metadata.bundleName);
          if (app) {
            const appMetadata = toIOSAppMetadata(app, {
              launchUrl: scrapeResult.metadata.launchUrl,
              containerFolder: scrapeResult.metadata.containerFolder,
            });
            scrapeResult.metadata = {
              ...appMetadata,
              id: scrapeResult.metadata.id,
              titleId: scrapeResult.metadata.titleId,
              launchConfig: scrapeResult.metadata.launchConfig,
            };
            scrapeResult.detectedCleanName = appMetadata.title;
            scrapeResult.needsManualName = false;
            scrapeResult.isOfflineFallback = false;
          }
        } catch (error) {
          console.warn('[AddGameModal] Could not enrich LiveContainer app metadata:', error);
        }
      }

      if (scrapeResult.candidates && scrapeResult.candidates.length > 0) {
        setCandidates(scrapeResult.candidates);
      } else {
        setCandidates([]);
      }

      if (scrapeResult.needsManualName && !nameOverride) {
        // Game Title ID not found in database, prompt user for name
        setShowNamePrompt(true);
        if (scrapeResult.candidates && scrapeResult.candidates.length > 0) {
          setShowCandidatePicker(true);
        }
        setIsProcessing(false);
        return;
      }

      setStepMessage(t('import.cachingLocally'));
      setPreviewResult(scrapeResult);
      setShowNamePrompt(false);
      setIsManualOffline(Boolean(scrapeResult.isOfflineFallback || scrapeResult.metadata.needsMetadataSync));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      console.error('[AddGameModal] Error:', err);
      setStepMessage(t('import.importFailed'));
      setProcessingError(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // User taps an official candidate
  const handleSelectCandidate = async (candidate: GameCatalogEntry) => {
    try {
      setIsProcessing(true);
      setProcessingError(false);
      setStepMessage(t('import.fetchingArt'));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      const meta = await scrapeGameByTitleId(candidate.titleId, {
        launchUrl: previewResult?.metadata?.launchUrl || inputUrl,
        bundleName: previewResult?.metadata?.bundleName,
        containerFolder: previewResult?.metadata?.containerFolder,
      });

      setPreviewResult({
        detectedTitleId: candidate.titleId,
        detectedCleanName: candidate.title,
        metadata: meta,
        source: 'nintendo_api',
        needsManualName: false,
        candidates,
      });
      setShowCandidatePicker(false);
      setShowNamePrompt(false);
      setIsManualOffline(Boolean(meta.needsMetadataSync));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      console.warn('[AddGameModal] Candidate selection error:', err);
      setProcessingError(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // User decides none of the candidates match, saving with custom title
  const handleApplyManualName = (customTitle: string) => {
    const clean = customTitle.trim();
    if (!clean) return;

    const customMeta: GameMetadata = {
      id: `custom_${Date.now()}`,
      title: clean,
      normalizedTitle: clean.toLowerCase(),
      publisher: 'LiveContainer App',
      developer: 'Independent Developer',
      releaseDate: new Date().toISOString().split('T')[0],
      genre: 'Application',
      description: `Application launched via LiveContainer: ${clean}`,
      coverUrl: '',
      heroUrl: '',
      screenshots: [],
      lastPlayed: null,
      playTimeMinutes: 0,
      isFavorite: false,
      rating: 8.0,
      launchUrl: previewResult?.metadata?.launchUrl || inputUrl,
      bundleName: previewResult?.metadata?.bundleName,
      containerFolder: previewResult?.metadata?.containerFolder,
      tags: ['LiveContainer'],
      needsMetadataSync: true,
    };

    setPreviewResult({
      detectedTitleId: undefined,
      detectedCleanName: clean,
      metadata: customMeta,
      source: 'custom',
      needsManualName: false,
      isOfflineFallback: true,
    });
    setShowCandidatePicker(false);
    setShowNamePrompt(false);
    setIsManualOffline(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const handleManualNameChange = (text: string) => {
    setManualName(text);
    if (text.trim().length >= 2) {
      const liveMatches = searchCatalogCandidates(text);
      setCandidates(liveMatches);
    }
  };

  const handleConfirmAdd = async () => {
    if (!previewResult) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    if (previewResult.metadata.containerFolder && isNxNativeBundle(previewResult.metadata.bundleName)) {
      ensureGameDirectBoot(
        previewResult.metadata.containerFolder,
        undefined,
        previewResult.metadata.bundleName
      ).catch((error) => {
        console.warn('[ImportGameModal] Could not configure NX Native game:', error);
      });
    }
    await addGame(previewResult.metadata);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setInputUrl('');
    setImportMode('appStore');
    setManualName('');
    setShowNamePrompt(false);
    setShowGuide(false);
    setIsProcessing(false);
    setProcessingError(false);
    setStepMessage('');
    setPreviewResult(null);
    setCandidates([]);
    setShowCandidatePicker(false);
    setIsManualOffline(false);
    setAppSearchQuery('');
    setAppSearchResults([]);
    setIsAppSearchLoading(false);
    setAppSearchError(false);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
      onRequestClose={() => {
        handleReset();
        onClose();
      }}
    >
      <StatusBar hidden />
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
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            handleReset();
            onClose();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}
        >
          <View
            style={[
              styles.container,
              isLandscape ? styles.containerLandscape : styles.containerPortrait,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                maxHeight: Math.max(320, height - (insets.top + insets.bottom + (isLandscape ? 20 : 40))),
              },
            ]}
          >
            <ScrollView
              style={styles.contentScroll}
              contentContainerStyle={styles.contentScrollInner}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <View style={styles.headerTitleRow}>
                  <View style={[styles.headerIcon, { backgroundColor: colors.accentSurface }]}>
                    <Ionicons name="add" size={20} color={colors.accent} />
                  </View>
                  <Text style={[styles.title, { color: colors.text }]}>{t('import.title')}</Text>
                </View>
                <Pressable
                  onPress={() => {
                    handleReset();
                    onClose();
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </Pressable>
              </View>

              <View
                style={[
                  styles.modePicker,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                ]}
                accessibilityRole="tablist"
              >
                {([
                  ['appStore', 'apps-outline', 'import.sourceAppStore'],
                  ['liveContainer', 'link-outline', 'import.sourceLiveContainer'],
                ] as const).map(([mode, icon, label]) => {
                  const selected = importMode === mode;
                  return (
                    <Pressable
                      key={mode}
                      style={[
                        styles.modeOption,
                        selected && { backgroundColor: colors.surface },
                      ]}
                      onPress={() => setImportMode(mode)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected }}
                    >
                      <Ionicons
                        name={icon}
                        size={17}
                        color={selected ? colors.accent : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.modeOptionText,
                          { color: selected ? colors.text : colors.textSecondary },
                          selected && styles.modeOptionTextSelected,
                        ]}
                      >
                        {t(label)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.contentStack}>
                {importMode === 'appStore' && !previewResult && (
                  <View>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>
                      {t('import.appCatalogTitle')}
                    </Text>
                    <Text style={[styles.guideStepText, { color: colors.textSecondary, marginBottom: 12 }]}>
                      {t('import.appCatalogDescription')}
                    </Text>

                    <View style={styles.inputRow}>
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            backgroundColor: colors.surfaceSecondary,
                            color: colors.text,
                            borderColor: colors.border,
                          },
                        ]}
                        placeholder={t('import.appCatalogPlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        value={appSearchQuery}
                        onChangeText={(value) => {
                          setAppSearchQuery(value);
                          setAppSearchResults([]);
                          setAppSearchError(false);
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                        onSubmitEditing={() => searchAppCatalog()}
                        accessibilityLabel={t('import.searchAppStore')}
                      />
                      <Pressable
                        style={({ pressed }) => [
                          styles.searchButton,
                          { backgroundColor: colors.accent },
                          pressed && styles.searchButtonPressed,
                          (!appSearchQuery.trim() || isAppSearchLoading) && styles.searchButtonDisabled,
                        ]}
                        onPress={() => searchAppCatalog()}
                        disabled={!appSearchQuery.trim() || isAppSearchLoading}
                        accessibilityRole="button"
                        accessibilityLabel={t('import.searchAppStore')}
                      >
                        {isAppSearchLoading ? (
                          <ActivityIndicator size="small" color={colors.surface} />
                        ) : (
                          <Ionicons name="search" size={20} color={colors.surface} />
                        )}
                      </Pressable>
                    </View>

                    {appSearchError && (
                      <View style={[styles.inlineNotice, { borderColor: colors.destructive }]}>
                        <Ionicons name="alert-circle-outline" size={18} color={colors.destructive} />
                        <Text
                          style={[
                            styles.guideStepText,
                            styles.inlineNoticeText,
                            { color: colors.destructive },
                          ]}
                        >
                          {t('import.appCatalogError')}
                        </Text>
                      </View>
                    )}

                    {featuredAppMatches.length > 0 && appSearchResults.length === 0 && (
                      <View style={styles.resultsSection}>
                        <Text style={[styles.sectionHeading, { color: colors.text }]}>
                          {t('import.preparedSuggestions')}
                        </Text>
                        {featuredAppMatches.map((app) => (
                          <Pressable
                            key={`${app.name}-${app.bundleId || ''}`}
                            style={({ pressed }) => [
                              styles.candidateItem,
                              {
                                backgroundColor: colors.surfaceSecondary,
                                borderColor: colors.border,
                              },
                              pressed && { borderColor: colors.accent },
                            ]}
                            onPress={() => handleSelectFeaturedApp(app.name, app.bundleId, app.launchUrl)}
                            accessibilityRole="button"
                            accessibilityLabel={t('import.searchFeaturedApp', { name: app.name })}
                          >
                            <View
                              style={[
                                styles.candidateIconBadge,
                                { backgroundColor: colors.accentSurface },
                              ]}
                            >
                              <Ionicons name="apps-outline" size={19} color={colors.accent} />
                            </View>
                            <View style={styles.candidateDetails}>
                              <Text
                                style={[styles.candidateTitle, { color: colors.text }]}
                                numberOfLines={1}
                              >
                                {app.name}
                              </Text>
                              <Text style={[styles.candidateSub, { color: colors.textSecondary }]}>
                                {t('import.preparedApp')}
                              </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                          </Pressable>
                        ))}
                      </View>
                    )}

                    {appSearchResults.length > 0 && (
                      <View style={styles.resultsSection}>
                        <Text style={[styles.sectionHeading, { color: colors.text }]}>
                          {t('import.appStoreResults')}
                        </Text>
                        {appSearchResults.slice(0, 8).map((app) => (
                          <Pressable
                            key={app.trackId}
                            style={({ pressed }) => [
                              styles.candidateItem,
                              {
                                backgroundColor: colors.surfaceSecondary,
                                borderColor: colors.border,
                              },
                              pressed && { borderColor: colors.accent },
                            ]}
                            onPress={() => handleSelectIOSApp(app)}
                            accessibilityRole="button"
                            accessibilityLabel={t('import.selectApp', { name: app.name })}
                          >
                            {app.artworkUrl ? (
                              <Image
                                source={{ uri: app.artworkUrl }}
                                style={styles.candidateIconBadge}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                              />
                            ) : (
                              <View
                                style={[
                                  styles.candidateIconBadge,
                                  { backgroundColor: colors.accentSurface },
                                ]}
                              >
                                <Ionicons name="apps-outline" size={19} color={colors.accent} />
                              </View>
                            )}
                            <View style={styles.candidateDetails}>
                              <Text
                                style={[styles.candidateTitle, { color: colors.text }]}
                                numberOfLines={1}
                              >
                                {app.name}
                              </Text>
                              <Text
                                style={[styles.candidateSub, { color: colors.textSecondary }]}
                                numberOfLines={1}
                              >
                                {app.publisher}
                              </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                          </Pressable>
                        ))}
                      </View>
                    )}

                    {!isAppSearchLoading &&
                      !appSearchError &&
                      appSearchQuery.trim().length > 0 &&
                      featuredAppMatches.length === 0 &&
                      appSearchResults.length === 0 && (
                        <Text style={[styles.emptyResults, { color: colors.textSecondary }]}>
                          {t('import.noAppResults')}
                        </Text>
                      )}
                  </View>
                )}

                <View>
                  {importMode === 'liveContainer' && (!previewResult || showCandidatePicker) && (
                    <>
                  <Text style={[styles.modeDescription, { color: colors.textSecondary }]}>
                    {t('import.liveContainerDescription')}
                  </Text>
                  {/* Paste from Clipboard Button */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.pasteButton,
                      { backgroundColor: colors.surfaceSecondary, borderColor: colors.accent },
                      pressed && styles.pasteButtonPressed,
                    ]}
                    onPress={handlePasteClipboard}
                  >
                    <Ionicons name="clipboard" size={20} color={colors.accent} />
                    <Text style={[styles.pasteButtonText, { color: colors.accentStrong }]}>{t('import.pasteFromClipboard')}</Text>
                  </Pressable>

                  {/* Input URL */}
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('import.orManual')}</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.textInput, { backgroundColor: colors.surfaceSecondary, color: colors.text, borderColor: colors.border }]}
                      placeholder={t('import.inputPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      value={inputUrl}
                      onChangeText={(value) => {
                        setInputUrl(value);
                        setProcessingError(false);
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="go"
                      onSubmitEditing={() => processUrl(inputUrl)}
                    />
                    <Pressable
                      style={({ pressed }) => [
                        styles.searchButton,
                        { backgroundColor: colors.accent },
                        pressed && styles.searchButtonPressed,
                        !inputUrl.trim() && styles.searchButtonDisabled,
                      ]}
                      onPress={() => processUrl(inputUrl)}
                      disabled={!inputUrl.trim() || isProcessing}
                    >
                      <Ionicons name="arrow-forward" size={20} color={colors.surface} />
                    </Pressable>
                  </View>
                  <Pressable
                    style={[
                      styles.guideToggle,
                      { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                    ]}
                    onPress={() => setShowGuide(!showGuide)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showGuide }}
                  >
                    <Ionicons name="help-circle-outline" size={18} color={colors.accent} />
                    <Text style={[styles.guideToggleText, { color: colors.accentStrong }]}>
                      {t('import.guideTitle')}
                    </Text>
                    <Ionicons
                      name={showGuide ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.textMuted}
                    />
                  </Pressable>
                  {showGuide && (
                    <View
                      style={[
                        styles.guideBox,
                        { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                      ]}
                    >
                      <View
                        style={[
                          styles.requirementCard,
                          { backgroundColor: colors.accentSurface, borderColor: colors.border },
                        ]}
                      >
                        <Ionicons name="information-circle" size={17} color={colors.accent} />
                        <Text style={[styles.requirementText, { color: colors.text }]}>
                          {t('import.nx2appleRequirementText')}
                        </Text>
                      </View>
                      <Text style={[styles.guideStepText, { color: colors.textSecondary }]}>
                        {t('import.guideStep1')}
                      </Text>
                      <Text style={[styles.guideStepText, { color: colors.textSecondary }]}>
                        {t('import.guideStep2')}
                      </Text>
                      <Text style={[styles.guideStepText, { color: colors.textSecondary }]}>
                        {t('import.guideStep3')}
                      </Text>
                      <Text style={[styles.guideStepText, { color: colors.textSecondary }]}>
                        {t('import.guideStep4')}
                      </Text>
                      <Text style={[styles.guideStepText, { color: colors.textSecondary }]}>
                        {t('import.guideStep5')}
                      </Text>
                    </View>
                  )}

                  {/* Name Prompt Box (When Title ID is not recognized or when user wants to change) */}
                  {(showNamePrompt || showCandidatePicker) && (
                    <View style={[styles.namePromptBox, { backgroundColor: colors.accentSurface, borderColor: colors.accent }]}>
                      <View style={styles.namePromptHeader}>
                        <Ionicons name="search-circle" size={20} color={colors.accent} />
                        <Text style={[styles.namePromptTitle, { color: colors.accentStrong }]}>
                          {t('import.candidatesTitle')}
                        </Text>
                      </View>
                      <Text style={[styles.namePromptSubtitle, { color: colors.textSecondary }]}>
                        {t('import.candidatesSubtitle')}
                      </Text>

                      <View style={styles.inputRow}>
                        <TextInput
                          style={[styles.textInput, { backgroundColor: colors.surfaceSecondary, color: colors.text, borderColor: colors.border }]}
                          placeholder={t('import.namePlaceholder')}
                          placeholderTextColor={colors.textMuted}
                          value={manualName}
                          onChangeText={handleManualNameChange}
                          autoCapitalize="words"
                          returnKeyType="search"
                          onSubmitEditing={() => {
                            if (candidates.length > 0) {
                              handleSelectCandidate(candidates[0]);
                            } else {
                              handleApplyManualName(manualName);
                            }
                          }}
                        />
                        <Pressable
                          style={[styles.searchButton, { backgroundColor: colors.accent }]}
                          onPress={() => {
                            if (manualName.trim()) {
                              processUrl(inputUrl, manualName);
                            }
                          }}
                          disabled={!manualName.trim() || isProcessing}
                        >
                          <Ionicons name="search" size={20} color={colors.surface} />
                        </Pressable>
                      </View>

                      {/* Matching Candidate Cards List */}
                      {candidates.length > 0 && (
                        <View style={styles.candidatesListWrap}>
                          {candidates.slice(0, 4).map((cand) => (
                            <Pressable
                              key={cand.titleId}
                              style={({ pressed }) => [
                                styles.candidateItem,
                                { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                                pressed && { borderColor: colors.accent },
                              ]}
                              onPress={() => handleSelectCandidate(cand)}
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
                        </View>
                      )}

                      {/* Button to force manual name */}
                      {manualName.trim().length > 0 && (
                        <Pressable
                          style={({ pressed }) => [
                            styles.manualFallbackBtn,
                            { backgroundColor: colors.surface, borderColor: colors.border },
                            pressed && { borderColor: colors.accent },
                          ]}
                          onPress={() => handleApplyManualName(manualName)}
                        >
                          <Ionicons name="pencil" size={14} color={colors.textSecondary} />
                          <Text style={[styles.manualFallbackBtnText, { color: colors.text }]}>
                            {t('import.useManualNameBtn')}: "{manualName.trim()}"
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}

                  {/* Loading Indicator */}
                  {isProcessing && (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={colors.accent} />
                      <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{stepMessage}</Text>
                    </View>
                  )}
                  {processingError && (
                    <View style={[styles.inlineNotice, { borderColor: colors.destructive }]}>
                      <Ionicons name="alert-circle-outline" size={18} color={colors.destructive} />
                      <Text
                        style={[
                          styles.guideStepText,
                          styles.inlineNoticeText,
                          { color: colors.destructive },
                        ]}
                      >
                        {t('import.linkProcessError')}
                      </Text>
                      <Pressable
                        style={styles.retryButton}
                        onPress={() => processUrl(inputUrl)}
                        disabled={!inputUrl.trim() || isProcessing}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.retryText, { color: colors.accent }]}>
                          {t('import.tryAgain')}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                    </>
                  )}

                  {/* Preview Card */}
                  {previewResult && previewResult.metadata.title && !showCandidatePicker ? (
                    <View style={[styles.previewSection]}>
                      <View style={[styles.previewCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                        <GameCartridgeCover
                          game={previewResult.metadata}
                          style={styles.previewCover}
                          contentFit="cover"
                          showSyncBadge={false}
                          iconSize={24}
                        />
                        <View style={styles.previewInfo}>
                          <View style={styles.detectedBadge}>
                            <Ionicons
                              name={isManualOffline ? 'cloud-offline-outline' : 'checkmark-circle'}
                              size={14}
                              color={isManualOffline ? '#FFA500' : colors.success}
                            />
                            <Text
                              style={[
                                styles.detectedBadgeText,
                                { color: isManualOffline ? '#FFA500' : colors.success },
                              ]}
                            >
                              {isManualOffline ? t('details.pendingSyncTitle') : t('import.autoDetectSuccess')}
                            </Text>
                          </View>
                          <Text style={[styles.previewTitle, { color: colors.text }]} numberOfLines={2}>
                            {previewResult.metadata.title}
                          </Text>
                          <Text style={[styles.previewPublisher, { color: colors.textSecondary }]}>
                            {previewResult.metadata.publisher}
                          </Text>
                          {previewResult.detectedTitleId && (
                            <Text style={[styles.previewTitleId, { color: colors.textMuted }]}>
                              ID: {previewResult.detectedTitleId}
                            </Text>
                          )}
                        </View>
                      </View>

                      {/* Change / Re-select candidate button */}
                      {!previewResult.metadata.appStoreId && (
                      <Pressable
                        style={({ pressed }) => [
                          styles.changeCandidateBtn,
                          { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                          pressed && { borderColor: colors.accent },
                        ]}
                        onPress={() => {
                          const list = searchCatalogCandidates(previewResult.detectedCleanName || manualName || inputUrl);
                          setCandidates(list);
                          setShowCandidatePicker(true);
                        }}
                      >
                        <Ionicons name="swap-horizontal" size={16} color={colors.accent} />
                        <Text style={[styles.changeCandidateBtnText, { color: colors.accent }]}>
                          {t('import.changeTitle')}
                        </Text>
                      </Pressable>
                      )}

                      {/* Offline notice when metadata is pending */}
                      {isManualOffline && (
                        <View style={[styles.offlineNoticeBox, { backgroundColor: colors.surfaceSecondary, borderColor: '#FFA500' }]}>
                          <Ionicons name="information-circle-outline" size={16} color="#FFA500" style={{ marginTop: 1 }} />
                          <Text style={[styles.offlineNoticeText, { color: colors.textSecondary }]}>
                            {t('import.offlineNotice')}
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : null}

                  {/* Footer Buttons */}
                  {previewResult?.metadata.title && !showCandidatePicker && (
                    <View style={[styles.footerRow, { borderTopColor: colors.border }]}>
                      <Pressable
                        style={[styles.cancelButton, { backgroundColor: colors.surfaceSecondary }]}
                        onPress={() => {
                          handleReset();
                          onClose();
                        }}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                          {t('common.cancel')}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.confirmButton, { backgroundColor: colors.accent }]}
                        onPress={handleConfirmAdd}
                        accessibilityRole="button"
                      >
                        <Ionicons name="add" size={20} color={colors.surface} style={{ marginRight: 4 }} />
                        <Text style={[styles.confirmButtonText, { color: colors.surface }]}>
                          {t('import.addToLibrary')}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  container: {
    width: '100%',
    backgroundColor: '#202326',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#41474C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  containerPortrait: {
    maxWidth: 560,
  },
  containerLandscape: {
    maxWidth: 1120,
    padding: 24,
  },
  contentStack: {
    gap: 14,
  },
  contentScroll: {
    flexShrink: 1,
  },
  contentScrollInner: {
    flexGrow: 1,
    paddingBottom: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#383838',
    paddingBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modePicker: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 13,
    borderWidth: 1,
    gap: 4,
    marginBottom: 16,
  },
  modeOption: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  modeOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modeOptionTextSelected: {
    fontWeight: '700',
  },
  resultsSection: {
    gap: 8,
    marginTop: 20,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  emptyResults: {
    paddingVertical: 20,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  inlineNotice: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  inlineNoticeText: {
    flex: 1,
  },
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  retryText: {
    fontWeight: '700',
  },
  modeDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  guideToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#242424',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#383838',
  },
  guideToggleText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#00D2FF',
  },
  guideBox: {
    backgroundColor: '#242424',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#383838',
  },
  guideStepText: {
    fontSize: 12,
    color: '#CCCCCC',
    lineHeight: 18,
  },
  requirementCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#1E323E',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#00D2FF',
    marginBottom: 6,
  },
  requirementText: {
    flex: 1,
    fontSize: 11,
    color: '#E0F7FF',
    lineHeight: 16,
    fontWeight: '500',
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#242424',
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#00D2FF',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 14,
  },
  pasteButtonPressed: {
    backgroundColor: '#383838',
  },
  pasteButtonText: {
    color: '#00D2FF',
    fontSize: 14,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 13,
    color: '#A0A0A0',
    fontWeight: '600',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#242424',
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#FFFFFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#383838',
  },
  searchButton: {
    backgroundColor: '#00D2FF',
    width: 48,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonPressed: {
    backgroundColor: '#00A8CC',
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  namePromptBox: {
    backgroundColor: 'rgba(0, 210, 255, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 210, 255, 0.3)',
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  namePromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  namePromptTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00D2FF',
  },
  namePromptSubtitle: {
    fontSize: 11.5,
    color: '#CCCCCC',
    lineHeight: 16,
  },
  candidatesListWrap: {
    gap: 6,
    marginTop: 4,
  },
  candidateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  candidateIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateDetails: {
    flex: 1,
  },
  candidateTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  candidateSub: {
    fontSize: 12,
  },
  manualFallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 2,
  },
  manualFallbackBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    justifyContent: 'center',
  },
  loadingText: {
    color: '#A0A0A0',
    fontSize: 13,
  },
  previewSection: {
    marginTop: 14,
    gap: 8,
  },
  previewCard: {
    flexDirection: 'row',
    backgroundColor: '#242424',
    borderRadius: 14,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#383838',
  },
  previewCover: {
    width: 84,
    height: 84,
    borderRadius: 10,
  },
  previewInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  detectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  detectedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  previewPublisher: {
    fontSize: 12,
    color: '#A0A0A0',
    marginBottom: 4,
  },
  previewTitleId: {
    fontSize: 11,
    fontFamily: 'Courier',
    color: '#777777',
  },
  changeCandidateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  changeCandidateBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  offlineNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  offlineNoticeText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#41474C',
  },
  cancelButton: {
    minHeight: 48,
    minWidth: 104,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#383838',
  },
  cancelButtonText: {
    color: '#CCCCCC',
    fontWeight: '700',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    backgroundColor: '#00D2FF',
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  confirmButtonText: {
    color: '#1E1E1E',
    fontWeight: '800',
  },
});
