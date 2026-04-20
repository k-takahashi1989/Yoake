import { SleepLog } from '../../../types';
import { safeToDate } from '../../../utils/dateUtils';

export interface HabitStat {
  id: string;
  label: string;
  withAvg: number;
  withoutAvg: number;
  withCount: number;
  withoutCount: number;
}

export type ScorePeriod = '7' | '14' | '30';

export function computeHabitStats(logs: SleepLog[]): HabitStat[] {
  const map = new Map<
    string,
    { label: string; withScores: number[]; withoutScores: number[] }
  >();

  for (const log of logs) {
    for (const h of (log.habits ?? [])) {
      if (!map.has(h.id)) {
        map.set(h.id, { label: h.label, withScores: [], withoutScores: [] });
      }
      const entry = map.get(h.id)!;
      if (h.checked) entry.withScores.push(log.score);
      else entry.withoutScores.push(log.score);
    }
  }

  const result: HabitStat[] = [];
  for (const [id, data] of map.entries()) {
    // 実行・未実行の各グループで最低3件ないと統計的な差として意味を持たないため除外
    if (data.withScores.length < 3 || data.withoutScores.length < 3) continue;
    const avg = (arr: number[]) =>
      arr.length > 0
        ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length)
        : 0;
    result.push({
      id,
      label: data.label,
      withAvg: avg(data.withScores),
      withoutAvg: avg(data.withoutScores),
      withCount: data.withScores.length,
      withoutCount: data.withoutScores.length,
    });
  }

  return result.sort(
    (a, b) =>
      Math.abs(b.withAvg - b.withoutAvg) - Math.abs(a.withAvg - a.withoutAvg),
  );
}

export function buildLineData(
  logs: SleepLog[],
  period: ScorePeriod,
): Array<{ value: number; label: string }> {
  const labelEveryN = period === '7' ? 1 : period === '14' ? 2 : 5;
  const sliced = logs.slice(0, Number(period));
  const chronological = [...sliced].reverse();
  return chronological.map((log, i) => {
    const d = safeToDate(log.date);
    const label =
      i % labelEveryN === 0
        ? `${d.getMonth() + 1}/${d.getDate()}`
        : '';
    return { value: log.score, label };
  });
}
