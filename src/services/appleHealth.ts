import AsyncStorage from '@react-native-async-storage/async-storage';
import AppleHealthKit, {
  HealthInputOptions,
  HealthKitPermissions,
  HealthUnit,
  HealthValue,
} from 'react-native-health';
import type { HCSleepData } from './healthConnect';

export type AppleHealthSleepData = HCSleepData;

type SleepSampleValue = 'INBED' | 'ASLEEP' | 'CORE' | 'DEEP' | 'REM' | string;

interface AppleSleepSample {
  id?: string;
  startDate: string;
  endDate: string;
  value: SleepSampleValue;
  sourceId?: string;
  sourceName?: string;
  metadata?: { HKWasUserEntered?: boolean } & Record<string, string | number | boolean | undefined>;
}

interface SleepInterval {
  start: Date;
  end: Date;
}

const APPLE_HEALTH_PERMISSION_KEY = '@yoake:apple_health_permission_requested';
const HEART_RATE_UNIT = HealthUnit.bpm;
const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.HeartRate,
    ],
    write: [],
  },
};

function healthKitAvailable(): Promise<boolean> {
  return new Promise(resolve => {
    AppleHealthKit.isAvailable((_error, available) => {
      resolve(Boolean(available));
    });
  });
}

function initializeHealthKit(): Promise<void> {
  return new Promise((resolve, reject) => {
    AppleHealthKit.initHealthKit(PERMISSIONS, error => {
      if (error) {
        reject(new Error(error));
        return;
      }

      resolve();
    });
  });
}

function getSleepSamples(options: HealthInputOptions): Promise<AppleSleepSample[]> {
  return new Promise((resolve, reject) => {
    AppleHealthKit.getSleepSamples(options, (error, results) => {
      if (error) {
        reject(new Error(error));
        return;
      }

      resolve((results ?? []) as unknown as AppleSleepSample[]);
    });
  });
}

function getHeartRateSamples(options: HealthInputOptions): Promise<HealthValue[]> {
  return new Promise((resolve, reject) => {
    AppleHealthKit.getHeartRateSamples(options, (error, results) => {
      if (error) {
        reject(new Error(error));
        return;
      }

      resolve(results ?? []);
    });
  });
}

function clipInterval(
  start: Date,
  end: Date,
  boundaryStart: Date,
  boundaryEnd: Date,
): SleepInterval | null {
  const clippedStart = new Date(Math.max(start.getTime(), boundaryStart.getTime()));
  const clippedEnd = new Date(Math.min(end.getTime(), boundaryEnd.getTime()));

  if (clippedEnd <= clippedStart) return null;

  return { start: clippedStart, end: clippedEnd };
}

function mergeIntervals(intervals: SleepInterval[]): SleepInterval[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: SleepInterval[] = [{ ...sorted[0] }];

  for (const interval of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (interval.start <= last.end) {
      if (interval.end > last.end) {
        last.end = interval.end;
      }
      continue;
    }

    merged.push({ ...interval });
  }

  return merged;
}

function sumIntervalMinutes(intervals: SleepInterval[]): number {
  return mergeIntervals(intervals).reduce((total, interval) => {
    return total + Math.round((interval.end.getTime() - interval.start.getTime()) / 60000);
  }, 0);
}

function clusterIntervals(intervals: SleepInterval[], maxGapMs: number): SleepInterval[] {
  if (intervals.length === 0) return [];

  const clusters: SleepInterval[][] = [];
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());

  for (const interval of sorted) {
    const currentCluster = clusters[clusters.length - 1];
    if (!currentCluster) {
      clusters.push([{ ...interval }]);
      continue;
    }

    const last = currentCluster[currentCluster.length - 1];
    const gapMs = interval.start.getTime() - last.end.getTime();
    if (gapMs <= maxGapMs) {
      currentCluster.push({ ...interval });
      continue;
    }

    clusters.push([{ ...interval }]);
  }

  return clusters
    .map(cluster => mergeIntervals(cluster))
    .sort((a, b) => {
      const aDuration = sumIntervalMinutes(a);
      const bDuration = sumIntervalMinutes(b);
      if (bDuration !== aDuration) return bDuration - aDuration;

      return b[b.length - 1].end.getTime() - a[a.length - 1].end.getTime();
    })[0];
}

function overlaps(interval: SleepInterval, boundary: SleepInterval): boolean {
  return interval.start < boundary.end && interval.end > boundary.start;
}

function deriveSleepSession(
  samples: AppleSleepSample[],
  searchStart: Date,
  searchEnd: Date,
): Omit<AppleHealthSleepData, 'heartRateAvg'> | null {
  const clippedSamples = samples
    .map(sample => {
      const start = new Date(sample.startDate);
      const end = new Date(sample.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

      const interval = clipInterval(start, end, searchStart, searchEnd);
      if (!interval) return null;

      return {
        value: sample.value,
        metadata: sample.metadata,
        interval,
      };
    })
    .filter((sample): sample is NonNullable<typeof sample> => sample !== null)
    .filter(sample => sample.metadata?.HKWasUserEntered !== true);

  if (clippedSamples.length === 0) return null;

  const isSleepValue = (value: SleepSampleValue) =>
    value === 'ASLEEP' || value === 'CORE' || value === 'DEEP' || value === 'REM';

  const sleepIntervals = clippedSamples
    .filter(sample => isSleepValue(sample.value))
    .map(sample => sample.interval);
  const inBedIntervals = clippedSamples
    .filter(sample => sample.value === 'INBED')
    .map(sample => sample.interval);

  const baseIntervals = sleepIntervals.length > 0 ? sleepIntervals : inBedIntervals;
  if (baseIntervals.length === 0) return null;

  const mainCluster = clusterIntervals(baseIntervals, 90 * 60 * 1000);
  if (mainCluster.length === 0) return null;

  const clusterBoundary: SleepInterval = {
    start: mainCluster[0].start,
    end: mainCluster[mainCluster.length - 1].end,
  };

  const relevantSleepIntervals = sleepIntervals.filter(interval => overlaps(interval, clusterBoundary));
  const relevantInBedIntervals = inBedIntervals.filter(interval => overlaps(interval, {
    start: new Date(clusterBoundary.start.getTime() - 2 * 60 * 60 * 1000),
    end: new Date(clusterBoundary.end.getTime() + 2 * 60 * 60 * 1000),
  }));

  const bedTime = relevantInBedIntervals.length > 0
    ? new Date(Math.min(...relevantInBedIntervals.map(interval => interval.start.getTime())))
    : clusterBoundary.start;
  const wakeTime = relevantInBedIntervals.length > 0
    ? new Date(Math.max(...relevantInBedIntervals.map(interval => interval.end.getTime())))
    : clusterBoundary.end;
  const totalMinutes = Math.round((wakeTime.getTime() - bedTime.getTime()) / 60000);

  const startHour = bedTime.getHours();
  if (totalMinutes < 360 && startHour >= 10 && startHour < 18) {
    return null;
  }

  const hasStageBreakdown = clippedSamples.some(sample => {
    return overlaps(sample.interval, clusterBoundary)
      && (sample.value === 'DEEP' || sample.value === 'CORE' || sample.value === 'REM');
  });

  const collectStageMinutes = (stage: SleepSampleValue) => {
    return sumIntervalMinutes(
      clippedSamples
        .filter(sample => sample.value === stage && overlaps(sample.interval, clusterBoundary))
        .map(sample => sample.interval),
    );
  };

  const mergedSleepIntervals = mergeIntervals(relevantSleepIntervals);
  const awakenings = mergedSleepIntervals.length > 1
    ? mergedSleepIntervals.slice(1).filter((interval, index) => {
        const previous = mergedSleepIntervals[index];
        const gapMinutes = (interval.start.getTime() - previous.end.getTime()) / 60000;
        return gapMinutes >= 5 && gapMinutes <= 120;
      }).length
    : null;

  return {
    bedTime,
    wakeTime,
    totalMinutes,
    deepSleepMinutes: hasStageBreakdown ? collectStageMinutes('DEEP') : null,
    remMinutes: hasStageBreakdown ? collectStageMinutes('REM') : null,
    lightSleepMinutes: hasStageBreakdown ? collectStageMinutes('CORE') : null,
    awakenings,
  };
}

async function ensureAppleHealthInitialized(prompt: boolean): Promise<boolean> {
  const available = await healthKitAvailable();
  if (!available) return false;

  const cached = (await AsyncStorage.getItem(APPLE_HEALTH_PERMISSION_KEY)) === '1';
  if (!prompt && !cached) {
    return false;
  }

  try {
    await initializeHealthKit();
    await AsyncStorage.setItem(APPLE_HEALTH_PERMISSION_KEY, '1');
    return true;
  } catch {
    if (!prompt) {
      await AsyncStorage.removeItem(APPLE_HEALTH_PERMISSION_KEY);
    }
    return false;
  }
}

async function readHeartRateAverage(startDate: Date, endDate: Date): Promise<number | null> {
  try {
    const results = await getHeartRateSamples({
      unit: HEART_RATE_UNIT,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ascending: true,
    });

    const validValues = results
      .filter(sample => sample.metadata?.HKWasUserEntered !== true)
      .map(sample => sample.value)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

    if (validValues.length === 0) return null;

    const total = validValues.reduce((sum, value) => sum + value, 0);
    return Math.round(total / validValues.length);
  } catch {
    return null;
  }
}

export async function isAppleHealthAvailable(): Promise<boolean> {
  return healthKitAvailable();
}

export async function requestAppleHealthPermissions(): Promise<boolean> {
  return ensureAppleHealthInitialized(true);
}

export async function hasAppleHealthPermission(): Promise<boolean> {
  return ensureAppleHealthInitialized(false);
}

export async function readAppleHealthSleepForDate(
  date: string,
): Promise<AppleHealthSleepData | null> {
  const initialized = await ensureAppleHealthInitialized(false);
  if (!initialized) return null;

  const [year, month, day] = date.split('-').map(Number);
  const searchStart = new Date(year, month - 1, day - 1, 12, 0, 0);
  const searchEnd = new Date(year, month - 1, day, 12, 0, 0);

  try {
    const sleepSamples = await getSleepSamples({
      startDate: searchStart.toISOString(),
      endDate: searchEnd.toISOString(),
      ascending: true,
      limit: 500,
      includeManuallyAdded: false,
    });

    const session = deriveSleepSession(sleepSamples, searchStart, searchEnd);
    if (!session) return null;

    const heartRateAvg = await readHeartRateAverage(session.bedTime, session.wakeTime);

    return {
      ...session,
      heartRateAvg,
    };
  } catch {
    return null;
  }
}
