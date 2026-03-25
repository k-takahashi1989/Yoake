import { onCall, HttpsError } from 'firebase-functions/v2/https';
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
  return {
    text,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

async function isPremiumUser(uid: string): Promise<boolean> {
  const subSnap = await db
    .collection('users').doc(uid)
    .collection('subscription').doc('main')
    .get();
  if (!subSnap.exists) return false;
  const data = subSnap.data()!;
  if (data.status === 'active' || data.status === 'trial') {
    const endAt: admin.firestore.Timestamp | null =
      data.currentPeriodEndAt ?? data.trialEndAt ?? null;
    if (endAt && endAt.toDate() > new Date()) return true;
  }
  return false;
}

async function getAndroidPublisher() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  return google.androidpublisher({ version: 'v3', auth });
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
    return callClaudeApi(systemPrompt, [{ role: 'user', content: userMessage }], 500);
  },
);

// ============================================================
// ③ AIチャット（有料）
// ============================================================

const DAILY_CHAT_LIMIT = 30;

export const claudeSendChatMessage = onCall(
  { region: 'asia-northeast1', secrets: ['CLAUDE_API_KEY'] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');
    const uid = request.auth.uid;
    if (!(await isPremiumUser(uid))) {
      throw new HttpsError('permission-denied', 'プレミアム機能です');
    }

    // 日次使用回数チェック
    const today = new Date().toISOString().split('T')[0];
    const usageRef = db.collection('users').doc(uid).collection('chatUsage').doc(today);
    const usageSnap = await usageRef.get();
    const count = usageSnap.exists ? ((usageSnap.data()!.count as number) ?? 0) : 0;
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
    const result = await callClaudeApi(systemPrompt, messages, 200);

    // 使用回数をインクリメント
    await usageRef.set({ count: admin.firestore.FieldValue.increment(1) }, { merge: true });

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
