import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

function getImageExtension(name?: string, mimeType?: string): string {
  const extension = name?.split('.').pop()?.toLowerCase();
  if (extension && /^[a-z0-9]{2,5}$/.test(extension)) return extension;
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export async function pickAndStoreImageAsset(prefix: string): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'image/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset?.uri) {
    throw new Error('The selected image does not have a readable file URI');
  }

  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) {
    throw new Error('The app document directory is unavailable');
  }

  const destinationDirectory = `${documentDirectory}custom-assets/`;
  const directoryInfo = await FileSystem.getInfoAsync(destinationDirectory);
  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(destinationDirectory, { intermediates: true });
  }

  const safePrefix = prefix.replace(/[^a-z0-9_-]/gi, '_');
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const extension = getImageExtension(asset.name, asset.mimeType);
  const destinationUri = `${destinationDirectory}${safePrefix}_${uniqueSuffix}.${extension}`;
  await FileSystem.copyAsync({ from: asset.uri, to: destinationUri });
  return destinationUri;
}
