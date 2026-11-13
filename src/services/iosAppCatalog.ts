import { GameMetadata } from '../types/game';

export interface IOSAppCatalogEntry {
  trackId: number;
  bundleId?: string;
  name: string;
  publisher: string;
  description: string;
  genre: string;
  artworkUrl: string;
  screenshots: string[];
  storeUrl: string;
}

interface ITunesSearchResponse {
  resultCount: number;
  results: Array<{
    trackId: number;
    bundleId?: string;
    trackName: string;
    artistName: string;
    sellerName?: string;
    description?: string;
    primaryGenreName?: string;
    artworkUrl512?: string;
    artworkUrl100?: string;
    screenshotUrls?: string[];
    trackViewUrl: string;
  }>;
}

export interface FeaturedIOSApp {
  name: string;
  bundleId?: string;
  launchUrl?: string;
}

export const FEATURED_IOS_APPS: FeaturedIOSApp[] = [
  { name: 'Minecraft', bundleId: 'com.mojang.minecraftpe', launchUrl: 'minecraft://' },
  { name: 'Discord', bundleId: 'com.hammerandchisel.discord', launchUrl: 'discord://' },
  { name: 'YouTube', bundleId: 'com.google.ios.youtube', launchUrl: 'youtube://' },
  { name: 'Netflix', bundleId: 'com.netflix.Netflix', launchUrl: 'nflx://' },
  { name: 'Crunchyroll', bundleId: 'com.crunchyroll.iphone', launchUrl: 'crunchyroll://' },
  { name: 'Roblox', bundleId: 'com.roblox.robloxmobile', launchUrl: 'roblox://' },
  { name: 'Spotify', bundleId: 'com.spotify.client', launchUrl: 'spotify://' },
  { name: 'Twitch', bundleId: 'tv.twitch', launchUrl: 'twitch://' },
  { name: 'TikTok', bundleId: 'com.zhiliaoapp.musically', launchUrl: 'snssdk1233://' },
  { name: 'Instagram', bundleId: 'com.burbn.instagram', launchUrl: 'instagram://' },
  { name: 'WhatsApp', bundleId: 'net.whatsapp.WhatsApp', launchUrl: 'whatsapp://' },
  { name: 'Telegram', bundleId: 'ph.telegra.Telegraph', launchUrl: 'tg://' },
  { name: 'Reddit', bundleId: 'com.reddit.Reddit', launchUrl: 'reddit://' },
  { name: 'X', bundleId: 'com.atebits.Tweetie2', launchUrl: 'twitter://' },
  { name: 'Disney+', bundleId: 'com.disney.disneyplus', launchUrl: 'disneyplus://' },
  { name: 'Amazon Prime Video', bundleId: 'com.amazon.aiv.AIVApp', launchUrl: 'aiv://' },
  { name: 'Genshin Impact' },
  { name: 'Pokémon GO' },
  { name: 'Clash of Clans' },
  { name: 'Clash Royale' },
  { name: 'Brawl Stars' },
  { name: 'Among Us!' },
  { name: 'Stardew Valley' },
  { name: 'Terraria' },
  { name: 'Monument Valley' },
  { name: 'PUBG MOBILE' },
  { name: 'Call of Duty: Mobile' },
  { name: 'Pokémon TCG Pocket' },
  { name: 'Google Maps' },
  { name: 'Gmail' },
  { name: 'Google Chrome' },
  { name: 'Google Photos' },
  { name: 'Google Drive' },
  { name: 'Google Meet' },
  { name: 'Facebook' },
  { name: 'Messenger' },
  { name: 'Threads' },
  { name: 'Pinterest' },
  { name: 'Snapchat' },
  { name: 'Zoom Workplace' },
  { name: 'Microsoft Teams' },
  { name: 'Microsoft Outlook' },
  { name: 'Microsoft Word' },
  { name: 'Microsoft Excel' },
  { name: 'Microsoft PowerPoint' },
  { name: 'Amazon Shopping' },
  { name: 'Amazon Kindle' },
  { name: 'Duolingo' },
  { name: 'Adobe Acrobat Reader' },
  { name: 'Canva' },
  { name: 'Shazam' },
  { name: 'SoundCloud' },
  { name: 'CapCut' },
  { name: 'Uber' },
  { name: 'Uber Eats' },
  { name: 'DoorDash' },
  { name: 'Google Translate' },
  { name: 'Apple Music' },
  { name: 'Hulu' },
  { name: 'Max' },
  { name: 'Peacock TV' },
  { name: 'Paramount+' },
  { name: 'Khan Academy' },
  { name: 'Tetris' },
  { name: 'Subway Surfers' },
  { name: 'Hill Climb Racing' },
  { name: 'Geometry Dash' },
  { name: 'Plants vs. Zombies' },
  { name: 'Stumble Guys' },
];

export function normalizeBundleId(bundleId?: string): string | undefined {
  const normalized = bundleId?.trim().replace(/\.app$/i, '').toLowerCase();
  return normalized || undefined;
}

function mapResult(result: ITunesSearchResponse['results'][number]): IOSAppCatalogEntry {
  return {
    trackId: result.trackId,
    bundleId: result.bundleId,
    name: result.trackName,
    publisher: result.sellerName || result.artistName,
    description: result.description || '',
    genre: result.primaryGenreName || 'App',
    artworkUrl: result.artworkUrl512 || result.artworkUrl100 || '',
    screenshots: result.screenshotUrls || [],
    storeUrl: result.trackViewUrl,
  };
}

async function requestResults(url: string): Promise<IOSAppCatalogEntry[]> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`App Store metadata request failed (${response.status})`);
  }
  const data = (await response.json()) as ITunesSearchResponse;
  return data.results.map(mapResult);
}

export async function searchIOSApps(query: string): Promise<IOSAppCatalogEntry[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const params = new URLSearchParams({
    term: trimmedQuery,
    entity: 'software',
    limit: '25',
  });
  return requestResults(`https://itunes.apple.com/search?${params.toString()}`);
}

export async function lookupIOSAppByBundleId(bundleId?: string): Promise<IOSAppCatalogEntry | null> {
  const requestedBundleId = bundleId?.trim().replace(/\.app$/i, '');
  const normalizedBundleId = normalizeBundleId(requestedBundleId);
  if (!requestedBundleId || !normalizedBundleId) return null;

  const bundleIds = [...new Set([requestedBundleId, normalizedBundleId])];
  for (const candidate of bundleIds) {
    const params = new URLSearchParams({ bundleId: candidate });
    const [result] = await requestResults(`https://itunes.apple.com/lookup?${params.toString()}`);
    if (result) return result;
  }
  return null;
}

export async function lookupIOSAppByTrackId(trackId?: string): Promise<IOSAppCatalogEntry | null> {
  if (!trackId || !/^\d+$/.test(trackId)) return null;
  const params = new URLSearchParams({ id: trackId });
  const [result] = await requestResults(`https://itunes.apple.com/lookup?${params.toString()}`);
  return result || null;
}

export function toIOSAppMetadata(
  app: IOSAppCatalogEntry,
  options: { launchUrl?: string; containerFolder?: string } = {}
): GameMetadata {
  return {
    id: `ios_app_${app.trackId}_${Date.now()}`,
    title: app.name,
    normalizedTitle: app.name.toLowerCase(),
    publisher: app.publisher,
    genre: app.genre,
    description: app.description,
    coverUrl: app.artworkUrl,
    heroUrl: app.screenshots[0] || app.artworkUrl,
    screenshots: app.screenshots,
    lastPlayed: null,
    playTimeMinutes: 0,
    isFavorite: false,
    launchUrl: options.launchUrl,
    bundleName: app.bundleId,
    containerFolder: options.containerFolder,
    appStoreId: String(app.trackId),
    appStoreUrl: app.storeUrl,
    needsMetadataSync: false,
  };
}
