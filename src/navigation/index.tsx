import React, { useCallback, useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import auth from '@react-native-firebase/auth';
import { saveFcmToken } from '../services/fcmService';
import {
  RootStackParamList,
  MainTabParamList,
  HomeStackParamList,
  DiaryStackParamList,
  ProfileStackParamList,
} from '../types';
import { useAuthStore } from '../stores/authStore';
import { useTranslation } from '../i18n';
import AnimatedBackground, {
  AnimatedBackgroundHandle,
} from '../components/common/AnimatedBackground';
import CustomTabBar from '../components/common/CustomTabBar';

import HomeScreen from '../screens/Home/HomeScreen';
import ScoreDetailScreen from '../screens/Home/ScoreDetailScreen';
import AiChatScreen from '../screens/Home/AiChatScreen';
import DiaryListScreen from '../screens/Diary/DiaryScreen';
import RecordEditScreen from '../screens/Diary/RecordEditScreen';
import RecordDetailScreen from '../screens/Diary/RecordDetailScreen';
import ReportScreen from '../screens/Report/ReportScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import EditProfileScreen from '../screens/Profile/EditProfileScreen';
import LinkEmailScreen from '../screens/Profile/LinkEmailScreen';
import SignInScreen from '../screens/Profile/SignInScreen';
import SubscriptionManageScreen from '../screens/Profile/SubscriptionManageScreen';
import HealthConnectSettingsScreen from '../screens/Profile/HealthConnectSettingsScreen';
import NotificationSettingsScreen from '../screens/Profile/NotificationSettingsScreen';
import DataManagementScreen from '../screens/Profile/DataManagementScreen';
import OnboardingScreen from '../screens/Onboarding/OnboardingScreen';
import {
  BEDTIME_REMINDER_ACTION_ID,
  BEDTIME_REMINDER_NOTIFICATION_ID,
  NOTIF_ID as MORNING_REMINDER_NOTIFICATION_ID,
  WEEKLY_REPORT_CHANNEL_ID,
  ensureWeeklyReportChannel,
  savePendingSleepStart,
} from '../services/notificationService';

// ============================================================
// ナビゲーションRef（コンポーネント外からでも使用可能）
// ============================================================

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// ============================================================
// スタック・タブ定義
// ============================================================

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const DiaryStack = createNativeStackNavigator<DiaryStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

const HEADER_OPTS = {
  headerStyle: { backgroundColor: '#1A1A2E' },
  headerTintColor: '#FFFFFF' as const,
  headerTitleStyle: { fontWeight: '600' as const },
  headerShadowVisible: false,
};

const HOME_BG_SOURCE = require('../assets/images/bg_home.png');


function HomeStackNavigator() {
  const { t } = useTranslation();
  return (
    <HomeStack.Navigator screenOptions={HEADER_OPTS}>
      <HomeStack.Screen name="HomeScreen" component={HomeScreen} options={{ headerShown: false }} />
      <HomeStack.Screen
        name="ScoreDetail"
        component={ScoreDetailScreen}
        options={{ title: t('nav.scoreDetail'), headerBackTitle: '' }}
      />
      <HomeStack.Screen
        name="RecordEdit"
        component={RecordEditScreen}
        options={{ title: t('nav.recordEdit'), headerBackTitle: '' }}
      />
      <HomeStack.Screen
        name="AiChat"
        component={AiChatScreen}
        options={{ title: t('nav.aiChat'), headerBackTitle: '' }}
      />
    </HomeStack.Navigator>
  );
}

function DiaryStackNavigator() {
  const { t } = useTranslation();
  return (
    <DiaryStack.Navigator screenOptions={HEADER_OPTS}>
      <DiaryStack.Screen
        name="DiaryList"
        component={DiaryListScreen}
        options={{ headerShown: false }}
      />
      <DiaryStack.Screen
        name="ScoreDetail"
        component={ScoreDetailScreen}
        options={{ title: t('nav.scoreDetail'), headerBackTitle: '' }}
      />
      <DiaryStack.Screen
        name="RecordEdit"
        component={RecordEditScreen}
        options={{ title: t('nav.recordEdit'), headerBackTitle: '' }}
      />
      <DiaryStack.Screen
        name="RecordDetail"
        component={RecordDetailScreen}
        options={{ title: t('nav.recordDetail'), headerBackTitle: '' }}
      />
    </DiaryStack.Navigator>
  );
}

function ProfileStackNavigator() {
  const { t, i18n } = useTranslation();
  const isJa = i18n.language === 'ja';
  return (
    <ProfileStack.Navigator screenOptions={HEADER_OPTS}>
      <ProfileStack.Screen
        name="ProfileScreen"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <ProfileStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: t('nav.editProfile'), headerBackTitle: '' }}
      />
      <ProfileStack.Screen
        name="LinkEmail"
        component={LinkEmailScreen}
        options={{ title: isJa ? 'メールで保護する' : 'Protect with Email', headerBackTitle: '' }}
      />
      <ProfileStack.Screen
        name="SignIn"
        component={SignInScreen}
        options={{ title: isJa ? 'ログイン' : 'Sign In', headerBackTitle: '' }}
      />
      <ProfileStack.Screen
        name="SubscriptionManage"
        component={SubscriptionManageScreen}
        options={{ title: t('nav.subscriptionManage'), headerBackTitle: '' }}
      />
      <ProfileStack.Screen
        name="HealthConnectSettings"
        component={HealthConnectSettingsScreen}
        options={{ title: t('nav.healthConnectSettings'), headerBackTitle: '' }}
      />
      <ProfileStack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ title: t('nav.notificationSettings'), headerBackTitle: '' }}
      />
      <ProfileStack.Screen
        name="DataManagement"
        component={DataManagementScreen}
        options={{ title: t('nav.dataManagement'), headerBackTitle: '' }}
      />
    </ProfileStack.Navigator>
  );
}

function MainTabs() {
  const { t } = useTranslation();

  // AnimatedBackground への ref。CustomTabBar がズームをトリガーするために使う。
  const bgRef = useRef<AnimatedBackgroundHandle>(null);

  useEffect(() => {
    const asset = Image.resolveAssetSource(HOME_BG_SOURCE);
    if (!asset?.uri) return;
    Image.prefetch(asset.uri).catch(() => {
      // ignore preload failures and fall back to normal decode
    });
  }, []);

  return (
    // 背景 + タブナビゲーター全体を包むコンテナ
    <View style={styles.mainContainer}>
      {/* ① 全画面背景：最背面に配置 */}
      <AnimatedBackground
        ref={bgRef}
        // source={require('../assets/bedroom.png')}  // 背景画像を用意したらここを有効化
      />

      {/* ② タブナビゲーター：背景の上に重ねる */}
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          // 各スクリーンのシーンコンテナを透明にして AnimatedBackground が透けて見えるようにする。
          // 個々のスクリーン側でも View の backgroundColor を transparent にすることで
          // 背景ズーム演出が活きる（既存スクリーンの background をそのまま使いたい場合は
          // 各スクリーンの最外 View に backgroundColor: 'transparent' を指定する）。
          sceneStyle: { backgroundColor: 'transparent' },
        }}
        tabBar={(props) => (
          <CustomTabBar {...props} backgroundRef={bgRef} />
        )}
      >
        <Tab.Screen name="Home" component={HomeStackNavigator} options={{ title: t('nav.home') }} />
        <Tab.Screen name="Diary" component={DiaryStackNavigator} options={{ title: t('nav.diary') }} />
        <Tab.Screen name="Report" component={ReportScreen} options={{ title: t('nav.report') }} />
        <Tab.Screen name="Profile" component={ProfileStackNavigator} options={{ title: t('nav.profile') }} />
      </Tab.Navigator>
    </View>
  );
}

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <Text style={styles.splashLogo}>🌅</Text>
      <Text style={styles.splashTitle}>YOAKE</Text>
      <ActivityIndicator color="#6B5CE7" style={{ marginTop: 32 }} />
    </View>
  );
}

// ============================================================
// アプリナビゲーター
// ============================================================

export default function AppNavigator() {
  const { isInitialized, hasCompletedOnboarding } = useAuthStore();

  const handleBedtimeReminderPress = useCallback(async (pressActionId?: string) => {
    if (pressActionId === BEDTIME_REMINDER_ACTION_ID) {
      await savePendingSleepStart();
    }

    if (navigationRef.isReady()) {
      navigationRef.navigate('Main');
    }
  }, []);

  // アプリ起動時の通知タップ処理（Notifee / FCM 両対応）
  const handleNavigationReady = useCallback(async () => {
    // 週次レポートチャンネルを確保
    ensureWeeklyReportChannel().catch(() => {});

    // Notifee: 朝リマインダー通知タップ
    const initial = await notifee.getInitialNotification();
    if (initial?.notification?.id === MORNING_REMINDER_NOTIFICATION_ID) {
      navigationRef.navigate('Main');
      return;
    }
    if (initial?.notification?.id === BEDTIME_REMINDER_NOTIFICATION_ID) {
      await handleBedtimeReminderPress((initial as any)?.pressAction?.id);
      return;
    }

    // FCM: アプリ終了状態から通知タップで起動した場合
    const remoteMessage = await messaging().getInitialNotification();
    if (remoteMessage?.data?.type === 'weekly_report' && navigationRef.isReady()) {
      setTimeout(() => {
        if (navigationRef.isReady()) {
          (navigationRef as any).navigate('Main', { screen: 'Report' });
        }
      }, 500);
    }
  }, [handleBedtimeReminderPress]);

  // フォアグラウンドで起床リマインダー通知がタップされた場合 → Diary タブへ遷移
  useEffect(() => {
    return notifee.onForegroundEvent(async ({ type, detail }) => {
      const isWakeReminder =
        detail.notification?.id === MORNING_REMINDER_NOTIFICATION_ID;
      if (isWakeReminder && type === EventType.PRESS && navigationRef.isReady()) {
        navigationRef.navigate('Main');
        return;
      }

      const isBedtimeReminder =
        detail.notification?.id === BEDTIME_REMINDER_NOTIFICATION_ID;
      if (!isBedtimeReminder) return;

      if (type === EventType.ACTION_PRESS) {
        await handleBedtimeReminderPress(detail.pressAction?.id);
        return;
      }

      if (type === EventType.PRESS && navigationRef.isReady()) {
        navigationRef.navigate('Main');
      }
    });
  }, [handleBedtimeReminderPress]);

  // FCM: フォアグラウンド通知受信 + バックグラウンド→フォアグラウンド時のタップ + トークンリフレッシュ
  useEffect(() => {
    const unsubMessage = messaging().onMessage(async remoteMessage => {
      if (remoteMessage.data?.type === 'weekly_report') {
        await ensureWeeklyReportChannel();
        await notifee.displayNotification({
          title: remoteMessage.notification?.title ?? '週次レポート',
          body: remoteMessage.notification?.body ?? '今週の睡眠レポートが届きました',
          android: {
            channelId: WEEKLY_REPORT_CHANNEL_ID,
            pressAction: { id: 'default' },
          },
        });
      }
    });

    const unsubOpened = messaging().onNotificationOpenedApp(remoteMessage => {
      if (remoteMessage.data?.type === 'weekly_report' && navigationRef.isReady()) {
        (navigationRef as any).navigate('Main', { screen: 'Report' });
      }
    });

    const unsubRefresh = messaging().onTokenRefresh(async newToken => {
      const user = auth().currentUser;
      if (user) await saveFcmToken(user.uid, newToken).catch(() => {});
    });

    return () => {
      unsubMessage();
      unsubOpened();
      unsubRefresh();
    };
  }, []);

  if (!isInitialized) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={handleNavigationReady}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!hasCompletedOnboarding ? (
          <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <RootStack.Screen name="Main" component={MainTabs} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  splashLogo: { fontSize: 64 },
  splashTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 8,
    marginTop: 8,
  },
  // MainTabs 用: 背景とタブナビゲーターを重ねるコンテナ
  mainContainer: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
});
