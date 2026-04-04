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
  topPositiveHabit: { label: string; diff: number } | null;
  topNegativeHabit: { label: string; diff: number } | null;
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

  const wakeFeelingMap: Record<string, string> = { GOOD: 'すっきり', NORMAL: 'ふつう', BAD: 'つらい' };
  const sleepOnsetMap: Record<string, string> = { FAST: 'すぐ寝れた', NORMAL: '少し時間かかった', SLOW: 'なかなか寝れなかった' };

  (wakeFeelingMap as Record<string, string>).SLIGHTLY_GOOD = 'ややすっきり';
  (wakeFeelingMap as Record<string, string>).SLIGHTLY_BAD = 'ややつらい';
  (sleepOnsetMap as Record<string, string>).SLIGHTLY_FAST = 'やや寝つき良い';
  (sleepOnsetMap as Record<string, string>).SLIGHTLY_SLOW = 'やや寝つき悪い';

  const checkedHabits = log.habits.filter(h => h.checked).map(h => h.label);

  // @ts-ignore legacy localized map is extended just above for the new 5-step values
  const lines = [
    `【${bedStr}就寝 → ${wakeStr}起床 / ${hours}時間${mins}分 / スコア${log.score}点】`,
    `  目覚め: ${wakeFeelingMap[log.wakeFeeling]} / 寝つき: ${sleepOnsetMap[log.sleepOnset]}`,
  ];

  if (log.deepSleepMinutes !== null && log.deepSleepMinutes !== undefined) {
    // 深睡眠の総睡眠に対する比率を算出（AIがしきい値判定に使えるよう付与）
    const deepRatio = log.totalMinutes > 0
      ? Math.round((log.deepSleepMinutes / log.totalMinutes) * 100)
      : 0;
    const remStr = log.remMinutes != null ? ` / REM: ${log.remMinutes}分` : '';
    lines.push(`  深睡眠: ${log.deepSleepMinutes}分（${deepRatio}%）${remStr} / 覚醒: ${log.awakenings ?? 0}回`);
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
  if (pos) lines.push(`スコアが上がりやすい習慣: ${pos.label}（+${pos.diff}点）`);
  if (neg) lines.push(`スコアが下がりやすい習慣: ${neg.label}（${neg.diff}点）`);

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

const DAILY_SYSTEM_PROMPT = `あなたは睡眠分析AIです。毎朝、ユーザーの睡眠データを見て簡潔なひとことを日本語で伝えます。

【出力フォーマット】
・1文目: 昨夜の結果サマリー（睡眠時間 and/or スコアを含める）
・2文目: データに基づく気づき1つ（習慣相関・前週比・睡眠ステージなど）
・3文目（任意）: 今日できる具体的な行動提案1つ
・合計2〜3文、150文字程度（最大200文字）

【トーン】
・落ち着いたですます調。過度な明るさ・馴れ馴れしさは避ける
・説教しない。「〜かもしれません」「〜を試してみてください」程度の表現
・スコア85点以上のときは肯定のみでよい。無理に改善点を探さない
・スコア40点未満が3日以上続く場合は「生活リズム全体の見直し」を穏やかに提案する

【数値の使い方】
・必ず1つ以上の数値を含める
・優先順位: スコア > 睡眠時間 > 前週比 > 深睡眠比率
・深睡眠が総睡眠の13%未満の場合のみ「深睡眠がやや少なめ」と触れてよい。それ以外は言及不要
・寝つき「5分以内」が3日以上連続する場合は「すぐ寝付けるのは睡眠負債の可能性もあります」と触れてよい

【アドバイスの原則】
・提案は1回に1つだけ
・禁止形（「〜をやめましょう」）は使わず、代替行動を提案する
  × 「カフェインを控えましょう」
  ○ 「午後はカフェインレスに切り替えてみてください」
・習慣相関データがある場合はそれを根拠にする

【安全弁】
・「目覚め: つらい」が5日以上連続する場合は「睡眠外来への相談も選択肢です」と1度だけ触れる
・医療的な診断・断言は絶対にしない

【良い出力の例】
「昨夜は7時間15分、スコア81点でした。入浴した日のスコアは平均+6点の傾向があり、昨夜もその効果が出ている可能性があります。この調子で就寝リズムを維持してみてください。」
「昨夜はスコア73点、6時間50分でした。前週比-5点で、就寝が30分遅れた影響かもしれません。今夜は23時までに布団に入ることを試してみてください。」
「スコア88点、7時間半の睡眠でした。就寝リズムも安定しており、良い状態が続いています。」`;

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

const INSIGHT_SYSTEM_PROMPT = `You are "Yoake", a sleep coach AI. Write a short Japanese insight for a sleep detail screen.
Your job is to interpret one target sleep record.

Output requirements:
- Natural Japanese only
- 2 to 4 short sentences
- Roughly 70 to 140 Japanese characters
- Calm, observant, and supportive tone

What to focus on:
- What stands out in the target sleep record
- One likely reason only when the data supports it
- Use nearby records only as light context
- Use memo or checked habits only when they clearly help interpretation

Rules:
- No headings, bullets, or emoji
- Do not write a full daily report
- Do not moralize or give generic advice
- Do not say "today" or "tonight" unless the input explicitly marks the target date as today
- Prioritize interpretation over motivation`;

export async function generateLogInsight(
  targetLog: SleepLog,
  referenceLogs: SleepLog[],
  goal?: UserGoal | null,
  ageGroup?: string | null,
  personality?: AiPersonality,
): Promise<AiReport> {
  const targetText = formatSleepLogForPrompt(targetLog);
  const referenceText = referenceLogs
    .slice(0, 6)
    .map(formatSleepLogForPrompt)
    .join('\n');
  const goalText = goal ? formatGoalForPrompt(goal) : '未設定';
  const isToday = targetLog.date === format(new Date(), 'yyyy-MM-dd');

  const userMessage = [
    `【対象日】${targetLog.date}${isToday ? '（今日）' : ''}`,
    '',
    '【対象の睡眠記録】',
    targetText,
    referenceText ? '' : '',
    referenceText ? '【参考: 直近の睡眠記録】' : '',
    referenceText,
    '',
    `【ユーザーの目標】${goalText}`,
    ageGroup ? `【年齢層】${ageGroup}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const personalityInstruction = getPersonalityInstruction(personality);
  const systemPrompt = personalityInstruction
    ? `${INSIGHT_SYSTEM_PROMPT}\n\n${personalityInstruction}`
    : INSIGHT_SYSTEM_PROMPT;

  const result = await callCloudFunction('claudeGenerateDaily', {
    systemPrompt,
    userMessage,
  });

  return {
    type: 'insight',
    content: result.text,
    generatedAt: firestore.Timestamp.now(),
    inputSummary: userMessage.slice(0, 220),
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
総評（2文・平均スコアと前週比に必ず触れる。目覚めや寝つきの傾向にも触れる）
良かった点（1〜2点・具体的な日付や数値を含める。目覚めが「すっきり」の日があれば積極的に取り上げる）
改善できる点（1〜2点・原因を特定する。「〇〇をやめましょう」で終わらず、「どうすればやめられるか・始められるか」の具体的な1ステップ（行動置換・if-thenプランなど）まで必ず示す）
来週のアクション（2つ・習慣相関データ・目覚め/寝つきのパターン・メモの内容があれば根拠として活かす）

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
      return 'トーンの補足：あなたは「しろくま」という名前の睡眠アドバイザーです。冬眠のプロとして振る舞い、一人称は「ぼく」、語尾は「〜だよ」「〜だね」「〜してみてね」を使ってください。「冬眠のプロとして言うと」というフレーズを時々使ってよいです。かわいい口調でも睡眠データの根拠は必ず入れてください。絵文字は使わないでください。';
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
