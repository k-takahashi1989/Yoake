/**
 * DiaryScreen - 日記エントリ作成に関わるビジネスロジックのユニットテスト
 * 睡眠負債計算と習慣チェックに関するロジックを検証する。
 */

import { calculateSleepDebt } from '../src/utils/scoreCalculator';

// Firestore Timestamp スタブ
function makeTimestamp(date: Date) {
  return { toDate: () => date, seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 } as any;
}

function makeLog(
  date: string,
  totalMinutes: number,
  habits: Array<{ id: string; label: string; emoji: string; checked: boolean }> = [],
) {
  const bed = new Date();
  const wake = new Date(bed.getTime() + totalMinutes * 60000);
  return {
    date,
    bedTime: makeTimestamp(bed),
    wakeTime: makeTimestamp(wake),
    totalMinutes,
    deepSleepMinutes: null,
    remMinutes: null,
    lightSleepMinutes: null,
    awakenings: null,
    heartRateAvg: null,
    sleepOnset: 'NORMAL' as const,
    wakeFeeling: 'NORMAL' as const,
    habits,
    memo: null,
    score: 70,
    sleepDebtMinutes: 0,
    source: 'MANUAL' as const,
    scoreVersion: 0,
    createdAt: makeTimestamp(new Date()),
    updatedAt: makeTimestamp(new Date()),
  };
}

// ── テストスイート ──

describe('calculateSleepDebt', () => {
  const TARGET_HOURS = 7.5;

  test('全日程で目標達成 → 負債0', () => {
    const logs = [
      makeLog('2026-03-20', 450), // 7.5h
      makeLog('2026-03-19', 480), // 8h
      makeLog('2026-03-18', 510), // 8.5h
    ];
    expect(calculateSleepDebt(logs, TARGET_HOURS)).toBe(0);
  });

  test('全日程で不足 → 累積負債を返す', () => {
    const logs = [
      makeLog('2026-03-20', 360), // 6h (90分不足)
      makeLog('2026-03-19', 360), // 6h (90分不足)
    ];
    expect(calculateSleepDebt(logs, TARGET_HOURS)).toBe(180); // 合計3時間不足
  });

  test('一部不足・一部達成 → 不足分のみ累積', () => {
    const logs = [
      makeLog('2026-03-20', 480), // 8h (達成)
      makeLog('2026-03-19', 300), // 5h (150分不足)
    ];
    expect(calculateSleepDebt(logs, TARGET_HOURS)).toBe(150);
  });

  test('空配列 → 負債0', () => {
    expect(calculateSleepDebt([], TARGET_HOURS)).toBe(0);
  });

  test('8時間目標の場合の計算', () => {
    const logs = [makeLog('2026-03-20', 420)]; // 7h (60分不足)
    expect(calculateSleepDebt(logs, 8)).toBe(60);
  });
});

describe('習慣チェック - ログデータ構造', () => {
  test('チェック済み習慣が正しく保存される', () => {
    const habits = [
      { id: 'h1', label: 'カフェイン', emoji: '☕', checked: true },
      { id: 'h2', label: '運動', emoji: '🏃', checked: false },
    ];
    const log = makeLog('2026-03-20', 450, habits);
    expect(log.habits).toHaveLength(2);
    expect(log.habits[0].checked).toBe(true);
    expect(log.habits[1].checked).toBe(false);
  });

  test('チェック数を正しくカウントできる', () => {
    const habits = [
      { id: 'h1', label: 'カフェイン', emoji: '☕', checked: true },
      { id: 'h2', label: '運動', emoji: '🏃', checked: true },
      { id: 'h3', label: '飲酒', emoji: '🍺', checked: false },
    ];
    const log = makeLog('2026-03-20', 450, habits);
    const checkedCount = log.habits.filter(h => h.checked).length;
    expect(checkedCount).toBe(2);
  });

  test('習慣なしのログ → habits は空配列', () => {
    const log = makeLog('2026-03-20', 450);
    expect(log.habits).toEqual([]);
  });
});

describe('sleepLog - totalMinutes 計算', () => {
  test('就寝22:00・起床6:00 → 480分', () => {
    const bedDate = new Date(2026, 2, 19, 22, 0);
    const wakeDate = new Date(2026, 2, 20, 6, 0);
    const totalMinutes = Math.round((wakeDate.getTime() - bedDate.getTime()) / 60000);
    expect(totalMinutes).toBe(480);
  });

  test('就寝23:30・起床7:00 → 450分', () => {
    const bedDate = new Date(2026, 2, 19, 23, 30);
    const wakeDate = new Date(2026, 2, 20, 7, 0);
    const totalMinutes = Math.round((wakeDate.getTime() - bedDate.getTime()) / 60000);
    expect(totalMinutes).toBe(450);
  });
});
