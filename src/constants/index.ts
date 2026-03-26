// ============================================================
// スコア閾値
// ============================================================

export const SCORE_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 75,
  NORMAL: 60,
  POOR: 40,
} as const;

import type { ScoreColor, AiPersonality } from '../types';

export const SCORE_COLORS: Record<ScoreColor, string> = {
  green: '#4CAF50',
  yellowGreen: '#8BC34A',
  yellow: '#FFC107',
  orange: '#FF9800',
  red: '#F44336',
};

// ============================================================
// デフォルト習慣
// ============================================================

export const DEFAULT_HABITS = [
  { id: 'default_01', label: 'カフェイン',   emoji: '☕', order: 1 },
  { id: 'default_02', label: '飲酒',         emoji: '🍺', order: 2 },
  { id: 'default_03', label: '運動',         emoji: '🏃', order: 3 },
  { id: 'default_04', label: '就寝前スマホ', emoji: '📱', order: 4 },
  { id: 'default_05', label: 'ストレス高め', emoji: '😤', order: 5 },
  { id: 'default_06', label: '入浴',         emoji: '🛁', order: 6 },
] as const;

// ============================================================
// サブスク設定
// ============================================================

export const SUBSCRIPTION = {
  MONTHLY_PRICE: 380,
  YEARLY_PRICE: 2800,
  TRIAL_DAYS: 7,
  PRODUCT_IDS: {
    MONTHLY: 'yoake_monthly_380',
    YEARLY: 'yoake_yearly_2800',
  },
} as const;

// ============================================================
// 無料プランの制限
// ============================================================

export const FREE_LIMITS = {
  LOG_HISTORY_DAYS: 7,
  MAX_HABIT_ITEMS: 6, // デフォルトのみ
  SNOOZE_COUNT: 2,
  SNOOZE_INTERVAL_MIN: 5,
  WAKE_WINDOW_MIN: 30,
} as const;

// ============================================================
// AI設定
// ============================================================

export const AI_CONFIG = {
  MODEL: 'claude-haiku-4-5',
  CHAT_HISTORY_LIMIT: 10, // 5往復
  CHAT_MAX_CHARS: 200,
  WEEKLY_REPORT_MIN_CHARS: 300,
  WEEKLY_REPORT_MAX_CHARS: 400,
  CONTEXT_DAYS: 14,
  DAILY_REPORT_CONTEXT_DAYS: 7,
} as const;

// ============================================================
// Health Connect
// ============================================================

export const HEALTH_CONNECT = {
  NAP_EXCLUDE_HOURS_MAX: 6,    // 6時間未満は昼寝として除外
  NAP_EXCLUDE_HOUR_START: 8,   // 8時〜20時は昼間判定
  NAP_EXCLUDE_HOUR_END: 20,
} as const;

// ============================================================
// 睡眠負債
// ============================================================

export const SLEEP_DEBT = {
  CALCULATION_DAYS: 14,
} as const;

// ============================================================
// 通知
// ============================================================

export const NOTIFICATION = {
  MORNING_HOUR: 8,
  MORNING_MINUTE: 0,
} as const;

// ============================================================
// スコアリングバージョン（アルゴリズム変更時にインクリメント）
// ============================================================

export const SCORE_VERSION = 1;

// ============================================================
// データ取得件数
// ============================================================

export const SLEEP_LOG_FETCH_LIMIT = {
  HOME: 30,
  REPORT: 90,
} as const;

// ============================================================
// 外部リンク
// ============================================================

export const LINKS = {
  PRIVACY_POLICY: 'https://ktakahashi.dev/yoake/privacy',
  TERMS: 'https://ktakahashi.dev/yoake/terms',
} as const;

// ============================================================
// AI性格設定
// ============================================================

export const AI_PERSONALITIES: {
  id: AiPersonality;
  emoji: string;
  themeColor: string;
  labelKey: string;
  subKey: string;
  previewKey: string;
}[] = [
  { id: 'standard',   emoji: '💬', themeColor: '#6B5CE7', labelKey: 'personality.standard',   subKey: 'personality.standardSub',   previewKey: 'personality.standardPreview'   },
  { id: 'gentle',     emoji: '🌙', themeColor: '#4CA1AF', labelKey: 'personality.gentle',     subKey: 'personality.gentleSub',     previewKey: 'personality.gentlePreview'     },
  { id: 'passionate', emoji: '🔥', themeColor: '#FF6B35', labelKey: 'personality.passionate', subKey: 'personality.passionateSub', previewKey: 'personality.passionatePreview' },
  { id: 'animal',     emoji: '🐻‍❄️', themeColor: '#7EC850', labelKey: 'personality.animal',     subKey: 'personality.animalSub',     previewKey: 'personality.animalPreview'     },
];
