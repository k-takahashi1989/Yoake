import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

// ============================================================
// Firestore Data Models
// ============================================================

export type AgeGroup = 'teens' | '20s_30s' | '40s_50s' | '60plus';
export type AiPersonality = 'standard' | 'gentle' | 'passionate' | 'animal';

export interface UserProfile {
  displayName: string | null;
  ageGroup?: AgeGroup | null; // 年代区分
  aiPersonality?: AiPersonality; // AI性格設定（未設定時はstandard扱い）
  createdAt: FirebaseFirestoreTypes.Timestamp;
  lastActiveAt: FirebaseFirestoreTypes.Timestamp;
}

export type SubscriptionPlan = 'free' | 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'expired' | 'trial';

export interface Subscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialStartAt: FirebaseFirestoreTypes.Timestamp | null;
  trialEndAt: FirebaseFirestoreTypes.Timestamp | null;
  currentPeriodEndAt: FirebaseFirestoreTypes.Timestamp | null;
  trialUsed: boolean;
}

export interface UserGoal {
  targetHours: number; // 例: 7.5
  targetScore: number; // 例: 80
  bedTimeTarget: string | null; // "23:00"
  updatedAt: FirebaseFirestoreTypes.Timestamp | null;
}

export type SleepOnset = 'FAST' | 'NORMAL' | 'SLOW';
export type WakeFeeling = 'GOOD' | 'NORMAL' | 'BAD';
export type SleepSource = 'HEALTH_CONNECT' | 'MANUAL';

export interface HabitEntry {
  id: string;
  label: string;
  emoji: string;
  checked: boolean;
}

export interface SleepLog {
  date: string; // "2026-03-24"
  bedTime: FirebaseFirestoreTypes.Timestamp;
  wakeTime: FirebaseFirestoreTypes.Timestamp;
  totalMinutes: number;

  // Health Connect由来（任意）
  deepSleepMinutes: number | null;
  remMinutes: number | null;
  lightSleepMinutes: number | null;
  awakenings: number | null;
  heartRateAvg: number | null;

  // 主観評価
  sleepOnset: SleepOnset;
  wakeFeeling: WakeFeeling;

  // 睡眠日記
  habits: HabitEntry[];
  memo: string | null;

  // 計算結果
  score: number;
  sleepDebtMinutes: number;

  // メタ
  source: SleepSource;
  scoreVersion: number;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
}

export type AiReportType = 'daily' | 'weekly';

export interface AiReport {
  type: AiReportType;
  content: string;
  generatedAt: FirebaseFirestoreTypes.Timestamp;
  inputSummary: string;
  modelUsed: string;
  tokenCount: number | null;
}

export interface HabitTemplate {
  id: string;
  label: string;
  emoji: string;
  isDefault: boolean;
  isActive: boolean;
  order: number;
  createdAt: FirebaseFirestoreTypes.Timestamp;
}

export interface DefaultHabit {
  id: string;
  label: string;
  emoji: string;
  order: number;
}

export interface BodyLog {
  date: string;
  weight: number | null; // kg
  createdAt: FirebaseFirestoreTypes.Timestamp;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: FirebaseFirestoreTypes.Timestamp;
}

// ============================================================
// Score Types
// ============================================================

export interface ScoreBreakdown {
  sleepDuration: number;
  bedTime: number;
  deepSleep: number;
  wakeFeeling: number;
  continuity: number;
  sleepOnset: number;
  consistencyBonus: number;
  oversleepPenalty: number;
  total: number;
}

export type ScoreColor = 'green' | 'yellowGreen' | 'yellow' | 'orange' | 'red';

export interface ScoreInfo {
  labelKey: string;
  color: ScoreColor;
}

// ============================================================
// Navigation Types
// ============================================================

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Diary: undefined;
  Report: undefined;
  Profile: undefined;
};

export type HomeStackParamList = {
  HomeScreen: undefined;
  ScoreDetail: { date: string; scoreColor?: string };
  RecordEdit: { date: string };
  AiChat: undefined;
};

export type DiaryStackParamList = {
  DiaryList: undefined;
  ScoreDetail: { date: string; scoreColor?: string };
  RecordEdit: { date: string };
  RecordDetail: { date: string };
};

export type ReportStackParamList = {
  ReportScreen: undefined;
};

export type ProfileStackParamList = {
  ProfileScreen: undefined;
  EditProfile: undefined;
  LinkEmail: undefined;
  SignIn: undefined;
  SubscriptionManage: undefined;
  HealthConnectSettings: undefined;
  NotificationSettings: undefined;
  DataManagement: undefined;
};

// ============================================================
// App State Types
// ============================================================

export interface SleepInputForm {
  bedTime: Date;
  wakeTime: Date;
  sleepOnset: SleepOnset;
  wakeFeeling: WakeFeeling;
  habits: HabitEntry[];
  memo: string;
  // Health Connect 由来データ（自動取得時のみ）
  deepSleepMinutes?: number | null;
  remMinutes?: number | null;
  lightSleepMinutes?: number | null;
  awakenings?: number | null;
  heartRateAvg?: number | null;
}

export type OnboardingStep =
  | 'welcome'
  | 'goal'
  | 'healthConnect'
  | 'notification'
  | 'trial';
