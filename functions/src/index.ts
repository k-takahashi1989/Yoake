import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';

admin.initializeApp();

const db = admin.firestore();
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-haiku-4-5';
const PACKAGE_NAME = 'com.ktakahashi.yoake';
const TRIAL_DAYS = 7;

// ============================================================
// 内部ヘルパー
// ============================================================

async function callClaudeApi(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new HttpsError('internal', 'Claude API key not configured');

  console.log('[callClaudeApi] model:', CLAUDE_MODEL, 'maxTokens:', maxTokens, 'messages:', messages.length);

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Claude API error:', response.status, errText);
    throw new HttpsError('internal', `Claude API error: ${response.status}`);
  }

  const data = await response.json() as {
    content: Array<{ type: string; text: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };
  const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
  const result = {
    text,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
  console.log('[callClaudeApi] done. inputTokens:', result.inputTokens, 'outputTokens:', result.outputTokens);
  return result;
}

async function isPremiumUser(uid: string): Promise<boolean> {
  console.log('[isPremiumUser] checking uid:', uid);
  const subSnap = await db
    .collection('users').doc(uid)
    .collection('subscription').doc('main')
    .get();
  if (!subSnap.exists) {
    console.log('[isPremiumUser] no subscription doc found');
    return false;
  }
  const data = subSnap.data()!;
  console.log('[isPremiumUser] status:', data.status);
  if (data.status === 'active' || data.status === 'trial') {
    const endAt: admin.firestore.Timestamp | null =
      data.currentPeriodEndAt ?? data.trialEndAt ?? null;
    const now = new Date();
    console.log('[isPremiumUser] endAt:', endAt?.toDate().toISOString(), 'now:', now.toISOString());
    if (endAt && endAt.toDate() > now) return true;
  }
  console.log('[isPremiumUser] not premium');
  return false;
}

async function getAndroidPublisher() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  return google.androidpublisher({ version: 'v3', auth });
}

// ============================================================
// 週次レポート自動生成 — ヘルパー
// ============================================================

// サーバー側週次レポート生成用システムプロンプト
const SERVER_WEEKLY_SYSTEM_PROMPT = `あなたは「ヨアケ」という名前の睡眠コーチAIです。
ユーザーの1週間の睡眠データを分析し、週次レポートを日本語で作成してください。

以下の構成で出力してください（合計400〜500文字）：
📊 今週の総評（2文・平均スコアと前週比に必ず触れる）
✅ 良かった点（1〜2点・具体的な日付や数値を含める）
💡 改善できる点（1〜2点・原因特定と具体的な1ステップまで示す）
🎯 来週のアクション（2つ・習慣相関・目覚め/寝つきのパターンを根拠に）

ルール：
・必ず上記の絵文字見出しを順番通り使う
・数値を積極的に使う（スコア・時間・前週比）
・メモを書いている日があれば内容をレポートに活かす
・医療的な表現は使わない
・データが3〜4日分しかない場合は冒頭で補足する`;

// 配列をsize件ずつのチャンクに分割する
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// ISO週番号（月曜始まり）を "YYYY-WNN" 形式で返す
function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Claudeへ渡すユーザーメッセージを睡眠ログから組み立てる
function buildServerWeeklyUserMessage(logs: any[], prevLogs: any[], goal: any | null): string {
  const avgScore = logs.length > 0
    ? Math.round(logs.reduce((s: number, l: any) => s + (l.score ?? 0), 0) / logs.length)
    : 0;
  const prevAvg = prevLogs.length > 0
    ? Math.round(prevLogs.reduce((s: number, l: any) => s + (l.score ?? 0), 0) / prevLogs.length)
    : null;

  const scoreLine = prevAvg !== null
    ? `平均スコア: ${avgScore}点（前週比 ${avgScore - prevAvg >= 0 ? '+' : ''}${avgScore - prevAvg}点）`
    : `平均スコア: ${avgScore}点`;

  const wakeFeelingMap: Record<string, string> = { GOOD: 'すっきり', NORMAL: 'ふつう', BAD: 'つらい' };
  const sleepOnsetMap: Record<string, string> = { FAST: '5分以内', NORMAL: '15〜30分', SLOW: '30分以上' };
  const seasonMap: Record<number, string> = {
    1: '1月・冬', 2: '2月・冬', 3: '3月・春', 4: '4月・春', 5: '5月・春',
    6: '6月・初夏', 7: '7月・夏', 8: '8月・真夏', 9: '9月・秋',
    10: '10月・秋', 11: '11月・秋', 12: '12月・冬',
  };

  const logsText = logs.map((log: any) => {
    const bedTime = log.bedTime?.toDate?.() ?? new Date(log.bedTime);
    const wakeTime = log.wakeTime?.toDate?.() ?? new Date(log.wakeTime);
    const h = Math.floor((log.totalMinutes ?? 0) / 60);
    const m = (log.totalMinutes ?? 0) % 60;
    const habits = ((log.habits ?? []) as any[])
      .filter((hb: any) => hb.checked)
      .map((hb: any) => `${hb.emoji}${hb.label}`)
      .join(', ');
    const lines = [
      `【${log.date} ${bedTime.getHours()}:${String(bedTime.getMinutes()).padStart(2, '0')}就寝 → ${wakeTime.getHours()}:${String(wakeTime.getMinutes()).padStart(2, '0')}起床 / ${h}時間${m}分 / スコア${log.score}点】`,
      `  目覚め: ${wakeFeelingMap[log.wakeFeeling] ?? log.wakeFeeling ?? '不明'} / 寝つき: ${sleepOnsetMap[log.sleepOnset] ?? log.sleepOnset ?? '不明'}`,
    ];
    if (log.deepSleepMinutes != null) lines.push(`  深睡眠: ${log.deepSleepMinutes}分 / 覚醒: ${log.awakenings ?? 0}回`);
    if (habits) lines.push(`  習慣: ${habits}`);
    if (log.memo) lines.push(`  メモ: ${log.memo}`);
    return lines.join('\n');
  }).join('\n');

  const month = new Date().getMonth() + 1;
  const goalText = goal ? `${goal.targetHours}時間 / スコア${goal.targetScore}点以上` : '未設定';

  return [
    `【季節】${seasonMap[month] ?? ''}`,
    '',
    `【直近7日の睡眠データ（${logs.length}日分）】`,
    logsText,
    '',
    `【統計】${scoreLine}`,
    '',
    `【目標】${goalText}`,
  ].join('\n');
}

// FCMプッシュ通知を送信し、無効トークンをFirestoreでフラグ更新する
async function sendWeeklyReportNotification(uid: string): Promise<void> {
  const tokensSnap = await db.collection('users').doc(uid)
    .collection('fcmTokens')
    .where('isValid', '==', true)
    .get();
  if (tokensSnap.empty) return;

  const sendResults = await Promise.allSettled(
    tokensSnap.docs.map(d =>
      admin.messaging().send({
        token: d.data().token as string,
        notification: {
          title: '📊 今週の睡眠レポートが届きました',
          body: '先週の睡眠を振り返りましょう',
        },
        data: { type: 'weekly_report' },
        android: { notification: { channelId: 'yoake_weekly_report' }, priority: 'high' },
      })
    )
  );

  // 無効トークンを Firestore でフラグ更新
  const batch = db.batch();
  let hasInvalid = false;
  sendResults.forEach((result, i) => {
    if (result.status === 'rejected') {
      const code = (result.reason as any)?.errorInfo?.code ?? '';
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        batch.update(tokensSnap.docs[i].ref, { isValid: false });
        hasInvalid = true;
      }
    }
  });
  if (hasInvalid) await batch.commit();
}

// 1ユーザー分の週次レポートを生成・保存する（冪等）
async function processUserWeeklyReport(uid: string, weekKey: string): Promise<void> {
  // 冪等チェック — すでに生成済みなら何もしない
  const reportRef = db.collection('users').doc(uid).collection('aiReports').doc(weekKey);
  const existing = await reportRef.get();
  if (existing.exists) return;

  // 直近7日の sleepLogs を取得
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startDate = sevenDaysAgo.toISOString().split('T')[0];
  const logsSnap = await db.collection('users').doc(uid)
    .collection('sleepLogs')
    .where('date', '>=', startDate)
    .orderBy('date', 'desc')
    .limit(7)
    .get();

  // データが3日未満の場合はスキップ
  if (logsSnap.docs.length < 3) return;

  // 前週のログ（前週比計算用）
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const prevStart = fourteenDaysAgo.toISOString().split('T')[0];
  const [prevLogsSnap, goalSnap] = await Promise.all([
    db.collection('users').doc(uid)
      .collection('sleepLogs')
      .where('date', '>=', prevStart)
      .where('date', '<', startDate)
      .get(),
    db.collection('users').doc(uid).collection('goal').doc('main').get(),
  ]);

  const logs = logsSnap.docs.map(d => ({ ...d.data(), date: d.id }));
  const prevLogs = prevLogsSnap.docs.map(d => d.data());
  const goal = goalSnap.exists ? goalSnap.data() ?? null : null;

  const userMessage = buildServerWeeklyUserMessage(logs, prevLogs, goal);
  const result = await callClaudeApi(
    SERVER_WEEKLY_SYSTEM_PROMPT,
    [{ role: 'user', content: userMessage }],
    700,
  );

  await reportRef.set({
    type: 'weekly',
    content: result.text,
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    inputSummary: `auto-generated ${weekKey}`,
    tokenCount: result.inputTokens + result.outputTokens,
  });

  await sendWeeklyReportNotification(uid);
}

// プレミアムユーザー全員をページネーションしながら週次レポートを生成するバッチ
async function runWeeklyReportBatch(): Promise<void> {
  const weekKey = getISOWeekKey(new Date());
  console.log('[weeklyBatch] start weekKey:', weekKey);

  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  const PAGE_SIZE = 50;
  let processedCount = 0;
  let errorCount = 0;

  while (true) {
    let query = db.collection('users')
      .where('isPremium', '==', true)
      .orderBy('__name__')
      .limit(PAGE_SIZE) as admin.firestore.Query;
    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;

    // 5件ずつ並列処理して API レート超過を防ぐ
    const chunks = chunkArray(snap.docs, 5);
    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(doc => processUserWeeklyReport(doc.id, weekKey))
      );
      results.forEach(r => {
        if (r.status === 'rejected') {
          console.error('[weeklyBatch] error for user:', r.reason);
          errorCount++;
        } else {
          processedCount++;
        }
      });
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < PAGE_SIZE) break;
  }

  console.log(`[weeklyBatch] done. processed: ${processedCount}, errors: ${errorCount}`);
}

// ============================================================
// ① 毎朝ひとこと（無料）
// ============================================================

export const claudeGenerateDaily = onCall(
  { region: 'asia-northeast1', secrets: ['CLAUDE_API_KEY'] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');
    const { systemPrompt, userMessage } = request.data as {
      systemPrompt: string;
      userMessage: string;
    };
    if (!systemPrompt || !userMessage) {
      throw new HttpsError('invalid-argument', 'systemPrompt and userMessage are required');
    }
    return callClaudeApi(systemPrompt, [{ role: 'user', content: userMessage }], 150);
  },
);

// ============================================================
// ② 週次AIレポート（有料）
// ============================================================

export const claudeGenerateWeekly = onCall(
  { region: 'asia-northeast1', secrets: ['CLAUDE_API_KEY'] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');
    if (!(await isPremiumUser(request.auth.uid))) {
      throw new HttpsError('permission-denied', 'プレミアム機能です');
    }
    const { systemPrompt, userMessage } = request.data as {
      systemPrompt: string;
      userMessage: string;
    };
    if (!systemPrompt || !userMessage) {
      throw new HttpsError('invalid-argument', 'systemPrompt and userMessage are required');
    }
    return callClaudeApi(systemPrompt, [{ role: 'user', content: userMessage }], 700);
  },
);

// ============================================================
// ③ AIチャット（有料）
// ============================================================

const DAILY_CHAT_LIMIT = 10;

export const claudeSendChatMessage = onCall(
  { region: 'asia-northeast1', secrets: ['CLAUDE_API_KEY'] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');
    const uid = request.auth.uid;
    console.log('[claudeSendChatMessage] uid:', uid);
    if (!(await isPremiumUser(uid))) {
      throw new HttpsError('permission-denied', 'プレミアム機能です');
    }

    // 日次使用回数チェック
    const today = new Date().toISOString().split('T')[0];
    const usageRef = db.collection('users').doc(uid).collection('chatUsage').doc(today);
    const usageSnap = await usageRef.get();
    const count = usageSnap.exists ? ((usageSnap.data()!.count as number) ?? 0) : 0;
    console.log('[claudeSendChatMessage] today:', today, 'count:', count);
    if (count >= DAILY_CHAT_LIMIT) {
      throw new HttpsError(
        'resource-exhausted',
        `本日のチャット上限(${DAILY_CHAT_LIMIT}回)に達しました`,
      );
    }

    const { systemPrompt, messages } = request.data as {
      systemPrompt: string;
      messages: Array<{ role: string; content: string }>;
    };
    if (!systemPrompt || !Array.isArray(messages) || messages.length === 0) {
      throw new HttpsError('invalid-argument', 'systemPrompt and messages are required');
    }
    const result = await callClaudeApi(systemPrompt, messages, 400);

    // 使用回数をインクリメント
    await usageRef.set({ count: admin.firestore.FieldValue.increment(1) }, { merge: true });
    console.log('[claudeSendChatMessage] success. new count:', count + 1);

    return { text: result.text };
  },
);

// ============================================================
// ④ サブスクリプション購入検証（Google Play）
// ============================================================

export const validatePurchase = onCall(
  { region: 'asia-northeast1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');
    const uid = request.auth.uid;
    const { purchaseToken, productId } = request.data as {
      purchaseToken: string;
      productId: string;
    };
    if (!purchaseToken || !productId) {
      throw new HttpsError('invalid-argument', 'purchaseToken and productId are required');
    }

    try {
      const androidpublisher = await getAndroidPublisher();
      const response = await androidpublisher.purchases.subscriptionsv2.get({
        packageName: PACKAGE_NAME,
        token: purchaseToken,
      });

      const sub = response.data;
      const lineItem = (sub.lineItems ?? [])[0];
      if (!lineItem) {
        throw new HttpsError('invalid-argument', '有効なサブスクリプションが見つかりません');
      }

      const expiryTime = lineItem.expiryTime ? new Date(lineItem.expiryTime) : null;
      if (!expiryTime || expiryTime <= new Date()) {
        throw new HttpsError('failed-precondition', 'サブスクリプションの有効期限が切れています');
      }

      const isYearly = productId === 'yoake_yearly_2800';
      await db.collection('users').doc(uid)
        .collection('subscription').doc('main')
        .set({
          plan: isYearly ? 'yearly' : 'monthly',
          status: 'active',
          purchaseToken,
          productId,
          currentPeriodEndAt: admin.firestore.Timestamp.fromDate(expiryTime),
          trialStartAt: null,
          trialEndAt: null,
          trialUsed: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      // isPremium フラグを users/{uid} ルートドキュメントに denormalize（バッチクエリ用）
      await db.collection('users').doc(uid).set(
        { isPremium: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );

      return { success: true, expiryTime: expiryTime.toISOString() };
    } catch (e: unknown) {
      if (e instanceof HttpsError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      console.error('validatePurchase error:', msg);
      throw new HttpsError('internal', `購入検証エラー: ${msg}`);
    }
  },
);

// ============================================================
// ⑤ トライアル開始（デバイスID重複チェック）
// ============================================================

export const activateTrial = onCall(
  { region: 'asia-northeast1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');
    const uid = request.auth.uid;
    const { purchaseToken, productId, deviceId } = request.data as {
      purchaseToken: string;
      productId: string;
      deviceId: string;
    };
    if (!purchaseToken || !productId || !deviceId) {
      throw new HttpsError('invalid-argument', 'purchaseToken, productId, deviceId are required');
    }

    // デバイスIDでトライアル重複チェック
    const trialRef = db.collection('trialUsage').doc(deviceId);
    const trialSnap = await trialRef.get();
    if (trialSnap.exists) {
      throw new HttpsError(
        'already-exists',
        'このデバイスではすでにトライアルが使用されています',
      );
    }

    try {
      // Google Play で購入トークン検証
      const androidpublisher = await getAndroidPublisher();
      await androidpublisher.purchases.subscriptionsv2.get({
        packageName: PACKAGE_NAME,
        token: purchaseToken,
      });

      // Firestore にトライアル利用記録（Admin SDK はルールをバイパス）
      const now = new Date();
      const trialEndAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
      const isYearly = productId === 'yoake_yearly_2800';

      await Promise.all([
        // 使用済みデバイス記録
        trialRef.set({
          uid,
          productId,
          usedAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
        // サブスクリプション書き込み
        db.collection('users').doc(uid)
          .collection('subscription').doc('main')
          .set({
            plan: isYearly ? 'yearly' : 'monthly',
            status: 'trial',
            purchaseToken,
            productId,
            trialStartAt: admin.firestore.FieldValue.serverTimestamp(),
            trialEndAt: admin.firestore.Timestamp.fromDate(trialEndAt),
            currentPeriodEndAt: null,
            trialUsed: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }),
        // isPremium フラグを users/{uid} ルートドキュメントに denormalize（バッチクエリ用）
        db.collection('users').doc(uid).set(
          { isPremium: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        ),
      ]);

      return { success: true };
    } catch (e: unknown) {
      if (e instanceof HttpsError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      console.error('activateTrial error:', msg);
      throw new HttpsError('internal', `トライアル開始エラー: ${msg}`);
    }
  },
);

// ============================================================
// ⑥ 週次レポート自動生成（Scheduled Function）
//    毎週月曜 07:00 JST に全プレミアムユーザー分を生成
// ============================================================

export const weeklyReportScheduler = onSchedule(
  {
    schedule: '0 7 * * 1',
    timeZone: 'Asia/Tokyo',
    region: 'asia-northeast1',
    secrets: ['CLAUDE_API_KEY'],
    memory: '512MiB',
    timeoutSeconds: 540,
    maxInstances: 1,
  },
  async () => {
    await runWeeklyReportBatch();
  },
);
