# 週次レポート自動生成 + FCMプッシュ通知 実装設計書

**作成日**: 2026-04-02

---

## 全体像

```
[月曜 07:00 JST Scheduled Function]
         |
         ├─ 1. Firestore で premium users を全件ページング
         ├─ 2. 各ユーザーの直近7日 sleepLogs を取得
         ├─ 3. Claude Haiku でレポート生成
         ├─ 4. aiReports/{YYYY-WNN} に保存
         └─ 5. FCMトークンへプッシュ通知送信

[クライアント 通知タップ]
         |
         └─ ディープリンク → Report タブ（weeklyタブ）
```

---

## 実装ファイル一覧

### 変更が必要なファイル

| ファイル | 内容 |
|---|---|
| `functions/src/index.ts` | `weeklyReportScheduler` 追加。`validatePurchase`・`activateTrial` に isPremium denormalization 追加。`sendWeeklyReportNotification` ヘルパー追加。サーバー側プロンプト構築関数追加 |
| `src/navigation/index.tsx` | FCM `onMessage`・`onNotificationOpenedApp`・`getInitialNotification` ハンドラ追加。トークンリフレッシュリスナー追加。Report タブへのディープリンク追加 |
| `src/stores/authStore.ts` | `completeOnboarding` と `onAuthStateChanged` の `!isAnonymous` 分岐で `registerFcmToken()` を呼ぶ。`signOut` で `deleteFcmToken()` を呼ぶ |
| `src/services/notificationService.ts` | `ensureWeeklyReportChannel()` と `WEEKLY_REPORT_CHANNEL_ID` を追加 |
| `src/screens/Onboarding/steps/NotificationStep.tsx` | `requestPermission` 成功時に `registerFcmToken()` を呼ぶ |
| `src/services/firebase.ts` | `saveFcmToken` / `deleteFcmToken` 関数を追加 |
| `firestore.rules` | `users/{userId}` ルートドキュメントの read ルール追加。`fcmTokens` サブコレクションの read/write ルール追加 |
| `android/app/src/main/AndroidManifest.xml` | FCMデフォルトチャンネルの `<meta-data>` 追加 |

### 新規作成が必要なファイル

| ファイル | 内容 |
|---|---|
| `src/services/fcmService.ts` | `registerFcmToken`・`deleteFcmToken`・`saveFcmToken` の実装 |
| `functions/src/reportBuilder.ts` | サーバー側プロンプト構築ロジック（index.ts の肥大化防止） |

---

## Step 1: Cloud Functions アーキテクチャ

### 1-1. Scheduled Function の定義

```typescript
// functions/src/index.ts に追加
import { onSchedule } from 'firebase-functions/v2/scheduler';

export const weeklyReportScheduler = onSchedule(
  {
    schedule: '0 7 * * 1',   // JST 月曜 07:00
    timeZone: 'Asia/Tokyo',
    region: 'asia-northeast1',
    secrets: ['CLAUDE_API_KEY'],
    memory: '512MiB',
    timeoutSeconds: 540,      // 最大9分
    maxInstances: 1,          // 重複実行防止
  },
  async () => {
    await runWeeklyReportBatch();
  },
);
```

### 1-2. バッチ処理（ページング）

Firestoreの `users/{userId}` ルートドキュメントに `isPremium: boolean` を denormalize して持つことで、プレミアムユーザーを直接クエリできるようにする（後述）。

```typescript
async function runWeeklyReportBatch(): Promise<void> {
  const weekKey = getISOWeekKey(new Date()); // "2026-W14"

  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  const PAGE_SIZE = 50;
  let processedCount = 0;
  let errorCount = 0;

  while (true) {
    let query = db.collection('users')
      .where('isPremium', '==', true)
      .orderBy('__name__')
      .limit(PAGE_SIZE);

    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;

    // Claude API レート制限を考慮して 5 件ずつ並列処理
    const chunks = chunkArray(snap.docs, 5);
    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(doc => processUserWeeklyReport(doc.id, weekKey))
      );
      results.forEach(r => {
        if (r.status === 'rejected') errorCount++;
        else processedCount++;
      });
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < PAGE_SIZE) break;
  }

  console.log(`Weekly batch done. processed: ${processedCount}, errors: ${errorCount}`);
}
```

### 1-3. ユーザーごとの処理

```typescript
async function processUserWeeklyReport(uid: string, weekKey: string): Promise<void> {
  // 1. 既存レポートチェック（冪等性）
  const reportRef = db.collection('users').doc(uid)
    .collection('aiReports').doc(weekKey);
  const existing = await reportRef.get();
  if (existing.exists) return; // スキップ

  // 2. 直近7日の sleepLogs を取得
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const startDate = sevenDaysAgo.toISOString().split('T')[0];

  const logsSnap = await db.collection('users').doc(uid)
    .collection('sleepLogs')
    .where('date', '>=', startDate)
    .orderBy('date', 'desc')
    .limit(7)
    .get();

  if (logsSnap.docs.length < 3) return; // データ不足スキップ

  // 3. goal / profile 取得
  const [goalSnap, profileSnap] = await Promise.all([
    db.collection('users').doc(uid).collection('goal').doc('main').get(),
    db.collection('users').doc(uid).collection('profile').doc('main').get(),
  ]);

  // 4. 前週のログを取得（前週比計算用）
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const prevWeekStart = fourteenDaysAgo.toISOString().split('T')[0];
  const prevLogsSnap = await db.collection('users').doc(uid)
    .collection('sleepLogs')
    .where('date', '>=', prevWeekStart)
    .where('date', '<', startDate)
    .get();

  const logs = logsSnap.docs.map(d => ({ ...d.data(), date: d.id }));
  const prevLogs = prevLogsSnap.docs.map(d => d.data());

  // 5. Claude 呼び出し
  const result = await callClaudeForWeeklyReport(
    logs, prevLogs, goalSnap.data() ?? null, profileSnap.data() ?? null
  );

  // 6. Firestore に保存
  await reportRef.set({
    type: 'weekly',
    content: result,
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    inputSummary: `auto-generated ${weekKey}`,
  });

  // 7. FCM 通知送信
  await sendWeeklyReportNotification(uid);
}
```

### 1-4. エラー処理・コスト管理

- `Promise.allSettled` により1ユーザーの失敗が全体を止めない
- 既存レポートチェックで冪等性を保証（Cloud Scheduler の重複発火でも安全）
- データ3件未満のユーザーはスキップ
- コスト試算: Claude Haiku 1件あたり約 2,100 tokens → 100ユーザー/週 ≒ $0.36

---

## Step 2: isPremium Denormalization

### validatePurchase / activateTrial の改修

```typescript
// validatePurchase と activateTrial のサブスクリプション書き込み後に追加
await db.collection('users').doc(uid).set(
  { isPremium: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
  { merge: true }
);
```

`users/{userId}` ルートドキュメントは Admin SDK のみが書き込む。クライアントからは read のみ許可。

---

## Step 3: FCMトークン管理

### Firestoreの保存場所

```
users/{userId}/fcmTokens/{token}
  - token: string        (ドキュメントIDと同じ)
  - platform: 'android' | 'ios'
  - updatedAt: Timestamp
  - isValid: boolean
```

サブコレクションにする理由: 複数デバイス対応、トークン個別無効化が容易

### src/services/fcmService.ts（新規）

```typescript
import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Platform } from 'react-native';

export async function registerFcmToken(): Promise<void> {
  const user = auth().currentUser;
  if (!user) return;

  const authStatus = await messaging().hasPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  if (!enabled) return;

  const token = await messaging().getToken();
  if (!token) return;

  await firestore()
    .collection('users').doc(user.uid)
    .collection('fcmTokens').doc(token)
    .set({
      token,
      platform: Platform.OS,
      updatedAt: firestore.FieldValue.serverTimestamp(),
      isValid: true,
    });
}

export async function deleteFcmToken(): Promise<void> {
  const user = auth().currentUser;
  if (!user) return;
  try {
    const token = await messaging().getToken();
    if (!token) return;
    await firestore()
      .collection('users').doc(user.uid)
      .collection('fcmTokens').doc(token)
      .update({ isValid: false });
    await messaging().deleteToken();
  } catch {
    // silent
  }
}
```

### FCMトークン登録タイミング（3箇所）

**A. オンボーディング完了時**（`authStore.ts`）:
```typescript
completeOnboarding: async () => {
  await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  set({ hasCompletedOnboarding: true });
  registerFcmToken().catch(() => {});
},
```

**B. サインイン後**（`authStore.ts` の `onAuthStateChanged`）:
```typescript
if (!user.isAnonymous) {
  await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  registerFcmToken().catch(() => {});
}
```

**C. 通知パーミッション付与後**（`NotificationStep.tsx`）:
```typescript
if (granted) {
  registerFcmToken().catch(() => {});
}
```

### トークン無効化ハンドリング（Cloud Functions側）

```typescript
async function sendWeeklyReportNotification(uid: string): Promise<void> {
  const tokensSnap = await db.collection('users').doc(uid)
    .collection('fcmTokens')
    .where('isValid', '==', true)
    .get();

  if (tokensSnap.empty) return;

  const tokens = tokensSnap.docs.map(d => d.data().token as string);

  const sendResults = await Promise.allSettled(
    tokens.map(token =>
      admin.messaging().send({
        token,
        notification: {
          title: '📊 今週の睡眠レポートが届きました',
          body: '先週の睡眠を振り返りましょう',
        },
        data: { type: 'weekly_report' },
        android: {
          channelId: 'yoake_weekly_report',
          priority: 'high',
        },
      })
    )
  );

  // 無効トークンを Firestore でフラグ更新
  const batch = db.batch();
  sendResults.forEach((result, i) => {
    if (result.status === 'rejected') {
      const code = (result.reason as any)?.errorInfo?.code ?? '';
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        batch.update(tokensSnap.docs[i].ref, { isValid: false });
      }
    }
  });
  await batch.commit();
}
```

---

## Step 4: サーバー側AIプロンプト

### functions/src/reportBuilder.ts（新規）

```typescript
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

export function buildServerWeeklyUserMessage(
  logs: any[],
  prevLogs: any[],
  goal: any | null,
): string {
  const avgScore = Math.round(logs.reduce((s, l) => s + (l.score ?? 0), 0) / logs.length);
  const prevAvg = prevLogs.length > 0
    ? Math.round(prevLogs.reduce((s, l) => s + (l.score ?? 0), 0) / prevLogs.length)
    : null;

  const scoreLine = prevAvg !== null
    ? `平均スコア: ${avgScore}点（前週比 ${avgScore - prevAvg >= 0 ? '+' : ''}${avgScore - prevAvg}点）`
    : `平均スコア: ${avgScore}点`;

  const wakeFeelingMap: Record<string, string> = { GOOD: 'すっきり', NORMAL: 'ふつう', BAD: 'つらい' };
  const sleepOnsetMap: Record<string, string> = { FAST: '5分以内', NORMAL: '15〜30分', SLOW: '30分以上' };

  const logsText = logs.map(log => {
    const bedTime = log.bedTime?.toDate?.() ?? new Date(log.bedTime);
    const wakeTime = log.wakeTime?.toDate?.() ?? new Date(log.wakeTime);
    const h = Math.floor(log.totalMinutes / 60);
    const m = log.totalMinutes % 60;
    const habits = (log.habits ?? []).filter((h: any) => h.checked).map((h: any) => `${h.emoji}${h.label}`).join(', ');
    const lines = [
      `【${log.date} ${bedTime.getHours()}:${String(bedTime.getMinutes()).padStart(2,'0')}就寝 → ${wakeTime.getHours()}:${String(wakeTime.getMinutes()).padStart(2,'0')}起床 / ${h}時間${m}分 / スコア${log.score}点】`,
      `  目覚め: ${wakeFeelingMap[log.wakeFeeling] ?? log.wakeFeeling} / 寝つき: ${sleepOnsetMap[log.sleepOnset] ?? log.sleepOnset}`,
    ];
    if (log.deepSleepMinutes != null) lines.push(`  深睡眠: ${log.deepSleepMinutes}分 / 覚醒: ${log.awakenings ?? 0}回`);
    if (habits) lines.push(`  習慣: ${habits}`);
    if (log.memo) lines.push(`  メモ: ${log.memo}`);
    return lines.join('\n');
  }).join('\n');

  const seasonMap: Record<number, string> = {
    1: '1月・冬', 2: '2月・冬', 3: '3月・春', 4: '4月・春', 5: '5月・春',
    6: '6月・初夏', 7: '7月・夏', 8: '8月・真夏', 9: '9月・秋',
    10: '10月・秋', 11: '11月・秋', 12: '12月・冬',
  };
  const month = new Date().getMonth() + 1;

  return [
    `【季節】${seasonMap[month]}`,
    '',
    `【直近7日の睡眠データ（${logs.length}日分）】`,
    logsText,
    '',
    `【統計】${scoreLine}`,
    '',
    `【目標】${goal ? `${goal.targetHours}時間 / スコア${goal.targetScore}点以上` : '未設定'}`,
  ].join('\n');
}
```

---

## Step 5: クライアント側の変更

### 5-1. FCM バックグラウンドハンドラ

`index.tsx`（React Native エントリーポイント）の **最外スコープ** に登録が必要：

```typescript
// AppRegistry.registerComponent の前に追加
import messaging from '@react-native-firebase/messaging';
messaging().setBackgroundMessageHandler(async _remoteMessage => {
  // バックグラウンドでは通知トレイに自動表示される。追加処理不要
});
```

### 5-2. navigation/index.tsx に追加するハンドラ

```typescript
// フォアグラウンド通知受信（FCMはフォアグラウンドで自動表示しないため Notifee で表示）
useEffect(() => {
  const unsubMsg = messaging().onMessage(async msg => {
    if (msg.data?.type === 'weekly_report') {
      await notifee.displayNotification({
        title: msg.notification?.title ?? '📊 週次レポート',
        body: msg.notification?.body ?? '今週の睡眠レポートが届きました',
        android: { channelId: WEEKLY_REPORT_CHANNEL_ID, pressAction: { id: 'default' } },
      });
    }
  });

  // バックグラウンド→通知タップ
  const unsubOpened = messaging().onNotificationOpenedApp(msg => {
    if (msg.data?.type === 'weekly_report' && navigationRef.isReady()) {
      navigationRef.navigate('Main', { screen: 'Report' } as any);
    }
  });

  // トークンリフレッシュ
  const unsubRefresh = messaging().onTokenRefresh(async newToken => {
    const user = auth().currentUser;
    if (user) await saveFcmToken(newToken);
  });

  return () => { unsubMsg(); unsubOpened(); unsubRefresh(); };
}, []);

// アプリ終了状態から通知タップで起動した場合
const handleNavigationReady = useCallback(async () => {
  const remoteMessage = await messaging().getInitialNotification();
  if (remoteMessage?.data?.type === 'weekly_report') {
    setTimeout(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('Main', { screen: 'Report' } as any);
      }
    }, 500);
  }
  // 既存の Notifee 処理...
}, []);
```

### 5-3. Android 通知チャンネル

`android/app/src/main/AndroidManifest.xml` に追加：

```xml
<meta-data
  android:name="com.google.firebase.messaging.default_notification_channel_id"
  android:value="yoake_weekly_report" />
```

これがないと FCM バックグラウンド通知がデフォルトチャンネル（importance: DEFAULT）で表示され、バナーが出ない。

---

## Step 6: Firestore セキュリティルール変更

```javascript
// users/{userId} ルートドキュメント（isPremium フラグ）
match /users/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if false;  // Admin SDK のみ（Cloud Functions）
}

// FCMトークン: クライアントから自分のものだけ読み書き可
match /users/{userId}/fcmTokens/{tokenId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

---

## 注意点・落とし穴

### Firebase Functions v2 の注意

- `onSchedule` のインポートは `firebase-functions/v2/scheduler`（v6の書き方）
- エミュレーターでは Scheduled Function は自動発火しない。テストはHTTPトリガーでラップして手動呼び出し

### タイムゾーン

- `timeZone: 'Asia/Tokyo'` + `schedule: '0 7 * * 1'` で JST 月曜 07:00 に正しく発火する
- Cloud Scheduler のコンソールで次回実行時刻を確認して検証する

### FCM バックグラウンドハンドラの登録場所

`messaging().setBackgroundMessageHandler()` は **`index.tsx` の最外スコープ** で登録しないと動作しない。`useEffect` 内では機能しない。

### isPremium の整合性

`users/{userId}.isPremium` はバッチ処理のクエリ最適化用キャッシュ。課金判定の正式ソースは `subscription/main` を維持する。サブスクリプション期限切れのフラグ更新は別途 Scheduled Function で対応する。

### コスト試算

| 項目 | 試算 |
|---|---|
| Claude Haiku 1件 | 入力 ~1,500 tokens + 出力 ~600 tokens |
| 100ユーザー/週 | ~$0.36/週 |
| Firestore 読み取り | 100ユーザー × 約15reads ≒ 1,500 reads/週 |
| FCM | 無料 |
