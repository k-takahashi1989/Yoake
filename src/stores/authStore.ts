import { create } from 'zustand';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSubscription, saveSubscription, getProfile, saveProfile, deleteAllUserData } from '../services/firebase';
import { Subscription, UserProfile, AiPersonality, AgeGroup } from '../types';
import { registerFcmToken, deleteFcmToken } from '../services/fcmService';
import { safeToDate } from '../utils/dateUtils';

const ONBOARDING_KEY = '@yoake:onboarding_completed';

function hasSubscriptionAccess(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  if (subscription.status !== 'active' && subscription.status !== 'trial') {
    return false;
  }

  const endAt =
    subscription.status === 'trial'
      ? subscription.trialEndAt
      : subscription.currentPeriodEndAt ?? subscription.trialEndAt;

  if (!endAt) return false;
  return safeToDate(endAt) > new Date();
}

interface AuthState {
  user: FirebaseAuthTypes.User | null;
  profile: UserProfile | null;
  subscription: Subscription | null;
  isLoading: boolean;
  isInitialized: boolean;
  isPremium: boolean;
  hasCompletedOnboarding: boolean;

  initialize: () => () => void;
  ensureSignedIn: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  signOut: () => Promise<void>;
  linkEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  refreshSubscription: () => Promise<void>;
  updateProfile: (data: { displayName?: string | null; ageGroup?: AgeGroup | null; aiPersonality?: AiPersonality }) => Promise<void>;
  deleteAccount: () => Promise<void>;
  /** DEV only: プレミアム状態を強制切替 */
  _devSetPremium: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  subscription: null,
  isLoading: false,
  isInitialized: false,
  isPremium: false,
  hasCompletedOnboarding: false,

  initialize: () => {
    // AsyncStorage からオンボーディング完了フラグを先読み
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      if (val === 'true') set({ hasCompletedOnboarding: true });
    });

    const unsubscribe = auth().onAuthStateChanged(async user => {
      try {
      if (!user) {
        // 未サインイン → 匿名サインインして onAuthStateChanged を再トリガー
        // isInitialized は false のままでスプラッシュを表示し続ける
        auth().signInAnonymously().catch(() => {
          // サインイン失敗時のみ初期化完了とみなしてエラー状態を表示
          set({ user: null, isInitialized: true, profile: null, subscription: null, isPremium: false });
        });
        return;
      }

      set({ user, isInitialized: true });

      if (user) {
        const [profile, subscription] = await Promise.all([
          getProfile(),
          getSubscription(),
        ]);
        const storedOnboarding = await AsyncStorage.getItem(ONBOARDING_KEY);
        const hasCompletedOnboarding = user.isAnonymous
          ? storedOnboarding === 'true'
          : true;

        const isPremium = hasSubscriptionAccess(subscription);

        if (!user.isAnonymous) {
          await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
          registerFcmToken().catch(() => {});
        }

        set({
          profile,
          subscription,
          isPremium,
          hasCompletedOnboarding,
        });

        // lastActiveAt を更新
        await saveProfile({});
      }
      } catch (e) {
        console.warn('[authStore] onAuthStateChanged error:', e);
      }
    });

    return unsubscribe;
  },

  // 匿名サインイン（未サインインの場合のみ）
  ensureSignedIn: async () => {
    if (auth().currentUser) return;
    set({ isLoading: true });
    try {
      await auth().signInAnonymously();
    } finally {
      set({ isLoading: false });
    }
  },

  // オンボーディング完了をAsyncStorageに保存
  completeOnboarding: async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    set({ hasCompletedOnboarding: true });
    registerFcmToken().catch(() => {});
  },

  signOut: async () => {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
    set({ hasCompletedOnboarding: false });
    await deleteFcmToken().catch(() => {});
    await auth().signOut();
  },

  linkEmail: async (email: string, password: string) => {
    const currentUser = auth().currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    set({ isLoading: true });
    try {
      const credential = auth.EmailAuthProvider.credential(email.trim(), password);
      await currentUser.linkWithCredential(credential);
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      set({ user: auth().currentUser, hasCompletedOnboarding: true });
    } finally {
      set({ isLoading: false });
    }
  },

  signInWithEmail: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      await auth().signInWithEmailAndPassword(email.trim(), password);
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      set({ user: auth().currentUser, hasCompletedOnboarding: true });
    } finally {
      set({ isLoading: false });
    }
  },

  refreshSubscription: async () => {
    const sub = await getSubscription();
    const isPremium = hasSubscriptionAccess(sub);
    set({ subscription: sub, isPremium });
  },

  updateProfile: async (data) => {
    await saveProfile(data);
    set(state => ({
      profile: state.profile ? { ...state.profile, ...data } : state.profile,
    }));
  },

  _devSetPremium: (value: boolean) => {
    if (!__DEV__) return;
    // ローカル state を即時更新（UI反映用）
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    const nextSubscription: Subscription = {
      plan: value ? 'monthly' : 'free',
      status: value ? 'active' : 'expired',
      trialStartAt: null,
      trialEndAt: null,
      currentPeriodEndAt: value ? firestore.Timestamp.fromDate(oneYearLater) : null,
      trialUsed: false,
    };
    set({ isPremium: value, subscription: nextSubscription });
    // Admin SDK 経由で Firestore に書き込む（クライアントのセキュリティルールをバイパス）
    const fns = getFunctions(undefined, 'asia-northeast1');
    httpsCallable(fns, 'devSetPremium')({ premium: value })
      .catch(e => console.warn('devSetPremium cloud function failed:', e));
  },

  deleteAccount: async () => {
    try { await deleteAllUserData(); } catch { /* ignore */ }
    await AsyncStorage.multiRemove([
      ONBOARDING_KEY,
      '@yoake:alarm_settings',
      '@yoake:notification_settings',
    ]);
    set({ hasCompletedOnboarding: false, profile: null, subscription: null, isPremium: false });
    try {
      await auth().currentUser?.delete();
    } catch {
      await auth().signOut();
    }
  },
}));
