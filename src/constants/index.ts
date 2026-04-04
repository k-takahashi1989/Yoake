import type { ScoreColor, AiPersonality } from '../types';

export const SCORE_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 75,
  NORMAL: 60,
  POOR: 40,
} as const;

export const SCORE_COLORS: Record<ScoreColor, string> = {
  green: '#4CAF50',
  yellowGreen: '#8BC34A',
  yellow: '#FFC107',
  orange: '#FF9800',
  red: '#F44336',
};

export const DEFAULT_HABITS = [
  { id: 'default_01', label: 'カフェイン', emoji: '', order: 1 },
  { id: 'default_02', label: '飲酒', emoji: '', order: 2 },
  { id: 'default_03', label: '運動', emoji: '', order: 3 },
  { id: 'default_04', label: '就寝前スマホ', emoji: '', order: 4 },
  { id: 'default_05', label: 'ストレス高め', emoji: '', order: 5 },
  { id: 'default_06', label: '入浴', emoji: '', order: 6 },
] as const;

export const SUBSCRIPTION = {
  MONTHLY_PRICE: 480,
  YEARLY_PRICE: 2800,
  TRIAL_DAYS: 7,
  PRODUCT_IDS: {
    MONTHLY: 'yoake_monthly_480',
    YEARLY: 'yoake_yearly_2800',
  },
} as const;

export const FREE_LIMITS = {
  LOG_HISTORY_DAYS: 7,
  MAX_HABIT_ITEMS: 6,
  SNOOZE_COUNT: 2,
  SNOOZE_INTERVAL_MIN: 5,
  WAKE_WINDOW_MIN: 30,
} as const;

export const AI_CONFIG = {
  MODEL: 'claude-haiku-4-5',
  CHAT_HISTORY_LIMIT: 10,
  CHAT_MAX_CHARS: 200,
  WEEKLY_REPORT_MIN_CHARS: 300,
  WEEKLY_REPORT_MAX_CHARS: 400,
  CONTEXT_DAYS: 14,
  DAILY_REPORT_CONTEXT_DAYS: 7,
} as const;

export const HEALTH_CONNECT = {
  NAP_EXCLUDE_HOURS_MAX: 6,
  NAP_EXCLUDE_HOUR_START: 8,
  NAP_EXCLUDE_HOUR_END: 20,
} as const;

export const SLEEP_DEBT = {
  CALCULATION_DAYS: 14,
} as const;

export const NOTIFICATION = {
  MORNING_HOUR: 8,
  MORNING_MINUTE: 0,
} as const;

export const SCORE_VERSION = 1;

export const SLEEP_LOG_FETCH_LIMIT = {
  HOME: 30,
  REPORT: 90,
} as const;

export const LINKS = {
  PRIVACY_POLICY: 'https://weak-nose-94e.notion.site/33634b367d7d80609cd8c674609e86cd',
  TERMS: 'https://weak-nose-94e.notion.site/33634b367d7d802eba1cfdc141a223be',
  HOW_TO_USE: 'https://weak-nose-94e.notion.site/YOAKE-33634b367d7d8061ba6fe6aee511bf5f?pvs=73',
  FEEDBACK_FORM: 'https://yoake-app.web.app/feedback.html',
} as const;

export const STORE_LINKS = {
  PLAY_STORE_PACKAGE: 'com.ktakahashi.yoake',
  PLAY_STORE_WEB:
    'https://play.google.com/store/apps/details?id=com.ktakahashi.yoake&showAllReviews=true',
  PLAY_STORE_REVIEW: 'market://details?id=com.ktakahashi.yoake&showAllReviews=true',
  APP_STORE_ID: null as string | null,
} as const;

export const AI_PERSONALITIES: {
  id: AiPersonality;
  themeColor: string;
  labelKey: string;
  subKey: string;
  previewKey: string;
}[] = [
  {
    id: 'standard',
    themeColor: '#6B5CE7',
    labelKey: 'personality.standard',
    subKey: 'personality.standardSub',
    previewKey: 'personality.standardPreview',
  },
  {
    id: 'gentle',
    themeColor: '#4CA1AF',
    labelKey: 'personality.gentle',
    subKey: 'personality.gentleSub',
    previewKey: 'personality.gentlePreview',
  },
  {
    id: 'passionate',
    themeColor: '#FF6B35',
    labelKey: 'personality.passionate',
    subKey: 'personality.passionateSub',
    previewKey: 'personality.passionatePreview',
  },
  {
    id: 'animal',
    themeColor: '#7EC850',
    labelKey: 'personality.animal',
    subKey: 'personality.animalSub',
    previewKey: 'personality.animalPreview',
  },
];
