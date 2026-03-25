import React, { useCallback, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import {
  RootStackParamList,
  MainTabParamList,
  HomeStackParamList,
  DiaryStackParamList,
  ProfileStackParamList,
} from '../types';
import { useAuthStore } from '../stores/authStore';

import HomeScreen from '../screens/Home/HomeScreen';
import ScoreDetailScreen from '../screens/Home/ScoreDetailScreen';
import AiChatScreen from '../screens/Home/AiChatScreen';
import DiaryListScreen from '../screens/Diary/DiaryScreen';
import RecordDetailScreen from '../screens/Diary/RecordDetailScreen';
import RecordEditScreen from '../screens/Diary/RecordEditScreen';
import ReportScreen from '../screens/Report/ReportScreen';
import AlarmScreen from '../screens/Alarm/AlarmScreen';
import AlarmFiringScreen from '../screens/Alarm/AlarmFiringScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import EditProfileScreen from '../screens/Profile/EditProfileScreen';
import SubscriptionManageScreen from '../screens/Profile/SubscriptionManageScreen';
import HealthConnectSettingsScreen from '../screens/Profile/HealthConnectSettingsScreen';
import NotificationSettingsScreen from '../screens/Profile/NotificationSettingsScreen';
import DataManagementScreen from '../screens/Profile/DataManagementScreen';
import OnboardingScreen from '../screens/Onboarding/OnboardingScreen';

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

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '🌙',
    Diary: '📔',
    Report: '📊',
    Alarm: '⏰',
    Profile: '👤',
  };
  const labels: Record<string, string> = {
    Home: 'ホーム',
    Diary: '日記',
    Report: 'レポート',
    Alarm: 'アラーム',
    Profile: 'マイページ',
  };
  return (
    <Text
      style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}
      accessibilityLabel={labels[name]}
    >
      {icons[name] ?? '?'}
    </Text>
  );
}

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={HEADER_OPTS}>
      <HomeStack.Screen name="HomeScreen" component={HomeScreen} options={{ headerShown: false }} />
      <HomeStack.Screen
        name="ScoreDetail"
        component={ScoreDetailScreen}
        options={{ title: 'スコア詳細', headerBackTitle: '' }}
      />
      <HomeStack.Screen
        name="AiChat"
        component={AiChatScreen}
        options={{ title: 'AIチャット', headerBackTitle: '' }}
      />
    </HomeStack.Navigator>
  );
}

function DiaryStackNavigator() {
  return (
    <DiaryStack.Navigator screenOptions={HEADER_OPTS}>
      <DiaryStack.Screen
        name="DiaryList"
        component={DiaryListScreen}
        options={{ headerShown: false }}
      />
      <DiaryStack.Screen
        name="RecordDetail"
        component={RecordDetailScreen}
        options={{ title: '記録詳細', headerBackTitle: '' }}
      />
      <DiaryStack.Screen
        name="RecordEdit"
        component={RecordEditScreen}
        options={{ title: '記録を編集', headerBackTitle: '' }}
      />
    </DiaryStack.Navigator>
  );
}

function ProfileStackNavigator() {
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
        options={{ title: 'プロフィール編集', headerBackTitle: '' }}
      />
      <ProfileStack.Screen
        name="SubscriptionManage"
        component={SubscriptionManageScreen}
        options={{ title: 'サブスク管理', headerBackTitle: '' }}
      />
      <ProfileStack.Screen
        name="HealthConnectSettings"
        component={HealthConnectSettingsScreen}
        options={{ title: 'Health Connect', headerBackTitle: '' }}
      />
      <ProfileStack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ title: '通知設定', headerBackTitle: '' }}
      />
      <ProfileStack.Screen
        name="DataManagement"
        component={DataManagementScreen}
        options={{ title: 'データ管理', headerBackTitle: '' }}
      />
    </ProfileStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#6B5CE7',
        tabBarInactiveTintColor: '#9E9E9E',
        tabBarStyle: { backgroundColor: '#1A1A2E', borderTopColor: '#2D2D44' },
        tabBarLabelStyle: { fontSize: 10 },
      })}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} options={{ title: 'ホーム' }} />
      <Tab.Screen name="Diary" component={DiaryStackNavigator} options={{ title: '日記' }} />
      <Tab.Screen name="Report" component={ReportScreen} options={{ title: 'レポート' }} />
      <Tab.Screen name="Alarm" component={AlarmScreen} options={{ title: 'アラーム' }} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} options={{ title: 'マイページ' }} />
    </Tab.Navigator>
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

  // アラーム通知からアプリが起動された場合 → AlarmFiring へ遷移
  const handleNavigationReady = useCallback(async () => {
    const initial = await notifee.getInitialNotification();
    if (initial?.notification?.id === 'yoake_alarm') {
      navigationRef.navigate('AlarmFiring');
    }
  }, []);

  // フォアグラウンドでアラームが届いた場合 → AlarmFiring へ遷移
  useEffect(() => {
    return notifee.onForegroundEvent(({ type, detail }) => {
      const isAlarm = detail.notification?.id === 'yoake_alarm';
      if (!isAlarm) return;
      if (
        (type === EventType.DELIVERED || type === EventType.PRESS) &&
        navigationRef.isReady()
      ) {
        navigationRef.navigate('AlarmFiring');
      }
    });
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
            <RootStack.Screen
              name="AlarmFiring"
              component={AlarmFiringScreen}
              options={{ animation: 'fade' }}
            />
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
});
