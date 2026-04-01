import { format, subDays } from 'date-fns';
import { SleepLog } from '../types';

/**
 * recentLogs（日付降順）から連続記録日数を計算する。
 * - 今日 or 昨日に記録がある場合のみストリークを開始
 * - 1日でも途切れたらそこで終了
 */
export function calculateStreak(logs: SleepLog[]): number {
  if (logs.length === 0) return 0;

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  // 日付の重複を除いて降順ソート
  const dates = [...new Set(logs.map(l => l.date))].sort().reverse();

  // 最新記録が今日でも昨日でもなければストリーク0
  if (dates[0] !== today && dates[0] !== yesterday) return 0;

  let streak = 0;
  // Hermes互換: new Date("yyyy/MM/dd") は Hermes で Invalid Date になるため
  // new Date(year, month-1, day) 形式でパースする（dateUtils.ts と同じ方針）
  const [cy, cm, cd] = dates[0].split('-').map(Number);
  let cursor = new Date(cy, cm - 1, cd);

  for (const dateStr of dates) {
    const expected = format(cursor, 'yyyy-MM-dd');
    if (dateStr === expected) {
      streak++;
      cursor = subDays(cursor, 1);
    } else {
      break;
    }
  }

  return streak;
}
