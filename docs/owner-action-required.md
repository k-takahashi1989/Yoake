# オーナー対応が必要なタスク一覧

> 作成日: 2026-03-26
> このファイルはコードで自動化できない、オーナーご本人にしか実施できないタスクです。

---

## 🔴 最優先（これがないとAI機能が動かない）

### 1. Firebase Blazeプランへの移行

**なぜ必要か**: Cloud Functions（AIひとこと・週次レポート・AIチャット・購入検証）は Spark プランでは使用不可。

**手順:**
1. [Firebase Console](https://console.firebase.google.com) を開く
2. 左下の「Spark」プランをクリック
3. 「アップグレード」→「Blaze（従量課金）」を選択
4. クレジットカードを登録

**コスト目安**: 月100ユーザー規模では ¥300〜¥1,000/月程度（無料枠内に収まることも多い）

---

### 2. `functions/.env` の CLAUDE_API_KEY 設定

**なぜ必要か**: これがないとすべてのAI機能（日次アドバイス・週次レポート・AIチャット）が動作しない。

**手順:**
```bash
# プロジェクトルートで実行
cd functions
# .env ファイルを作成（.gitignore済みなので安全）
echo "CLAUDE_API_KEY=sk-ant-..." > .env
```

**APIキーの取得**: [Anthropic Console](https://console.anthropic.com) → API Keys → Create Key

---

### 3. Cloud Functions のデプロイ

**なぜ必要か**: 本番環境でAI機能が動作するために必要。

**手順:**
```bash
cd C:\Users\neigh\Documents\Yoake\Yoake
npm install -g firebase-tools   # 未インストールの場合
firebase login                  # 未ログインの場合
firebase deploy --only functions
```

**確認**: デプロイ後に Firebase Console → Functions で5つの関数が表示されること
- `claudeGenerateDaily`
- `claudeGenerateWeekly`
- `claudeSendChatMessage`
- `validatePurchase`
- `activateTrial`

---

## 🟠 高優先（Google Play リリースに必要）

### 4. Google Play Developer アカウントの本番アプリ登録

**なぜ必要か**: アプリを一般公開するために必要。

**手順:**
1. [Google Play Console](https://play.google.com/console) を開く
2. 「アプリを作成」→ アプリ名「YOAKE」・デフォルト言語「日本語」
3. パッケージ名: `com.ktakahashi.yoake`
4. ストア掲載情報を入力（下記「ストア掲載情報チェックリスト」参照）

---

### 5. Health Connect API 申請

**なぜ必要か**: 審査なしでは Health Connect の権限が本番ビルドで使用不可。審査に1〜4週間かかるため最優先で申請すること。

**手順:**
1. Google Play Console → 対象アプリ → 「ポリシーとプログラム」→「アプリのコンテンツ」
2. 「Health Connect の権限」セクションで申請フォームに記入
3. 使用する権限: `READ_SLEEP` / `READ_HEART_RATE`
4. 使用目的: 睡眠データの記録・分析・スコアリング

**申請時に必要な情報:**
- プライバシーポリシーURL（`LINKS.PRIVACY_POLICY` 定数に設定済みのURL）
- アプリのスクリーンショット（Health Connect連携の画面）
- データの使用目的の説明文

---

### 6. Google Play Billing のサービスアカウント設定

**なぜ必要か**: 購入検証（Cloud Functions の `validatePurchase`）がサービスアカウント経由でPlay APIを叩くため。

**手順:**
1. [Google Cloud Console](https://console.cloud.google.com) → IAM → サービスアカウント
2. 新規サービスアカウントを作成（またはFirebaseが作成したものを使用）
3. Google Play Console → 設定 → API アクセス → サービスアカウントをリンク
4. 「財務データ閲覧者」権限を付与
5. サービスアカウントのJSONキーをダウンロード → `functions/service-account.json` に配置

---

### 7. Google Play ストア掲載情報の準備

**必要な素材:**

| 素材 | サイズ | 備考 |
|---|---|---|
| アプリアイコン | 512×512px PNG | 透過なし |
| フィーチャーグラフィック | 1024×500px | ストアトップに表示される横長バナー |
| スクリーンショット（最低2枚） | 各種端末サイズ | ホーム・日記・レポート画面を推奨 |
| 短い説明文 | 80文字以内 | 例:「AIが毎朝あなたの睡眠を採点。習慣との相関を分析し、質の高い眠りへ導きます」|
| 詳細説明文 | 4000文字以内 | 機能一覧・差別化ポイント |

**プライバシーポリシー**: 公開URLが必須（Google Play の要件）

---

## 🟡 中優先（リリース後に対応）

### 8. 価格設定の最終確認

**現在の設定:**
- 月額: ¥380/月
- 年額: ¥2,800/年

**検討事項:** 分析では¥380は安すぎる可能性が指摘されている。
- ¥500/月 → 月5万円に必要なユーザー数が200人→125人に減る
- 価格変更は Google Play Console → アプリ → 収益化 → 製品 から変更可能
- **既存ユーザーへの影響**: 変更前に購入済みのサブスクは旧価格が適用されるため、早めに適正価格に設定するほうがよい

**推奨**: ¥480〜¥580/月 での再設定を検討

---

### 9. プライバシーポリシー・利用規約の公開

**なぜ必要か**: Google Play 審査要件・Health Connect 申請要件・匿名認証ユーザーへの法的開示義務。

**現状**: `LINKS` 定数に URL が設定されているが、ページが存在するかは未確認。

**対応:**
1. `ktakahashi.dev/yoake/privacy` にプライバシーポリシーを公開
2. `ktakahashi.dev/yoake/terms` に利用規約を公開
3. 最低限の記載事項:
   - 収集するデータ（睡眠データ・Firebase匿名ID）
   - データの使用目的（スコア計算・AI分析）
   - 第三者提供（Anthropic API・Firebase）
   - データ削除方法（アプリ内「データをリセット」機能）

---

### 10. Firebase Crashlytics の有効化確認

**なぜ必要か**: 本番リリース後のクラッシュを把握するために必要。

**手順:**
1. Firebase Console → Crashlytics
2. アプリが表示されていれば有効化済み
3. 表示されていない場合は `@react-native-firebase/crashlytics` の設定を確認

---

## 📋 リリース前チェックリスト

```
インフラ
  [ ] Firebase Blaze プランに移行済み
  [ ] functions/.env に CLAUDE_API_KEY 設定済み
  [ ] firebase deploy --only functions 完了
  [ ] Google Play サービスアカウント設定完了

アプリ設定
  [ ] com.ktakahashi.yoake で Google Play Console アプリ登録済み
  [ ] アプリアイコン・スプラッシュ画面が YOAKE ブランドになっている
  [ ] リリースビルド（release APK/AAB）でのE2Eテスト完了
  [ ] IAP（課金）の実機テスト完了（Google Play の内部テストトラック推奨）

審査・申請
  [ ] Health Connect API 申請済み（審査結果を待つ）
  [ ] プライバシーポリシー・利用規約を公開済み
  [ ] ストア掲載情報（スクリーンショット・説明文）入力済み

リリース
  [ ] 内部テスト → クローズドテスト → オープンテスト → 製品版 の段階的ロールアウト
  [ ] 最初は「製品版の 20%」にロールアウトしてクラッシュがないか確認
```

---

## 参考リンク

- Firebase Console: https://console.firebase.google.com
- Google Play Console: https://play.google.com/console
- Anthropic Console（APIキー発行）: https://console.anthropic.com
- Google Cloud Console（サービスアカウント）: https://console.cloud.google.com
- Health Connect 申請ガイド: https://developer.android.com/health-and-fitness/guides/health-connect/publish/request-permissions
