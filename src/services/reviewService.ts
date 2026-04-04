import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Platform } from 'react-native';
import { STORE_LINKS } from '../constants';

const REVIEW_STATE_KEY = '@yoake:review_state';
const REVIEW_COOLDOWN_DAYS = 21;
const MAX_SEEN_MOMENTS = 32;

type ReviewMomentType = 'score_improved' | 'streak_milestone' | 'weekly_report';
type ReviewLanguage = 'en' | 'ja';

interface ReviewMoment {
  id: string;
  type: ReviewMomentType;
  createdAt: string;
  priority: number;
}

interface ReviewState {
  completedAt: string | null;
  lastPromptAt: string | null;
  pending: ReviewMoment[];
  seenMomentIds: string[];
}

const DEFAULT_STATE: ReviewState = {
  completedAt: null,
  lastPromptAt: null,
  pending: [],
  seenMomentIds: [],
};

function isReviewDestinationAvailable(): boolean {
  if (Platform.OS === 'android') return true;
  return Boolean(STORE_LINKS.APP_STORE_ID);
}

function isWithinCooldown(isoString: string | null): boolean {
  if (!isoString) return false;

  const promptedAt = new Date(isoString);
  if (Number.isNaN(promptedAt.getTime())) return false;

  return Date.now() - promptedAt.getTime() < REVIEW_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
}

function sortMoments(a: ReviewMoment, b: ReviewMoment): number {
  if (b.priority !== a.priority) return b.priority - a.priority;
  return b.createdAt.localeCompare(a.createdAt);
}

async function readState(): Promise<ReviewState> {
  const raw = await AsyncStorage.getItem(REVIEW_STATE_KEY);
  if (!raw) return DEFAULT_STATE;

  try {
    const parsed = JSON.parse(raw) as Partial<ReviewState>;
    return {
      completedAt: parsed.completedAt ?? null,
      lastPromptAt: parsed.lastPromptAt ?? null,
      pending: Array.isArray(parsed.pending) ? parsed.pending : [],
      seenMomentIds: Array.isArray(parsed.seenMomentIds) ? parsed.seenMomentIds : [],
    };
  } catch {
    return DEFAULT_STATE;
  }
}

async function writeState(state: ReviewState): Promise<void> {
  await AsyncStorage.setItem(REVIEW_STATE_KEY, JSON.stringify(state));
}

async function queueMoment(moment: ReviewMoment): Promise<void> {
  const state = await readState();
  const alreadySeen = state.seenMomentIds.includes(moment.id);
  const alreadyPending = state.pending.some(entry => entry.id === moment.id);

  if (alreadySeen || alreadyPending) return;

  await writeState({
    ...state,
    pending: [...state.pending, moment].sort(sortMoments),
  });
}

async function claimNextMoment(): Promise<ReviewMoment | null> {
  if (!isReviewDestinationAvailable()) return null;

  const state = await readState();
  if (state.completedAt || isWithinCooldown(state.lastPromptAt) || state.pending.length === 0) {
    return null;
  }

  const [nextMoment, ...rest] = [...state.pending].sort(sortMoments);

  await writeState({
    ...state,
    lastPromptAt: new Date().toISOString(),
    pending: rest,
    seenMomentIds: [...state.seenMomentIds, nextMoment.id].slice(-MAX_SEEN_MOMENTS),
  });

  return nextMoment;
}

function buildPromptCopy(language: ReviewLanguage, type: ReviewMomentType) {
  if (language === 'ja') {
    switch (type) {
      case 'weekly_report':
        return {
          title: '週次レポートが役立ったら',
          body: 'ストアで短くレビューしてもらえると、YOAKE を見つけてもらいやすくなります。',
          later: 'あとで',
          rateNow: 'レビューする',
        };
      case 'streak_milestone':
        return {
          title: '継続すごくいい感じです',
          body: 'YOAKE が続ける助けになっていたら、ストアでひとこと残してもらえると嬉しいです。',
          later: 'あとで',
          rateNow: 'レビューする',
        };
      default:
        return {
          title: 'スコア改善が見えてきました',
          body: '役に立っていたら、ストアでレビューしてもらえると今後の成長にかなり効きます。',
          later: 'あとで',
          rateNow: 'レビューする',
        };
    }
  }

  switch (type) {
    case 'weekly_report':
      return {
        title: 'If the weekly report helped',
        body: 'A short store review would make it much easier for new users to find YOAKE.',
        later: 'Later',
        rateNow: 'Rate YOAKE',
      };
    case 'streak_milestone':
      return {
        title: 'Your streak is looking good',
        body: 'If YOAKE is helping you stay consistent, a quick review would help a lot.',
        later: 'Later',
        rateNow: 'Rate YOAKE',
      };
    default:
      return {
        title: 'Your score is moving up',
        body: 'If YOAKE has been useful, leaving a short store review would really help.',
        later: 'Later',
        rateNow: 'Rate YOAKE',
      };
  }
}

export async function openStoreReviewPage(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      try {
        await Linking.openURL(STORE_LINKS.PLAY_STORE_REVIEW);
      } catch {
        await Linking.openURL(STORE_LINKS.PLAY_STORE_WEB);
      }
      return true;
    }

    if (!STORE_LINKS.APP_STORE_ID) return false;

    await Linking.openURL(
      `itms-apps://itunes.apple.com/app/id${STORE_LINKS.APP_STORE_ID}?action=write-review`,
    );
    return true;
  } catch {
    return false;
  }
}

export async function markReviewFlowCompleted(): Promise<void> {
  const state = await readState();
  await writeState({
    ...state,
    completedAt: new Date().toISOString(),
    pending: [],
  });
}

export async function promptForReviewIfEligible(
  language: ReviewLanguage,
): Promise<boolean> {
  const moment = await claimNextMoment();
  if (!moment) return false;

  const copy = buildPromptCopy(language, moment.type);

  Alert.alert(copy.title, copy.body, [
    { text: copy.later, style: 'cancel' },
    {
      text: copy.rateNow,
      onPress: () => {
        openStoreReviewPage()
          .then(async opened => {
            if (opened) {
              await markReviewFlowCompleted();
            }
          })
          .catch(() => {});
      },
    },
  ]);

  return true;
}

export async function queueScoreImprovementReviewMoment(
  date: string,
  improvement: number,
  score: number,
): Promise<void> {
  if (improvement < 5 || score < 75) return;

  await queueMoment({
    id: `score:${date}`,
    type: 'score_improved',
    createdAt: new Date().toISOString(),
    priority: score >= 85 ? 2 : 1,
  });
}

export async function queueStreakReviewMoment(streak: number): Promise<void> {
  if (streak < 3) return;

  await queueMoment({
    id: `streak:${streak}`,
    type: 'streak_milestone',
    createdAt: new Date().toISOString(),
    priority: streak >= 7 ? 3 : 2,
  });
}

export async function queueWeeklyReportReviewMoment(weekKey: string): Promise<void> {
  await queueMoment({
    id: `weekly:${weekKey}`,
    type: 'weekly_report',
    createdAt: new Date().toISOString(),
    priority: 4,
  });
}
