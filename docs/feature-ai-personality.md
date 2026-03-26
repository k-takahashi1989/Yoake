# AI性格選択機能 設計ログ

> 作成日: 2026-03-26
> ステータス: 実装中

---

## 概要

AIチャット（Claude Haiku）の口調・キャラクターをユーザーが選択できる機能。
睡眠アドバイスの「何を言うか」は変えず、「どう伝えるか」だけを変える。

---

## ユーザーからの指示

> AIチャットの性格を選べるようにしたい。（共通、優しい、熱血、動物など）
> このアプリを多くの人に使ってもらえるようにするにはどうすればいいかという観点で

---

## 専門エージェントによる調査・設計（2026-03-26）

### sleep-analyst の見解（AIプロンプト設計）

**設計方針の核心**:
> 「性格が変えるのは『どう伝えるか』であり『何を伝えるか』ではない」

全性格共通の制約:
- 200〜300文字以内の返答
- 医療的断言の禁止（「〜の可能性があります」止まり）
- データに基づいた根拠を最低1つ入れる
- 共感→アドバイス1点の構造

**各性格のコンセプト**:

| ID | 名称 | コンセプト | 口調例 |
|---|---|---|---|
| `standard` | スタンダード | フレンドリーかつ客観的なコーチ | 「昨夜のスコアは72点でした。就寝時刻がやや遅かったことが影響しています。」 |
| `gentle` | 優しい | 責めずに受け止める。眠れない夜に隣にいる存在 | 「昨日は少し眠れなかったんだね…無理しないでね。一緒に改善しましょう。」 |
| `passionate` | 熱血 | 目標達成にコミットする本気のパーソナルトレーナー | 「72点！まだいける！今夜23時には布団に入るぞ！」 |
| `animal` | しろくまコーチ | 冬眠のプロ。ゆるく・やさしく | 「きのうのねむり、72点だよ🐻‍❄️もうすこしはやねすると、もっとよくなるね！」 |

**動物キャラの選定理由（しろくまを選んだ根拠）**:
- 冬眠＝睡眠の象徴 → 「眠りの達人」設定が自然に成立
- YOAKE の深夜・紺色の世界観と色調が合う
- 「冬眠のプロとして言うと」というフレーズでキャラクター内ロジックが保てる

**追加提案（将来検討）**: 睡眠博士（有料限定）— 科学的根拠を丁寧に解説するキャラ。プレミアム転換の呼び水として機能する可能性あり。

---

### rn-specialist の見解（実装設計）

**保存先: Firestore `UserProfile`（AsyncStorage ではない）**

理由:
- 端末変更・将来のWeb版でも設定が引き継がれる
- 既存の `saveProfile({ merge: true })` に追加フィールドを乗せるだけ
- `authStore.profile` からコンポーネントが即座に参照できる

**型定義**:
```typescript
// src/types/index.ts
export type AiPersonality = 'standard' | 'gentle' | 'passionate' | 'animal';

// UserProfile インターフェースに追加（optional）
aiPersonality?: AiPersonality;
```

**プロンプト切り替えの実装方針**（差分追記方式）:
```typescript
// src/services/claudeApi.ts
function getPersonalityInstruction(personality?: AiPersonality): string {
  // 性格ごとの差分プロンプトを返す。standard は '' を返す。
}

// 3関数共通パターン
const personalityInstruction = getPersonalityInstruction(personality);
const systemPrompt = personalityInstruction
  ? `${BASE_SYSTEM_PROMPT}\n\n${personalityInstruction}`
  : BASE_SYSTEM_PROMPT;
```

基本プロンプトの修正は全性格に自動反映される。Cloud Functions 側は変更不要（`systemPrompt` はすでにパラメータとして受け取っている）。

**変更ファイル一覧**:

| ファイル | 変更内容 |
|---|---|
| `src/types/index.ts` | `AiPersonality` 型追加・`UserProfile.aiPersonality?` 追加 |
| `src/constants/index.ts` | `AI_PERSONALITIES` 配列追加 |
| `src/stores/authStore.ts` | `updateProfile` の引数に `aiPersonality?` 追加 |
| `src/services/claudeApi.ts` | `getPersonalityInstruction()` 追加・3関数の引数拡張 |
| `src/screens/Profile/ProfileScreen.tsx` | MenuRow + PersonalityBottomSheet 追加 |
| `src/i18n/locales/ja.ts` | `personality.*` / `profile.aiPersonality` キー追加 |
| `src/i18n/locales/en.ts` | 同上（英語） |

---

### ui-ux-expert の見解（UI設計）

**配置**: ProfileScreen の MenuRow（`🤖 AIの性格`）→ BottomSheet モーダル

既存の言語選択 MenuRow と同じパターンで自然に追加できる。

**カードデザイン（2列グリッド）**:
```
┌──────────────┐ ┌──────────────┐
│  💬           │ │  🌙           │
│  スタンダード  │ │  優しい        │
│  ─────────── │ │  ─────────── │
│  "72点でした" │ │  "無理しない  │
│              │ │   でね..."    │
└──────────────┘ └──────────────┘

┌──────────────┐ ┌──────────────┐
│  🔥           │ │  🐻‍❄️          │
│  熱血          │ │  しろくまコーチ │
│  ─────────── │ │  ─────────── │
│  "まだいける  │ │  "72点だよ🐻‍❄️ │
│   布団へ！"   │ │   はやね！"   │
└──────────────┘ └──────────────┘
```

選択状態: 性格固有 `themeColor` のボーダー + 薄い背景色 + ✓マーク

**アニメーション**:
- BottomSheet 表示時: カード4枚を staggered slide-in（60ms ずつ遅延、`useNativeDriver: true`）
- 確定ボタン押下: scale bounce（1.0→0.95→1.0）

**コントラスト対応**: サブテキスト `#888` → `#AAAAAA`（WCAG AA合格: 4.6:1）

---

## 戦略的評価（PM）

| 性格 | 訴求できるユーザー層 |
|---|---|
| 💬 スタンダード | データ重視・分析好き |
| 🌙 優しい | 不安・ストレスを抱えている、継続が難しい人 |
| 🔥 熱血 | 目標達成志向、フィットネス系 |
| 🐻‍❄️ しろくまコーチ | ライト層・若年層・SNSでシェアしたくなる層 |

「しろくまコーチ」はスクリーンショットをSNSでシェアされやすく、他の睡眠アプリにない差別化ポイントになる。

### 却下した提案

**性別選択（男の子/女の子しろくま）**:
- ユーザーの判断により採用しないことに決定
- 理由: 英語ローカライズの複雑化・実装コストに対してユーザー価値が不明確

---

## 実装結果

> 実装完了: 2026-03-26

- [x] `src/types/index.ts` — `AiPersonality` 型・`UserProfile.aiPersonality?` 追加
- [x] `src/constants/index.ts` — `AI_PERSONALITIES` 配列追加
- [x] `src/services/claudeApi.ts` — `getPersonalityInstruction()` + 3関数の引数拡張
- [x] `src/stores/authStore.ts` — `updateProfile` 引数に `aiPersonality?` 追加
- [x] `src/screens/Profile/ProfileScreen.tsx` — MenuRow + `PersonalityBottomSheet` コンポーネント追加
- [x] `src/i18n/locales/ja.ts` — 13キー追加
- [x] `src/i18n/locales/en.ts` — 13キー追加
- [x] `npx tsc --noEmit` 型エラーなし確認

---

## 関連ファイル

- `docs/ui-ux-review.md` — UI/UX改善リスト全般
- `src/services/claudeApi.ts` — AIプロンプト定義
- `src/utils/scoreCalculator.ts` — スコア計算ロジック
