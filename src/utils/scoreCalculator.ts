import { SleepLog, ScoreBreakdown, ScoreInfo } from '../types';
import { SCORE_THRESHOLDS, SCORE_LABELS, SCORE_COLORS } from '../constants';
import { safeToDate } from './dateUtils';

// ============================================================
// Health Connectあり スコア計算（100点満点）
// ============================================================

function calcSleepDurationScore(totalMinutes: number): number {
  const hours = totalMinutes / 60;
  if (hours >= 7.5 && hours <= 9) return 30;
  if (hours >= 7) return 25;
  if (hours >= 6) return 18;
  if (hours >= 5) return 10;
  return 5;
}

function calcBedTimeScore(bedTime: Date): number {
  const hour = bedTime.getHours();
  const minute = bedTime.getMinutes();
  const decimalHour = hour + minute / 60;

  // 22〜23時
  if (decimalHour >= 22 && decimalHour < 23) return 20;
  // 23〜24時
  if (decimalHour >= 23 && decimalHour < 24) return 15;
  // 0〜1時
  if (decimalHour >= 0 && decimalHour < 1) return 15;
  // 1〜2時
  if (decimalHour >= 1 && decimalHour < 2) return 8;
  return 3;
}

function calcDeepSleepScore(totalMinutes: number, deepSleepMinutes: number | null): number {
  if (deepSleepMinutes === null || totalMinutes === 0) return 0;
  const ratio = deepSleepMinutes / totalMinutes;
  if (ratio >= 0.20) return 15;
  if (ratio >= 0.15) return 11;
  if (ratio >= 0.10) return 7;
  return 3;
}

function calcWakeFeelingScore(wakeFeeling: string): number {
  if (wakeFeeling === 'GOOD') return 15;
  if (wakeFeeling === 'NORMAL') return 9;
  return 3;
}

function calcContinuityScore(awakenings: number | null): number {
  if (awakenings === null) return 0;
  if (awakenings === 0) return 10;
  if (awakenings === 1) return 8;
  if (awakenings === 2) return 5;
  if (awakenings === 3) return 2;
  return 0;
}

function calcSleepOnsetScore(sleepOnset: string): number {
  if (sleepOnset === 'FAST') return 10;
  if (sleepOnset === 'NORMAL') return 6;
  return 2;
}

// ============================================================
// 手動入力のみ スコア計算（100点満点）
// ============================================================

function calcSleepDurationScoreManual(totalMinutes: number): number {
  const hours = totalMinutes / 60;
  if (hours >= 7.5 && hours <= 9) return 40;
  if (hours >= 7) return 33;
  if (hours >= 6) return 24;
  if (hours >= 5) return 14;
  return 7;
}

function calcBedTimeScoreManual(bedTime: Date): number {
  const hour = bedTime.getHours();
  const minute = bedTime.getMinutes();
  const decimalHour = hour + minute / 60;

  if (decimalHour >= 22 && decimalHour < 23) return 25;
  if (decimalHour >= 23 && decimalHour < 24) return 19;
  if (decimalHour >= 0 && decimalHour < 1) return 19;
  if (decimalHour >= 1 && decimalHour < 2) return 10;
  return 4;
}

function calcWakeFeelingScoreManual(wakeFeeling: string): number {
  if (wakeFeeling === 'GOOD') return 20;
  if (wakeFeeling === 'NORMAL') return 12;
  return 4;
}

function calcSleepOnsetScoreManual(sleepOnset: string): number {
  if (sleepOnset === 'FAST') return 15;
  if (sleepOnset === 'NORMAL') return 9;
  return 3;
}

// ============================================================
// 継続ボーナス・ペナルティ（直近7日の就寝時刻ばらつき）
// ============================================================

function calcConsistencyBonus(recentLogs: SleepLog[]): number {
  if (recentLogs.length < 3) return 0;

  const bedTimes = recentLogs.map(log => {
    const d = safeToDate(log.bedTime);
    return d.getHours() * 60 + d.getMinutes();
  });

  const mean = bedTimes.reduce((a, b) => a + b, 0) / bedTimes.length;
  const variance = bedTimes.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / bedTimes.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev < 20) return 5;
  if (stdDev < 40) return 2;
  if (stdDev > 90) return -5;
  return 0;
}

// ============================================================
// メインのスコア計算
// ============================================================

export function calculateScore(
  log: Omit<SleepLog, 'score' | 'sleepDebtMinutes' | 'createdAt' | 'updatedAt'>,
  recentLogs: SleepLog[] = [],
): { score: number; breakdown: ScoreBreakdown } {
  const hasHealthConnect = log.source === 'HEALTH_CONNECT' &&
    log.deepSleepMinutes !== null;

  const bedTimeDate = safeToDate(log.bedTime);
  const hours = log.totalMinutes / 60;

  let breakdown: ScoreBreakdown;

  if (hasHealthConnect) {
    const sleepDuration = calcSleepDurationScore(log.totalMinutes);
    const bedTime = calcBedTimeScore(bedTimeDate);
    const deepSleep = calcDeepSleepScore(log.totalMinutes, log.deepSleepMinutes);
    const wakeFeeling = calcWakeFeelingScore(log.wakeFeeling);
    const continuity = calcContinuityScore(log.awakenings);
    const sleepOnset = calcSleepOnsetScore(log.sleepOnset);
    const consistencyBonus = calcConsistencyBonus(recentLogs);
    const oversleepPenalty = hours > 9 ? -5 : 0;

    const total = Math.max(0, Math.min(100,
      sleepDuration + bedTime + deepSleep + wakeFeeling + continuity + sleepOnset +
      consistencyBonus + oversleepPenalty,
    ));

    breakdown = {
      sleepDuration, bedTime, deepSleep, wakeFeeling,
      continuity, sleepOnset, consistencyBonus, oversleepPenalty, total,
    };
  } else {
    const sleepDuration = calcSleepDurationScoreManual(log.totalMinutes);
    const bedTime = calcBedTimeScoreManual(bedTimeDate);
    const wakeFeeling = calcWakeFeelingScoreManual(log.wakeFeeling);
    const sleepOnset = calcSleepOnsetScoreManual(log.sleepOnset);
    const consistencyBonus = calcConsistencyBonus(recentLogs);
    const oversleepPenalty = hours > 9 ? -5 : 0;

    const total = Math.max(0, Math.min(100,
      sleepDuration + bedTime + wakeFeeling + sleepOnset +
      consistencyBonus + oversleepPenalty,
    ));

    breakdown = {
      sleepDuration, bedTime, deepSleep: 0, wakeFeeling,
      continuity: 0, sleepOnset, consistencyBonus, oversleepPenalty, total,
    };
  }

  return { score: breakdown.total, breakdown };
}

// ============================================================
// スコアラベル・色
// ============================================================

export function getScoreInfo(score: number): ScoreInfo {
  if (score >= SCORE_THRESHOLDS.EXCELLENT) {
    return { label: SCORE_LABELS.EXCELLENT, color: 'green' };
  }
  if (score >= SCORE_THRESHOLDS.GOOD) {
    return { label: SCORE_LABELS.GOOD, color: 'yellowGreen' };
  }
  if (score >= SCORE_THRESHOLDS.NORMAL) {
    return { label: SCORE_LABELS.NORMAL, color: 'yellow' };
  }
  if (score >= SCORE_THRESHOLDS.POOR) {
    return { label: SCORE_LABELS.POOR, color: 'orange' };
  }
  return { label: SCORE_LABELS.BAD, color: 'red' };
}

// ============================================================
// 睡眠負債計算（直近14日）
// ============================================================

export function calculateSleepDebt(
  recentLogs: SleepLog[],
  targetHours: number,
): number {
  const targetMinutes = targetHours * 60;
  return recentLogs.reduce((debt, log) => {
    const diff = targetMinutes - log.totalMinutes;
    return debt + (diff > 0 ? diff : 0);
  }, 0);
}
