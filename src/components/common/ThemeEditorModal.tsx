import React, { useEffect, useMemo, useState } from 'react';
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
import { AppColors, CustomTheme, useAppTheme } from '../../theme/ThemeProvider';
import { pickAndStoreImageAsset } from '../../services/userImageAssets';

interface ThemeEditorModalProps {
  visible: boolean;
  theme?: CustomTheme | null;
  onClose: () => void;
}

interface ThemeColorFields {
  background: string;
  surface: string;
  text: string;
  accent: string;
  border: string;
}

const themeColorPalette = [
  '#FFFFFF',
  '#E5E5E5',
  '#BDBDBD',
  '#8A8A8A',
  '#555555',
  '#242424',
  ...[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].flatMap((hue) =>
    [25, 38, 51, 64, 77].map((lightness) => {
      const saturation = 78;
      const l = lightness / 100;
      const s = saturation / 100;
      const channel = (offset: number) => {
        const k = (offset + hue / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        return Math.round(255 * value).toString(16).padStart(2, '0');
      };
      return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase();
    })
  ),
];

function hexToRgb(color: string): [number, number, number] | null {
  const match = color.match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;
  return [
    parseInt(match[1].slice(0, 2), 16),
    parseInt(match[1].slice(2, 4), 16),
    parseInt(match[1].slice(4, 6), 16),
  ];
}

function contrastRatio(foreground: string, background: string): number {
  const luminance = (color: string) => {
    const rgb = hexToRgb(color);
    if (!rgb) return 0;
    const channels = rgb.map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function getHex(color: string | undefined, fallback: string): string {
  return color && hexToRgb(color) ? color : fallback;
}

export const ThemeEditorModal: React.FC<ThemeEditorModalProps> = ({ visible, theme, onClose }) => {
  const { t } = useTranslation();
  const { colors, colorScheme, saveCustomTheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [name, setName] = useState('');
  const [colorFields, setColorFields] = useState<ThemeColorFields>({
    background: '#181A1C',
    surface: '#202326',
    text: '#F4F5F6',
    accent: '#00D2FF',
    border: '#41474C',
  });
  const [backgroundImageUri, setBackgroundImageUri] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [activeColorField, setActiveColorField] = useState<keyof ThemeColorFields | null>(null);

  useEffect(() => {
    if (!visible) return;
    const sourceColors = theme?.colors || colors;
    const isDark = colorScheme === 'dark';
    setName(theme?.name || '');
    setColorFields({
      background: getHex(sourceColors.background, isDark ? '#181A1C' : '#F1F2F3'),
      surface: getHex(sourceColors.surface, isDark ? '#202326' : '#FFFFFF'),
      text: getHex(sourceColors.text, isDark ? '#F4F5F6' : '#24282C'),
      accent: getHex(sourceColors.accent, isDark ? '#00D2FF' : '#007482'),
      border: getHex(sourceColors.border, isDark ? '#41474C' : '#D5D9DC'),
    });
    setBackgroundImageUri(theme?.backgroundImageUri);
    setActiveColorField(null);
  }, [visible, theme, colors, colorScheme]);

  const allColorsValid = Object.values(colorFields).every((color) => hexToRgb(color));
  const contrastRatios = useMemo(
    () => ({
      background: contrastRatio(colorFields.text, colorFields.background),
      surface: contrastRatio(colorFields.text, colorFields.surface),
    }),
    [colorFields.text, colorFields.background, colorFields.surface]
  );
  const contrastValid =
    allColorsValid && contrastRatios.background >= 4.5 && contrastRatios.surface >= 4.5;
  const contrastAreas = [
    contrastRatios.background < 4.5 ? t('settings.themeContrastBackground') : null,
    contrastRatios.surface < 4.5 ? t('settings.themeContrastSurface') : null,
  ]
    .filter((area): area is string => area !== null)
    .join(t('settings.themeContrastJoiner'));

  const updateColor = (key: keyof ThemeColorFields, value: string) => {
    setColorFields((current) => ({ ...current, [key]: value }));
  };

  const handlePickBackground = async () => {
    try {
      const uri = await pickAndStoreImageAsset('theme-background');
      if (uri) setBackgroundImageUri(uri);
    } catch (error) {
      console.warn('[ThemeEditor] Could not store background image:', error);
      Alert.alert(t('common.error'), t('settings.themeSaveError'));
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !allColorsValid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsSaving(true);
    try {
      const [red, green, blue] = hexToRgb(colorFields.accent) || [0, 175, 194];
      const accentSurface = `rgba(${red}, ${green}, ${blue}, ${colorScheme === 'dark' ? 0.2 : 0.12})`;
      const colorsForTheme: AppColors = {
        ...colors,
        background: colorFields.background.toUpperCase(),
        surface: colorFields.surface.toUpperCase(),
        surfaceElevated: colorFields.surface.toUpperCase(),
        surfaceSecondary: colorFields.surface.toUpperCase(),
        text: colorFields.text.toUpperCase(),
        textSecondary: colorFields.text.toUpperCase(),
        textMuted: colorFields.text.toUpperCase(),
        border: colorFields.border.toUpperCase(),
        accent: colorFields.accent.toUpperCase(),
        accentStrong: colorFields.accent.toUpperCase(),
        accentSurface,
      };
      await saveCustomTheme({
        id: theme?.id || `custom-theme-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: name.trim(),
        colors: colorsForTheme,
        backgroundImageUri,
      });
      onClose();
    } catch (error) {
      console.warn('[ThemeEditor] Could not save theme:', error);
      Alert.alert(t('common.error'), t('settings.themeSaveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const colorInputs: Array<[keyof ThemeColorFields, string]> = [
    ['background', t('settings.themeBackground')],
    ['surface', t('settings.themeSurface')],
    ['text', t('settings.themeText')],
    ['accent', t('settings.themeAccent')],
    ['border', t('settings.themeBorder')],
  ];

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
              <Text style={[styles.title, { color: colors.text }]}>
                {theme ? t('settings.editTheme') : t('settings.createTheme')}
              </Text>
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
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('settings.themeName')}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('settings.themeName')}
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text, borderColor: colors.border }]}
                maxLength={32}
                returnKeyType="done"
              />

              {colorInputs.map(([key, label]) => (
                <View key={key} style={styles.colorField}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
                  <Pressable
                    style={[
                      styles.colorSelector,
                      {
                        backgroundColor: colors.surfaceSecondary,
                        borderColor: activeColorField === key ? colors.accent : colors.border,
                      },
                    ]}
                    onPress={() => setActiveColorField(activeColorField === key ? null : key)}
                    accessibilityRole="button"
                    accessibilityLabel={`${label}, ${colorFields[key].toUpperCase()}`}
                    accessibilityHint={t('settings.themeColorPickerHint')}
                    accessibilityState={{ expanded: activeColorField === key }}
                  >
                    <View
                      style={[
                        styles.swatch,
                        { backgroundColor: colorFields[key] },
                      ]}
                    />
                    <Text style={[styles.colorValue, { color: colors.text }]}>
                      {colorFields[key].toUpperCase()}
                    </Text>
                    <Ionicons
                      name={activeColorField === key ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                  {activeColorField === key ? (
                    <View
                      style={[
                        styles.colorPalettePanel,
                        { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.paletteLabel, { color: colors.textSecondary }]}>
                        {t('settings.themeChooseColor')}
                      </Text>
                      <View style={styles.colorPalette}>
                        {(
                          themeColorPalette.includes(colorFields[key].toUpperCase())
                            ? themeColorPalette
                            : [colorFields[key].toUpperCase(), ...themeColorPalette]
                        ).map((color) => {
                          const isSelected = colorFields[key].toUpperCase() === color;
                          const checkColor =
                            contrastRatio('#FFFFFF', color) > contrastRatio('#111111', color)
                              ? '#FFFFFF'
                              : '#111111';
                          return (
                            <Pressable
                              key={color}
                              style={[
                                styles.colorOption,
                                isSelected && { borderColor: colors.accent },
                              ]}
                              onPress={() => updateColor(key, color)}
                              accessibilityRole="button"
                              accessibilityLabel={`${label}, ${color}`}
                              accessibilityState={{ selected: isSelected }}
                            >
                              <View style={[styles.paletteSwatch, { backgroundColor: color }]}>
                                {isSelected ? (
                                  <Ionicons name="checkmark" size={17} color={checkColor} />
                                ) : null}
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                </View>
              ))}

              {!allColorsValid && (
                <Text style={[styles.validationText, { color: colors.destructive }]}>
                  {t('settings.themeInvalidColor')}
                </Text>
              )}
              {allColorsValid && !contrastValid && (
                <View style={styles.contrastNotice}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.accent} />
                  <Text style={[styles.validationText, styles.contrastNoticeText, { color: colors.textSecondary }]}>
                    {t('settings.themeContrastWarning', { areas: contrastAreas })}
                  </Text>
                </View>
              )}

              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t('settings.themeBackgroundImage')}
              </Text>
              {backgroundImageUri ? (
                <Image
                  source={{ uri: backgroundImageUri }}
                  style={[styles.backgroundPreview, { borderColor: colors.border }]}
                  contentFit="cover"
                />
              ) : null}
              <View style={styles.imageActions}>
                <Pressable
                  style={[styles.secondaryButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                  onPress={handlePickBackground}
                  accessibilityRole="button"
                >
                  <Ionicons name="image-outline" size={18} color={colors.accent} />
                  <Text style={[styles.buttonText, { color: colors.accent }]}>{t('settings.chooseBackgroundImage')}</Text>
                </Pressable>
                {backgroundImageUri ? (
                  <Pressable
                    style={[styles.secondaryButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                    onPress={() => setBackgroundImageUri(undefined)}
                    accessibilityRole="button"
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                    <Text style={[styles.buttonText, { color: colors.destructive }]}>{t('settings.removeBackgroundImage')}</Text>
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                style={[
                  styles.saveButton,
                  { backgroundColor: colors.accent },
                  (!name.trim() || !allColorsValid || isSaving) && styles.disabledButton,
                ]}
                onPress={handleSave}
                disabled={!name.trim() || !allColorsValid || isSaving}
                accessibilityRole="button"
              >
                <Text style={[styles.buttonText, { color: colors.surface }]}>
                  {isSaving ? t('common.loading') : t('settings.themeSave')}
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
  colorField: {
    gap: 6,
  },
  colorSelector: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 12,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(127, 127, 127, 0.5)',
  },
  colorValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  colorPalettePanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  paletteLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  colorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  colorOption: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 12,
  },
  paletteSwatch: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(127, 127, 127, 0.45)',
    borderRadius: 17,
  },
  validationText: {
    fontSize: 13,
    lineHeight: 18,
  },
  contrastNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  contrastNoticeText: {
    flex: 1,
  },
  backgroundPreview: {
    width: '100%',
    height: 120,
    borderWidth: 1,
    borderRadius: 12,
  },
  imageActions: {
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
