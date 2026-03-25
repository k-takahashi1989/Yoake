# YOAKE 改善点レビュー

> 作成日: 2026-03-25
> 対象バージョン: v0.1.0（Week8 MVP）
> レビュー観点: セキュリティ / 収益化 / UX / コード品質 / パフォーマンス / 法務

---

## 凡例

| 優先度 | 目安 |
|--------|------|
| 🔴 CRITICAL | リリース前に必ず対応（ユーザー被害・収益損失リスク） |
| 🟠 HIGH | ベータ前に対応推奨（品質・信頼性に直結） |
| 🟡 MEDIUM | v1.1 以降で対応（改善効果は大きいが緊急性は低い） |
| 🟢 LOW | ポリッシュ（余裕があれば） |

---

## 1. セキュリティ

### 🔴 ~~Claude API キーがクライアントに露出~~ ✅ 実装済み

**場所**: `src/services/claudeApi.ts:8`, `src/config.ts`

```typescript
const CLAUDE_API_KEY = CONFIG.CLAUDE_API_KEY;  // APKリバースエンジニアリングで抽出可能
```

APK は `apktool` 等で逆コンパイルすると文字列定数が平文で取得できる。`.gitignore` でリポジトリから除外しても、**リリースビルドの中に残る**。

**推奨対応**:
- Firebase Cloud Functions（または自前バックエンド）でプロキシを立て、APIキーはサーバー側のみに保持する
- クライアントは Firebase Auth の ID トークンを添えて Cloud Function を呼び出す
- Cloud Function 側で課金ユーザーかどうかも検証できる（=API乱用防止）

---

### 🔴 ~~サブスクリプション検証がクライアント完結~~ ✅ 実装済み

**場所**: `src/stores/authStore.ts:53-56`, `src/screens/Onboarding/steps/TrialStep.tsx`

```typescript
const isPremium =
  subscription !== null &&
  (subscription.status === 'active' || subscription.status === 'trial');
```

Firestore の `subscription.status` を書き換えられれば有料機能を無料で利用できる。現状は Firestore Rules が `users/{uid}/**` への本人書き込みを許可しているため、Firestoreクライアント SDK から直接 `status: 'active'` と書き込める。

**推奨対応**:
- Google Play Billing のレシートは Cloud Function で Google の検証エンドポイントに送り、検証結果を Admin SDK 経由で Firestore に書き込む
- クライアントは `subscription` ドキュメントに **write 不可** のルールを追加する:
  ```
  match /users/{userId}/subscription/main {
    allow read: if request.auth.uid == userId;
    allow write: if false;  // Cloud Function のみ Admin SDK で書き込む
  }
  ```

---

### 🔴 ~~トライアル重複利用が防げない~~ ✅ 実装済み

**場所**: `authStore.ts:81-84`

匿名アカウントでオンボーディングを完了 → ログアウト → 再インストール すると、新しい匿名 UID で何度でも7日トライアルが使える。

**推奨対応**:
- デバイス固有ID（例: `react-native-device-info` の `getUniqueId()`）と使用済みフラグを Cloud Function で突き合わせる
- または Apple/Google のサブスクリプション API でトライアル履歴を確認する

---

### 🟠 ~~`generatedAt` フィールドに偽の Timestamp~~ ✅ 実装済み

**場所**: `src/services/claudeApi.ts:196, 233, 296`

```typescript
generatedAt: { toDate: () => new Date() } as any,  // 偽のFirestoreタイムスタンプ
```

Firestore への保存時に実際の Timestamp に変換されるが、`as any` キャストで型チェックを回避している。Firestoreのクエリ（`orderBy('generatedAt', 'desc')`）が意図通りに動かない可能性がある。

**推奨対応**:
```typescript
generatedAt: firestore.Timestamp.now(),
```

---

### 🟠 ~~Firestore ルールにデータサイズ制限がない~~ ✅ 実装済み

**場所**: `firestore.rules:105-108`

```
match /users/{userId}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

`sleepLogs` や `chatHistory` に無制限にドキュメントを追加できる。悪意あるユーザーが大量書き込みをした場合、Firestore の読み取りコスト（= 課金）が跳ね上がる。

**推奨対応**:
```
match /users/{userId}/sleepLogs/{date} {
  allow write: if request.auth.uid == userId
    && request.resource.data.memo == null
       || request.resource.data.memo.size() <= 500;
}
```

---

### 🟡 匿名認証のデータ引き継ぎ手段がない

ユーザーが端末を変えたり、アプリを再インストールすると匿名 UID が変わり、**過去のデータがすべて消える**。

**推奨対応**:
- Google/Apple サインインへのアカウントリンク機能（`auth().currentUser.linkWithCredential()`）を追加する
- プロフィール編集画面に「アカウントをリンク」ボタンを設ける

---

## 2. 収益化

### 🔴 ~~ペイウォールが弱い・誘導が少ない~~ ✅ 実装済み

**場所**: `ReportScreen.tsx:208-224`, `AiChatScreen.tsx:98-115`

「有料プランで利用できます」の1文だけで、何が得られるかの説明・価格・トライアルCTAが不十分。

**推奨改善**:
- ロック画面に「7日間無料で始める → ¥380/月」ボタンを常に表示
- 各機能で「プレビュー」として一部を見せてから制限する（例: グラフの7日分は無料、30日はProで解禁）
- `SubscriptionManageScreen` へのディープリンクをペイウォールごとに設置

---

### 🟠 AIチャットの使用制限がない（無制限呼び出し可）

**場所**: `AiChatScreen.tsx`

プレミアムユーザーはチャットを無制限に利用できる。Claude Haiku は比較的安価だが、1ユーザーが1日100回チャットすると無視できないコストになる。

**推奨対応**:
- 1日あたりの呼び出し回数を Cloud Function でカウント・制限（例: 無料 3回/日、プレミアム 30回/日）
- トークン消費は Firestore に記録し、月次上限を設ける

---

### 🟠 週次AIレポートが手動生成のみでは使われない

**場所**: `ReportScreen.tsx:148`

月曜日のみ自動生成、かつユーザーが「生成する」ボタンを押す必要がある。ほとんどのユーザーは気づかない。

**推奨対応**:
- Cloud Functionで毎週月曜朝8時に自動生成してプッシュ通知で案内
- 初回レポートを「7日経過後に自動生成されました」と通知することで、プレミアム継続のインセンティブにする

---

### 🟡 ~~年額プランのPRが弱い~~ ✅ 実装済み

**場所**: `SubscriptionManageScreen.tsx`, `constants.ts:46`

月¥380 × 12 = ¥4,560 に対して年額¥2,800 は大幅割引（約40%オフ）だが、UIで割引率が目立たない。

**推奨改善**:
- 年額プランに「🎉 40%OFF」バッジを追加
- 月換算価格（¥233/月）を大きく表示

---

### 🟡 ~~解約後のデータ保持ポリシーが不明確~~ ✅ 実装済み

解約後に過去のAIレポートや詳細グラフにアクセスできるかどうかが UI に明示されていない。「データは保持・閲覧不可になる」と伝えることが再購入の動機にもなる。

---

## 3. ユーザビリティ（UX/UI）

### 🟠 ~~スコアの意味がホーム画面で伝わらない~~ ✅ 実装済み

**場所**: `HomeScreen.tsx`

スコアリング(例: 74点)が表示されるが、「何点が良いのか」「どうすれば上がるのか」の文脈がない。`ScoreDetailScreen` に遷移しないと内訳がわからない。

**推奨改善**:
- スコアの下に「前日比 +3点」「今週平均 72点」などコンテキスト情報を1行追加
- スコアリングの「初回表示」時のみ簡単な説明をオーバーレイで出す

---

### 🟠 ~~Health Connect ローディングにタイムアウトがない~~ ✅ 実装済み

**場所**: `SleepInputModal.tsx`

Health Connect の取得中スピナーが出続け、失敗しても画面が変わらないケースがある（権限エラー等）。

**推奨対応**:
```typescript
// 5秒タイムアウト
const timer = setTimeout(() => {
  setSourceMode('manual');
  Alert.alert('取得タイムアウト', '手動入力に切り替えました');
}, 5000);
```

---

### 🟠 ~~「前日の記録がない」バナーが毎回表示される~~ ✅ 実装済み

**場所**: `HomeScreen.tsx:175-189`

`dismissedYesterday` が `useState` なので、アプリを再起動するたびにバナーが復活する。毎日同じバナーが出ることでノイズになる。

**推奨対応**:
- AsyncStorage に「無視した日付」を保存し、同じ日には表示しない

---

### 🟠 ~~オンボーディング完了後に何も起きない~~ ✅ 実装済み

**場所**: `OnboardingScreen.tsx` → `HomeScreen.tsx`

初回起動でオンボーディングを終えてホーム画面に遷移した瞬間、データゼロ・スコアなしの画面が表示される。「まず記録を始めましょう」的な誘導がない。

**推奨改善**:
- 初回起動後に「今日の睡眠を記録する」ボタンをフルスクリーンCTAで表示する
- または空状態のホーム画面に教育的なプレースホルダーを追加

---

### 🟡 ~~日記画面の空状態にアクションがない~~ ✅ 実装済み

**場所**: `DiaryScreen.tsx`

データゼロ時に「📔」絵文字と「まだ記録がありません」テキストのみ。「記録する」ボタンがない。

---

### 🟡 ~~アラーム画面でスヌーズ残回数が直感的でない~~ ✅ 実装済み

**場所**: `AlarmFiringScreen.tsx`

「スヌーズ残り0回」の表示はあるが、残り0回になってから「これ以上スヌーズできません」と Alert が出る。残り回数が少なくなる前から警告を出す方が親切。

---

### 🟡 ~~習慣カスタマイズの上限(6件)の説明がない~~ ✅ 既実装確認済み

**場所**: `HabitCustomizeModal.tsx`

無料ユーザーが7件目を追加しようとすると「プレミアムが必要です」のアラートが出るが、理由が唐突。リスト上部に「無料プランは6件まで / プレミアムで無制限」を常時表示する方が自然。

---

### 🟡 ~~プロフィール画面の「ゲスト」ユーザー向けの説明が薄い~~ ✅ 実装済み

**場所**: `ProfileScreen.tsx:43`

匿名ユーザーは名前が「ゲスト」になる。アカウントをリンクしていないと端末変更でデータが消えることへの警告がない。

---

### 🟡 ~~タブのアクティブ状態がスクリーンリーダーに非対応~~ ✅ 実装済み

**場所**: `navigation/index.tsx:58-71`

タブアイコンが絵文字テキストのため、TalkBack（Android スクリーンリーダー）では「🌙 ホーム」のように読まれてしまう。`accessibilityLabel` が設定されていない。

---

## 4. コード品質・保守性

### 🟠 ~~`safeToDate()` が `HomeScreen.tsx` に重複定義されている~~ ✅ 実装済み

**場所**: `src/screens/Home/HomeScreen.tsx:21-27`

`src/utils/dateUtils.ts` に同一の関数が存在するが、`HomeScreen` でも独自定義している。

```typescript
// HomeScreen.tsx 21行目（削除すべき）
function safeToDate(ts: any): Date { ... }
```

`import { safeToDate } from '../../utils/dateUtils';` に統一する。

---

### 🟠 ~~`as any` キャストが散在している~~ ✅ 主要箇所を実装済み

| ファイル | 箇所 | 問題 |
|---------|------|------|
| `claudeApi.ts:195,232,296` | `{ toDate: () => new Date() } as any` | 偽のTimestamp |
| `ScoreDetailScreen.tsx:57` | `calculateScore(log as any, [])` | 型安全性の回避 |
| `ReportScreen.tsx:154` | `updatedAt: null as any` | null を Timestamp に代入 |
| `firebase.ts:186` | `(snap.data() as any).messages` | 型定義を使うべき |

---

### 🟠 ~~`reportScreen.tsx` が700行超の神コンポーネント~~ ✅ 実装済み

**場所**: `src/screens/Report/ReportScreen.tsx`

`computeHabitStats`, `buildLineData`, `StatCell`, `HabitCorrelationRow` など複数の責務が1ファイルに集中している。

**推奨分割**:
```
Report/
  ReportScreen.tsx         ← メインコンテナのみ
  components/
    ScoreTrendCard.tsx     ← LineChart + 期間チップ
    HabitCorrelationCard.tsx
    WeeklyReportCard.tsx
  hooks/
    useReportData.ts       ← データ取得ロジック
  utils/
    habitStats.ts          ← computeHabitStats
```

---

### 🟡 ~~`buildLineData` / `computeHabitStats` が毎レンダーで再計算される~~ ✅ 実装済み

**場所**: `ReportScreen.tsx:227-242`

```typescript
// レンダーのたびに再計算（高コスト）
const lineData = buildLineData(monthlyLogs, scorePeriod);
const habitStats = computeHabitStats(logs);
```

**推奨対応**:
```typescript
const lineData = useMemo(
  () => buildLineData(monthlyLogs, scorePeriod),
  [monthlyLogs, scorePeriod],
);
const habitStats = useMemo(() => computeHabitStats(logs), [logs]);
```

---

### 🟡 ~~`loadRecent(30)` のマジックナンバー~~ ✅ 実装済み

**場所**: `HomeScreen.tsx:56`

なぜ 30 か、なぜ 90 か（ReportScreen）がコードを読んでも分からない。定数化を推奨:

```typescript
// constants/index.ts に追加
export const SLEEP_LOG_FETCH_LIMIT = {
  HOME: 30,
  REPORT: 90,
  SEED: 90,
} as const;
```

---

### 🟡 ~~バージョン番号がハードコード~~ ✅ 実装済み

**場所**: `ProfileScreen.tsx:106`

```typescript
<Text style={styles.version}>YOAKE v0.1.0</Text>
```

`package.json` の `version` と乖離しやすい。

```typescript
import { version } from '../../../package.json';
// <Text>YOAKE v{version}</Text>
```

---

### 🟡 `firestore.rules` に他アプリ（SharedMemo）のルールが混在

**場所**: `firestore.rules:8-64`

`sharedMemos`, `couponCodes` は YOAKE とは別のアプリのルール。同一 Firebase プロジェクトを複数アプリで共有しているとみられるが、管理上の混乱を招く。長期的には Firebase プロジェクトを分離することを推奨。

---

## 5. パフォーマンス

### 🟡 ~~`HomeScreen` で `loadRecent(7)` が二重に呼ばれている~~ ✅ 実装済み

**場所**: `HomeScreen.tsx:56, 92`

```typescript
// useEffect で一度呼ばれ…
loadRecent(30);

// さらに loadAiAdvice の中でも呼ばれる
await loadRecent(7);
return useSleepStore.getState().recentLogs;
```

最初の `loadRecent(30)` の結果をそのまま使えばよく、再度フェッチは不要。

---

### 🟡 ~~ReportScreen で毎回 Firestore を3回クエリしている~~ ✅ 実装済み

**場所**: `ReportScreen.tsx:168-176`

`getRecentSleepLogs(90)` + `getPastWeeklyReports(8)` の後に `loadWeeklyReport` でさらに `getAiReport` を呼ぶ。`loadData` が呼ばれるたびに最低3回のFirestoreリクエストが発生する。

**推奨対応**:
- `pastReports[0]` が今週のレポートなら `getAiReport(weekKey)` の個別取得は不要

---

### 🟡 ~~過去のチャット履歴が全件取得される~~ ✅ 実装済み

**場所**: `AiChatScreen.tsx`（`getChatMessages` の呼び出し）

チャット履歴がどれだけ増えても全件 Firestore から取得する。1ドキュメントにメッセージ配列で保存しているため、配列が長くなると読み書きコストが線形に増大する。

**推奨対応**:
- 履歴は最新50件のみ保持するよう保存時にスライスする
- またはサブコレクション + ページネーションに変更する

---

## 6. 機能的な抜け・未実装

### 🟠 プッシュ通知の送信ロジックが実装されていない

`Firebase Messaging` はパッケージとして追加されているが、週次レポート完成時・睡眠スコアが大幅改善した時などのプッシュ通知送信ロジックがない。Cloud Function 側も未実装と思われる。

---

### 🟠 Health Connect の統合テストが不足

`readSleepForDate` は実装されているが、実機での動作確認・エラーハンドリングのテストが不足している可能性がある。特に:
- HC が端末にインストールされていない場合
- 権限を後から剥奪された場合
- HC が更新によって API が変わった場合

---

### 🟠 ~~データエクスポート機能がない~~ ✅ 実装済み

個人情報保護法・GDPR の「データポータビリティ権」および Google Play ポリシーに対応するため、ユーザーが自分のデータを CSV/JSON でエクスポートできる機能が必要。`DataManagementScreen` に追加するのが自然。

---

### 🟡 オフライン対応がない

Firestore のオフライン永続化（`enableIndexedDbPersistence`）が未設定。機内モードや電波の弱い環境でアプリを開くと一切データが表示されない。

```typescript
// firebase初期化時に追加
firestore().settings({ persistence: true });
```

---

### 🟡 アプリ内レビュー促進がない

`react-native-in-app-review` を使い、スコアが改善した翌朝（例: 週平均が初めて80点超）にレビューを促すタイミングが最も効果的。

---

### 🟡 ボディログ（体重）画面が未実装

型定義（`BodyLog`）とFirestore CRUD（`saveBodyLog`, `getBodyLog`）は存在するが、入力・閲覧の画面がない。設計書にあるなら実装ステータスを明示すべき。

---

### 🟡 ~~睡眠ログの削除機能がない~~ ✅ 実装済み

`RecordEditScreen` で編集はできるが、誤ったログを**削除**する手段がない。`DataManagementScreen` の「全データ削除」しか削除手段がない。

---

### 🟢 アプリアイコン・スプラッシュスクリーンが未設定

デフォルトのRNアイコン・スプラッシュのままと思われる。

---

## 7. テスト

### 🟠 ~~スコア計算ロジックのエッジケースがテスト不足~~ ✅ 実装済み

**場所**: `__tests__/SleepInputForm.test.tsx`（追加済み）

現状のテストは基本パターンのみ。以下のエッジケースを追加推奨:
- 日をまたぐ就寝（23:30就寝 → 翌7:00起床）の `totalMinutes` 計算
- ちょうど9時間睡眠（oversleepPenaltyの境界）
- Health Connect データありのスコア vs なしのスコアの比較

---

### 🟡 ~~Firebase サービス層の統合テストがない~~ ✅ 実装済み

`src/services/firebase.ts` は全 CRUD 関数をカバーするが、テストがゼロ。最低限 `saveSleepLog` / `getRecentSleepLogs` のモックテストを追加すべき。

---

### 🟡 E2E テストの仕組みがない

Detox は未導入。クリティカルパス（オンボーディング → 睡眠記録 → スコア確認 → レポート生成）は Detox で自動化しておくと、リリース前の回帰テストが楽になる。

---

## 8. 法務・ストアポリシー

### 🟠 ~~プライバシーポリシーがアプリ内に表示されていない~~ ✅ 実装済み

Google Play / App Store とも、プライバシーポリシーへのリンクをアプリ内に設置する必要がある。`ProfileScreen` または `DataManagementScreen` に追加する。

---

### 🟠 ~~健康データの取り扱いに関する同意が不十分~~ ✅ 実装済み

Health Connect 経由で睡眠データ（センシティブ個人情報）を取得する場合、日本の個人情報保護法では「要配慮個人情報」として取得に明示的な同意が必要。現状のオンボーディングの Health Connect 許可画面（`HealthConnectStep`）だけでは不十分な可能性がある。

**推奨対応**:
- 「収集するデータの種類・用途・保存期間・第三者提供の有無」を明示した同意画面を追加する

---

### 🟡 ~~アカウント削除後の AI レポートデータ残留~~ ✅ 実装済み

`deleteAllUserData` は `sleepLogs`, `aiReports` などを削除するが、Claude API に送信したデータの Anthropic 側での保持期間についてプライバシーポリシーに明記が必要。

---

## 9. 将来の拡張性

### 🟡 ~~スコアリングアルゴリズムのバージョン管理がない~~ ✅ 実装済み

スコア計算ロジックを変更した場合、過去のログのスコアと現在のスコアが比較できなくなる。`SleepLog` に `scoreVersion: number` フィールドを追加し、アルゴリズム改訂時に再計算できる仕組みを設けておく。

---

### 🟡 AIモデルのフォールバックがない

`AI_CONFIG.MODEL` が固定されており、Anthropic の API 障害時やモデル非推奨化時の切り替えロジックがない。

---

### 🟢 i18n（多言語化）の準備がゼロ

全文字列がソースにハードコードされている。将来、英語圏への展開を考えるなら `i18next` 等の導入を早期に検討すべき。後から差し込むと工数が膨大になる。

---

## 優先度別まとめ

| 優先度 | 項目 | 分類 | 状態 |
|--------|------|------|------|
| 🔴 | Claude APIキーをバックエンドに移す | セキュリティ | ✅ 実装済み |
| 🔴 | サブスクリプション検証をサーバーサイドで行う | セキュリティ/収益化 | ✅ 実装済み |
| 🔴 | トライアル重複利用の防止 | 収益化 | ✅ 実装済み |
| 🟠 | `generatedAt` の偽 Timestamp を修正 | コード品質 | ✅ 実装済み |
| 🟠 | Firestore ルールにサブスクリプション書き込み禁止を追加 | セキュリティ | ✅ 実装済み |
| 🟠 | アカウントリンク（Google/Apple サインイン）の追加 | UX | スキップ（ネイティブ設定必要） |
| 🟠 | Health Connect ローディングのタイムアウト追加 | UX | ✅ 実装済み |
| 🟠 | 週次レポートのプッシュ通知 | 収益化/UX | 未実装 |
| 🟠 | データエクスポート機能 | 法務 | ✅ 実装済み |
| 🟠 | プライバシーポリシーをアプリ内に表示 | 法務 | ✅ 実装済み |
| 🟠 | `safeToDate` の重複定義を削除 | コード品質 | ✅ 実装済み |
| 🟠 | AIチャットの使用回数制限 | 収益化 | ✅ 実装済み |
| 🔴 | ペイウォールが弱い・誘導が少ない | 収益化 | ✅ 実装済み |
| 🟠 | ペイウォールのCTA改善 | 収益化 | ✅ 実装済み |
| 🟠 | オンボーディング完了後の初回誘導 | UX | ✅ 実装済み |
| 🟠 | 健康データ取り扱い同意画面 | 法務 | ✅ 実装済み |
| 🟠 | ReportScreen 神コンポーネント分割 | コード品質 | ✅ 実装済み |
| 🟡 | チャット履歴50件上限 | パフォーマンス | ✅ 実装済み |
| 🟡 | Firebase統合テスト追加 | テスト | ✅ 実装済み |
| 🟡 | アカウント削除後のAIデータポリシー明記 | 法務 | ✅ 実装済み |
| 🟡 | 前日バナーを AsyncStorage で管理 | UX | ✅ 実装済み |
| 🟡 | `buildLineData` / `computeHabitStats` の `useMemo` 化 | パフォーマンス | ✅ 実装済み |
| 🟡 | loadRecent マジックナンバー定数化 | コード品質 | ✅ 実装済み |
| 🟡 | loadRecent 二重呼び出し修正 | パフォーマンス | ✅ 実装済み |
| 🟡 | ReportScreen Firestore最適化 | パフォーマンス | ✅ 実装済み |
| 🟡 | 年額プランPR強化（40%OFFバッジ） | 収益化 | ✅ 実装済み |
| 🟡 | 解約後データ保持ポリシー明記 | 収益化 | ✅ 実装済み |
| 🟡 | バージョン番号 package.json 化 | コード品質 | ✅ 実装済み |
| 🟡 | UserGoal.updatedAt null as any 除去 | コード品質 | ✅ 実装済み |
| 🟡 | 日記画面の空状態アクション追加 | UX | ✅ 実装済み |
| 🟡 | スヌーズ残回数の視覚的警告 | UX | ✅ 実装済み |
| 🟡 | タブ accessibilityLabel 追加 | アクセシビリティ | ✅ 実装済み |
| 🟡 | ゲストユーザー警告バナー | UX | ✅ 実装済み |
| 🟡 | 睡眠ログの個別削除機能 | UX | ✅ 実装済み |
| 🟡 | オフライン対応（Firestore永続化） | 機能 | スキップ（ネイティブ設定） |
| 🟡 | アプリ内レビュー促進 | 収益化 | スキップ（ライブラリ未導入） |
| 🟡 | スコアリングバージョン管理 | 拡張性 | ✅ 実装済み |
| 🟡 | バージョン番号を `package.json` から取得 | コード品質 | ✅ 実装済み |
| 🟡 | `as any` キャストの撲滅 | コード品質 | ✅ 主要箇所を実装済み |
| 🟡 | ReportScreen の分割（神コンポーネント解消） | コード品質 | ✅ 実装済み |
| 🟢 | アプリアイコン・スプラッシュ設定 | ストア |
| 🟢 | i18n 準備 | 拡張性 |
| 🟢 | アクセシビリティ対応（`accessibilityLabel`） | UX |

---

*このドキュメントは YOAKE v0.1.0 のソースコード全体を読んだ上でのレビューです。Week9以降の実装計画の参考にしてください。*
