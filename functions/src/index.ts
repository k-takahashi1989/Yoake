import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { google } from 'googleapis';

admin.initializeApp();

const db = admin.firestore();
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-haiku-4-5';
const PACKAGE_NAME = 'com.ktakahashi.yoake';
const APP_STORE_BUNDLE_ID = 'com.ktakahashi.yoake';
const TRIAL_DAYS = 7;

// ============================================================
// 蜀・Κ繝倥Ν繝代・
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
  const userRef = db.collection('users').doc(uid);
  const subRef = userRef.collection('subscription').doc('main');
  const subSnap = await subRef.get();
  if (!subSnap.exists) {
    console.log('[isPremiumUser] no subscription doc found');
    await userRef.set(
      { isPremium: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true },
    );
    return false;
  }
  const data = subSnap.data()!;
  console.log('[isPremiumUser] status:', data.status);
  const endAt: admin.firestore.Timestamp | null =
    data.currentPeriodEndAt ?? data.trialEndAt ?? null;
  const now = new Date();
  const hasEntitlement =
    (data.status === 'active' || data.status === 'trial') &&
    endAt &&
    endAt.toDate() > now;

  console.log('[isPremiumUser] endAt:', endAt?.toDate().toISOString(), 'now:', now.toISOString());

  if (hasEntitlement) {
    return true;
  }

  await Promise.all([
    subRef.set(
      {
        status: 'expired',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    ),
    userRef.set(
      { isPremium: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true },
    ),
  ]);

  console.log('[isPremiumUser] not premium');
  return false;
}

async function getAndroidPublisher() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  return google.androidpublisher({ version: 'v3', auth });
}

type SubscriptionWriteInput = {
  uid: string;
  platform: 'android' | 'ios';
  productId: string;
  purchaseToken: string;
  status: 'trial' | 'active';
  currentPeriodEndAt: Date | null;
  trialStartAt: Date | null;
  trialEndAt: Date | null;
  transactionId?: string | null;
  originalTransactionId?: string | null;
  environment?: string | null;
};

type AppStoreTransactionInfo = {
  bundleId?: string;
  productId?: string;
  transactionId?: string;
  originalTransactionId?: string;
  environment?: string;
  purchaseDate?: number | string;
  expiresDate?: number | string;
  revocationDate?: number | string;
  offerType?: number | string;
};

function toBase64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
}

function parseStoreDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const raw = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(raw)) return null;

  // Apple often returns milliseconds since epoch, but keep a seconds fallback.
  const normalized = raw > 1_000_000_000_000 ? raw : raw * 1000;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function decodeSignedPayload<T>(signedValue: string): T {
  const parts = signedValue.split('.');
  if (parts.length < 2) {
    throw new Error('Signed payload is malformed');
  }

  return JSON.parse(decodeBase64Url(parts[1])) as T;
}

function getAppStorePrivateKey(): string {
  const raw = process.env.APP_STORE_PRIVATE_KEY;
  if (!raw) {
    throw new HttpsError(
      'failed-precondition',
      'APP_STORE_PRIVATE_KEY is not configured',
    );
  }

  const normalized = raw.includes('BEGIN PRIVATE KEY')
    ? raw.replace(/\\n/g, '\n')
    : Buffer.from(raw, 'base64').toString('utf8').replace(/\\n/g, '\n');

  if (!normalized.includes('BEGIN PRIVATE KEY')) {
    throw new HttpsError(
      'failed-precondition',
      'APP_STORE_PRIVATE_KEY is not a valid private key',
    );
  }

  return normalized;
}

function createAppStoreServerToken(): string {
  const issuerId = process.env.APP_STORE_ISSUER_ID;
  const keyId = process.env.APP_STORE_KEY_ID;

  if (!issuerId || !keyId) {
    throw new HttpsError(
      'failed-precondition',
      'APP_STORE_ISSUER_ID and APP_STORE_KEY_ID must be configured',
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const payload = toBase64Url(JSON.stringify({
    iss: issuerId,
    iat: now,
    exp: now + 300,
    aud: 'appstoreconnect-v1',
    bid: APP_STORE_BUNDLE_ID,
  }));
  const signingInput = `${header}.${payload}`;
  const signature = crypto.sign(
    'sha256',
    Buffer.from(signingInput),
    crypto.createPrivateKey(getAppStorePrivateKey()),
  );

  return `${signingInput}.${toBase64Url(signature)}`;
}

async function fetchAppStoreTransactionInfo(
  transactionId: string,
  environmentHint?: string | null,
): Promise<AppStoreTransactionInfo> {
  const authToken = createAppStoreServerToken();
  const wantsSandbox = (environmentHint ?? '').toLowerCase().includes('sandbox');
  const endpoints = wantsSandbox
    ? [
        'https://api.storekit-sandbox.itunes.apple.com',
        'https://api.storekit.itunes.apple.com',
      ]
    : [
        'https://api.storekit.itunes.apple.com',
        'https://api.storekit-sandbox.itunes.apple.com',
      ];

  let lastError: string | null = null;

  for (const baseUrl of endpoints) {
    const response = await fetch(
      `${baseUrl}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    );

    if (!response.ok) {
      lastError = `${response.status} ${await response.text()}`;
      continue;
    }

    const data = await response.json() as { signedTransactionInfo?: string };
    if (!data.signedTransactionInfo) {
      throw new Error('App Store transaction payload is missing signedTransactionInfo');
    }

    return decodeSignedPayload<AppStoreTransactionInfo>(data.signedTransactionInfo);
  }

  throw new Error(lastError ?? 'Unable to fetch App Store transaction info');
}

async function writeSubscriptionEntitlement({
  uid,
  platform,
  productId,
  purchaseToken,
  status,
  currentPeriodEndAt,
  trialStartAt,
  trialEndAt,
  transactionId = null,
  originalTransactionId = null,
  environment = null,
}: SubscriptionWriteInput): Promise<void> {
  const isYearly = productId === 'yoake_yearly_2800';

  await db.collection('users').doc(uid)
    .collection('subscription').doc('main')
    .set({
      plan: isYearly ? 'yearly' : 'monthly',
      platform,
      status,
      purchaseToken,
      productId,
      transactionId,
      originalTransactionId,
      environment,
      currentPeriodEndAt: currentPeriodEndAt
        ? admin.firestore.Timestamp.fromDate(currentPeriodEndAt)
        : null,
      trialStartAt: trialStartAt
        ? admin.firestore.Timestamp.fromDate(trialStartAt)
        : null,
      trialEndAt: trialEndAt
        ? admin.firestore.Timestamp.fromDate(trialEndAt)
        : null,
      trialUsed: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  await db.collection('users').doc(uid).set(
    { isPremium: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true },
  );
}

// ============================================================
// 週次レポート生成・ヘルパー
// ============================================================

// サーバー側週次レポート生成用システムプロンプト
const SERVER_WEEKLY_SYSTEM_PROMPT = `あなたは「ヨアケ」という名前の睡眠コーチAIです。ユーザーの1週間の睡眠データを分析し、週次レポートを日本語で作成してください。
以下の構成で出力してください（合計400〜600文字）：
📊 今週の総括（1文・今週のスコアと先週比に必ず触れる）
✅ 良かった点（具体的な日や数値を含める）
🔼 改善できる点（1点・改善方法と具体的な1ステップまで示す）
📅 来週のアクション（1つ・就寝時間関連・目標/達成のパターンを活かす）
ルール：・必ず上記の絵文字見出しを順番通り使う・数値を定量的に使う（スコア・時間・先週比）・メモを書いている日があれば内容をレポートに活かす
・感傷的な表現は使わない・データが3日分しかない場合は冒頭で補足する`;

// 配列をsize個ずつのチャンクに分割する
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

// Claude に渡すユーザーメッセージを生成する
function buildServerWeeklyUserMessage(logs: any[], prevLogs: any[], goal: any | null): string {
  const avgScore = logs.length > 0
    ? Math.round(logs.reduce((s: number, l: any) => s + (l.score ?? 0), 0) / logs.length)
    : 0;
  const prevAvg = prevLogs.length > 0
    ? Math.round(prevLogs.reduce((s: number, l: any) => s + (l.score ?? 0), 0) / prevLogs.length)
    : null;

  const scoreLine = prevAvg !== null
    ? `今週のスコア: ${avgScore}点 (先週比 ${avgScore - prevAvg >= 0 ? '+' : ''}${avgScore - prevAvg}点)`
    : `今週のスコア: ${avgScore}点`;

  const wakeFeelingMap: Record<string, string> = {
    GOOD: 'すっきり',
    SLIGHTLY_GOOD: 'ややすっきり',
    NORMAL: 'ふつう',
    SLIGHTLY_BAD: 'ややつらい',
    BAD: 'つらい',
  };
  const sleepOnsetMap: Record<string, string> = {
    FAST: 'すぐ寝れた',
    SLIGHTLY_FAST: 'ややすぐ寝れた',
    NORMAL: 'ふつう',
    SLIGHTLY_SLOW: 'やや寝つきが悪い',
    SLOW: 'なかなか寝れなかった',
  };
  const seasonMap: Record<number, string> = {
    1: '1月',
    2: '2月',
    3: '3月',
    4: '4月',
    5: '5月',
    6: '6月',
    7: '7月',
    8: '8月',
    9: '9月',
    10: '10月',
    11: '11月',
    12: '12月',
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
      `・${log.date} 就寝 ${bedTime.getHours()}:${String(bedTime.getMinutes()).padStart(2, '0')} / 起床 ${wakeTime.getHours()}:${String(wakeTime.getMinutes()).padStart(2, '0')} / ${h}時間${m}分 / スコア${log.score ?? '-'}点`,
      `  目覚め: ${wakeFeelingMap[log.wakeFeeling] ?? log.wakeFeeling ?? '未入力'} / 寝つき: ${sleepOnsetMap[log.sleepOnset] ?? log.sleepOnset ?? '未入力'}`,
    ];
    if (log.deepSleepMinutes != null) {
      lines.push(`  深睡眠: ${log.deepSleepMinutes}分 / 覚醒: ${log.awakenings ?? 0}回`);
    }
    if (habits) {
      lines.push(`  習慣: ${habits}`);
    }
    if (log.memo) {
      lines.push(`  メモ: ${log.memo}`);
    }
    return lines.join('\n');
  }).join('\n');

  const month = new Date().getMonth() + 1;
  const goalText = goal
    ? `${goal.targetHours}時間 / スコア${goal.targetScore}点`
    : '未設定';

  return [
    `季節: ${seasonMap[month] ?? ''}`,
    '',
    `直近7日の睡眠データ (${logs.length}日分)`,
    logsText,
    '',
    '要約',
    scoreLine,
    '',
    '目標',
    goalText,
  ].join('\n');
}

// FCM push を送り、無効トークンは Firestore で flag 更新する
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
          title: '今週の睡眠レポートが届きました',
          body: '先週の睡眠を振り返ってみましょう',
        },
        data: { type: 'weekly_report' },
        android: { notification: { channelId: 'yoake_weekly_report' }, priority: 'high' },
      }),
    ),
  );

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

// 1ユーザー分の週次レポートを生成・保存する
async function processUserWeeklyReport(uid: string, weekKey: string): Promise<void> {
  if (!(await isPremiumUser(uid))) return;

  const reportRef = db.collection('users').doc(uid).collection('aiReports').doc(weekKey);
  const existing = await reportRef.get();
  if (existing.exists) return;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startDate = sevenDaysAgo.toISOString().split('T')[0];
  const logsSnap = await db.collection('users').doc(uid)
    .collection('sleepLogs')
    .where('date', '>=', startDate)
    .orderBy('date', 'desc')
    .limit(7)
    .get();

  if (logsSnap.docs.length < 3) return;

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

// プレミアムユーザー全体をページネーションしながら週次レポートを生成するバッチ
async function runWeeklyReportBatch(): Promise<void> {
  const weekKey = getISOWeekKey(new Date());
  console.log('[weeklyBatch] start weekKey:', weekKey);

  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  const pageSize = 50;
  let processedCount = 0;
  let errorCount = 0;

  while (true) {
    let query = db.collection('users')
      .where('isPremium', '==', true)
      .orderBy('__name__')
      .limit(pageSize) as admin.firestore.Query;
    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;

    const chunks = chunkArray(snap.docs, 5);
    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(doc => processUserWeeklyReport(doc.id, weekKey)),
      );
      results.forEach(result => {
        if (result.status === 'rejected') {
          console.error('[weeklyBatch] error for user:', result.reason);
          errorCount++;
        } else {
          processedCount++;
        }
      });
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < pageSize) break;
  }

  console.log(`[weeklyBatch] done. processed: ${processedCount}, errors: ${errorCount}`);
}

// Daily insight generation
export const claudeGenerateDaily = onCall(
  { region: 'asia-northeast1', secrets: ['CLAUDE_API_KEY'] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');

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

// Weekly insight generation
export const claudeGenerateWeekly = onCall(
  { region: 'asia-northeast1', secrets: ['CLAUDE_API_KEY'] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    if (!(await isPremiumUser(request.auth.uid))) {
      throw new HttpsError('permission-denied', 'Premium subscription required');
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

const DAILY_CHAT_LIMIT = 10;

// Premium chat
export const claudeSendChatMessage = onCall(
  { region: 'asia-northeast1', secrets: ['CLAUDE_API_KEY'] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    const uid = request.auth.uid;
    console.log('[claudeSendChatMessage] uid:', uid);

    if (!(await isPremiumUser(uid))) {
      throw new HttpsError('permission-denied', 'Premium subscription required');
    }

    const today = new Date().toISOString().split('T')[0];
    const usageRef = db.collection('users').doc(uid).collection('chatUsage').doc(today);
    const usageSnap = await usageRef.get();
    const count = usageSnap.exists ? ((usageSnap.data()!.count as number) ?? 0) : 0;
    console.log('[claudeSendChatMessage] today:', today, 'count:', count);

    if (count >= DAILY_CHAT_LIMIT) {
      throw new HttpsError(
        'resource-exhausted',
        `Daily chat limit reached (${DAILY_CHAT_LIMIT})`,
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
    await usageRef.set({ count: admin.firestore.FieldValue.increment(1) }, { merge: true });
    console.log('[claudeSendChatMessage] success. new count:', count + 1);

    return { text: result.text };
  },
);

// Purchase validation for Google Play and App Store
export const validatePurchase = onCall(
  {
    region: 'asia-northeast1',
    secrets: ['APP_STORE_ISSUER_ID', 'APP_STORE_KEY_ID', 'APP_STORE_PRIVATE_KEY'],
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    const uid = request.auth.uid;
    const {
      purchaseToken,
      productId,
      platform = 'android',
      transactionId,
      environmentIOS,
      appBundleIdIOS,
    } = request.data as {
      purchaseToken: string;
      productId: string;
      platform?: 'android' | 'ios';
      transactionId?: string | null;
      environmentIOS?: string | null;
      appBundleIdIOS?: string | null;
    };

    if (!purchaseToken || !productId) {
      throw new HttpsError('invalid-argument', 'purchaseToken and productId are required');
    }

    try {
      if (platform === 'ios') {
        if (!transactionId) {
          throw new HttpsError('invalid-argument', 'transactionId is required for iOS');
        }
        if (appBundleIdIOS && appBundleIdIOS !== APP_STORE_BUNDLE_ID) {
          throw new HttpsError('failed-precondition', 'iOS bundle id does not match');
        }

        const transaction = await fetchAppStoreTransactionInfo(transactionId, environmentIOS);
        if (transaction.bundleId && transaction.bundleId !== APP_STORE_BUNDLE_ID) {
          throw new HttpsError('failed-precondition', 'App Store bundle id does not match');
        }
        if (transaction.productId && transaction.productId !== productId) {
          throw new HttpsError('failed-precondition', 'App Store product does not match');
        }

        const expiryTime = parseStoreDate(transaction.expiresDate);
        if (!expiryTime || expiryTime <= new Date() || transaction.revocationDate) {
          throw new HttpsError('failed-precondition', 'App Store entitlement is not active');
        }

        const purchaseDate = parseStoreDate(transaction.purchaseDate) ?? new Date();
        const isTrial = Number(transaction.offerType ?? 0) === 1;

        await writeSubscriptionEntitlement({
          uid,
          platform: 'ios',
          productId,
          purchaseToken,
          status: isTrial ? 'trial' : 'active',
          currentPeriodEndAt: isTrial ? null : expiryTime,
          trialStartAt: isTrial ? purchaseDate : null,
          trialEndAt: isTrial ? expiryTime : null,
          transactionId: transaction.transactionId ?? transactionId,
          originalTransactionId: transaction.originalTransactionId ?? null,
          environment: transaction.environment ?? environmentIOS ?? null,
        });

        return {
          success: true,
          status: isTrial ? 'trial' : 'active',
          expiryTime: expiryTime.toISOString(),
        };
      }

      const androidpublisher = await getAndroidPublisher();
      const response = await androidpublisher.purchases.subscriptionsv2.get({
        packageName: PACKAGE_NAME,
        token: purchaseToken,
      });

      const sub = response.data;
      const subscriptionState = sub.subscriptionState ?? 'SUBSCRIPTION_STATE_UNSPECIFIED';
      const lineItem = (sub.lineItems ?? [])[0];
      if (!lineItem) {
        throw new HttpsError('invalid-argument', 'No valid subscription line item found');
      }

      const expiryTime = lineItem.expiryTime ? new Date(lineItem.expiryTime) : null;
      const currentOfferPhase = (lineItem as typeof lineItem & {
        offerPhase?: { freeTrial?: unknown };
      }).offerPhase;
      const hasAccess = [
        'SUBSCRIPTION_STATE_ACTIVE',
        'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
        'SUBSCRIPTION_STATE_CANCELED',
      ].includes(subscriptionState);

      if (!expiryTime || expiryTime <= new Date() || !hasAccess) {
        throw new HttpsError('failed-precondition', 'Google Play entitlement is not active');
      }

      const isTrial = Boolean(currentOfferPhase?.freeTrial);
      const startTime = sub.startTime ? new Date(sub.startTime) : new Date();

      await writeSubscriptionEntitlement({
        uid,
        platform: 'android',
        productId,
        purchaseToken,
        status: isTrial ? 'trial' : 'active',
        currentPeriodEndAt: isTrial ? null : expiryTime,
        trialStartAt: isTrial ? startTime : null,
        trialEndAt: isTrial ? expiryTime : null,
      });

      return {
        success: true,
        status: isTrial ? 'trial' : 'active',
        expiryTime: expiryTime.toISOString(),
      };
    } catch (e: unknown) {
      if (e instanceof HttpsError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      console.error('validatePurchase error:', msg);
      throw new HttpsError('internal', `Purchase validation failed: ${msg}`);
    }
  },
);

// Legacy trial activation path
export const activateTrial = onCall(
  { region: 'asia-northeast1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    const uid = request.auth.uid;
    const { purchaseToken, productId, deviceId } = request.data as {
      purchaseToken: string;
      productId: string;
      deviceId: string;
    };

    if (!purchaseToken || !productId || !deviceId) {
      throw new HttpsError('invalid-argument', 'purchaseToken, productId, deviceId are required');
    }

    const trialRef = db.collection('trialUsage').doc(deviceId);
    const trialSnap = await trialRef.get();
    if (trialSnap.exists) {
      throw new HttpsError('already-exists', 'Trial already used on this device');
    }

    try {
      const androidpublisher = await getAndroidPublisher();
      await androidpublisher.purchases.subscriptionsv2.get({
        packageName: PACKAGE_NAME,
        token: purchaseToken,
      });

      const now = new Date();
      const trialEndAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
      const isYearly = productId === 'yoake_yearly_2800';

      await Promise.all([
        trialRef.set({
          uid,
          productId,
          usedAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
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
        db.collection('users').doc(uid).set(
          { isPremium: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true },
        ),
      ]);

      return { success: true };
    } catch (e: unknown) {
      if (e instanceof HttpsError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      console.error('activateTrial error:', msg);
      throw new HttpsError('internal', `Trial activation failed: ${msg}`);
    }
  },
);

// ============================================================
// 週次レポート自動生成（Scheduled Function）
// ============================================================

export const weeklyReportScheduler = onSchedule(
  {
    // 毎週月曜日 08:00 JST（Asia/Tokyo）に自動実行
    schedule: '0 8 * * 1',
    timeZone: 'Asia/Tokyo',
    region: 'asia-northeast1',
    secrets: ['CLAUDE_API_KEY'],
    memory: '512MiB',
    // 全ユーザーの処理タイムアウト対策として最大9分を設定
    timeoutSeconds: 540,
    maxInstances: 1,
  },
  async () => {
    await runWeeklyReportBatch();
  },
);

