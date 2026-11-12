import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  useWindowDimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  isLiveContainerLinked,
  isLiveContainerModuleAvailable,
  pickLiveContainerFolder,
} from '../../../modules/nx-livecontainer';
import { useAppTheme } from '../../theme/ThemeProvider';

interface OnboardingModalProps {
  visible: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLinkingFolder, setIsLinkingFolder] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkedFolder, setLinkedFolder] = useState(() => isLiveContainerLinked());
  const totalSlides = 4;

  useEffect(() => {
    if (visible) {
      setLinkedFolder(isLiveContainerLinked());
      setLinkError('');
    }
  }, [visible]);

  const handleLinkFolder = async () => {
    if (!isLiveContainerModuleAvailable()) {
      setLinkError(t('onboarding.linkFolderUnavailable'));
      return;
    }

    setIsLinkingFolder(true);
    setLinkError('');
    try {
      const result = await pickLiveContainerFolder();
      if (result.isLinked) {
        setLinkedFolder(isLiveContainerLinked());
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      } else if (!result.cancelled) {
        setLinkError(t('onboarding.linkFolderError'));
      }
    } catch (error) {
      console.warn('[Onboarding] Could not link LiveContainer folder:', error);
      setLinkError(t('onboarding.linkFolderError'));
    } finally {
      setIsLinkingFolder(false);
    }
  };

  const handleNext = () => {
    if (isLinkingFolder) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleFinish = () => {
    if (isLinkingFolder) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    setCurrentSlide(0);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      presentationStyle="fullScreen"
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
      onRequestClose={handleFinish}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top', 'bottom', 'left', 'right']}
      >
        <StatusBar hidden />
          {/* Top Header Bar */}
          <View style={[styles.topHeader, { borderBottomColor: colors.border }]}>
            <View style={styles.brandRow}>
              <Ionicons name="game-controller" size={18} color={colors.accent} />
              <Text style={[styles.brandText, { color: colors.accentStrong }]}>NX HORIZON</Text>
            </View>
            <Pressable
              style={[styles.skipBtn, isLinkingFolder && styles.disabledAction]}
              onPress={handleFinish}
              disabled={isLinkingFolder}
              hitSlop={10}
            >
              <Text style={[styles.skipBtnText, { color: colors.textSecondary }]}>{t('onboarding.skip')}</Text>
            </Pressable>
          </View>

          {/* Slide Content */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={[
              styles.scrollContent,
              isLandscape && styles.scrollContentLandscape,
            ]}
            scrollEnabled={!isLandscape}
            showsVerticalScrollIndicator={false}
          >
            {/* SLIDE 0: Welcome */}
            {currentSlide === 0 && (
              <View style={[styles.slideCard, isLandscape && styles.slideCardLandscape]}>
                <View
                  style={[
                    styles.slideOverview,
                    isLandscape && styles.slideOverviewLandscape,
                  ]}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: colors.surface, borderColor: colors.accent },
                      isLandscape && styles.iconCircleLandscape,
                    ]}
                  >
                    <Ionicons name="sparkles" size={isLandscape ? 34 : 48} color={colors.accent} />
                  </View>
                  <Text style={[styles.slideTitle, { color: colors.text }, isLandscape && styles.slideTitleLandscape]}>
                    {t('onboarding.welcomeTitle')}
                  </Text>
                  <Text
                    style={[
                      styles.slideSubtitle,
                      { color: colors.accentStrong },
                      isLandscape && styles.slideSubtitleLandscape,
                    ]}
                  >
                    {t('onboarding.welcomeSubtitle')}
                  </Text>
                </View>
                <View style={[styles.slideDetails, isLandscape && styles.slideDetailsLandscape]}>
                  <Text style={[styles.slideDesc, { color: colors.textSecondary }]}>{t('onboarding.welcomeDesc')}</Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.linkFolderButton,
                      pressed && styles.linkFolderButtonPressed,
                      isLinkingFolder && styles.disabledAction,
                    ]}
                    onPress={handleLinkFolder}
                    disabled={isLinkingFolder}
                    accessibilityRole="button"
                    accessibilityLabel={t('onboarding.linkContainerNow')}
                  >
                    {isLinkingFolder ? (
                      <ActivityIndicator size="small" color={colors.surface} />
                    ) : (
                      <Ionicons
                        name={linkedFolder.isLinked ? 'checkmark-circle' : 'folder-open'}
                        size={19}
                        color={colors.surface}
                      />
                    )}
                    <Text style={[styles.linkFolderButtonText, { color: colors.surface }]}>
                      {isLinkingFolder
                        ? t('onboarding.linkingFolder')
                        : linkedFolder.isLinked
                          ? t('onboarding.changeLinkedFolder')
                          : t('onboarding.linkContainerNow')}
                    </Text>
                    {!isLinkingFolder && (
                      <Ionicons name="chevron-forward" size={16} color={colors.surface} />
                    )}
                  </Pressable>
                  {linkedFolder.isLinked && (
                    <Text style={[styles.linkFolderSuccess, { color: colors.success }]}>
                      {t('onboarding.folderLinked', {
                        folder: 'LiveContainer',
                      })}
                    </Text>
                  )}
                  {linkError ? <Text style={[styles.linkFolderError, { color: colors.destructive }]}>{linkError}</Text> : null}
                </View>
              </View>
            )}

            {/* SLIDE 1: NX2Apple Compilation Requirement */}
            {currentSlide === 1 && (
              <View style={[styles.slideCard, isLandscape && styles.slideCardLandscape]}>
                <View
                  style={[
                    styles.slideOverview,
                    isLandscape && styles.slideOverviewLandscape,
                  ]}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: colors.surface, borderColor: colors.destructive },
                      isLandscape && styles.iconCircleLandscape,
                    ]}
                  >
                    <Ionicons name="cube-outline" size={isLandscape ? 32 : 46} color={colors.destructive} />
                  </View>
                  <Text style={[styles.slideTitle, { color: colors.text }, isLandscape && styles.slideTitleLandscape]}>
                    {t('onboarding.nx2appleTitle')}
                  </Text>
                  <Text
                    style={[
                      styles.slideSubtitle,
                      { color: colors.destructive },
                      isLandscape && styles.slideSubtitleLandscape,
                    ]}
                  >
                    {t('onboarding.nx2appleSubtitle')}
                  </Text>
                </View>
                <View style={[styles.slideDetails, isLandscape && styles.slideDetailsLandscape]}>
                  <View
                    style={[
                      styles.alertCard,
                      { backgroundColor: colors.accentSurface, borderColor: colors.destructive },
                      isLandscape && styles.alertCardCompact,
                    ]}
                  >
                    <Ionicons
                      name="warning-outline"
                      size={20}
                      color={colors.destructive}
                      style={{ marginTop: 2 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.alertCardTitle, { color: colors.destructive }]}>
                        {t('onboarding.standaloneRequired')}
                      </Text>
                      <Text style={[styles.alertCardText, { color: colors.textSecondary }]}>{t('onboarding.nx2appleDesc')}</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {currentSlide === 2 && (
              <View style={[styles.slideCard, isLandscape && styles.slideCardLandscape]}>
                <View
                  style={[
                    styles.slideOverview,
                    isLandscape && styles.slideOverviewLandscape,
                  ]}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: colors.surface, borderColor: colors.accent },
                      isLandscape && styles.iconCircleLandscape,
                    ]}
                  >
                    <Ionicons name="link" size={isLandscape ? 32 : 46} color={colors.accent} />
                  </View>
                  <Text style={[styles.slideTitle, { color: colors.text }, isLandscape && styles.slideTitleLandscape]}>
                    {t('onboarding.livecontainerTitle')}
                  </Text>
                  <Text
                    style={[
                      styles.slideSubtitle,
                      { color: colors.accentStrong },
                      isLandscape && styles.slideSubtitleLandscape,
                    ]}
                  >
                    {t('onboarding.livecontainerSubtitle')}
                  </Text>
                </View>
                <View style={[styles.slideDetails, isLandscape && styles.slideDetailsLandscape]}>
                  <View
                    style={[
                      styles.stepsContainer,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      isLandscape && styles.stepsContainerLandscape,
                    ]}
                  >
                    <View style={styles.stepRow}>
                      <View style={[styles.stepNum, { backgroundColor: colors.surfaceSecondary }]}>
                        <Text style={[styles.stepNumText, { color: colors.textSecondary }]}>1</Text>
                      </View>
                      <Text style={[styles.stepDescText, { color: colors.textSecondary }]}>{t('onboarding.step1')}</Text>
                    </View>

                    <View style={styles.stepRow}>
                      <View style={[styles.stepNum, { backgroundColor: colors.surfaceSecondary }]}>
                        <Text style={[styles.stepNumText, { color: colors.textSecondary }]}>2</Text>
                      </View>
                      <Text style={[styles.stepDescText, { color: colors.textSecondary }]}>{t('onboarding.step2')}</Text>
                    </View>

                    <View style={styles.stepRow}>
                      <View style={[styles.stepNum, { backgroundColor: colors.surfaceSecondary }]}>
                        <Text style={[styles.stepNumText, { color: colors.textSecondary }]}>3</Text>
                      </View>
                      <Text style={[styles.stepDescText, { color: colors.textSecondary }]}>{t('onboarding.step3')}</Text>
                    </View>

                    <View style={styles.stepRow}>
                      <View style={[styles.stepNum, { backgroundColor: colors.accent }]}>
                        <Text style={[styles.stepNumTextHighlight, { color: colors.surface }]}>4</Text>
                      </View>
                      <Text style={[styles.stepDescText, { color: colors.accentStrong, fontWeight: '700' }]}>
                        {t('onboarding.step4')}
                      </Text>
                    </View>

                    <View style={styles.stepRow}>
                      <View style={[styles.stepNum, { backgroundColor: colors.surfaceSecondary }]}>
                        <Text style={[styles.stepNumText, { color: colors.textSecondary }]}>5</Text>
                      </View>
                      <Text style={[styles.stepDescText, { color: colors.textSecondary }]}>{t('onboarding.step5')}</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {currentSlide === 3 && (
              <View style={[styles.slideCard, isLandscape && styles.slideCardLandscape]}>
                <View
                  style={[
                    styles.slideOverview,
                    isLandscape && styles.slideOverviewLandscape,
                  ]}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: colors.surface, borderColor: colors.success },
                      isLandscape && styles.iconCircleLandscape,
                    ]}
                  >
                    <Ionicons name="flash" size={isLandscape ? 32 : 46} color={colors.success} />
                  </View>
                  <Text style={[styles.slideTitle, { color: colors.text }, isLandscape && styles.slideTitleLandscape]}>
                    {t('onboarding.directBootTitle')}
                  </Text>
                  <Text
                    style={[
                      styles.slideSubtitle,
                      { color: colors.success },
                      isLandscape && styles.slideSubtitleLandscape,
                    ]}
                  >
                    {t('onboarding.directBootSubtitle')}
                  </Text>
                </View>
                <View style={[styles.slideDetails, isLandscape && styles.slideDetailsLandscape]}>
                  <View
                    style={[
                      styles.alertCard,
                      { backgroundColor: colors.accentSurface, borderColor: colors.success },
                      isLandscape && styles.alertCardCompact,
                    ]}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={20}
                      color={colors.success}
                      style={{ marginTop: 2 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.alertCardTitle, { color: colors.success }]}>
                        {t('onboarding.directBootEnabled')}
                      </Text>
                      <Text style={[styles.alertCardText, { color: colors.textSecondary }]}>
                        {t('onboarding.directBootDesc')}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Bottom Pagination & Navigation Controls */}
          <View style={[styles.bottomNav, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
            <View style={styles.navLeft}>
              {currentSlide > 0 ? (
                <Pressable style={styles.navBtnSecondary} onPress={handleBack}>
                  <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
                  <Text style={[styles.navBtnSecondaryText, { color: colors.textSecondary }]}>{t('onboarding.back')}</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Dots Indicator */}
            <View style={styles.dotsRow}>
              {Array.from({ length: totalSlides }).map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    { backgroundColor: colors.border },
                    idx === currentSlide && { backgroundColor: colors.accent },
                    idx === currentSlide && styles.dotActive,
                  ]}
                />
              ))}
            </View>

            <View style={styles.navRight}>
              <Pressable
                style={({ pressed }) => [
                  styles.navBtnPrimary,
                  { backgroundColor: colors.accent },
                  pressed && styles.navBtnPrimaryPressed,
                ]}
                onPress={handleNext}
              >
                <Text style={[styles.navBtnPrimaryText, { color: colors.surface }]}>
                  {currentSlide === totalSlides - 1 ? t('onboarding.finish') : t('onboarding.next')}
                </Text>
                <Ionicons
                  name={currentSlide === totalSlides - 1 ? 'checkmark' : 'chevron-forward'}
                  size={16}
                  color={colors.surface}
                />
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1C',
  },
  topHeader: {
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2C',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#00D2FF',
    letterSpacing: 1.5,
  },
  skipBtn: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipBtnText: {
    fontSize: 13,
    color: '#8E8E8E',
    fontWeight: '600',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContentLandscape: {
    width: '100%',
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  slideCard: {
    width: '100%',
    maxWidth: 720,
    alignItems: 'center',
  },
  slideCardLandscape: {
    flexDirection: 'row',
    width: '100%',
    alignSelf: 'stretch',
    maxWidth: 920,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
  },
  slideOverview: {
    width: '100%',
    alignItems: 'center',
  },
  slideOverviewLandscape: {
    width: '33%',
    maxWidth: 280,
  },
  slideDetails: {
    width: '100%',
    alignItems: 'center',
  },
  slideDetailsLandscape: {
    width: '60%',
    maxWidth: 520,
    justifyContent: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#262626',
    borderWidth: 2,
    borderColor: '#00D2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#00D2FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  iconCircleLandscape: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 6,
  },
  slideTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  slideTitleLandscape: {
    fontSize: 18,
    marginBottom: 4,
  },
  slideSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00D2FF',
    textAlign: 'center',
    marginBottom: 10,
  },
  slideSubtitleLandscape: {
    fontSize: 12,
    marginBottom: 0,
  },
  slideDesc: {
    fontSize: 14,
    color: '#C4C8CB',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 460,
  },
  linkFolderButton: {
    width: '100%',
    maxWidth: 400,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#1686A0',
  },
  linkFolderButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  linkFolderButtonText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  disabledAction: {
    opacity: 0.55,
  },
  linkFolderSuccess: {
    marginTop: 8,
    fontSize: 12,
    color: '#7DD3A7',
    textAlign: 'center',
  },
  linkFolderError: {
    marginTop: 8,
    fontSize: 12,
    color: '#FCA5A5',
    textAlign: 'center',
  },
  alertCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#2B2313',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    padding: 12,
    marginVertical: 14,
  },
  alertCardCompact: {
    marginVertical: 4,
    padding: 10,
  },
  directBootAlert: {
    backgroundColor: '#132E27',
    borderColor: '#10B981',
  },
  alertCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
    marginBottom: 4,
  },
  alertCardText: {
    fontSize: 12,
    color: '#FDE68A',
    lineHeight: 18,
  },
  stepsContainer: {
    width: '100%',
    backgroundColor: '#242424',
    borderRadius: 10,
    padding: 14,
    gap: 10,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  stepsContainerLandscape: {
    marginVertical: 0,
    padding: 8,
    gap: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#383838',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumHighlight: {
    backgroundColor: '#00D2FF',
  },
  stepNumText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#CCCCCC',
  },
  stepNumTextHighlight: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  stepDescText: {
    flex: 1,
    fontSize: 11,
    color: '#E0E0E0',
    lineHeight: 15,
  },
  stepDescTextHighlight: {
    color: '#00D2FF',
    fontWeight: '700',
  },
  bottomNav: {
    height: 58,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2C',
    backgroundColor: '#1C1C1C',
  },
  navLeft: {
    width: 90,
    alignItems: 'flex-start',
  },
  navRight: {
    width: 110,
    alignItems: 'flex-end',
  },
  navBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  navBtnSecondaryText: {
    fontSize: 13,
    color: '#A0A0A0',
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#444444',
  },
  dotActive: {
    width: 18,
    backgroundColor: '#00D2FF',
  },
  navBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    gap: 4,
    backgroundColor: '#00D2FF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  navBtnPrimaryPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  navBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: 0.5,
  },
});
