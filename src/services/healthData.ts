import { Linking, Platform } from 'react-native';
import {
  HCSleepData,
  hasHCSleepPermission,
  isHCAvailable,
  readSleepForDate,
  requestHCPermissions,
} from './healthConnect';

export type HealthSleepData = HCSleepData;

export type HealthDataPlatform = 'health_connect' | 'apple_health';

export function getHealthDataPlatform(): HealthDataPlatform {
  return Platform.OS === 'ios' ? 'apple_health' : 'health_connect';
}

export async function isSleepDataAvailable(): Promise<boolean> {
  if (Platform.OS === 'android') {
    return isHCAvailable();
  }

  return false;
}

export async function requestSleepDataPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    return requestHCPermissions();
  }

  return false;
}

export async function hasSleepDataPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    return hasHCSleepPermission();
  }

  return false;
}

export async function readSleepDataForDate(date: string): Promise<HealthSleepData | null> {
  if (Platform.OS === 'android') {
    return readSleepForDate(date);
  }

  return null;
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
