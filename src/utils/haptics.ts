import { Vibration, Platform } from 'react-native';

/**
 * 触覚フィードバックユーティリティ。
 * Android は Vibration API で代替。
 * iOS は将来 react-native-haptic-feedback を導入した際にここを差し替える。
 */
export const haptics = {
  /** 軽いタップ感触（ボタン押下・送信など） */
  light: () => {
    if (Platform.OS === 'android') Vibration.vibrate(8);
  },
  /** 成功フィードバック（保存完了・記録完了など） */
  success: () => {
    if (Platform.OS === 'android') Vibration.vibrate([0, 12, 50, 8]);
  },
  /** 警告フィードバック（エラー・制限到達など） */
  warning: () => {
    if (Platform.OS === 'android') Vibration.vibrate([0, 20, 40, 20]);
  },
};
