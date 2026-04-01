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
- トリガー: 月曜日の初回アプリ起動（直近7日に3件以上のログ）【確定】
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

| 機能 | Android | iOS | 備考 |
|---|---|---|---|
| 睡眠記録（手動） | ✅ | 🚧 | ビルド確認待ち |
| Health Connect | ✅ | ❌ | HealthKit実装が必要 |
| スコア計算 | ✅ | 🚧 | ロジックは共通 |
| AIひとこと | ✅ | 🚧 | Cloud Functions共通 |
| 週次レポート | ✅ | 🚧 | Cloud Functions共通 |
| AIチャット | ✅ | 🚧 | Cloud Functions共通 |
| 通常アラーム | ✅ | ❌ | BGTaskScheduler対応必要 |
| スマートアラーム | ✅ | ❌ | BGTaskScheduler + HealthKit |
| Google Play Billing | ✅ | ❌ | Apple IAP対応必要 |
| プッシュ通知 | ✅ | ❌ | APNs設定必要 |

---

## UI・アニメーション仕様

### 共通
- **ScalePressable** (`src/components/common/ScalePressable.tsx`) — 主要ボタンの共通コンポーネント。press時 scale 1→0.96（80ms）、release時 spring で 1 に戻る
- **触覚フィードバック** (`src/utils/haptics.ts`) — `light` / `success` / `warning` の3種。Android: Vibration API

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
