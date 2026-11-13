import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import i18n from '../i18n';
import { GameMetadata } from '../types/game';
import { SWITCH_TITLES_INDEX, findSwitchTitleInCatalog, searchCatalogCandidates, GameCatalogEntry } from './gameDatabase';
import { parseLiveContainerUrl, LiveContainerParsedData } from './liveContainerParser';

export interface ScrapeResult {
  detectedTitleId?: string;
  detectedCleanName: string;
  metadata: GameMetadata;
  source: 'nintendo_api' | 'catalog' | 'custom';
  needsManualName: boolean;
  candidates?: GameCatalogEntry[];
  isOfflineFallback?: boolean;
}

const NLIB_BASE = 'https://api.nlib.cc/nx';

/**
 * Resolves the query language for nlib API ('es' or 'en')
 */
export function getScraperLanguage(preferredLang?: string): string {
  if (preferredLang) {
    return preferredLang.toLowerCase().startsWith('es') ? 'es' : 'en';
  }
  const current = (i18n && i18n.language) ? i18n.language.toLowerCase() : '';
  return current.startsWith('es') ? 'es' : 'en';
}

interface NlibMultiLangResult {
  data: any;
  localizedDescriptions: Record<string, string>;
  localizedGenres: Record<string, string>;
  activeLang: string;
}

/**
 * Downloads metadata from nlib API for BOTH Spanish and English concurrently
 */
async function fetchNlibMetadataMultiLang(
  titleId: string,
  preferredLang?: string
): Promise<NlibMultiLangResult | null> {
  const activeLang = getScraperLanguage(preferredLang);
  const otherLang = activeLang === 'es' ? 'en' : 'es';

  try {
    const [resActive, resOther] = await Promise.allSettled([
      fetch(`${NLIB_BASE}/${titleId}?lang=${activeLang}`, { headers: { 'Accept': 'application/json' } }),
      fetch(`${NLIB_BASE}/${titleId}?lang=${otherLang}`, { headers: { 'Accept': 'application/json' } }),
    ]);

    let dataActive: any = null;
    let dataOther: any = null;

    if (resActive.status === 'fulfilled' && resActive.value.ok) {
      try {
        dataActive = await resActive.value.json();
      } catch (_) {}
    }
    if (resOther.status === 'fulfilled' && resOther.value.ok) {
      try {
        dataOther = await resOther.value.json();
      } catch (_) {}
    }

    const primaryData = dataActive || dataOther;
    if (!primaryData) return null;

    const localizedDescriptions: Record<string, string> = {};
    const localizedGenres: Record<string, string> = {};

    if (dataActive) {
      const desc = dataActive.description || dataActive.intro;
      if (desc) localizedDescriptions[activeLang] = String(desc).trim();
      if (Array.isArray(dataActive.category) && dataActive.category.length > 0) {
        localizedGenres[activeLang] = dataActive.category.join(' / ');
      }
    }

    if (dataOther) {
      const desc = dataOther.description || dataOther.intro;
      if (desc) localizedDescriptions[otherLang] = String(desc).trim();
      if (Array.isArray(dataOther.category) && dataOther.category.length > 0) {
        localizedGenres[otherLang] = dataOther.category.join(' / ');
      }
    }

    return {
      data: primaryData,
      localizedDescriptions,
      localizedGenres,
      activeLang,
    };
  } catch (err) {
    console.warn('[GameScraper] Multi-lang fetch error:', err);
    return null;
  }
}

/**
 * Automatically detects and scrapes official artwork and metadata
 * from Nintendo CDN/nlib API or catalog.
 */
export async function autoDetectAndScrapeGame(
  input: string,
  manualNameOverride?: string,
  langOverride?: string
): Promise<ScrapeResult> {
  const parsedLiveContainer: LiveContainerParsedData = parseLiveContainerUrl(input);

  let titleId = manualNameOverride?.trim() ? undefined : parsedLiveContainer.titleId;
  const launchUrl = parsedLiveContainer.launchUrl;
  const bundleName = parsedLiveContainer.bundleName;
  const containerFolder = parsedLiveContainer.containerFolderName;

  // 1. If manual name was provided, find candidates in catalog
  const searchName =
    manualNameOverride?.trim() ||
    (!input.startsWith('livecontainer://') && !titleId ? input.trim() : '') ||
    parsedLiveContainer.suggestedName ||
    '';
  const candidates: GameCatalogEntry[] = searchName
    ? searchCatalogCandidates(searchName)
    : (titleId ? searchCatalogCandidates(titleId) : []);

  if (!titleId && candidates.length > 1) {
    return {
      detectedCleanName: searchName,
      metadata: {
        id: `pending_${Date.now()}`,
        title: '',
        normalizedTitle: '',
        publisher: '',
        genre: '',
        description: '',
        coverUrl: '',
        heroUrl: '',
        screenshots: [],
        lastPlayed: null,
        playTimeMinutes: 0,
        isFavorite: false,
        launchUrl,
        bundleName,
        containerFolder,
        needsMetadataSync: true,
      },
      source: 'custom',
      needsManualName: true,
      candidates,
    };
  }

  if (!titleId && candidates.length === 1) {
    titleId = candidates[0].titleId;
  }

  // 2. If we have a Title ID, query the official Nintendo Switch REST API
  if (titleId) {
    try {
      const multiRes = await fetchNlibMetadataMultiLang(titleId, langOverride);

      if (multiRes) {
        const { data, localizedDescriptions, localizedGenres, activeLang } = multiRes;
        const cleanTitle = (data.name || searchName || 'Nintendo Switch Game').replace(/[™®]/g, '').trim();
        const coverUrl = `${NLIB_BASE}/${titleId}/icon`;
        const heroUrl = `${NLIB_BASE}/${titleId}/banner`;
        
        let screenshots: string[] = [];
        if (Array.isArray(data.screens?.screenshots) && data.screens.screenshots.length > 0) {
          screenshots = data.screens.screenshots
            .filter((s: any) => typeof s === 'string' && !s.endsWith('/screen/0'))
            .map((s: string) => s.replace(/^http:\/\//, 'https://'));
        } else {
          // Screenshots on nlib are 1-indexed (screen/1, screen/2, ...)
          screenshots = [
            `${NLIB_BASE}/${titleId}/screen/1`,
            `${NLIB_BASE}/${titleId}/screen/2`,
            `${NLIB_BASE}/${titleId}/screen/3`,
            `${NLIB_BASE}/${titleId}/screen/4`,
          ];
        }

        const activeGenre = localizedGenres[activeLang] || (Array.isArray(data.category) ? data.category.join(' / ') : 'Action / Adventure');
        const activeDesc = localizedDescriptions[activeLang] || data.description || data.intro || `Nintendo Switch title: ${cleanTitle}`;

        const meta: GameMetadata = {
          id: `game_${titleId}_${Date.now()}`,
          titleId,
          title: cleanTitle,
          normalizedTitle: cleanTitle.toLowerCase(),
          publisher: data.publisher || 'Nintendo',
          developer: data.developer || data.publisher || 'Nintendo',
          releaseDate: data.releaseDate || new Date().toISOString().split('T')[0],
          genre: activeGenre,
          description: activeDesc,
          localizedDescriptions,
          localizedGenres,
          coverUrl,
          heroUrl,
          screenshots,
          lastPlayed: null,
          playTimeMinutes: 0,
          isFavorite: false,
          launchUrl,
          bundleName,
          containerFolder,
          rating: 9.0,
          tags: Array.isArray(data.category) ? data.category : ['Nintendo Switch'],
          needsMetadataSync: false,
        };

        await preloadAndCacheImages(coverUrl, heroUrl, screenshots);

        return {
          detectedTitleId: titleId,
          detectedCleanName: cleanTitle,
          metadata: meta,
          source: 'nintendo_api',
          needsManualName: false,
          candidates,
          isOfflineFallback: false,
        };
      }
    } catch (apiErr) {
      console.warn('[GameScraper] nlib API fetch error, checking offline catalog:', apiErr);
    }

    // If API was unreachable, check offline catalog for this Title ID
    const offlineMatch = SWITCH_TITLES_INDEX.find(
      (entry) => entry.titleId.toLowerCase() === titleId?.toLowerCase()
    );

    if (offlineMatch) {
      const coverUrl = `${NLIB_BASE}/${titleId}/icon`;
      const heroUrl = `${NLIB_BASE}/${titleId}/banner`;
      const screenshots = [
        `${NLIB_BASE}/${titleId}/screen/1`,
        `${NLIB_BASE}/${titleId}/screen/2`,
        `${NLIB_BASE}/${titleId}/screen/3`,
        `${NLIB_BASE}/${titleId}/screen/4`,
      ];
      const meta: GameMetadata = {
        id: `game_${titleId}_${Date.now()}`,
        titleId,
        title: offlineMatch.title,
        normalizedTitle: offlineMatch.normalizedTitle,
        publisher: offlineMatch.publisher,
        developer: offlineMatch.developer,
        releaseDate: offlineMatch.releaseDate,
        genre: offlineMatch.genre,
        description: offlineMatch.description,
        coverUrl,
        heroUrl,
        screenshots,
        lastPlayed: null,
        playTimeMinutes: 0,
        isFavorite: false,
        launchUrl,
        bundleName,
        containerFolder,
        rating: 9.2,
        needsMetadataSync: true,
      };

      await preloadAndCacheImages(coverUrl, heroUrl, screenshots);

      return {
        detectedTitleId: titleId,
        detectedCleanName: offlineMatch.title,
        metadata: meta,
        source: 'catalog',
        needsManualName: false,
        candidates,
        isOfflineFallback: true,
      };
    }
  }

  // 3. If a name was entered but title ID was not found in Nintendo database:
  if (searchName) {
    const fallbackId = `custom_${Date.now()}`;
    const customMetadata: GameMetadata = {
      id: fallbackId,
      titleId: titleId || undefined,
      title: searchName,
      normalizedTitle: searchName.toLowerCase(),
      publisher: 'LiveContainer App',
      developer: 'Independent Developer',
      releaseDate: new Date().toISOString().split('T')[0],
      genre: 'Application',
      description: `Application launched via LiveContainer: ${searchName}`,
      // Clean styled SVG/gradient cover instead of random picsum photos
      coverUrl: `https://dummyimage.com/600x900/1e293b/38bdf8.png&text=${encodeURIComponent(searchName)}`,
      heroUrl: `https://dummyimage.com/1280x720/0f172a/38bdf8.png&text=${encodeURIComponent(searchName)}`,
      screenshots: [],
      lastPlayed: null,
      playTimeMinutes: 0,
      isFavorite: false,
      rating: 8.0,
      launchUrl,
      bundleName,
      containerFolder,
      tags: ['LiveContainer'],
      needsMetadataSync: true,
    };

    return {
      detectedTitleId: titleId,
      detectedCleanName: searchName,
      metadata: customMetadata,
      source: 'custom',
      needsManualName: false,
      candidates,
      isOfflineFallback: true,
    };
  }

  // 4. No Title ID matched and no name was provided yet -> ask user for name
  return {
    detectedTitleId: titleId,
    detectedCleanName: '',
    metadata: {
      id: `pending_${Date.now()}`,
      titleId,
      title: '',
      normalizedTitle: '',
      publisher: '',
      genre: '',
      description: '',
      coverUrl: '',
      heroUrl: '',
      screenshots: [],
      lastPlayed: null,
      playTimeMinutes: 0,
      isFavorite: false,
      launchUrl,
      bundleName,
      containerFolder,
      needsMetadataSync: true,
    },
    source: 'custom',
    needsManualName: true,
    candidates,
  };
}

/**
 * Directly scrapes or builds metadata for a given Title ID (with online API and offline fallback).
 */
export async function scrapeGameByTitleId(
  titleId: string,
  baseData?: {
    launchUrl?: string;
    bundleName?: string;
    containerFolder?: string;
  },
  langOverride?: string
): Promise<GameMetadata> {
  const cleanId = titleId.toLowerCase().trim();
  const coverUrl = `${NLIB_BASE}/${cleanId}/icon`;
  const heroUrl = `${NLIB_BASE}/${cleanId}/banner`;
  let screenshots: string[] = [
    `${NLIB_BASE}/${cleanId}/screen/1`,
    `${NLIB_BASE}/${cleanId}/screen/2`,
    `${NLIB_BASE}/${cleanId}/screen/3`,
    `${NLIB_BASE}/${cleanId}/screen/4`,
  ];

  try {
    const multiRes = await fetchNlibMetadataMultiLang(cleanId, langOverride);

    if (multiRes) {
      const { data, localizedDescriptions, localizedGenres, activeLang } = multiRes;
      const cleanTitle = (data.name || 'Nintendo Switch Game').replace(/[™®]/g, '').trim();

      if (Array.isArray(data.screens?.screenshots) && data.screens.screenshots.length > 0) {
        screenshots = data.screens.screenshots
          .filter((s: any) => typeof s === 'string' && !s.endsWith('/screen/0'))
          .map((s: string) => s.replace(/^http:\/\//, 'https://'));
      }

      const activeGenre = localizedGenres[activeLang] || (Array.isArray(data.category) ? data.category.join(' / ') : 'Action / Adventure');
      const activeDesc = localizedDescriptions[activeLang] || data.description || data.intro || `Nintendo Switch title: ${cleanTitle}`;

      const meta: GameMetadata = {
        id: `game_${cleanId}_${Date.now()}`,
        titleId: cleanId,
        title: cleanTitle,
        normalizedTitle: cleanTitle.toLowerCase(),
        publisher: data.publisher || 'Nintendo',
        developer: data.developer || data.publisher || 'Nintendo',
        releaseDate: data.releaseDate || new Date().toISOString().split('T')[0],
        genre: activeGenre,
        description: activeDesc,
        localizedDescriptions,
        localizedGenres,
        coverUrl,
        heroUrl,
        screenshots,
        lastPlayed: null,
        playTimeMinutes: 0,
        isFavorite: false,
        launchUrl: baseData?.launchUrl,
        bundleName: baseData?.bundleName,
        containerFolder: baseData?.containerFolder,
        rating: 9.0,
        tags: Array.isArray(data.category) ? data.category : ['Nintendo Switch'],
        needsMetadataSync: false,
      };

      await preloadAndCacheImages(coverUrl, heroUrl, screenshots);
      return meta;
    }
  } catch (err) {
    console.warn('[GameScraper] scrapeGameByTitleId fetch failed, falling back to offline catalog:', err);
  }

  // Fallback to offline catalog
  const catalogMatch = SWITCH_TITLES_INDEX.find((e) => e.titleId.toLowerCase() === cleanId);
  const title = catalogMatch?.title || `Switch Title (${cleanId})`;
  const meta: GameMetadata = {
    id: `game_${cleanId}_${Date.now()}`,
    titleId: cleanId,
    title,
    normalizedTitle: title.toLowerCase(),
    publisher: catalogMatch?.publisher || 'Nintendo',
    developer: catalogMatch?.developer || 'Nintendo',
    releaseDate: catalogMatch?.releaseDate || new Date().toISOString().split('T')[0],
    genre: catalogMatch?.genre || 'Action / Adventure',
    description: catalogMatch?.description || `Nintendo Switch title: ${title}`,
    coverUrl,
    heroUrl,
    screenshots,
    lastPlayed: null,
    playTimeMinutes: 0,
    isFavorite: false,
    launchUrl: baseData?.launchUrl,
    bundleName: baseData?.bundleName,
    containerFolder: baseData?.containerFolder,
    rating: 9.0,
    needsMetadataSync: true,
  };

  await preloadAndCacheImages(coverUrl, heroUrl, screenshots);
  return meta;
}

/**
 * Pre-caches images via Image.prefetch to persistent disk cache
 */
async function preloadAndCacheImages(coverUrl?: string, heroUrl?: string, screenshots?: string[]): Promise<void> {
  try {
    if (coverUrl) await Image.prefetch(coverUrl, 'memory-disk').catch(() => {});
    if (heroUrl) await Image.prefetch(heroUrl, 'memory-disk').catch(() => {});
    if (Array.isArray(screenshots)) {
      for (const s of screenshots.slice(0, 4)) {
        if (s) Image.prefetch(s, 'memory-disk').catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[GameScraper] Cache warning:', err);
  }
}
