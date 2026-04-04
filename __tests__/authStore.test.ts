jest.mock('../src/services/firebase', () => ({
  getSubscription: jest.fn(),
  saveSubscription: jest.fn(),
  getProfile: jest.fn(),
  saveProfile: jest.fn(),
  deleteAllUserData: jest.fn(),
}));

jest.mock('../src/services/fcmService', () => ({
  registerFcmToken: jest.fn().mockResolvedValue(undefined),
  deleteFcmToken: jest.fn().mockResolvedValue(undefined),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../src/stores/authStore';
import {
  getSubscription,
  saveSubscription,
  getProfile,
  saveProfile,
} from '../src/services/firebase';
import { registerFcmToken } from '../src/services/fcmService';

const flushPromises = () => new Promise(resolve => setImmediate(resolve));
const authModule = jest.requireMock('@react-native-firebase/auth') as any;
const mockAuth = authModule.default ?? authModule;

describe('useAuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.__reset();
    useAuthStore.setState({
      user: null,
      profile: null,
      subscription: null,
      isLoading: false,
      isInitialized: false,
      isPremium: false,
      hasCompletedOnboarding: false,
    });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (getProfile as jest.Mock).mockResolvedValue({
      displayName: 'Yoake',
      createdAt: null,
      lastActiveAt: null,
    });
    (getSubscription as jest.Mock).mockResolvedValue({
      plan: 'monthly',
      status: 'active',
      trialStartAt: null,
      trialEndAt: null,
      currentPeriodEndAt: null,
      trialUsed: false,
    });
    (saveProfile as jest.Mock).mockResolvedValue(undefined);
    (saveSubscription as jest.Mock).mockResolvedValue(undefined);
  });

  it('completeOnboarding persists the onboarding completion flag', async () => {
    await useAuthStore.getState().completeOnboarding();

    expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@yoake:onboarding_completed',
      'true',
    );
    expect(registerFcmToken).toHaveBeenCalled();
  });

  it('signInWithEmail marks onboarding complete after login', async () => {
    await useAuthStore
      .getState()
      .signInWithEmail('restore@example.com', 'pw123456');

    expect(useAuthStore.getState().user?.email).toBe('restore@example.com');
    expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@yoake:onboarding_completed',
      'true',
    );
  });

  it('dev premium toggle keeps subscription state in sync with premium flag', async () => {
    useAuthStore.getState()._devSetPremium(true);

    expect(useAuthStore.getState().isPremium).toBe(true);
    expect(useAuthStore.getState().subscription).toMatchObject({
      plan: 'monthly',
      status: 'active',
    });
    await flushPromises();
    expect(saveSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'monthly',
        status: 'active',
      }),
    );
  });
});
