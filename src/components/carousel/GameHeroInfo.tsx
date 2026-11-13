import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GameMetadata, getGameTitle } from '../../types/game';

interface GameHeroInfoProps {
  game: GameMetadata | null;
  onPlay: (game: GameMetadata) => void;
  onDetails: (game: GameMetadata) => void;
}

export const GameHeroInfo: React.FC<GameHeroInfoProps> = ({
  game,
  onPlay,
  onDetails,
}) => {
  const { t } = useTranslation();

  if (!game) return null;

  const handlePlayPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    onPlay(game);
  };

  const handleDetailsPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onDetails(game);
  };

  const title = getGameTitle(game);

  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={styles.genreBadge}>{game.genre.toUpperCase()}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.publisher}>{game.publisher}</Text>

        {typeof game.rating === 'number' && game.rating > 0 ? (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="star" size={14} color="#FBBF24" />
              <Text style={styles.statText}>{game.rating.toFixed(1)}</Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Action Buttons: Generous hitSlop and clear visual feedback */}
      <View style={styles.actionsRow}>
        <Pressable
          onPress={handlePlayPress}
          style={({ pressed }) => [
            styles.playButton,
            pressed && styles.playButtonPressed,
          ]}
          hitSlop={8}
        >
          <Ionicons name="play" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.playButtonText}>{t('common.play').toUpperCase()}</Text>
        </Pressable>

        <Pressable
          onPress={handleDetailsPress}
          style={({ pressed }) => [
            styles.infoButton,
            pressed && styles.infoButtonPressed,
          ]}
          hitSlop={8}
        >
          <Ionicons name="information-circle-outline" size={24} color="#E2E8F0" />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  genreBadge: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '700',
    color: '#38BDF8',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 4,
  },
  publisher: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 24,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  playButtonPressed: {
    backgroundColor: '#0369A1',
    transform: [{ scale: 0.97 }],
  },
  playButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  infoButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoButtonPressed: {
    backgroundColor: '#334155',
    transform: [{ scale: 0.95 }],
  },
});
