/**
 * SleepInputForm - 睡眠スコア計算ロジックのユニットテスト
 * calculateScore を使って就寝・起床時刻パターンごとのスコアを検証する。
 * (コンポーネント描画には多数のネイティブモックが必要なため、ビジネスロジック層でテスト)
 */

// Firebase モジュールを使わないため、pure なユーティリティのみインポート
import { calculateScore, getScoreInfo } from '../src/utils/scoreCalculator';

// Firestore Timestamp の簡易スタブ
function makeTimestamp(date: Date) {
  return {
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  } as any;
}

function makeLog(bedDate: Date, wakeDate: Date, extra?: Partial<Parameters<typeof calculateScore>[0]>) {
  const totalMinutes = Math.round((wakeDate.getTime() - bedDate.getTime()) / 60000);
  return {
    date: '2026-03-20',
    bedTime: makeTimestamp(bedDate),
    wakeTime: makeTimestamp(wakeDate),
    totalMinutes,
    deepSleepMinutes: null,
    remMinutes: null,
    lightSleepMinutes: null,
    awakenings: null,
    heartRateAvg: null,
    sleepOnset: 'NORMAL' as const,
    wakeFeeling: 'NORMAL' as const,
    habits: [],
    memo: null,
    source: 'MANUAL' as const,
    scoreVersion: 0,
    ...extra,
  };
}

// ── テストスイート ──

describe('calculateScore - 手動入力モード', () => {
  test('7.5時間・22時就寝・FAST onset・GOOD feeling → 高スコア(≥80)', () => {
    const bed = new Date(2026, 2, 19, 22, 30); // 22:30
    const wake = new Date(2026, 2, 20, 6, 0);  // 6:00 (7.5h)
    const { score } = calculateScore(
      makeLog(bed, wake, { sleepOnset: 'FAST', wakeFeeling: 'GOOD' }),
      [],
    );
    expect(score).toBeGreaterThanOrEqual(80);
  });

  test('5時間未満・深夜3時就寝・SLOW onset・BAD feeling → 低スコア(≤40)', () => {
    const bed = new Date(2026, 2, 20, 3, 0);   // 3:00
    const wake = new Date(2026, 2, 20, 7, 45); // 7:45 (4h45m)
    const { score } = calculateScore(
      makeLog(bed, wake, { sleepOnset: 'SLOW', wakeFeeling: 'BAD' }),
      [],
    );
    expect(score).toBeLessThanOrEqual(40);
  });

  test('8時間・23時就寝・NORMAL onset・NORMAL feeling → 中高スコア(60〜90)', () => {
    const bed = new Date(2026, 2, 19, 23, 0);
    const wake = new Date(2026, 2, 20, 7, 0); // 8h
    const { score } = calculateScore(makeLog(bed, wake), []);
    expect(score).toBeGreaterThanOrEqual(60);
    expect(score).toBeLessThanOrEqual(90);
  });

  test('スコアは 0〜100 の範囲内', () => {
    const bed = new Date(2026, 2, 20, 4, 0);
    const wake = new Date(2026, 2, 20, 5, 0); // 1h
    const { score } = calculateScore(
      makeLog(bed, wake, { sleepOnset: 'SLOW', wakeFeeling: 'BAD' }),
      [],
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('10時間超の寝すぎはペナルティが適用され完璧スコアにならない', () => {
    const bed = new Date(2026, 2, 19, 22, 0);
    const wake = new Date(2026, 2, 20, 8, 30); // 10.5h
    const { score: sleepyScore } = calculateScore(
      makeLog(bed, wake, { sleepOnset: 'FAST', wakeFeeling: 'GOOD' }),
      [],
    );
    const bed2 = new Date(2026, 2, 19, 22, 0);
    const wake2 = new Date(2026, 2, 20, 6, 0); // 8h (適正)
    const { score: normalScore } = calculateScore(
      makeLog(bed2, wake2, { sleepOnset: 'FAST', wakeFeeling: 'GOOD' }),
      [],
    );
    expect(sleepyScore).toBeLessThan(normalScore);
  });
});

describe('calculateScore - エッジケース', () => {
  test('日またぎ就寝: 23:30就寝 → 翌7:00起床 = 450分', () => {
    const bed = new Date(2026, 2, 19, 23, 30); // 23:30
    const wake = new Date(2026, 2, 20, 7, 0);  // 翌7:00
    const totalMinutes = Math.round((wake.getTime() - bed.getTime()) / 60000);
    expect(totalMinutes).toBe(450);
    const { score } = calculateScore(makeLog(bed, wake), []);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('9時間ちょうど(540分)はペナルティなし・適正範囲内スコア', () => {
    const bed = new Date(2026, 2, 19, 22, 0);
    const wake = new Date(2026, 2, 20, 7, 0); // 9h = 540min
    const { score, breakdown } = calculateScore(
      makeLog(bed, wake, { sleepOnset: 'FAST', wakeFeeling: 'GOOD' }),
      [],
    );
    // 9時間は上限ギリギリ → oversleepPenalty は発動しないはず
    expect(breakdown.oversleepPenalty).toBe(0);
    expect(score).toBeGreaterThanOrEqual(70);
  });

  test('HC データあり vs なし: 同じ時間でスコアが異なる（deepSleepMinutes の有無）', () => {
    const bed = new Date(2026, 2, 19, 23, 0);
    const wake = new Date(2026, 2, 20, 7, 0); // 8h
    const manualLog = makeLog(bed, wake);
    const hcLog = makeLog(bed, wake, {
      source: 'HEALTH_CONNECT' as const,
      deepSleepMinutes: 90,
      remMinutes: 100,
      lightSleepMinutes: 150,
      awakenings: 2,
    });
    const { score: manualScore } = calculateScore(manualLog, []);
    const { score: hcScore } = calculateScore(hcLog, []);
    // HC ありとなしでスコアが違うことを確認
    expect(manualScore).not.toBe(hcScore);
  });
});

describe('getScoreInfo', () => {
  test('90点以上 → score.excellent', () => {
    expect(getScoreInfo(95).labelKey).toBe('score.excellent');
  });

  test('75〜89点 → score.good', () => {
    expect(getScoreInfo(80).labelKey).toBe('score.good');
  });

  test('60〜74点 → score.normal', () => {
    expect(getScoreInfo(65).labelKey).toBe('score.normal');
  });

  test('40〜59点 → score.poor', () => {
    expect(getScoreInfo(50).labelKey).toBe('score.poor');
  });

  test('39点以下 → score.bad', () => {
    expect(getScoreInfo(30).labelKey).toBe('score.bad');
  });
});
