# B5「しろくまペルソナ」UI/UX 設計仕様書

作成日: 2026-04-01
担当: ui-ux-expert
実装担当: rn-specialist

---

## 1. 概要・設計方針

### 目的
AIアドバイス（今日の一言）を「しろくまキャラクター」からの発話として見せることで、アプリへの愛着を高める。Duolingo のフクロウと同じ「擬人化エージェント」による継続動機づけ効果を狙う。

### アセット調査結果
- `src/assets/images/bg_home.png` — ホーム背景画像（ビルドアーカイブで存在確認）
- 白熊専用の画像アセットは存在しない
- react-native-svg はプロジェクトに導入済み（`react-native-reanimated` v3 と共存）

### キャラクター表現方針: 案B採用（テキスト絵文字ベース）+ 部分的に案C（SVGシルエット）

**採用理由**
- 案A（既存画像活用）: bg_home.png に白熊が含まれているが、AI吹き出し横の小アイコンとして切り出すのは困難。背景画像と同じキャラを別用途で使うとデザインが混乱する。
- 案B（絵文字）: `🐻‍❄️` 単体では Android の絵文字フォントが端末依存で見た目がバラつく（ui-ux-review.md §1 の指摘と同じ問題）。ただし表情切り替えはこれで十分。
- 案C（SVG シルエット）: 工数が最大だが表現の自由度が高い。

**採用案: B+C ハイブリッド**
- しろくまの「顔アイコン」は SVG で描画する新規コンポーネントとして作成
- 表情（目・口）は小さな SVG パスで表現し、スコア帯で切り替える
- SVG は 48×48pt の正円マスク内に収めて吹き出し左横に配置
- 工数が問題な場合は絵文字 `🐻‍❄️` で暫定実装し後で SVG に差し替え可能な設計にする

---

## 2. 変更が必要なファイル一覧

| ファイルパス | 変更種別 | 内容 |
|---|---|---|
| `src/components/home/AiAdviceCard.tsx` | 改修 | しろくまアイコン + 吹き出しレイアウトに全面変更 |
| `src/services/claudeApi.ts` | 改修 | `DAILY_SYSTEM_PROMPT` をしろくま口調に変更 |
| `src/screens/Onboarding/steps/WelcomeStep.tsx` | 改修 | しろくまの紹介文を features リストに追加 |
| `src/i18n/ja.json` | 追加 | しろくま関連の翻訳キー追加 |
| `src/i18n/en.json` | 追加 | 英語対応翻訳キー追加 |

**新規作成ファイル**

| ファイルパス | 内容 |
|---|---|
| `src/components/home/ShirokumaBubble.tsx` | しろくまアイコン + 吹き出し複合コンポーネント |
| `src/components/common/ShirokumaIcon.tsx` | SVGしろくま顔アイコン（表情切替対応） |

---

## 3. ShirokumaIcon コンポーネント仕様

### ファイル: `src/components/common/ShirokumaIcon.tsx`

**役割**
スコア帯に応じた表情を持つ白熊の顔を SVG で描画する。Props で表情を切り替えられる独立コンポーネント。

**Props 定義**
```
interface Props {
  size: number;          // アイコンの直径（px）。推奨: 48
  mood: 'happy' | 'normal' | 'cheer'; // スコア帯別表情
}
```

**mood マッピング（スコア帯との対応）**
| スコア帯 | mood | 表情の説明 |
|---|---|---|
| 80点以上 | `'happy'` | 目が弧（くっきり笑い目）、口が大きめの弧 |
| 60〜79点 | `'normal'` | 目が小さい円（ふつう目）、口が小さい弧 |
| 60点未満 | `'cheer'` | 目が下向き斜め線（困り目）、口が上向き弧（励ましの笑み） |

**SVG 構造（論理的な座標、size=48 基準）**
```
<Svg width={size} height={size} viewBox="0 0 48 48">
  {/* 頭部（白い丸） */}
  <Circle cx="24" cy="26" r="18" fill="#FFFFFF" />
  {/* 耳（左右の小さい丸） */}
  <Circle cx="9"  cy="12" r="7"  fill="#FFFFFF" />
  <Circle cx="39" cy="12" r="7"  fill="#FFFFFF" />
  {/* 耳の内側（薄いピンク） */}
  <Circle cx="9"  cy="12" r="4"  fill="#F5D0D0" />
  <Circle cx="39" cy="12" r="4"  fill="#F5D0D0" />
  {/* 鼻（黒い小判型） */}
  <Ellipse cx="24" cy="30" rx="4" ry="2.5" fill="#222244" />
  {/* 目（mood によって SVG パスで切り替え） */}
  {mood === 'happy' && (
    <>
      {/* 弧（笑い目） */}
      <Path d="M 15 23 Q 17 19 19 23" stroke="#222244" strokeWidth="2" fill="none" strokeLinecap="round" />
      <Path d="M 29 23 Q 31 19 33 23" stroke="#222244" strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  )}
  {mood === 'normal' && (
    <>
      {/* 小円（普通の目） */}
      <Circle cx="17" cy="22" r="2.5" fill="#222244" />
      <Circle cx="31" cy="22" r="2.5" fill="#222244" />
    </>
  )}
  {mood === 'cheer' && (
    <>
      {/* 困り目（斜め線） */}
      <Path d="M 14 20 L 20 24" stroke="#222244" strokeWidth="2" strokeLinecap="round" />
      <Path d="M 34 20 L 28 24" stroke="#222244" strokeWidth="2" strokeLinecap="round" />
    </>
  )}
  {/* 口（mood によって切り替え） */}
  {mood === 'happy' && (
    <Path d="M 18 35 Q 24 40 30 35" stroke="#222244" strokeWidth="2" fill="none" strokeLinecap="round" />
  )}
  {(mood === 'normal' || mood === 'cheer') && (
    <Path d="M 19 35 Q 24 38 29 35" stroke="#222244" strokeWidth="2" fill="none" strokeLinecap="round" />
  )}
</Svg>
```

**グロー効果（happy 時）**
- 外側の `View` に `shadowColor: '#FFD700'`、`shadowOpacity: 0.6`、`shadowRadius: 10`、`elevation: 6` を付与（Android elevation + iOS shadow）
- mood が `happy` の場合のみ適用。スタイル分岐で対応する

**実装注意点**
- `react-native-svg` の `Svg`, `Circle`, `Ellipse`, `Path` を import する
- `size` が変わっても比率が崩れないよう必ず `viewBox="0 0 48 48"` を固定し width/height を Props で受け取る

---

## 4. ShirokumaBubble コンポーネント仕様

### ファイル: `src/components/home/ShirokumaBubble.tsx`

**役割**
AiAdviceCard の表示ロジックを完全に置き換える複合コンポーネント。
左側にしろくまアイコン、右側に吹き出し形式でアドバイスを表示する。
既存の `AiAdviceCard` を呼び出しているファイルはなく（HomeScreen から直接使用）、`HomeScreen.tsx` の dreamBubble エリアをそのまま差し替える形で使用する。

**Props 定義**
```
interface Props {
  advice: string | null;
  isLoading: boolean;
  score: number | null;           // 今日のスコア（null = 未記録）
  isDreamExpanded: boolean;
  onToggleExpand: () => void;
  dreamExpandAnim: Animated.Value;
  ecgAnim: Animated.Value;
  dreamExpandedH: number;
  onRefresh?: () => void;
}
```

**JSX 構造（概念図）**
```
<Animated.View style={[shell, { borderColor: ecgAnimInterpolated }]}>
  {/* 上向き尻尾（既存 dreamBubbleTail を流用） */}
  <View style={tail} />

  <TouchableOpacity onPress={onToggleExpand} style={inner}>
    {/* 左カラム：しろくまアイコン */}
    <View style={leftCol}>
      <View style={iconContainer}>       {/* グロー枠 */}
        <ShirokumaIcon size={48} mood={moodFromScore} />
      </View>
      {/* キャラクター名ラベル */}
      <Text style={nameLabel}>しろくま</Text>
    </View>

    {/* 右カラム：発話テキスト */}
    <View style={rightCol}>
      {/* しろくまが「話している」ことを示す小さな吹き出し三角は CSS border で作る */}
      <View style={speechTriangle} />
      <View style={speechBubble}>
        {isLoading ? (
          <AiAdviceSkeleton />           {/* 既存コンポーネントを流用 */}
        ) : (
          <>
            <Animated.View style={{ maxHeight: animatedHeight, overflow: 'hidden' }}>
              <ScrollView scrollEnabled={isDreamExpanded} nestedScrollEnabled>
                <Text style={adviceText} numberOfLines={isDreamExpanded ? undefined : 3}>
                  {advice ?? ''}
                </Text>
              </ScrollView>
            </Animated.View>
            {/* 展開/折りたたみシェブロン */}
            <Text style={chevron}>{isDreamExpanded ? '▲' : '▼'}</Text>
          </>
        )}
      </View>
    </View>
  </TouchableOpacity>
</Animated.View>
```

### スタイル仕様

**shell（外枠）**
```
backgroundColor: '#252540'   // 既存の dreamBubbleShell と同一
borderRadius: 18
padding: 0
borderWidth: 1.5             // ecgAnim でアニメーション（既存の borderColor アニメを継承）
overflow: 'visible'          // グロー効果を枠外まで出すため
```

**inner（タッチ可能エリア）**
```
flexDirection: 'row'
alignItems: 'flex-start'
padding: 12
gap: 12
```

**leftCol（アイコン列）**
```
alignItems: 'center'
width: 56           // アイコン 48px + 余白
```

**iconContainer（グロー枠、happy 時のみ適用）**
```
// 通常（normal / cheer）
borderRadius: 28     // 56/2 の完全な円
padding: 4
backgroundColor: 'rgba(255,255,255,0.06)'

// happy の場合に追加
shadowColor: '#FFD700'
shadowOpacity: 0.55
shadowRadius: 12
elevation: 8
```

**nameLabel（「しろくま」テキスト）**
```
fontSize: 10
color: '#9A9AB8'
marginTop: 4
fontWeight: '600'
letterSpacing: 0.5
```
- コントラスト比: `#9A9AB8` on `#252540` = 約 4.9:1（WCAG AA 達成）

**speechTriangle（左向き三角）**
```
// leftCol と speechBubble の間に挟む View
width: 0
height: 0
borderTopWidth: 7
borderBottomWidth: 7
borderRightWidth: 10
borderTopColor: 'transparent'
borderBottomColor: 'transparent'
borderRightColor: '#2D2D55'
marginTop: 14     // アイコン中心付近に合わせる
```

**speechBubble（テキスト背景）**
```
flex: 1
backgroundColor: '#2D2D55'
borderRadius: 12
padding: 10
```

**adviceText（発話テキスト）**
```
fontSize: 14
color: '#E0E0F0'
lineHeight: 22
```
- コントラスト比: `#E0E0F0` on `#2D2D55` = 約 9.1:1（WCAG AAA 達成）

**スコア帯 → mood 変換ロジック**
```
const moodFromScore = (score: number | null): 'happy' | 'normal' | 'cheer' => {
  if (score === null) return 'normal';
  if (score >= 80) return 'happy';
  if (score >= 60) return 'normal';
  return 'cheer';
};
```

**speechBubble の枠色（スコア帯別）**
吹き出し背景色は変えず、`borderWidth: 1` と `borderColor` だけでスコアを示す。
| mood | borderColor |
|---|---|
| `happy` | `rgba(255, 215, 0, 0.35)` — ゴールド系 |
| `normal` | `rgba(107, 92, 231, 0.25)` — アクセント紫（薄め） |
| `cheer` | `rgba(156, 143, 255, 0.20)` — アクセント薄紫 |

---

## 5. AiAdviceCard.tsx 改修仕様

### ファイル: `src/components/home/AiAdviceCard.tsx`

AiAdviceCard は HomeScreen の dreamBubble ゾーン内に埋め込まれているのではなく、**単独コンポーネントとして定義されているが実際には HomeScreen の dreamBubble ゾーン内の JSX で直接テキストを描画している**。

コードを確認した結果、HomeScreen の dreamBubble ゾーン（`line 578-636`）は AiAdviceCard を import せず、直接 dreamBubble の JSX を組んでいる。`AiAdviceCard.tsx` 自体は別途存在する。

**対応方針**
1. `HomeScreen.tsx` の dreamBubble ゾーン（`line 578-636` の `{goal !== null && (...)}` ブロック）を `<ShirokumaBubble>` の呼び出しに差し替える。
2. `AiAdviceCard.tsx` はホーム以外の画面から呼ばれる可能性を考慮してファイルは残すが、内部を同様にしろくまスタイルに更新する（ただし score prop が必要になるため Props を拡張する）。

**AiAdviceCard.tsx の Props 拡張**
```
interface Props {
  advice: string | null;
  isLoading: boolean;
  onRefresh?: () => void;
  score?: number | null;   // 追加（未指定時は normal 扱い）
}
```

**ヘッダーのアイコン変更**
- 既存: `<Icon name="sparkling" />` + テキスト「AIアドバイス」
- 変更後: `<ShirokumaIcon size={24} mood="normal" />` + テキスト「しろくまのアドバイス」

**ヘッダーの左揃えテキスト**
```
// 変更前
title: { fontSize: 13, color: '#9A9AB8', fontWeight: '600' }
// i18n キー: 'aiAdviceCard.title' → 'しろくまのひとこと'

// 変更後（スタイルは据え置き、テキストのみ変更）
```

---

## 6. HomeScreen.tsx 改修仕様

### ファイル: `src/screens/Home/HomeScreen.tsx`

**変更箇所 1: import 追加**
既存の `AiAdviceSkeleton` の import 行の下に追記。
```
import ShirokumaBubble from '../../components/home/ShirokumaBubble';
```

**変更箇所 2: dreamBubble レンダリングブロックの差し替え**

現在の `line 576-636` に相当する `{goal !== null && (...)}` ブロック全体を以下に差し替える。

変更前の JSX 構造（概要）:
```
{goal !== null && (
  <Animated.View style={{ position: 'absolute', ... }}>
    {isLoadingAi ? <AiAdviceSkeleton /> : (
      <Animated.View style={[styles.dreamBubbleShell, { borderColor: ecgAnim.interpolate(...) }]}>
        <View style={styles.dreamBubbleTail} />
        <TouchableOpacity onPress={toggleDreamExpand}>
          <Text style={styles.dreamBubbleEmoji}>💭</Text>
          <Animated.View>
            <ScrollView>
              <Text>{aiAdvice ?? ''}</Text>
            </ScrollView>
          </Animated.View>
          <Text>{isDreamExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>
      </Animated.View>
    )}
  </Animated.View>
)}
```

変更後の JSX 構造（概要）:
```
{goal !== null && (
  <Animated.View
    style={{
      position: 'absolute',
      left: screenW * 0.08,
      top: bearY + 80,
      width: screenW * 0.84,
      opacity: revealAiOpacity,
      transform: [{ translateY: revealAiY }],
    }}
  >
    <ShirokumaBubble
      advice={aiAdvice}
      isLoading={isLoadingAi}
      score={todayLog?.score ?? null}
      isDreamExpanded={isDreamExpanded}
      onToggleExpand={toggleDreamExpand}
      dreamExpandAnim={dreamExpandAnim}
      ecgAnim={ecgAnim}
      dreamExpandedH={dreamExpandedH}
    />
  </Animated.View>
)}
```

**変更箇所 3: 既存 dreamBubble スタイル定義の扱い**
HomeScreen.tsx の StyleSheet には `dreamBubbleShell`、`dreamBubbleTail`、`dreamBubbleInner`、`dreamBubbleEmoji`、`dreamBubbleText`、`dreamBubbleChevron` のスタイルが定義されている。
これらは ShirokumaBubble 内部に移動するため、HomeScreen.tsx の StyleSheet からは削除する。
ただし `dreamBubbleTail` の形状（三角の寸法・色）は ShirokumaBubble の StyleSheet にそのままコピーする。

**削除可能になる state / import**
- HomeScreen の `dreamBubbleEmoji` (`💭`) の Text は不要になる
- ただし `isDreamExpanded`、`dreamExpandAnim`、`toggleDreamExpand` の state と関数はそのまま維持し、ShirokumaBubble の props に渡す

---

## 7. AIプロンプト改修仕様

### ファイル: `src/services/claudeApi.ts`

**変更箇所: `DAILY_SYSTEM_PROMPT` の差し替え**

変更前（`line 152-166`）:
```typescript
const DAILY_SYSTEM_PROMPT = `あなたは「ヨアケ」という名前の睡眠コーチAIです。
毎朝、ユーザーの睡眠データを見てひとことアドバイスを日本語で伝えます。
...
```

変更後:
```typescript
const DAILY_SYSTEM_PROMPT = `あなたは「しろくま」という名前の睡眠の友だちです。
眠りが大好きな白熊として、毎朝ユーザーの睡眠データを見てひとことアドバイスを日本語で伝えます。

キャラクター設定：
・名前: しろくま
・性格: 穏やかで優しく、少しだけマイペース。共感してから具体的なアドバイスをする
・口調: 語尾に「〜だよ」「〜だね」「〜してみて」を自然に使う。押しつけがましくない
・ユーザーへの呼びかけ: 文中に「きみ」を1回だけ自然に使う

ルール：
・2〜3文以内で簡潔に（200文字以内）
・ポジティブで前向きなトーン（ただし過度に明るくしない）
・具体的な数字を必ず1つ以上使う
・習慣とスコアの相関があれば積極的に言及する
・前週比・3ヶ月比の数値があれば傾向として触れる
・季節の文脈も活かす
・説教くさくしない

【良い出力の例】
「昨夜は6時間50分でスコア74点だったね。就寝前の入浴が効いたのか深睡眠が15分増えてたよ。きみ、今日は水分補給をしっかりして夜に備えてみて。」
「スコア68点、先週より3点ダウンだね。木曜の深夜就寝が響いてるみたい。今夜は0時前に布団に入ることだけ意識してみてよ。」
「きみの今週の平均スコア82点、いい感じだよ。このまま就寝リズムをキープしていこうね。」`;
```

**変更の意図**
- 「コーチ」から「友だち（ぐるみのような存在）」に変えることで上から目線を排除
- 語尾ルールを明示することで出力のトーンを一貫させる
- 「きみ」の呼びかけを1回に限定し、くどくなるのを防ぐ
- 200文字以内の制約を明示（既存は暗黙的な「2〜3文以内」のみ）

**フォールバック文言の変更（`line 178`）**
```typescript
// 変更前
content: 'データが溜まったら分析します。まずは数日間記録を続けてみましょう！',

// 変更後
content: 'まだ睡眠データがないね。数日間記録してくれたら、しろくまが分析するよ。',
```

---

## 8. i18n キー追加仕様

### ファイル: `src/i18n/ja.json`

追加するキー（`aiAdviceCard` セクションの title を変更、新キー追加）:
```json
{
  "aiAdviceCard": {
    "title": "しろくまのひとこと",
    "refresh": "更新",
    "loading": "考えてるよ…",
    "noData": "まだデータがないよ。記録してね。"
  },
  "shirokuma": {
    "name": "しろくま"
  }
}
```

### ファイル: `src/i18n/en.json`

```json
{
  "aiAdviceCard": {
    "title": "Shirokuma's Advice",
    "refresh": "Refresh",
    "loading": "Thinking...",
    "noData": "No data yet. Start logging!"
  },
  "shirokuma": {
    "name": "Shirokuma"
  }
}
```

---

## 9. オンボーディング追加仕様（WelcomeStep）

### ファイル: `src/screens/Onboarding/steps/WelcomeStep.tsx`

**変更内容: FEATURES 配列にしろくまの紹介を追加**

現在の FEATURES（3項目）の先頭に1項目追加する。合計4項目になる。

```typescript
const FEATURES = [
  // 追加
  { emoji: '🐻‍❄️', label: t('onboarding.welcome.feature0') },
  // 既存（feature1〜3 のキーは変更なし）
  { emoji: '🤖', label: t('onboarding.welcome.feature1') },
  { emoji: '📊', label: t('onboarding.welcome.feature2') },
  { emoji: '📔', label: t('onboarding.welcome.feature3') },
];
```

**i18n キー追加（ja.json）**
```json
"onboarding": {
  "welcome": {
    "feature0": "しろくまが毎朝、きみの眠りをひとことで教えてくれるよ"
  }
}
```

**i18n キー追加（en.json）**
```json
"onboarding": {
  "welcome": {
    "feature0": "Shirokuma the polar bear gives you daily sleep insights every morning"
  }
}
```

**工数評価: 小（3行の変更 + i18n キー追加のみ）**

---

## 10. アニメーション設計

### 10.1 アイコン出現アニメーション（ShirokumaBubble マウント時）

ShirokumaBubble は `Animated.View` ラッパーを持つ HomeScreen の stagger reveal（revealAiOpacity / revealAiY）の内側に入るため、コンポーネント自体に新たなマウントアニメーションは追加しない。既存の 100ms delay stagger をそのまま継承する。

### 10.2 mood 切替アニメーション（スコアが変化したとき）

`ShirokumaIcon` 内部で `moodPrev` と `mood` を比較し、変化があった場合に軽い scale bounce を行う。

```
// mood が変化した瞬間: scale 1.0 → 1.25 → 1.0 の spring アニメーション
// duration: 300ms（spring）
// useNativeDriver: true
```

実装方法: `useEffect([mood], ...)` + `Animated.spring(scaleAnim, { toValue: 1.25, ... })` → `Animated.spring(scaleAnim, { toValue: 1.0, ... })`
ただし初回マウント時は skip する（`isFirstRender` ref で制御）。

### 10.3 happy 時のグロー点滅

`mood === 'happy'` のとき、iconContainer の `shadowOpacity` を 0.3 → 0.7 → 0.3 のゆっくりとした loop アニメーションで脈動させる。

```
// shadowOpacity のアニメーション: useNativeDriver: false（シャドウは layout プロパティのため）
// period: 2000ms（1秒フェードイン + 1秒フェードアウト）
// Animated.loop(Animated.sequence([timing(0.7, 1000), timing(0.3, 1000)]))
```

---

## 11. アクセシビリティ仕様

### ShirokumaIcon
```
accessibilityRole="image"
accessibilityLabel={`しろくまの表情: ${mood === 'happy' ? '喜び' : mood === 'cheer' ? '励まし' : '普通'}`}
```

### ShirokumaBubble の TouchableOpacity
```
accessibilityRole="button"
accessibilityLabel={isDreamExpanded ? 'しろくまのアドバイスを折りたたむ' : 'しろくまのアドバイスを展開する'}
accessibilityHint="ダブルタップでアドバイスの全文を表示します"
```

---

## 12. コントラスト比まとめ

| テキスト色 | 背景色 | コントラスト比 | WCAG 基準 |
|---|---|---|---|
| `#9A9AB8`（nameLabel「しろくま」） | `#252540` | 約 4.9:1 | AA 達成 |
| `#E0E0F0`（adviceText） | `#2D2D55` | 約 9.1:1 | AAA 達成 |
| `#9A9AB8`（loading text） | `#252540` | 約 4.9:1 | AA 達成 |

---

## 13. 実装順序の推奨

1. **Step 1**: `src/components/common/ShirokumaIcon.tsx` を作成・動作確認
2. **Step 2**: `src/services/claudeApi.ts` の `DAILY_SYSTEM_PROMPT` を変更（影響範囲が局所的で確認しやすい）
3. **Step 3**: `src/components/home/ShirokumaBubble.tsx` を作成し、Props を受け取るだけの静的レイアウトで確認
4. **Step 4**: `src/screens/Home/HomeScreen.tsx` の dreamBubble ゾーンを ShirokumaBubble 呼び出しに差し替え
5. **Step 5**: i18n キーを追加し、AiAdviceCard のタイトルを更新
6. **Step 6**: WelcomeStep の feature0 を追加
7. **Step 7**: `npx tsc --noEmit` + `npx jest --no-coverage` で確認

---

## 14. 実装上の注意点

### react-native-svg の import
```typescript
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
```
`react-native-svg` はすでにプロジェクトに導入済み。追加インストール不要。

### useNativeDriver の制約
- `shadowOpacity`（グロー点滅）は JS スレッドで動かすため `useNativeDriver: false` を使う。これは happy 時のみ実行される処理なので UI スレッドのブロッキングリスクは低い。
- scale アニメーション（mood 切替バウンス）は `useNativeDriver: true` で実装可能。

### 既存の dreamBubbleTail スタイルの移植
HomeScreen の StyleSheet から ShirokumaBubble の StyleSheet へそのままコピーする。座標の調整は不要（ShirokumaBubble の `leftCol` が増えた分だけ tail の `alignSelf` や `marginLeft` を調整する必要がある可能性がある）。

### AiAdviceSkeleton の再利用
`src/components/home/AiAdviceSkeleton.tsx` は ShirokumaBubble 内部から import して `isLoading` 時に表示する。ShirokumaBubble の右カラム（`speechBubble` 内部）に収まるよう幅は親の `flex: 1` に従う。

### HomeScreen の state は変更不要
`isDreamExpanded`、`dreamExpandAnim`、`toggleDreamExpand`、`ecgAnim`、`dreamExpandedH` はすべて HomeScreen に残り、Props として ShirokumaBubble に渡す設計。HomeScreen の state 管理に手を加えない。

### DAILY_SYSTEM_PROMPT の変更後の動作確認
プロンプト変更後、初回生成はエミュレーター + Firebase エミュレーターで動作確認を行うこと。既存のキャッシュ（aiReports コレクション）には変更前の口調のデータが残っているが、当日分として保存されているため翌日には自動更新される。強制更新テストには既存の「更新」ボタン（`onRefresh` prop）を使う。

---

## 15. feature-spec.md の更新内容（実装後に記載すること）

実装完了後、`docs/feature-spec.md` の以下セクションを更新する。
- AIアドバイス（今日の一言）セクション: ペルソナ「しろくま」の導入を記載
- 画面構成 §8: HomeScreen の dreamBubble が ShirokumaBubble コンポーネントになったことを反映
- 変更履歴: B5 実装として追記
