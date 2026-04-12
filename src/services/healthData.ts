import { Linking, Platform } from 'react-native';
import type { SleepSource } from '../types';
import {
  HCSleepData,
  hasHCSleepPermission,
  isHCAvailable,
  readSleepForDate,
  requestHCPermissions,
} from './healthConnect';
import {
  hasAppleHealthPermission,
  isAppleHealthAvailable,
  readAppleHealthSleepForDate,
  requestAppleHealthPermissions,
} from './appleHealth';

export type HealthSleepData = HCSleepData;

export type HealthDataPlatform = 'health_connect' | 'apple_health';

export function getHealthDataPlatform(): HealthDataPlatform {
  return Platform.OS === 'ios' ? 'apple_health' : 'health_connect';
}

export function getNativeHealthSource(): Exclude<SleepSource, 'MANUAL'> {
  return Platform.OS === 'ios' ? 'APPLE_HEALTH' : 'HEALTH_CONNECT';
}

export function isHealthDataSource(source: SleepSource): boolean {
  return source === 'HEALTH_CONNECT' || source === 'APPLE_HEALTH';
}

export function getImportedHealthSourceLabelKey(
  source: SleepSource,
): 'common.hcSource' | 'common.appleHealthSource' {
  if (source === 'APPLE_HEALTH') {
    return 'common.appleHealthSource';
  }

  if (source === 'HEALTH_CONNECT' && Platform.OS === 'ios') {
    return 'common.appleHealthSource';
  }

  return 'common.hcSource';
}

export async function isSleepDataAvailable(): Promise<boolean> {
  if (Platform.OS === 'android') {
    return isHCAvailable();
  }

  return isAppleHealthAvailable();
}

export async function requestSleepDataPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    return requestHCPermissions();
  }

  return requestAppleHealthPermissions();
}

export async function hasSleepDataPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    return hasHCSleepPermission();
  }

  return hasAppleHealthPermission();
}

export async function readSleepDataForDate(date: string): Promise<HealthSleepData | null> {
  if (Platform.OS === 'android') {
    return readSleepForDate(date);
  }

  return readAppleHealthSleepForDate(date);
}

export async function openHealthDataProviderApp(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    await Linking.openURL('android-app://com.google.android.apps.healthdata');
    return true;
  } catch {
    return false;
  }
}

export async function openHealthDataProviderStorePage(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    await Linking.openURL('market://details?id=com.google.android.apps.healthdata');
    return true;
  } catch {
    await Linking.openURL(
      'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata',
    );
    return true;
  }
}
