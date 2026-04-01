import { create } from 'zustand';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSubscription, saveSubscription, getProfile, saveProfile, deleteAllUserData } from '../services/firebase';
import { Subscription, UserProfile, AiPersonality, AgeGroup } from '../types';

const ONBOARDING_KEY = '@yoake:onboarding_completed';

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
  refreshSubscription: () => Promise<void>;
  updateProfile: (data: { displayName?: string | null; ageGroup?: AgeGroup | null; aiPersonality?: AiPersonality }) => Promise<void>;
  deleteAccount: () => Promise<void>;
  /** DEV only: プレミアム状態を強制切替 */
  _devSetPremium: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
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
      set({ user, isInitialized: true });

      if (user) {
        const [profile, subscription] = await Promise.all([
          getProfile(),
          getSubscription(),
        ]);

        const isPremium =
          subscription !== null &&
          (subscription.status === 'active' || subscription.status === 'trial');

        set({ profile, subscription, isPremium });

        // lastActiveAt を更新
        await saveProfile({});
      } else {
        set({ profile: null, subscription: null, isPremium: false });
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
  },

  signOut: async () => {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
    set({ hasCompletedOnboarding: false });
    await auth().signOut();
  },

  refreshSubscription: async () => {
    const sub = await getSubscription();
    const isPremium =
      sub !== null && (sub.status === 'active' || sub.status === 'trial');
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
    set({ isPremium: value });
    saveSubscription({
      plan: value ? 'monthly' : 'free',
      status: value ? 'active' : 'expired',
      trialStartAt: null,
      trialEndAt: null,
      currentPeriodEndAt: null,
      trialUsed: false,
    }).catch(e => console.warn('_devSetPremium failed:', e));
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
