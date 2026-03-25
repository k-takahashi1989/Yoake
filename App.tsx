import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from './src/stores/authStore';
import AppNavigator from './src/navigation';

export default function App() {
  const { initialize, ensureSignedIn } = useAuthStore();

  useEffect(() => {
    const unsubscribe = initialize();
    // 未サインインの場合は匿名で自動サインイン
    ensureSignedIn();
    return unsubscribe;
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
