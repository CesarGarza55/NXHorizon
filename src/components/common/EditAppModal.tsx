import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { GameMetadata, getGameCoverUrl, getGameTitle, getLocalizedDescription } from '../../types/game';
import { useGameStore } from '../../state/useGameStore';
import { useAppTheme } from '../../theme/ThemeProvider';
import { pickAndStoreImageAsset } from '../../services/userImageAssets';

interface EditAppModalProps {
  game: GameMetadata | null;
  visible: boolean;
  onClose: () => void;
}

export const EditAppModal: React.FC<EditAppModalProps> = ({ game, visible, onClose }) => {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const { updateGameMetadata } = useGameStore();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [launchUrl, setLaunchUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible || !game) return;
    setName(game.customTitle || getGameTitle(game));
    setDescription(game.customDescription ?? getLocalizedDescription(game, i18n.language));
    setCoverUrl(game.customCoverUrl !== undefined ? game.customCoverUrl : getGameCoverUrl(game));
    setLaunchUrl(game.launchUrl || '');
  }, [game, i18n.language, visible]);

  const handlePickCover = async () => {
    try {
      const uri = await pickAndStoreImageAsset('app-cover');
      if (uri) setCoverUrl(uri);
    } catch (error) {
      console.warn('[EditAppModal] Could not store custom app cover:', error);
      Alert.alert(t('common.error'), t('details.editAppSaveError'));
    }
  };

  const handleSave = async () => {
    if (!game || !name.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsSaving(true);
    try {
      await updateGameMetadata(game.id, {
        customTitle: name.trim() === game.title ? undefined : name.trim(),
        customDescription: description.trim() === game.description ? undefined : description.trim(),
        customCoverUrl: coverUrl.trim() === game.coverUrl ? undefined : coverUrl.trim(),
        launchUrl: launchUrl.trim() || undefined,
      });
      onClose();
    } catch (error) {
      console.warn('[EditAppModal] Could not save app metadata:', error);
      Alert.alert(t('common.error'), t('details.editAppSaveError'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!game) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoiding}
        >
          <View
            style={[
              styles.sheet,
              isLandscape && styles.sheetLandscape,
              { backgroundColor: colors.surface, borderColor: colors.border, maxHeight: height - insets.top - insets.bottom - 24 },
            ]}
          >
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.text }]}>{t('details.editAppTitle')}</Text>
              <Pressable
                onPress={onClose}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('details.customName')}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('details.customName')}
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text, borderColor: colors.border }]}
                maxLength={80}
                returnKeyType="done"
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('details.customDescription')}</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={t('details.customDescription')}
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.descriptionInput, { backgroundColor: colors.surfaceSecondary, color: colors.text, borderColor: colors.border }]}
                multiline
                textAlignVertical="top"
                maxLength={2000}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('details.customCover')}</Text>
              {coverUrl ? (
                <Image
                  source={{ uri: coverUrl }}
                  style={[styles.coverPreview, { borderColor: colors.border }]}
                  contentFit="cover"
                />
              ) : null}
              <View style={styles.coverActions}>
                <Pressable
                  style={[styles.secondaryButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                  onPress={handlePickCover}
                  accessibilityRole="button"
                >
                  <Ionicons name="image-outline" size={18} color={colors.accent} />
                  <Text style={[styles.buttonText, { color: colors.accent }]}>{t('details.chooseCover')}</Text>
                </Pressable>
                {game.customCoverUrl !== undefined || coverUrl !== game.coverUrl ? (
                  <Pressable
                    style={[styles.secondaryButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                    onPress={() => setCoverUrl(game.coverUrl)}
                    accessibilityRole="button"
                  >
                    <Ionicons name="refresh-outline" size={18} color={colors.accent} />
                    <Text style={[styles.buttonText, { color: colors.accent }]}>{t('details.restoreCover')}</Text>
                  </Pressable>
                ) : null}
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('details.openingLink')}</Text>
              <TextInput
                value={launchUrl}
                onChangeText={setLaunchUrl}
                placeholder="myapp://"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text, borderColor: colors.border }]}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Text style={[styles.helperText, { color: colors.textMuted }]}>{t('details.openingLinkHelp')}</Text>

              <Pressable
                style={[
                  styles.saveButton,
                  { backgroundColor: colors.accent },
                  (!name.trim() || isSaving) && styles.disabledButton,
                ]}
                onPress={handleSave}
                disabled={!name.trim() || isSaving}
                accessibilityRole="button"
              >
                <Text style={[styles.buttonText, { color: colors.surface }]}>
                  {isSaving ? t('common.loading') : t('details.saveAppChanges')}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  keyboardAvoiding: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 620,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sheetLandscape: {
    maxWidth: 720,
  },
  header: {
    minHeight: 56,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 18,
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  descriptionInput: {
    minHeight: 96,
    paddingTop: 12,
  },
  coverPreview: {
    width: 112,
    height: 148,
    borderWidth: 1,
    borderRadius: 10,
  },
  coverActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  secondaryButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
  },
  saveButton: {
    minHeight: 48,
    marginTop: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
