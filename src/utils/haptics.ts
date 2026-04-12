import { Platform, Vibration } from 'react-native';
import { trigger } from 'react-native-haptic-feedback';

const HAPTIC_OPTIONS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

function runHaptic(type: Parameters<typeof trigger>[0], androidFallback?: number | number[]) {
  try {
    trigger(type, HAPTIC_OPTIONS);
    return;
  } catch {
    if (androidFallback && Platform.OS === 'android') {
      Vibration.vibrate(androidFallback);
      return;
    }

    if (Platform.OS === 'ios') {
      Vibration.vibrate();
    }
  }
}

export const haptics = {
  light: () => {
    runHaptic('impactLight', 8);
  },
  success: () => {
    runHaptic('notificationSuccess', [0, 12, 50, 8]);
  },
  warning: () => {
    runHaptic('notificationWarning', [0, 20, 40, 20]);
  },
};
