import React, { useEffect, useState } from 'react';
import { StatusBar, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from './src/stores/authStore';
import AppNavigator from './src/navigation';
import { initI18n } from './src/i18n';

export default function App() {
  const { initialize, ensureSignedIn } = useAuthStore();
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  useEffect(() => {
    if (!i18nReady) return;
    const unsubscribe = initialize();
    // 未サインインの場合は匿名で自動サインイン
    ensureSignedIn();
    return unsubscribe;
  }, [i18nReady]);

  if (!i18nReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#6B5CE7" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
