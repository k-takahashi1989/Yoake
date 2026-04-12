# YOAKE 機能設計書

> このドキュメントは実装の真実のソースです。コードを変更したら必ずここも更新してください。
> 最終更新: 2026-04-01

---

## ドキュメント構成

| ファイル | 役割 |
|---|---|
| `YOAKE_設計まとめ.md` | プロダクト仕様・コンセプト・ビジネス設計 |
| `docs/feature-spec.md` | **実装レベルの機能設計（このファイル）** |
| `docs/ui-ux-review.md` | UI/UX 改善リスト |
| `YOAKE_改善点レビュー.md` | セキュリティ・品質の改善リスト |

---

## 実装ステータス凡例

| マーク | 意味 |
|---|---|
| ✅ 実装済み | コードが存在し動作する |
| 🚧 部分実装 | 実装中または一部のみ動作 |
| ❌ 未実装 | 設計のみ・コードなし |
| 🔒 有料限定 | isPremium チェックあり |

---

## 1. 認証・ユーザー管理

### Firebase Auth（匿名認証）
- **実装**: `src/stores/authStore.ts`
- **フロー**: 初回起動 → 匿名UID自動生成 → Firestoreにprofile作成
- **ステータス**: ✅ 実装済み

### サブスクリプション
- **実装**: `src/stores/authStore.ts` / Cloud Functions
- **判定**: `isPremium = subscription.status === 'active' || 'trial'`
- **検証**: Cloud Functions で Google Play レシートを検証 → Admin SDKでFirestore書き込み
- **クライアント書き込み禁止**: `subscription` ドキュメントへの直接書き込みはFirestore Rulesで拒否
- **トライアル重複防止**: `react-native-device-info` の `getUniqueId()` とCloud Functionsで照合
- **isPremium denormalization**: `validatePurchase` / `activateTrial` 実行時に `users/{uid}.isPremium = true` を merge 書き込み。`weeklyReportScheduler` のバッチクエリに使用
- **ステータス**: ✅ 実装済み

---

## 2. 睡眠記録

### 実装ファイル
- `src/stores/sleepStore.ts`
- `src/services/healthConnect.ts`
- `src/screens/Home/` 配下（入力モーダル）

### データ取得優先順位
```
Health Connect（自動） → データなし/未連携 → 手動入力
```

### Health Connect 連携
- **ステータス**: ✅ 実装済み（Android）/ ❌ 未実装（iOS: HealthKit対応が必要）
- 権限リクエスト → 過去90日分を一括インポート（Firestoreバッチ処理・500件単位）
- 再連携時は既存ドキュメントをスキップ（手動修正を保護）
- 昼寝除外: 6時間未満 & 昼間のデータは除外

### 手動入力項目
| 項目 | 型 | 備考 |
|---|---|---|
| 就寝時刻 | Timestamp | 「今から寝ます」ボタンで自動記録 |
| 起床時刻 | Timestamp | アラーム「起きた！」で自動記録 |
| 寝つき | `FAST/NORMAL/SLOW` | |
| 目覚め | `GOOD/NORMAL/BAD` | |
| 習慣チェック | `Habit[]` | |
| メモ | `string \| null` | |

### エッジケース
| ケース | 対応 |
|---|---|
| 日付またぎ（深夜2時就寝等） | 就寝日ベースで記録 |
| 昼寝データがHC混入 | 6時間未満 & 昼間 → 除外 |
| 記録0日 | AIひとこと「データが溜まったら分析します」 |

---

## 3. スコア計算

### 実装ファイル
- `src/utils/scoreCalculator.ts`

### Health Connect あり（100点満点）
| 項目 | 配点 | 計算方法 |
|---|---|---|
| 睡眠時間 | 30点 | 7.5〜9h→30 / 7〜7.5h→25 / 6〜7h→18 / 5〜6h→10 / その他→5 |
| 就寝時刻 | 20点 | 22〜23時→20 / 0時→15 / 1時→8 / その他→3 |
| 深睡眠割合 | 15点 | 20%以上→15 / 15%→11 / 10%→7 / 以下→3 |
| 目覚め主観 | 15点 | GOOD→15 / NORMAL→9 / BAD→3 |
| 睡眠連続性 | 10点 | 0回→10 / 1回→8 / 2回→5 / 3回→2 / 4回以上→0 |
| 寝つき主観 | 10点 | FAST→10 / NORMAL→6 / SLOW→2 |

### Health Connect なし（手動入力のみ）
| 項目 | 配点 |
|---|---|
| 睡眠時間 | 40点 |
| 就寝時刻 | 25点 |
| 目覚め主観 | 20点 |
| 寝つき主観 | 15点 |

### ボーナス・ペナルティ
| 条件 | 変動 |
|---|---|
| 就寝時刻ばらつき < 20分 | +5点 |
| 就寝時刻ばらつき < 40分 | +2点 |
| 就寝時刻ばらつき > 90分 | -5点 |
| 9時間超睡眠 | -5点 |

最終スコアは 0〜100 でクランプ。

### スコアラベル・カラー
| スコア | ラベル | カラーキー |
|---|---|---|
| 90〜100 | 最高 | `green` |
| 75〜89 | 良好 | `yellowGreen` |
| 60〜74 | 普通 | `yellow` |
| 40〜59 | やや不足 | `orange` |
| 0〜39 | 要改善 | `red` |

### 睡眠負債
- 計算: 直近14日の「目標睡眠時間 − 実睡眠時間」の合計
- 保存: `SleepLog.sleepDebtMinutes`
- 🔒 詳細表示・推移グラフは有料

---

## 4. AI分析

### 実装ファイル
- `src/services/claudeApi.ts`（Cloud Functions 呼び出しのみ）
- `functions/` 配下（実際のAPI呼び出し・プロンプト）

### 共通仕様
- **モデル**: Claude Haiku 4.5
- **呼び出し経路**: Cloud Functions（APIキーはサーバーのみ）
- **認証**: Firebase Auth IDトークン必須

### 毎朝ひとこと（無料）
- **ステータス**: ✅ 実装済み
- トリガー: **睡眠記録を保存したタイミング**（起動時はキャッシュ表示のみ）
- 入力: 直近14日のsleepLogs + 習慣データ + 目標 + 季節情報
- 出力: 2〜3文の日本語アドバイス
- キャッシュ: Firestore `aiReports/{date}` に保存・当日は再生成しない

### 週次AIレポート（🔒 有料）
- **ステータス**: ✅ 実装済み
- トリガー①（サーバー）: **Scheduled Function `weeklyReportScheduler`** が毎週月曜 07:00 JST に全プレミアムユーザー分を自動生成
  - 実装: `functions/src/index.ts` — `weeklyReportScheduler` / `runWeeklyReportBatch`
  - 条件: 直近7日に3件以上のsleepLogsがある場合のみ生成
  - 冪等: `aiReports/{weekKey}` が既存なら生成をスキップ
  - 生成後: FCMプッシュ通知「📊 今週の睡眠レポートが届きました」を送信
  - ページネーション: 50件ずつ取得 / 5件ずつ並列処理でAPI負荷を分散
- トリガー②（クライアント）: 月曜日の初回アプリ起動（サーバー生成前の場合のフォールバック）
- 再生成ボタン: レポート未生成時のみ表示（生成済みの場合は非表示）
- 保存先: `aiReports/{"YYYY-WNN"}`
- 出力構成: 今週の総評 / 良かった点 / 改善できる点 / 来週のアクション

### AIチャット（🔒 有料）
- **ステータス**: ✅ 実装済み
- コンテキスト: 直近14日のsleepLogs
- 制限: 1セッション最大50メッセージ / 1日10回送信
- max_tokens: 400（Cloud Functions）/ 返答目安150〜300文字

---

## 5. スマートアラーム

- **ステータス**: ❌ 削除済み（通常アラーム・スマートアラームともに削除）
- アラーム機能はアプリから除外されました。関連画面・ストア・サービスは残骸として存在する可能性あり。
- オンボーディングの機能紹介からも削除済み（2026-04-01）

---

## 6. 睡眠日記

### 実装ファイル
- `src/stores/habitStore.ts`
- `src/screens/Diary/`

### デフォルト習慣（無料・6項目）
`☕ カフェイン` / `🍺 飲酒` / `🏃 運動` / `📱 就寝前スマホ` / `😤 ストレス高め` / `🛁 入浴`

### カスタム習慣（🔒 有料・上限20項目）
- **ステータス**: ✅ 実装済み
- 任意の名前 + 絵文字で追加・並び替え・削除・ON/OFF

### AI相関分析
- **ステータス**: ✅ 実装済み
- サンプル5件未満は「データ収集中」表示
- 「あと○日で分析できる」で記録継続を促進

### 習慣別スコア比較グラフ（🔒 有料）
- **ステータス**: ✅ 実装済み

---

## 7. 目標設定

### 設定項目
| 項目 | 型 | デフォルト |
|---|---|---|
| 目標睡眠時間 | Number（分） | 450分（7.5h） |
| 目標スコア | Number | 80 |
| 就寝目標時刻 | `string \| null` | `"23:00"` |

### 反映先
- ホーム: 今週の目標達成進捗バー・「目標まであと○分」
- AI: 全プロンプトに目標を含め、進捗をアドバイスに反映

---

## 8. 画面構成・ナビゲーション

### Bottom Tabs
```
Home / Diary / Report / Alarm / Profile
```

### スタック構成（主要画面）
```
Home
  ├── SleepInputModal（記録入力）
  ├── ScoreDetail
  └── AiChat（🔒）

Diary
  ├── LogDetail
  ├── LogEdit
  └── HabitCustomize（🔒・モーダル）

Report
  ├── WeeklyTab（グラフ🔒）
  └── MonthlyTab（グラフ🔒）

Alarm
  └── AlarmFiring（フルスクリーン）

Profile
  ├── SubscriptionManage
  ├── HealthConnectSettings
  ├── NotificationSettings
  └── DataManage
```

### Paywall（共通）
表示タイミング:
1. 7日より前のログを開いた時
2. 有料グラフをタップした時
3. 週次AIレポートが届く月曜朝（転換率最高）
4. スマートアラーム設定画面

---

## 9. Firestore セキュリティルール

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    // subscription は Cloud Functions(Admin SDK) のみ書き込み可
    match /users/{userId}/subscription/main {
      allow read: if request.auth.uid == userId;
      allow write: if false;
    }
    match /appData/{document=**} {
      allow read: if request.auth != null;
      allow write: if false;
    }
  }
}
```

---

## 10. iOS 対応状況（EAS Build 対応中）

> 監査日: 2026-04-12 / 実装反映日: 2026-04-12  
> 現状は Android-first 設計だが、iOS 向けの主要な土台実装は反映済み。未完了なのは主に Apple/Firebase 側の設定と、Pod install 後の実機ビルド検証。

### 機能別ステータス

| 機能 | Android | iOS | 備考 |
|---|---|---|---|
| 睡眠記録（手動） | ✅ | 🚧 | ビルド未検証 |
| Apple Health 連携 | ✅ HC | 🚧 | `react-native-health` 導入済み。`src/services/appleHealth.ts` 実装済み。HealthKit entitlement 追加済み。`pod install` / 実機検証待ち |
| スコア計算 | ✅ | 🚧 | ロジック共通。`APPLE_HEALTH` ソースをスコア計算対象に追加済み。実機データでの確認待ち |
| AIひとこと | ✅ | 🚧 | Cloud Functions 共通。iOS 側ビルド未検証 |
| 週次レポート | ✅ | 🚧 | Cloud Functions 共通。iOS 側ビルド未検証 |
| AIチャット | ✅ | 🚧 | Cloud Functions 共通。iOS 側ビルド未検証 |
| アラーム | ✅ | ❌ | BGTaskScheduler 対応が必要 |
| 課金（IAP） | ✅ GP | 🚧 | `react-native-iap` は iOS 対応済み。App Store Connect 商品登録が必要 |
| プッシュ通知（FCM） | ✅ | ❌ | APNs 設定・`GoogleService-Info.plist` が必要 |
| ローカル通知（Notifee） | ✅ | 🚧 | `notificationService.ts` に `ios` オプション追加済み。通知許可 / 配信の実機検証待ち |
| スプラッシュ（BootSplash） | ✅ | 🚧 | `AppDelegate.swift` に `RNBootSplash.initWithStoryboard("LaunchScreen")` を追加済み。iOS 起動検証待ち |
| ハプティクス | ✅ | 🚧 | `react-native-haptic-feedback` 導入済み。`src/utils/haptics.ts` を置換済み。実機確認待ち |
| レビュー誘導 | ✅ | ❌ | `STORE_LINKS.APP_STORE_ID` が `null`。App Store ID 設定が必要 |
| SafeArea / ノッチ対応 | ✅ | ✅ | `react-native-safe-area-context` で対応済み |
| KeyboardAvoidingView | ✅ | ✅ | iOS/Android で `behavior` を正しく分岐済み |

---

### ネイティブ設定の不足（ビルド必須）

#### `ios/Yoake/AppDelegate.swift`
反映済み:

```swift
import FirebaseCore
import RNBootSplash

if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
  FirebaseApp.configure()
}

override func customize(_ rootView: RCTRootView) {
  RNBootSplash.initWithStoryboard("LaunchScreen", rootView: rootView)
}
```

補足:
- `GoogleService-Info.plist` が未配置でも起動時クラッシュを避けるため、Firebase 初期化は存在チェック付き
- BootSplash は `LaunchScreen.storyboard` を使う構成
- iOS 実機 / Simulator での起動確認は未実施

#### `ios/Yoake/Info.plist`
反映済み:

```xml
<!-- HealthKit -->
<key>NSHealthShareUsageDescription</key>
<string>睡眠データを取得して記録内容の自動入力に利用します。</string>
<key>NSHealthUpdateUsageDescription</key>
<string>睡眠データをApple Healthへ記録するために利用します。</string>
```

補足:
- HealthKit の usage description は追加済み
- Clinical Records は未使用のため未追加

#### `GoogleService-Info.plist`
Firebase iOS 設定ファイルが存在しない。Firebase Console からダウンロードして `ios/Yoake/` に配置する必要がある。`.gitignore` に追加済みなので、手動管理（EAS Secrets 等）が必要。

#### `ios/Yoake/Yoake.entitlements`
新規追加済み:

```xml
<key>com.apple.developer.healthkit</key>
<true/>
```

補足:
- `ios/Yoake.xcodeproj/project.pbxproj` に `CODE_SIGN_ENTITLEMENTS = Yoake/Yoake.entitlements;` を追加済み
- Xcode 上で HealthKit Capability が正しく反映されるかは未検証

---

### Apple Health 実装状況

反映済みの構成:

```
src/services/
  healthConnect.ts   ← Android（実装済み）
  appleHealth.ts     ← iOS 実装済み
  healthData.ts      ← プラットフォーム振り分け済み
```

`appleHealth.ts` の実装内容:
- `AppleHealthKit.isAvailable()` で利用可否確認
- `AppleHealthKit.initHealthKit()` で `SleepAnalysis` / `HeartRate` 読み取り権限を要求
- `AppleHealthKit.getSleepSamples()` で睡眠セッションを取得
- `INBED` / `ASLEEP` / `CORE` / `DEEP` / `REM` を集計して `bedTime` / `wakeTime` / `deepSleepMinutes` / `remMinutes` / `lightSleepMinutes` / `awakenings` を算出
- `AppleHealthKit.getHeartRateSamples()` で就寝中の平均心拍を算出
- 手入力データは `HKWasUserEntered` を見て除外

残タスク:
- `ios/` で `pod install` 実行
- 実機で HealthKit 許可ダイアログ・睡眠データ取得の確認
- Apple Watch / ヘルスケアの実データでステージ集計の妥当性確認

---

### 対応優先順位

| 優先度 | 作業 | 工数目安 |
|---|---|---|
| **必須** | `GoogleService-Info.plist` 追加 | 30分 |
| **必須** | `pod install` 実行 + iOS ビルド確認 | 30〜60分 |
| **必須** | Apple Health 実機検証（権限 / 睡眠サンプル / 心拍） | 0.5〜1日 |
| 高 | APNs / FCM iOS 設定 | 1〜2時間 |
| 高 | Notifee ローカル通知の実機検証 | 1時間 |
| 中 | App Store Connect の IAP 商品登録 | 1〜2時間 |
| 低 | `APP_STORE_ID` 設定 | 15分 |

---

### iOS 実機検証チェックリスト

事前準備:
- `ios/` で `pod install` 実行済み
- `ios/Yoake/GoogleService-Info.plist` を配置済み
- Apple Developer / Xcode 上で HealthKit Capability が有効
- APNs / Push 関連を検証する場合は証明書・プロビジョニング・Firebase 設定を反映済み

起動確認:
- アプリが iPhone 実機でクラッシュせず起動する
- LaunchScreen から React Native 画面へ自然に遷移する
- `GoogleService-Info.plist` あり / なしの両ケースで起動時挙動が意図通り

Apple Health:
- オンボーディングの Apple Health 接続ボタンで許可ダイアログが出る
- プロフィールの Health 設定画面から再確認できる
- 許可後、当日または過去日の睡眠データが `SleepInputModal` に自動入力される
- `bedTime` / `wakeTime` / `deepSleepMinutes` / `remMinutes` / `lightSleepMinutes` / `heartRateAvg` が妥当
- 手入力の睡眠データが混ざらず、`HKWasUserEntered` 除外が効いている
- ステージ未提供の日は manual スコア配点にフォールバックする

スコア / 表示:
- Apple Health 由来ログが `APPLE_HEALTH` として保存される
- 詳細画面・スコア画面のソース表示が `Apple Health` になる
- ステージありログで睡眠ステージカードが表示される
- ステージなしログで UI が崩れない

通知 / ハプティクス:
- ローカル通知許可が iOS で取得できる
- 朝通知・就寝通知が Notifee 経由で表示される
- フォアグラウンド表示時に banner / list / sound が期待どおり
- `haptics.light()` / `success()` / `warning()` が iPhone 実機で発火する

Firebase / Push:
- `GoogleService-Info.plist` ありで Firebase 初期化が通る
- FCM トークン保存が iOS でも失敗しない
- Push 通知タップで所定画面へ遷移する

課金 / ストア:
- `react-native-iap` の初期化が iOS でエラーにならない
- App Store Connect 商品登録後に商品取得できる
- `APP_STORE_ID` 設定後にレビュー導線が App Store へ遷移する

未通過なら残すメモ:
- 端末 / iOS バージョン
- Apple Watch 連携の有無
- Health アプリに存在した元データの種類
- 再現手順
- コンソールログ / スクリーンショット

---

## UI・アニメーション仕様

### 共通
- **ScalePressable** (`src/components/common/ScalePressable.tsx`) — 主要ボタンの共通コンポーネント。press時 scale 1→0.96（80ms）、release時 spring で 1 に戻る
- **触覚フィードバック** (`src/utils/haptics.ts`) — `light` / `success` / `warning` の3種。Android / iOS とも `react-native-haptic-feedback` を優先し、フォールバックで Vibration API を使用

### 発火タイミング
| イベント | 種類 |
|---|---|
| 睡眠記録 保存成功 | `haptics.success()` |
| スコアがnull→数値に変わった瞬間 | `haptics.light()` |
| AIチャット返信受信 | `haptics.light()` |

### ScoreRing
- スコア75以上: `shadowColor = scoreColor` でグロウ表示（elevation: 12）
- グロウは opacity 0→1 でフェードイン

### ホーム画面 マウント時 stagger reveal
| 要素 | delay |
|---|---|
| ScoreRing エリア | 0ms |
| AIアドバイスカード | 100ms |
| CloudDots | 180ms |
| 睡眠負債カード | 240ms |

各要素: opacity 0→1 + translateY 10→0（250ms, ease-out）

---

## 変更履歴

| 日付 | 変更内容 |
|---|---|
| 2026-04-01 | 初版作成 |
| 2026-04-01 | AIチャットmax_tokens 200→400、プロンプト文字数制限緩和 |
| 2026-04-01 | 週次レポート再生成ボタン：生成済み時は非表示 |
| 2026-04-01 | 今日の一言トリガー：起動時→睡眠記録保存後に変更 |
| 2026-04-01 | 日記画面に「過去の記録を追加」DatePicker追加 |
| 2026-04-01 | ScalePressable共通コンポーネント追加・主要ボタンに適用 |
| 2026-04-01 | ホーム画面 initial stagger reveal 追加 |
| 2026-04-01 | ScoreRing グロウ効果（75点以上）追加 |
| 2026-04-01 | 触覚フィードバック（haptics.ts）追加 |
| 2026-04-01 | バグ修正: HomeScreen AIアドバイス吹き出しのnative/JS driver混在エラー解消（Animated.View分離） |
| 2026-04-01 | バグ修正: ScoreRing.tsx 重複変数宣言・JSXタグ不整合を修正 |
| 2026-04-01 | オンボーディング改善: WelcomeStep に bg_home.png 背景 + stagger reveal アニメーション追加 |
| 2026-04-01 | オンボーディング改善: 機能訴求文言変更・アラームを末尾に移動（「AI睡眠分析アプリ」の印象を強化） |
| 2026-04-01 | オンボーディング改善: 全ステップのボタンを ScalePressable に統一 |
| 2026-04-01 | アラーム機能削除に伴いオンボーディング feature4（スマートアラーム）を削除・3機能表示に変更 |
| 2026-04-01 | ストリーク表示追加: `src/utils/streakCalculator.ts` 新規作成・HomeScreen 日付左下に🔥バッジ表示（2日以上） |
| 2026-04-01 | 朝通知パーソナライズ: `src/services/notificationService.ts` 新規作成・スコア付き通知文・保存時に自動再スケジュール |
| 2026-04-01 | NotificationSettingsScreen: インライン通知関数を notificationService から呼び出しに置き換え |
| 2026-04-01 | sleepStore.saveLog: LAST_SCORE_KEY 保存 + refreshMorningReminderIfEnabled fire-and-forget 追加 |
| 2026-04-01 | B5 しろくまペルソナ導入: `ShirokumaIcon.tsx`（SVGアイコン・表情3種・groomアニメ）+ `ShirokumaBubble.tsx`（吹き出し複合コンポーネント）新規作成。HomeScreen の dreamBubble ゾーンを ShirokumaBubble に差し替え。`DAILY_SYSTEM_PROMPT` をしろくま口調に変更（既適用済）。WelcomeStep に feature0 追加。i18n キー `shirokuma.name` / `aiAdviceCard.title` 更新。 |
| 2026-04-02 | `weeklyReportScheduler` 追加: 毎週月曜 07:00 JST に全プレミアムユーザーの週次レポートをサーバー側で自動生成・FCM通知送信。`functions/src/index.ts` に `onSchedule` import・`SERVER_WEEKLY_SYSTEM_PROMPT` / `chunkArray` / `getISOWeekKey` / `buildServerWeeklyUserMessage` / `sendWeeklyReportNotification` / `processUserWeeklyReport` / `runWeeklyReportBatch` を追加。 |
| 2026-04-02 | `validatePurchase` / `activateTrial` に `users/{uid}.isPremium = true` の denormalization を追加。`weeklyReportScheduler` のバッチクエリ（`isPremium == true` フィルタ）で利用。 |
| 2026-04-11 | バグ修正: 就寝リマインダー「今から寝ます」ボタン押下後にHomeScreen `useFocusEffect` で `getPendingSleepStart()` を確認し、pending があれば SleepInputModal を自動表示するよう修正（HomeScreen.tsx）。 |
| 2026-04-11 | バグ修正: DiaryScreen の日付ピッカーキャンセル時も画面遷移してしまう問題を修正。`onChange` で `event.type !== 'set'` をチェックするよう変更（DiaryScreen.tsx）。 |
| 2026-04-11 | バグ修正: RecordEditScreen の削除後 `navigation.pop(2)` をスタック深度依存の固定値から `navigation.popToTop()` に変更。4画面深（DiaryList→ScoreDetail→RecordDetail→RecordEdit）でも正しくリスト画面に戻るよう修正（RecordEditScreen.tsx）。 |
| 2026-04-12 | § 10. iOS対応状況 を全面更新。監査結果に基づき機能別ステータス・ネイティブ設定の不足・Apple Health 実装計画・対応優先順位を追記。 |
