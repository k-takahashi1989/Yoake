import {
  initialize,
  getSdkStatus,
  requestPermission,
  getGrantedPermissions,
  readRecords,
  SdkAvailabilityStatus,
  SleepStageType,
} from 'react-native-health-connect';

// ============================================================
// 型定義
// ============================================================

export interface HCSleepData {
  bedTime: Date;
  wakeTime: Date;
  totalMinutes: number;
  deepSleepMinutes: number | null;
  remMinutes: number | null;
  lightSleepMinutes: number | null;
  awakenings: number | null;
  heartRateAvg: number | null;
}

const SLEEP_PERMISSION = { accessType: 'read', recordType: 'SleepSession' } as const;
const HEART_RATE_PERMISSION = { accessType: 'read', recordType: 'HeartRate' } as const;

// ============================================================
// SDK 初期化 & 利用可否確認
// ============================================================

let _initialized = false;

export async function isHCAvailable(): Promise<boolean> {
  try {
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return false;
    if (!_initialized) {
      _initialized = await initialize();
    }
    return _initialized;
  } catch {
    return false;
  }
}

// ============================================================
// 権限
// ============================================================

export async function requestHCPermissions(): Promise<boolean> {
  try {
    const available = await isHCAvailable();
    if (!available) return false;
    const granted = await requestPermission([SLEEP_PERMISSION, HEART_RATE_PERMISSION]);
    return granted.some(p => (p as any).recordType === 'SleepSession');
  } catch {
    return false;
  }
}

export async function hasHCSleepPermission(): Promise<boolean> {
  try {
    const available = await isHCAvailable();
    if (!available) return false;
    const granted = await getGrantedPermissions();
    return granted.some(p => (p as any).recordType === 'SleepSession' && (p as any).accessType === 'read');
  } catch {
    return false;
  }
}

// ============================================================
// 睡眠データ取得
// ============================================================

/**
 * 指定日の睡眠データを Health Connect から取得する。
 * 昼寝（6時間未満かつ昼帯）は除外する。
 * 複数セッションある場合は最長を採用する。
 */
export async function readSleepForDate(date: string): Promise<HCSleepData | null> {
  try {
    // 対象日の前日正午 〜 当日正午まで検索（深夜就寝に対応）
    const [year, month, day] = date.split('-').map(Number);
    const searchStart = new Date(year, month - 1, day - 1, 12, 0, 0);
    const searchEnd = new Date(year, month - 1, day, 12, 0, 0);

    const { records } = await readRecords('SleepSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: searchStart.toISOString(),
        endTime: searchEnd.toISOString(),
      },
    });

    if (records.length === 0) return null;

    // 昼寝除外: 6時間未満かつ start が 10:00〜18:00 の間
    const validRecords = records.filter(r => {
      const start = new Date(r.startTime);
      const end = new Date(r.endTime);
      const durationMin = (end.getTime() - start.getTime()) / 60000;
      const startHour = start.getHours();
      if (durationMin < 360 && startHour >= 10 && startHour < 18) return false;
      return true;
    });

    if (validRecords.length === 0) return null;

    // 最長セッションを採用
    const best = validRecords.reduce((prev, cur) => {
      const pd = new Date(prev.endTime).getTime() - new Date(prev.startTime).getTime();
      const cd = new Date(cur.endTime).getTime() - new Date(cur.startTime).getTime();
      return cd > pd ? cur : prev;
    });

    const bedTime = new Date(best.startTime);
    const wakeTime = new Date(best.endTime);
    const totalMinutes = Math.round((wakeTime.getTime() - bedTime.getTime()) / 60000);

    // Sleep stage 集計
    let deepSleepMinutes: number | null = null;
    let remMinutes: number | null = null;
    let lightSleepMinutes: number | null = null;
    let awakenings: number | null = null;

    const stages = best.stages ?? [];
    if (stages.length > 0) {
      deepSleepMinutes = 0;
      remMinutes = 0;
      lightSleepMinutes = 0;
      awakenings = 0;

      for (const stage of stages) {
        const stageDuration = Math.round(
          (new Date(stage.endTime).getTime() - new Date(stage.startTime).getTime()) / 60000,
        );
        switch (stage.stage) {
          case SleepStageType.DEEP:
            deepSleepMinutes += stageDuration;
            break;
          case SleepStageType.REM:
            remMinutes += stageDuration;
            break;
          case SleepStageType.LIGHT:
            lightSleepMinutes += stageDuration;
            break;
          case SleepStageType.AWAKE:
            awakenings += 1;
            break;
        }
      }
    }

    // 心拍数（同時間帯の平均）
    let heartRateAvg: number | null = null;
    try {
      const { records: hrRecords } = await readRecords('HeartRate', {
        timeRangeFilter: {
          operator: 'between',
          startTime: bedTime.toISOString(),
          endTime: wakeTime.toISOString(),
        },
      });

      if (hrRecords.length > 0) {
        const allSamples = hrRecords.flatMap(r => r.samples);
        if (allSamples.length > 0) {
          const sum = allSamples.reduce((acc, s) => acc + s.beatsPerMinute, 0);
          heartRateAvg = Math.round(sum / allSamples.length);
        }
      }
    } catch {
      // 心拍数は必須ではないので握りつぶす
    }

    return {
      bedTime,
      wakeTime,
      totalMinutes,
      deepSleepMinutes,
      remMinutes,
      lightSleepMinutes,
      awakenings,
      heartRateAvg,
    };
  } catch (e) {
    console.error('HC sleep read error:', e);
    return null;
  }
}
