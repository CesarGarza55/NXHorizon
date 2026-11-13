import packageJson from '../../package.json';

export interface AppReleaseInfo {
  version: string;
  tag: string;
  releaseUrl: string;
  downloadUrl?: string;
  publishedAt?: string;
  releaseNotes?: string;
  isNewer: boolean;
}

export interface UpdateStatusState {
  status: 'idle' | 'checking' | 'up_to_date' | 'update_available' | 'error';
  currentVersion: string;
  latestRelease: AppReleaseInfo | null;
  errorMessage?: string;
  lastCheckedAt: Date | null;
}

const GITHUB_REPO = 'CesarGarza55/NXHorizon';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

/**
 * Compare two semantic version strings (e.g. "1.0.1" vs "1.0.0")
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareVersions(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/, '').trim();
  const clean2 = v2.replace(/^v/, '').trim();

  const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0);

  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

export function getCurrentAppVersion(): string {
  return packageJson.version || '1.0.0';
}

/**
 * Checks GitHub Releases API for the latest published release.
 */
export async function checkForAppUpdates(): Promise<AppReleaseInfo> {
  const currentVersion = getCurrentAppVersion();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(GITHUB_API_URL, {
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'NXHorizon-App',
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 404) {
        // No releases published yet
        return {
          version: currentVersion,
          tag: `v${currentVersion}`,
          releaseUrl: `https://github.com/${GITHUB_REPO}/releases`,
          isNewer: false,
        };
      }
      throw new Error(`GitHub API returned status ${res.status}`);
    }

    const data = await res.json();
    const tag = data.tag_name || '';
    const latestVersion = tag.replace(/^v/, '').trim() || currentVersion;

    // Look for an .ipa asset if present
    const ipaAsset = Array.isArray(data.assets)
      ? data.assets.find((a: any) => a.name?.endsWith('.ipa'))
      : null;

    const isNewer = compareVersions(latestVersion, currentVersion) > 0;

    return {
      version: latestVersion,
      tag,
      releaseUrl: data.html_url || `https://github.com/${GITHUB_REPO}/releases`,
      downloadUrl: ipaAsset?.browser_download_url || data.html_url,
      publishedAt: data.published_at,
      releaseNotes: data.body || '',
      isNewer,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err;
  }
}
