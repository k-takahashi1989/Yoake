# YOAKE UI/UX レビュー

## 優先度: HIGH（リリース前に対応推奨）

### 1. タブバー — Emoji → ベクターアイコン
**現状**: `Text` コンポーネントに絵文字 (🌙 📔 📊 ⏰ 👤) を使用
**問題**:
- Android はメーカー・OS バージョンによって絵文字の外観が大きく異なる（Samsung/Pixel/低価格帯で差が出る）
- `Text` では active/inactive のカラー補間アニメーションが不可（opacity 切替のみ）
- 絵文字はネイティブ UI の「アイコン」として認識されにくく安っぽく見える

**推奨**: Flaticon SVG を `react-native-svg` で読み込む、または `react-native-vector-icons` に切替
→ 別ファイル `flaticon-icons.md` を参照

---

### 2. ScoreRing — 数値出現にアニメーションなし
**現状**: スコアが取得された瞬間にリングが完成形で静止表示
**問題**: スコアは毎日ユーザーが最初に見る数値。動きがないと「スキャン」感が薄い
**推奨**: `Animated` または `react-native-reanimated` で `strokeDashoffset` を CIRCUMFERENCE → 目標値 へ 600ms ease-out アニメーション
```
withTiming(targetOffset, { duration: 600, easing: Easing.out(Easing.cubic) })
```
スコア数値も 0 から実際の値へカウントアップするとさらに効果的

---

### 3. AlarmScreen — フォント細すぎ問題
**現状**: 時刻表示に `fontWeight: '100'` (ultra-thin)
**問題**: Android の多くのフォントは `100` をサポートしていないため `400` として描画される → デザイン意図と乖離
**推奨**: `fontWeight: '200'` または `'300'` に変更、または明示的に thin フォントをロード

---

### 4. DiaryRow スコアバッジ — 透明度が薄すぎ
**現状**: `backgroundColor: scoreColor + '20'`（16進 Alpha = 12%）
**問題**: 暗い背景 `#1A1A2E` 上では色がほぼ見えない
**推奨**: `'33'`（20%）〜 `'40'`（25%）に変更

---

### 5. コントラスト — `#888` は WCAG AA ギリギリ
**現状**: secondary text として `#888` を多用
**問題**: `#1A1A2E` 背景での contrast ratio ≒ 4.3:1（AA 基準 4.5:1 を下回るケースあり）
**推奨**: secondary text は `#9A9AB8` または `#A0A0C0` に統一

---

## 優先度: MEDIUM（v1.1 で対応推奨）

### 6. Pull-to-refresh — DiaryScreen に未実装
HomeScreen には `RefreshControl` があるが DiaryScreen にはない
ユーザーは他タブから戻った際にリストが古いと感じる

### 7. 触覚フィードバック (Haptics) が未実装
**主要なタイミング**:
- 睡眠記録の保存完了 → `HapticFeedback.notificationSuccess()`
- スコア初表示 → `HapticFeedback.impactLight()`
- アラーム dismiss → `HapticFeedback.notificationSuccess()`

ライブラリ: `react-native-haptic-feedback`（軽量・追加コストなし）

### 8. Loading States — ActivityIndicator だらけ
HomeScreen の AI アドバイスカード、ReportScreen のグラフなど重い箇所に skeleton UI を入れると体感速度が上がる
`MotiView`（moti ライブラリ）の shimmer が最もシンプルに実装可能

### 9. 週次目標ドット — スコア数値が 9px で小さすぎ
`goalDotScore: { fontSize: 9 }` は 32px の円に収めるには限界
**推奨案**:
- ドットを 36px に拡大 → 10px フォントで余裕が出る
- またはスコア非表示にして色のみ（シンプル路線）
- タップ時に Tooltip でスコア表示（インタラクション重視路線）

### 10. SleepDebtCard — 睡眠負債量に応じたアイコン出し分け

**概要**: 睡眠負債の数値だけでなく、アイコンで感情的フィードバックを加える

**アイコン案（段階別）**:

| 負債量 | アイコン（絵文字案） | 意味 |
|--------|-------------------|------|
| 0分    | ⚡ または 😊     | 完全充電・元気 |
| 1〜60分 | 🔋             | 軽微な負債 |
| 61〜120分 | 🔋 (低め)    | 注意レベル |
| 121分〜 | 🪫             | バッテリー切れ・要回収 |

**実装方針**:
- `SleepDebtCard.tsx` の `debtValue` 表示エリアの左隣にアイコンを置く
- アイコンは絵文字（実装コスト最小）または `react-native-vector-icons` の battery 系アイコン（デザイン統一）
- `debtColor` と同じ閾値ロジックを流用できる（`debtMinutes === 0` / `< 120` / `>= 120`）
- 将来的にはアイコンにフワっとした pulse アニメーションを入れると「負債が積み上がっている感」を演出できる

**実装コスト**: 低（`SleepDebtCard.tsx` に数行追加のみ）

---

### 11. AiAdviceCard — 再生成ボタンの視認性
テキストボタン「再生成」が右上に浮いている
アイコン付きゴーストボタン（🔄 再生成）に変えると意図が伝わりやすい

### 12. TrialStep の「スキップ」ボタン
`color: '#666'` のアンダーライン文字はコントラスト比 ≈ 2.8:1 で WCAG 不合格
意図的なダークパターンにするとしても、最低 `#888` 以上を推奨

---

## 優先度: LOW（polishing フェーズ）

### 13. SleepInputModal — セクション区切りが Border のみ
各セクション（就寝時刻 / 寝つき / 目覚め / 習慣 / メモ）の区切りが細い線だけ
セクションヘッダーに軽い背景色か padding を足すと可読性が上がる

### 14. タブラベル — 10px は限界
`tabBarLabelStyle: { fontSize: 10 }` はシステム設定でフォントサイズを大きくしているユーザーに切れることがある
`allowFontScaling={false}` を TabBar に設定するか、ラベル非表示にしてアイコンのみにする

### 15. スコアリング「点」単位 — 冗長
HomeScreen の `scoreRing.unit` に「点」を表示しているが、スコアリングアプリとして文脈が明確なら単位不要
代わりに `/ 100` のサブテキストにするとよりクリーン

---

## Flaticon アイコン一覧 → 別ファイル `flaticon-icons.md` 参照

---

# オンボーディング アニメーション設計

## 現状の問題
`currentStep` の switch 切替は瞬間的な View 差し替えのみ → 「次のステップへ進んだ感」がない
ProgressDot の幅変化（8px → 24px）もアニメーションなし

## 推奨アニメーション設計（実装コスト順）

### Level 1 — 最小コスト: フェードトランジション（1〜2時間）
```tsx
// OnboardingScreen.tsx に追加
const fadeAnim = useRef(new Animated.Value(1)).current;

const goNext = () => {
  Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
    setCurrentStep(STEPS[stepIndex + 1]);
    Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  });
};

// <View style={styles.content}> → <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
```

### Level 2 — 推奨: 横スライドトランジション（半日）
`react-native-reanimated` + `useSharedValue` で水平スライド
左→右の STEPS 順に自然な流れを演出

```tsx
// 概念コード
const translateX = useSharedValue(0);
const goNext = () => {
  translateX.value = withSequence(
    withTiming(-40, { duration: 150 }),    // 現ステップが左に消える
    withTiming(40, { duration: 0 }),       // 次ステップが右から登場
    withSpring(0, { damping: 15 })         // spring で収まる
  );
  // stepIndex を変更するタイミングは translateX = 40 の瞬間
};
```

### Level 3 — Premium: WelcomeStep の段階出現（2〜3時間）
feature 行を stagger アニメーションで 1 行ずつ下から出現させる

```tsx
// WelcomeStep.tsx
const anims = FEATURES.map((_, i) => useRef(new Animated.Value(0)).current);

useEffect(() => {
  Animated.stagger(80, anims.map(a =>
    Animated.spring(a, { toValue: 1, useNativeDriver: true })
  )).start();
}, []);

// 各行: translateY: a.interpolate({inputRange:[0,1], outputRange:[20,0]}) + opacity: a
```

### Level 4 — ProgressDot の幅アニメーション
`Animated.Value` で dot の width を 8 → 24 に `spring` アニメーション
OnboardingScreen.tsx の `dotActive` スタイルを Animated.View で管理する

```tsx
const dotWidth = useRef(new Animated.Value(8)).current;
useEffect(() => {
  Animated.spring(dotWidth, { toValue: stepIndex > prev ? 24 : 8, useNativeDriver: false }).start();
}, [stepIndex]);
```

## 実装優先度の推奨順
1. **ScoreRing アニメーション** — ユーザーが毎日見る中核体験、インパクト大
2. **WelcomeStep フェード/スライド** — 初回印象に直結
3. **ProgressDot 幅アニメーション** — 実装 30 分、視覚的まとまりが上がる
4. **保存完了 Haptics** — 実装 1 時間、体感品質が上がる
5. **Step 横スライドトランジション** — 完成度の高い体験

## ライブラリ候補
| 用途 | ライブラリ | 備考 |
|---|---|---|
| 高度なアニメーション | `react-native-reanimated` v3 | すでに入っているか確認 |
| シンプルな Animated | React Native 組み込み `Animated` | 追加不要 |
| Haptics | `react-native-haptic-feedback` | 軽量 |
| Skeleton/Shimmer | `moti` | `react-native-reanimated` ベース |
