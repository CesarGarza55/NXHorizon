import React, { useState } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { Image, ImageContentFit } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { GameMetadata } from '../../types/game';
import { useAppTheme } from '../../theme/ThemeProvider';

interface GameCartridgeCoverProps {
  game: Pick<GameMetadata, 'id' | 'title' | 'coverUrl' | 'needsMetadataSync'>;
  style?: StyleProp<ViewStyle | ImageStyle>;
  contentFit?: ImageContentFit;
  showSyncBadge?: boolean;
  iconSize?: number;
}

export const GameCartridgeCover: React.FC<GameCartridgeCoverProps> = ({
  game,
  style,
  contentFit = 'cover',
  showSyncBadge = true,
  iconSize = 28,
}) => {
  const { colors } = useAppTheme();
  const [imageError, setImageError] = useState(false);

  const hasValidCover = Boolean(game.coverUrl && !imageError && game.coverUrl.trim().length > 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, style]}>
      {hasValidCover ? (
        <Image
          source={{ uri: game.coverUrl }}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          transition={200}
          cachePolicy="memory-disk"
          onError={() => setImageError(true)}
        />
      ) : (
        /* Authentic Nintendo Switch Software Cartridge Empty State */
        <View style={styles.placeholder}>
          <View style={[styles.cartridgeTopBar, { backgroundColor: colors.accent }]} />
          <View style={styles.placeholderContent}>
            <View style={[styles.iconCircle, { backgroundColor: colors.surface }]}>
              <Ionicons name="game-controller-outline" size={iconSize} color={colors.accent} />
            </View>
            <Text style={[styles.placeholderTitle, { color: colors.text }]} numberOfLines={2}>
              {game.title}
            </Text>
          </View>
        </View>
      )}

      {/* Pending Metadata Sync Badge */}
      {showSyncBadge && game.needsMetadataSync && (
        <View style={[styles.syncBadge, { backgroundColor: 'rgba(0,0,0,0.75)', borderColor: '#FFA500' }]}>
          <Ionicons name="cloud-offline-outline" size={12} color="#FFA500" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
  },
  placeholder: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartridgeTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  placeholderContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderTitle: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  syncBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
});
