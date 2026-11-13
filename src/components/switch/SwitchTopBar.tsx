import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../theme/ThemeProvider';
import {
  getBatteryStatus,
  getNetworkStatus,
  addBatteryListener,
  addNetworkListener,
  BatteryStatus,
  NetworkStatus,
} from '../../../modules/nx-livecontainer';

interface SwitchTopBarProps {
  isLandscape: boolean;
  onProfilePress?: () => void;
  isConnected: boolean;
}

export const SwitchTopBar: React.FC<SwitchTopBarProps> = ({
  isLandscape,
  onProfilePress,
  isConnected,
}) => {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [currentTime, setCurrentTime] = useState('');
  const [battery, setBattery] = useState<BatteryStatus>(getBatteryStatus);
  const [network, setNetwork] = useState<NetworkStatus>(getNetworkStatus);

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(
        new Intl.DateTimeFormat(i18n.language, {
          hour: 'numeric',
          minute: '2-digit',
        }).format(new Date())
      );
    };

    updateTime();
    const clockInterval = setInterval(updateTime, 30000);
    return () => clearInterval(clockInterval);
  }, [i18n.language]);

  // Real Hardware Battery & Network Monitoring
  useEffect(() => {
    // Initial poll
    setBattery(getBatteryStatus());
    setNetwork(getNetworkStatus());

    // Native iOS event subscriptions
    const subBattery = addBatteryListener((status) => {
      if (status && typeof status.level === 'number') {
        setBattery(status);
      }
    });

    const subNetwork = addNetworkListener((status) => {
      if (status) {
        setNetwork(status);
      }
    });

    // Periodic safety poll every 15s
    const pollInterval = setInterval(() => {
      setBattery(getBatteryStatus());
      setNetwork(getNetworkStatus());
    }, 15000);

    return () => {
      subBattery?.remove?.();
      subNetwork?.remove?.();
      clearInterval(pollInterval);
    };
  }, []);

  const getBatteryColor = () => {
    if (battery.isCharging) {
      return '#34C759'; // Charging green
    }
    if (battery.level <= 10) {
      return '#FF3B30'; // Critical red
    }
    if (battery.level <= 20) {
      return '#FF9500'; // Low battery warning orange
    }
    return colors.text;
  };

  const renderBatteryIcon = () => {
    const batteryColor = getBatteryColor();

    if (battery.isCharging) {
      return <Ionicons name="battery-charging" size={18} color={batteryColor} />;
    }
    if (battery.level <= 20) {
      return <Ionicons name="battery-dead" size={18} color={batteryColor} />;
    }
    if (battery.level <= 70) {
      return <Ionicons name="battery-half" size={18} color={batteryColor} />;
    }
    return <Ionicons name="battery-full" size={18} color={batteryColor} />;
  };

  const renderNetworkIcon = () => {
    if (network.isWifi) {
      return <Ionicons name="wifi" size={15} color={colors.text} style={styles.statusIcon} />;
    }
    if (network.isCellular) {
      return <Ionicons name="cellular" size={15} color={colors.text} style={styles.statusIcon} />;
    }
    if (!network.isConnected) {
      return <Ionicons name="cloud-offline-outline" size={15} color={colors.textSecondary} style={styles.statusIcon} />;
    }
    return <Ionicons name="wifi" size={15} color={colors.text} style={styles.statusIcon} />;
  };

  return (
    <View
      style={[
        styles.container,
        isLandscape ? styles.containerLandscape : styles.containerPortrait,
        {
          paddingTop: isLandscape ? Math.max(insets.top, 4) : insets.top + 4,
          paddingLeft: Math.max(insets.left, 28),
          paddingRight: Math.max(insets.right, 28),
        },
      ]}
    >
      {/* Top Left: Switch Profile Avatar */}
      <Pressable
        style={({ pressed }) => [styles.profileBtn, pressed && styles.profileBtnPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('settings.title')}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
          onProfilePress?.();
        }}
        hitSlop={8}
      >
        <View
          style={[
            styles.avatarCircle,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Image
            source={require('../../../assets/icon.png')}
            style={{ width: 24, height: 24, borderRadius: 12 }}
          />
        </View>
        <Text style={[styles.userName, { color: colors.text }]}>NX Horizon</Text>
      </Pressable>

      {/* Top Right: Controller, Time, Real Network, Real Battery */}
      <View style={styles.systemStatusRow}>
        {isConnected && (
          <View
            style={styles.controllerPill}
            accessibilityLabel={t('settings.gamepadConnected')}
          >
            <View style={[styles.joyconLeft, styles.joyconLeftConnected]} />
            <Ionicons name="game-controller" size={13} color={colors.textSecondary} />
            <View style={[styles.joyconRight, styles.joyconRightConnected]} />
          </View>
        )}
        <Text style={[styles.clockText, { color: colors.text }]}>{currentTime}</Text>
        {renderNetworkIcon()}
        <Text style={[styles.batteryPercentText, { color: battery.isCharging ? colors.text : getBatteryColor() }]}>
          {battery.level}%
        </Text>
        {renderBatteryIcon()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 26,
    backgroundColor: 'transparent',
  },
  containerLandscape: {
    minHeight: 42,
    paddingBottom: 4,
  },
  containerPortrait: {
    minHeight: 46,
    paddingBottom: 6,
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileBtnPressed: {
    opacity: 0.8,
  },
  avatarCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    backgroundColor: '#2D2D2D',
  },
  userName: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  systemStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusIcon: {
    marginLeft: 2,
  },
  controllerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginRight: 4,
  },
  joyconLeft: {
    width: 3,
    height: 12,
    borderRadius: 1,
    backgroundColor: '#777777',
  },
  joyconLeftConnected: {
    backgroundColor: '#00D2FF',
  },
  joyconRight: {
    width: 3,
    height: 12,
    borderRadius: 1,
    backgroundColor: '#777777',
  },
  joyconRightConnected: {
    backgroundColor: '#FF3C28',
  },
  clockText: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  batteryPercentText: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    marginLeft: 2,
  },
});
