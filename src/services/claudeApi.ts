import functions from '@react-native-firebase/functions';
import firestore from '@react-native-firebase/firestore';
import { SleepLog, UserGoal, AiReport } from '../types';
import { AI_CONFIG } from '../constants';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { safeToDate } from '../utils/dateUtils';

// ============================================================
// 型定義
// ============================================================

export interface SleepStats {
  avgScore: number;
  prevPeriodAvgScore: number | null;
  threeMonthAvgScore: number | null;
  topPositiveHabit: { label: string; emoji: string; diff: number } | null;
  topNegativeHabit: { label: string; emoji: string; diff: number } | null;
}

interface FunctionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

// ============================================================
// Firebase Functions 呼び出し（API キーはサーバー側で管理）
// ============================================================

const cloudFunctions = functions();

async function callCloudFunction(
  name: string,
  data: object,
): Promise<FunctionResult> {
  const fn = cloudFunctions.httpsCallable(name);
  const result = await fn(data);
  return result.data as FunctionResult;
}

// ============================================================
// ヘルパー（プロンプト構築）
// ============================================================

function formatSleepLogForPrompt(log: SleepLog): string {
  const bedTime = safeToDate(log.bedTime);
  const wakeTime = safeToDate(log.wakeTime);
  const bedStr = format(bedTime, 'M月d日 HH:mm', { locale: ja });
  const wakeStr = format(wakeTime, 'HH:mm', { locale: ja });
  const hours = Math.floor(log.totalMinutes / 60);
  const mins = log.totalMinutes % 60;

  const wakeFeelingMap = { GOOD: 'すっきり', NORMAL: 'ふつう', BAD: 'つらい' };
  const sleepOnsetMap = { FAST: '速い', NORMAL: '普通', SLOW: '遅い' };

  const checkedHabits = log.habits.filter(h => h.checked).map(h => `${h.emoji}${h.label}`);

  const lines = [
    `【${bedStr}就寝 → ${wakeStr}起床 / ${hours}時間${mins}分 / スコア${log.score}点】`,
    `  目覚め: ${wakeFeelingMap[log.wakeFeeling]} / 寝つき: ${sleepOnsetMap[log.sleepOnset]}`,
  ];

  if (log.deepSleepMinutes !== null) {
    lines.push(`  深睡眠: ${log.deepSleepMinutes}分 / 覚醒: ${log.awakenings ?? 0}回`);
  }
  if (checkedHabits.length > 0) {
    lines.push(`  習慣: ${checkedHabits.join(', ')}`);
  }
  if (log.memo) {
    lines.push(`  メモ: ${log.memo}`);
  }

  return lines.join('\n');
}

function formatGoalForPrompt(goal: UserGoal): string {
  const lines = [
    `目標睡眠時間: ${goal.targetHours}時間`,
    `目標スコア: ${goal.targetScore}点以上`,
  ];
  if (goal.bedTimeTarget) {
    lines.push(`目標就寝時刻: ${goal.bedTimeTarget}`);
  }
  return lines.join(' / ');
}

function getSeasonContext(): string {
  const month = new Date().getMonth() + 1;
  const map: Record<number, string> = {
    1:  '1月・冬（日照時間が短く体内時計が乱れやすい時期）',
    2:  '2月・冬（寒さのピーク。就寝前の体温管理が重要）',
    3:  '3月・春（気温変動・花粉の影響が出やすい時期）',
    4:  '4月・春（新生活による生活リズムの変化に注意）',
    5:  '5月・春（気候は良いが五月病に注意）',
    6:  '6月・初夏（梅雨で気圧変動。熱帯夜が始まる時期）',
    7:  '7月・夏（熱帯夜・エアコン使用で睡眠の質が下がりやすい）',
    8:  '8月・真夏（熱帯夜が最も多い時期）',
    9:  '9月・秋（台風・気温低下。睡眠改善のチャンス）',
    10: '10月・秋（睡眠の質が上がりやすい季節）',
    11: '11月・秋（日照時間が短くなりメラトニン分泌が増加）',
    12: '12月・冬（忘年会シーズン。飲酒による睡眠質低下に注意）',
  };
  return map[month] ?? '';
}

function buildStatsText(logs: SleepLog[], stats: Partial<SleepStats> | undefined): string {
  const avgScore = logs.length > 0
    ? Math.round(logs.reduce((s, l) => s + l.score, 0) / logs.length)
    : 0;

  const prev = stats?.prevPeriodAvgScore ?? null;
  const three = stats?.threeMonthAvgScore ?? null;

  let scoreLine = `平均スコア: ${avgScore}点`;
  if (prev !== null) {
    const d = avgScore - prev;
    scoreLine += `（前週比 ${d >= 0 ? '+' : ''}${d}点`;
    if (three !== null) {
      const d3 = avgScore - three;
      scoreLine += `、3ヶ月平均比 ${d3 >= 0 ? '+' : ''}${d3}点`;
    }
    scoreLine += '）';
  }

  const lines = [scoreLine];

  const pos = stats?.topPositiveHabit;
  const neg = stats?.topNegativeHabit;
  if (pos) lines.push(`スコアが上がりやすい習慣: ${pos.emoji}${pos.label}（+${pos.diff}点）`);
  if (neg) lines.push(`スコアが下がりやすい習慣: ${neg.emoji}${neg.label}（${neg.diff}点）`);

  return lines.join('\n');
}

// ============================================================
// ① 毎朝ひとこと（無料）
// ============================================================

const DAILY_SYSTEM_PROMPT = `あなたは「ヨアケ」という名前の睡眠コーチAIです。
毎朝、ユーザーの睡眠データを見てひとことアドバイスを日本語で伝えます。

ルール：
・2〜3文以内で簡潔に
・ポジティブで前向きなトーン（ただし過度に明るくしない）
・具体的な数字を必ず1つ以上使う
・習慣とスコアの相関があれば積極的に言及する
・前週比・3ヶ月比の数値があれば傾向として触れる
・季節の文脈も活かす
・説教くさくしない

【良い出力の例】
「昨夜は6時間50分でスコア74点。就寝前の入浴が効いたのか、深睡眠が15分増えてました。今日は水分補給をしっかりして夜に備えましょう。」
「スコア68点、先週より3点ダウン。木曜の深夜就寝が響いてますね。今夜は0時前に布団に入ることだけ意識してみて。」`;

export async function generateDailyAdvice(
  recentLogs: SleepLog[],
  goal: UserGoal,
  stats?: Partial<SleepStats>,
): Promise<AiReport> {
  if (recentLogs.length === 0) {
    return {
      type: 'daily',
      content: 'データが溜まったら分析します。まずは数日間記録を続けてみましょう！',
      generatedAt: firestore.Timestamp.now(),
      inputSummary: 'no_data',
      modelUsed: AI_CONFIG.MODEL,
      tokenCount: 0,
    };
  }

  const logsText = recentLogs
    .slice(0, AI_CONFIG.DAILY_REPORT_CONTEXT_DAYS)
    .map(formatSleepLogForPrompt)
    .join('\n');

  const statsText = buildStatsText(recentLogs, stats);
  const seasonText = getSeasonContext();
  const goalText = formatGoalForPrompt(goal);

  const userMessage = [
    `【季節・時期】${seasonText}`,
    '',
    '【直近の睡眠データ】',
    logsText,
    '',
    '【統計サマリー】',
    statsText,
    '',
    `【ユーザーの目標】${goalText}`,
  ].join('\n');

  const result = await callCloudFunction('claudeGenerateDaily', {
    systemPrompt: DAILY_SYSTEM_PROMPT,
    userMessage,
  });

  return {
    type: 'daily',
    content: result.text,
    generatedAt: firestore.Timestamp.now(),
    inputSummary: userMessage.slice(0, 200),
    modelUsed: AI_CONFIG.MODEL,
    tokenCount: result.inputTokens + result.outputTokens,
  };
}

// ============================================================
// ② 週次AIレポート（有料）
// ============================================================

const WEEKLY_SYSTEM_PROMPT = `あなたは「ヨアケ」という名前の睡眠コーチAIです。
ユーザーの1週間の睡眠データを分析し、週次レポートを日本語で作成してください。

以下の構成で出力してください（合計300〜400文字）：
📊 今週の総評（2文・平均スコアと前週比に必ず触れる）
✅ 良かった点（1〜2点・具体的な日付や数値を含める）
💡 改善できる点（1〜2点・原因を特定して具体的に）
🎯 来週のアクション（2つ・習慣相関データがあれば活かす）

ルール：
・必ず上記の絵文字見出しを使う
・季節の要因があれば総評か改善点で触れる
・数値を積極的に使う（点数・時間・前週比など）
・医療的な表現は使わない`;

export async function generateWeeklyReport(
  recentLogs: SleepLog[],
  goal: UserGoal,
  stats?: Partial<SleepStats>,
): Promise<AiReport> {
  const logsText = recentLogs
    .slice(0, AI_CONFIG.CONTEXT_DAYS)
    .map(formatSleepLogForPrompt)
    .join('\n');

  const statsText = buildStatsText(recentLogs, stats);
  const seasonText = getSeasonContext();
  const goalText = formatGoalForPrompt(goal);

  const userMessage = [
    `【季節・時期】${seasonText}`,
    '',
    `【直近14日の睡眠データ（${recentLogs.length}日分）】`,
    logsText,
    '',
    '【統計サマリー】',
    statsText,
    '',
    `【ユーザーの目標】${goalText}`,
  ].join('\n');

  const result = await callCloudFunction('claudeGenerateWeekly', {
    systemPrompt: WEEKLY_SYSTEM_PROMPT,
    userMessage,
  });

  return {
    type: 'weekly',
    content: result.text,
    generatedAt: firestore.Timestamp.now(),
    inputSummary: userMessage.slice(0, 300),
    modelUsed: AI_CONFIG.MODEL,
    tokenCount: result.inputTokens + result.outputTokens,
  };
}

// ============================================================
// ③ AIチャット（有料）
// ============================================================

const CHAT_SYSTEM_PROMPT_TEMPLATE = (
  logsText: string,
  goalText: string,
  statsText: string,
  seasonText: string,
) =>
  `あなたは「ヨアケ」という名前の睡眠コーチAIです。
ユーザーの睡眠改善を親身にサポートします。

トーン：
・フレンドリーなタメ口（馴れ馴れしすぎない）
・200文字以内で返答（長くても300文字まで）
・共感してから具体的なアドバイスを1つ提示する
・データに基づいた根拠を必ず入れる
・医療的な断言はしない

【季節・時期】${seasonText}

【ユーザーの直近の睡眠データ】
${logsText}

【統計サマリー】
${statsText}

【ユーザーの目標】${goalText}`;

export async function sendChatMessage(
  userMessage: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  recentLogs: SleepLog[],
  goal: UserGoal,
  stats?: Partial<SleepStats>,
): Promise<string> {
  const logsText = recentLogs
    .slice(0, AI_CONFIG.CONTEXT_DAYS)
    .map(formatSleepLogForPrompt)
    .join('\n');

  const statsText = buildStatsText(recentLogs, stats);
  const seasonText = getSeasonContext();
  const goalText = formatGoalForPrompt(goal);

  const limitedHistory = history.slice(-AI_CONFIG.CHAT_HISTORY_LIMIT);
  const messages = [
    ...limitedHistory,
    { role: 'user' as const, content: userMessage },
  ];

  const result = await callCloudFunction('claudeSendChatMessage', {
    systemPrompt: CHAT_SYSTEM_PROMPT_TEMPLATE(logsText, goalText, statsText, seasonText),
    messages,
  });

  return result.text;
}
