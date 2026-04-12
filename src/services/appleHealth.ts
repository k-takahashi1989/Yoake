/**
 * Apple Health stub
 *
 * react-native-health は React Native 0.84 (New Architecture) と非互換のため
 * 一時的にスタブ実装とする。
 * 対応ライブラリが整い次第、実装を追加する。
 */
import type { HCSleepData } from './healthConnect';

export type AppleHealthSleepData = HCSleepData;

export async function isAppleHealthAvailable(): Promise<boolean> {
  return false;
}

export async function requestAppleHealthPermissions(): Promise<boolean> {
  return false;
}

export async function hasAppleHealthPermission(): Promise<boolean> {
  return false;
}

export async function readAppleHealthSleepForDate(
  _date: string,
): Promise<AppleHealthSleepData | null> {
  return null;
}
