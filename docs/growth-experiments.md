# Growth Experiments

> Updated: 2026-04-03
> Goal: lift organic installs and paid conversion without paid ads or SNS

## North-star metrics

- `Store CVR`: target `20%+`
- `Install -> paid`: target `2.0%+` blended
- `Trial start rate`: target `6%+`
- `Trial -> paid`: target `35%+`
- `7-day retained users`: target `25%+`
- `Review rating`: target `4.5+`

## Experiment order

1. Store first-frame message
2. Screenshot sequence
3. Paywall headline
4. Yearly plan emphasis
5. Review-prompt timing

## Store listing message variants

### Variant A: AI sleep coach

- Title lead: `AIで睡眠改善`
- Subtitle idea: `睡眠スコアと週次レポートで、次にやることが分かる`
- Use when: search intent is broad and "sleep improvement" is the main hook

### Variant B: Sleep score tracker

- Title lead: `睡眠スコア記録`
- Subtitle idea: `毎朝のスコアで睡眠の波を見える化`
- Use when: ranking improves on score / log / sleep record keywords

### Variant C: Weekly report hook

- Title lead: `週次レポートで睡眠分析`
- Subtitle idea: `AIが前週比と改善ポイントを要約`
- Use when: report / analysis / AI keywords show better conversion

## Screenshot sequence

### Screen 1

- Headline: `睡眠を記録すると、朝すぐ点数が見える`
- Visual: Home score + morning state

### Screen 2

- Headline: `AIが今週の崩れ方と改善案を要約`
- Visual: Weekly report with one concrete action

### Screen 3

- Headline: `習慣ごとの相性まで分かる`
- Visual: habit correlation card

### Screen 4

- Headline: `7日間、全部試してから決められる`
- Visual: paywall preview + yearly plan

## Paywall variants to test

### Variant P1: result-first

- Headline: `7日で、自分の睡眠の崩れ方が見えてくる`
- Subcopy: `週次レポート / AI要約 / 習慣との相関をまとめて確認`

### Variant P2: action-first

- Headline: `次にやること1つまで分かる`
- Subcopy: `記録だけで終わらず、改善アクションまで受け取る`

### Variant P3: premium-feature-first

- Headline: `週次AIレポートを解放する`
- Subcopy: `プレミアムでレポート、AIチャット、過去データ閲覧をまとめて利用`

## Console work

### Google Play

- Create `Custom store listing` for the three message variants above.
- Run `Store listing experiments` on icon and first screenshot separately.
- Keep only one major variable per test.
- Wait until each variant gets enough traffic for at least one full week.

### App Store

- Create `Custom Product Pages` for the same three angles.
- Run `Product Page Optimization` on screenshot order and first caption.
- Keep subscription screenshots aligned with the in-app paywall headline.

## Review prompt checkpoints

- After weekly report becomes visible
- After `7-day streak`
- After a `+5` or better score improvement

## Notes

- The app now has review-prompt hooks for the three checkpoints above.
- Before iOS launch, fill `STORE_LINKS.APP_STORE_ID` in `src/constants/index.ts`.
- Do not run price experiments until purchase validation and restore flow are both stable.
