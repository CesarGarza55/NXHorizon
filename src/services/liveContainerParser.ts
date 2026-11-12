export interface LiveContainerParsedData {
  isValid: boolean;
  launchUrl: string;
  bundleName?: string;
  containerFolderName?: string;
  titleId?: string;
  suggestedName?: string;
}

const TITLE_ID_REGEX = /\b(0100[0-9A-Fa-f]{12})\b/i;

export function parseLiveContainerUrl(rawInput: string): LiveContainerParsedData {
  const trimmed = rawInput.trim();

  // 1. Look for any 16-hex Title ID anywhere in the input
  const titleIdMatch = trimmed.match(TITLE_ID_REGEX);
  const detectedTitleId = titleIdMatch ? titleIdMatch[1].toLowerCase() : undefined;

  let bundleName: string | undefined;
  let containerFolderName: string | undefined;
  let suggestedName: string | undefined;

  // 2. Parse query parameters if it's a URL
  try {
    const queryIndex = trimmed.indexOf('?');
    if (queryIndex !== -1) {
      const queryString = trimmed.substring(queryIndex + 1);
      const params = new URLSearchParams(queryString);
      bundleName = params.get('bundle-name') || undefined;
      containerFolderName = params.get('container-folder-name') || undefined;
    }
  } catch (e) {
    // URL parsing fallback
  }

  // 3. Try to extract a suggested name from bundleName if present
  // e.g. "com.nintendo.marioodyssey.app" -> "marioodyssey"
  if (bundleName) {
    const segments = bundleName.replace(/\.app$/i, '').split('.');
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && !lastSegment.match(TITLE_ID_REGEX) && lastSegment.length > 2) {
      suggestedName = lastSegment.replace(/([A-Z])/g, ' $1').trim();
    }
  }

  // We consider any non-empty input as a potentially valid launch URL or custom title
  return {
    isValid: trimmed.length > 0,
    launchUrl: trimmed,
    bundleName,
    containerFolderName,
    titleId: detectedTitleId,
    suggestedName,
  };
}
