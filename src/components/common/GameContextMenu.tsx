import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Alert,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GameMetadata } from '../../types/game';
import { ensureGameDirectBoot } from '../../../modules/nx-livecontainer';
import { useAppTheme } from '../../theme/ThemeProvider';

interface GameContextMenuProps {
  game: GameMetadata | null;
  visible: boolean;
  onClose: () => void;
  onPlay: (game: GameMetadata) => void;
  onOpenConfig: (game: GameMetadata) => void;
  onRefreshMetadata: (game: GameMetadata) => void;
  onDelete: (game: GameMetadata) => void;
}

export const GameContextMenu: React.FC<GameContextMenuProps> = ({
  game,
  visible,
  onClose,
  onPlay,
  onOpenConfig,
  onRefreshMetadata,
  onDelete,
}) => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  if (!game) return null;

  const handleAction = (action: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    onClose();
    action();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
      onRequestClose={onClose}
    >
      <StatusBar hidden />
      <View
        style={[
          styles.backdrop,
          {
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            paddingLeft: Math.max(insets.left, isLandscape ? 32 : 20),
            paddingRight: Math.max(insets.right, isLandscape ? 32 : 20),
            paddingTop: Math.max(insets.top, isLandscape ? 16 : 24),
            paddingBottom: Math.max(insets.bottom, isLandscape ? 16 : 24),
          },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View
          style={[
            styles.sheetContainer,
            isLandscape && styles.sheetContainerLandscape,
            {
              maxHeight: Math.max(240, height - (insets.top + insets.bottom + (isLandscape ? 24 : 48))),
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={[
              styles.sheetContent,
              isLandscape && styles.sheetContentLandscape,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {game.title}
              </Text>
              {game.publisher ? (
                <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                  {game.publisher}
                </Text>
              ) : null}
            </View>

            <View style={[styles.actionList, isLandscape && styles.actionListLandscape]}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionItem,
                  isLandscape && styles.actionItemLandscape,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                  pressed && { borderColor: colors.accent },
                ]}
                onPress={() => handleAction(() => onPlay(game))}
                accessibilityRole="button"
              >
                <View style={[styles.btnCircle, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.btnLetter, { color: colors.surface }]}>A</Text>
                </View>
                <Text style={[styles.actionText, { color: colors.text }]} numberOfLines={2}>
                  {t('contextMenu.playNow')}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.actionItem,
                  isLandscape && styles.actionItemLandscape,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                  pressed && { borderColor: colors.accent },
                ]}
                onPress={() => handleAction(() => onOpenConfig(game))}
                accessibilityRole="button"
              >
                <Ionicons name="options-outline" size={20} color={colors.accent} />
                <Text style={[styles.actionText, { color: colors.text }]} numberOfLines={2}>
                  {t('contextMenu.gameConfig')}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.actionItem,
                  isLandscape && styles.actionItemLandscape,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                  pressed && { borderColor: colors.accent },
                ]}
                onPress={() => handleAction(() => onRefreshMetadata(game))}
                accessibilityRole="button"
              >
                <Ionicons name="sync" size={20} color={colors.accent} />
                <Text style={[styles.actionText, { color: colors.text }]} numberOfLines={2}>
                  {t('contextMenu.refreshMetadata')}
                </Text>
              </Pressable>

              {game.containerFolder && (
                <Pressable
                  style={({ pressed }) => [
                    styles.actionItem,
                    isLandscape && styles.actionItemLandscape,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                    pressed && { borderColor: colors.accent },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
                    ensureGameDirectBoot(game.containerFolder).then((ok) => {
                      Alert.alert(
                        ok ? t('common.success') : t('contextMenu.liveContainerUnlinked'),
                        ok
                          ? t('contextMenu.directBootApplied')
                          : t('contextMenu.linkLiveContainerForDirectBoot')
                      );
                    });
                  }}
                  accessibilityRole="button"
                >
                  <Ionicons name="flash" size={20} color={colors.accent} />
                  <Text style={[styles.actionText, { color: colors.text }]} numberOfLines={2}>
                    {t('contextMenu.directBoot')}
                  </Text>
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.actionItem,
                  styles.deleteAction,
                  isLandscape && styles.actionItemLandscape,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                  pressed && { borderColor: colors.destructive },
                ]}
                onPress={() => handleAction(() => onDelete(game))}
                accessibilityRole="button"
              >
                <Ionicons name="trash-outline" size={20} color={colors.destructive} />
                <Text style={[styles.actionText, { color: colors.destructive }]} numberOfLines={2}>
                  {t('contextMenu.delete')}
                </Text>
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                { backgroundColor: colors.surfaceSecondary },
              ]}
              onPress={onClose}
              accessibilityRole="button"
            >
              <Text style={[styles.cancelText, { color: colors.text }]}>{t('common.close')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 420,
    flexShrink: 1,
    backgroundColor: '#2D2D2D',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#444444',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 10,
  },
  sheetContainerLandscape: {
    width: '84%',
    maxWidth: 560,
  },
  sheetScroll: {
    flexShrink: 1,
  },
  sheetContent: {
    padding: 18,
  },
  sheetContentLandscape: {
    padding: 16,
  },
  header: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3D3D3D',
    paddingBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 12,
    color: '#8E8E8E',
    marginTop: 2,
  },
  actionList: {
    gap: 7,
    marginBottom: 12,
  },
  actionListLandscape: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: 8,
    rowGap: 7,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    backgroundColor: '#242424',
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexShrink: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#383838',
  },
  actionItemLandscape: {
    width: '48%',
    gap: 9,
    paddingHorizontal: 10,
  },
  actionItemPressed: {
    backgroundColor: '#383838',
    borderColor: '#00D2FF',
  },
  btnCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00D2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLetter: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1E1E1E',
  },
  actionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#E0E0E0',
  },
  deleteAction: {
    backgroundColor: 'rgba(255, 77, 77, 0.08)',
    borderColor: 'rgba(255, 77, 77, 0.3)',
  },
  deleteText: {
    color: '#FF4D4D',
  },
  cancelButton: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#383838',
  },
  cancelButtonPressed: {
    backgroundColor: '#4D4D4D',
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CCCCCC',
  },
});
