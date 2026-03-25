// ============================================================
// スコア閾値
// ============================================================

export const SCORE_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 75,
  NORMAL: 60,
  POOR: 40,
} as const;

export const SCORE_LABELS = {
  EXCELLENT: '最高',
  GOOD: '良好',
  NORMAL: '普通',
  POOR: 'やや不足',
  BAD: '要改善',
} as const;

export const SCORE_COLORS = {
  EXCELLENT: '#4CAF50',
  GOOD: '#8BC34A',
  NORMAL: '#FFC107',
  POOR: '#FF9800',
  BAD: '#F44336',
} as const;

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
