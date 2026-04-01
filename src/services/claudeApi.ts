import { getFunctions, httpsCallable as firebaseHttpsCallable } from '@react-native-firebase/functions';
import firestore from '@react-native-firebase/firestore';
import { SleepLog, UserGoal, AiReport, AiPersonality } from '../types';
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
  ageGroup?: string | null; // 年代コンテキスト
}

interface FunctionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

// ============================================================
// Firebase Functions 呼び出し（API キーはサーバー側で管理）
// ============================================================

async function callCloudFunction(
  name: string,
  data: object,
): Promise<FunctionResult> {
  const fns = getFunctions(undefined, 'asia-northeast1');
  const fn = firebaseHttpsCallable(fns, name);
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
  const sleepOnsetMap = { FAST: '5分以内', NORMAL: '15〜30分', SLOW: '30分以上' };

  const checkedHabits = log.habits.filter(h => h.checked).map(h => `${h.emoji}${h.label}`);

  const lines = [
    `【${bedStr}就寝 → ${wakeStr}起床 / ${hours}時間${mins}分 / スコア${log.score}点】`,
    `  目覚め: ${wakeFeelingMap[log.wakeFeeling]} / 寝つき: ${sleepOnsetMap[log.sleepOnset]}`,
  ];

  if (log.deepSleepMinutes !== null) {
    const remStr = log.remMinutes != null ? ` / REM: ${log.remMinutes}分` : '';
    lines.push(`  深睡眠: ${log.deepSleepMinutes}分${remStr} / 覚醒: ${log.awakenings ?? 0}回`);
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

  // 年代別コンテキスト
  const ageGroupMap: Record<string, string> = {
    teens:    '10代（推奨8〜10時間。深睡眠が多い成長期）',
    '20s_30s': '20〜30代（推奨7〜9時間。社会的ジェットラグに注意）',
    '40s_50s': '40〜50代（推奨7〜9時間。深睡眠が減少し始める年代）',
    '60plus':  '60代以上（推奨7〜8時間。深睡眠の減少は正常。早起きの傾向あり）',
  };
  if (stats?.ageGroup && ageGroupMap[stats.ageGroup]) {
    lines.push(`ユーザー年代: ${ageGroupMap[stats.ageGroup]}`);
  }

  return lines.join('\n');
}

// ============================================================
// ① 毎朝ひとこと（無料）
// ============================================================

const DAILY_SYSTEM_PROMPT = `あなたは「しろくま」という名前の睡眠の友だちです。
眠りが大好きな白熊として、毎朝ユーザーの睡眠データを見てひとことアドバイスを日本語で伝えます。

キャラクター設定：
・名前: しろくま
・性格: 穏やかで優しく、少しだけマイペース。共感してから具体的なアドバイスをする
・口調: 語尾に「〜だよ」「〜だね」「〜してみて」を自然に使う。押しつけがましくない
・ユーザーへの呼びかけ: 文中に「きみ」を1回だけ自然に使う

ルール：
・2〜3文以内で簡潔に（200文字以内）
・ポジティブで前向きなトーン（ただし過度に明るくしない）
・具体的な数字を必ず1つ以上使う
・習慣とスコアの相関があれば積極的に言及する
・前週比・3ヶ月比の数値があれば傾向として触れる
・季節の文脈も活かす
・説教くさくしない

【良い出力の例】
「昨夜は6時間50分でスコア74点だったね。就寝前の入浴が効いたのか深睡眠が15分増えてたよ。きみ、今日は水分補給をしっかりして夜に備えてみて。」
「スコア68点、先週より3点ダウンだね。木曜の深夜就寝が響いてるみたい。今夜は0時前に布団に入ることだけ意識してみてよ。」
「きみの今週の平均スコア82点、いい感じだよ。このまま就寝リズムをキープしていこうね。」`;

export async function generateDailyAdvice(
  recentLogs: SleepLog[],
  goal: UserGoal,
  stats?: Partial<SleepStats>,
  personality?: AiPersonality,
): Promise<AiReport> {
  if (recentLogs.length === 0) {
    return {
      type: 'daily',
      content: 'まだ睡眠データがないね。数日間記録してくれたら、しろくまが分析するよ。',
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

  // 性格指示をシステムプロンプトに追記
  const personalityInstruction = getPersonalityInstruction(personality);
  const systemPrompt = personalityInstruction
    ? `${DAILY_SYSTEM_PROMPT}\n\n${personalityInstruction}`
    : DAILY_SYSTEM_PROMPT;

  const result = await callCloudFunction('claudeGenerateDaily', {
    systemPrompt,
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

以下の構成で出力してください（合計400〜500文字）：
📊 今週の総評（2文・平均スコアと前週比に必ず触れる。目覚めや寝つきの傾向にも触れる）
✅ 良かった点（1〜2点・具体的な日付や数値を含める。目覚めが「すっきり」の日があれば積極的に取り上げる）
💡 改善できる点（1〜2点・原因を特定する。「〇〇をやめましょう」で終わらず、「どうすればやめられるか・始められるか」の具体的な1ステップ（行動置換・if-thenプランなど）まで必ず示す）
🎯 来週のアクション（2つ・習慣相関データ・目覚め/寝つきのパターン・メモの内容があれば根拠として活かす）

ルール：
・必ず上記の絵文字見出しを使う
・季節の要因があれば総評か改善点で触れる
・数値を積極的に使う（点数・時間・前週比など）
・ユーザーがメモを書いている日がある場合、その内容をレポートに活かす
・睡眠スコアが同じでも目覚めの主観（すっきり/ふつう/つらい）や寝つきの悪化が続く場合は必ず取り上げる
・医療的な表現は使わない`;

export async function generateWeeklyReport(
  recentLogs: SleepLog[],
  goal: UserGoal,
  stats?: Partial<SleepStats>,
  personality?: AiPersonality,
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

  // 性格指示をシステムプロンプトに追記
  const personalityInstruction = getPersonalityInstruction(personality);
  const weeklySystemPrompt = personalityInstruction
    ? `${WEEKLY_SYSTEM_PROMPT}\n\n${personalityInstruction}`
    : WEEKLY_SYSTEM_PROMPT;

  const result = await callCloudFunction('claudeGenerateWeekly', {
    systemPrompt: weeklySystemPrompt,
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
・150〜300文字程度で返答（内容が長い場合は350文字まで可）
・共感してから具体的なアドバイスを1つ提示する
・データに基づいた根拠を必ず入れる
・医療的な断言はしない

【季節・時期】${seasonText}

【ユーザーの直近の睡眠データ】
${logsText}

【統計サマリー】
${statsText}

【ユーザーの目標】${goalText}`;

// ============================================================
// AI性格ごとの追加指示文
// ============================================================

function getPersonalityInstruction(personality?: AiPersonality): string {
  switch (personality) {
    case 'gentle':
      return 'トーンの補足：常に丁寧な敬語（ですます調）で話してください。まず「つらかったですね」「よく頑張りました」と受け止めてから話し、アドバイスは1つだけ「〜してみてもいいかもしれません」のように押しつけない提案形にしてください。スコアが低くても責めないでください。';
    case 'passionate':
      return 'トーンの補足：情熱的なコーチとして「絶対いける！」「一緒に頑張ろう！」など前向きで力強い表現を使ってください。必ず数値と目標の差分を引用し、即行動できる具体的な1ステップを伝えてください。';
    case 'animal':
      return 'トーンの補足：あなたは「しろくま」という名前の睡眠アドバイザーです。冬眠のプロとして振る舞い、一人称は「ぼく」、語尾は「〜だよ」「〜だね」「〜してみてね」を使ってください。「冬眠のプロとして言うと」というフレーズを時々使ってよいです。絵文字は🐻‍❄️か🌙を1つだけ使えます。かわいい口調でも睡眠データの根拠は必ず入れてください。';
    default:
      return '';
  }
}

export async function sendChatMessage(
  userMessage: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  recentLogs: SleepLog[],
  goal: UserGoal,
  stats?: Partial<SleepStats>,
  personality?: AiPersonality,
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

  // 性格指示をシステムプロンプトに追記
  const baseChatPrompt = CHAT_SYSTEM_PROMPT_TEMPLATE(logsText, goalText, statsText, seasonText);
  const personalityInstruction = getPersonalityInstruction(personality);
  const chatSystemPrompt = personalityInstruction
    ? `${baseChatPrompt}\n\n${personalityInstruction}`
    : baseChatPrompt;

  const result = await callCloudFunction('claudeSendChatMessage', {
    systemPrompt: chatSystemPrompt,
    messages,
  });

  return result.text;
}
