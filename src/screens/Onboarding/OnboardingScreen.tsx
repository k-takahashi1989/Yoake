import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import WelcomeStep from './steps/WelcomeStep';
import GoalSetupStep from './steps/GoalSetupStep';
import HealthConnectStep from './steps/HealthConnectStep';
import NotificationStep from './steps/NotificationStep';
import TrialStep from './steps/TrialStep';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

type Step = 'welcome' | 'goal' | 'healthConnect' | 'notification' | 'trial';
const STEPS: Step[] = ['welcome', 'goal', 'healthConnect', 'notification', 'trial'];

// ProgressDot: アクティブ時に幅が 8px → 24px へ Animated.spring で伸びるドット
function ProgressDot({ isActive, isDone }: { isActive: boolean; isDone: boolean }) {
  // useNativeDriver: false — width はレイアウトプロパティのためネイティブドライバ不可
  const dotWidth = useRef(new Animated.Value(isActive ? 24 : 8)).current;

  useEffect(() => {
    Animated.spring(dotWidth, {
      toValue: isActive ? 24 : 8,
      useNativeDriver: false,
    }).start();
  }, [isActive, dotWidth]);

  return (
    <Animated.View
      style={[
        styles.dot,
        isDone && styles.dotDone,
        isActive && styles.dotActive,
        { width: dotWidth },
      ]}
    />
  );
}

export default function OnboardingScreen({ navigation }: Props) {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const { completeOnboarding } = useAuthStore();

  const stepIndex = STEPS.indexOf(currentStep);

  // フェードアニメーション用の値（初期値 1 = 完全表示）
  const fadeAnim = useRef(new Animated.Value(1)).current;

  /**
   * フェードアウト（150ms）→ ステップ切替 → フェードイン（200ms）
   * 既存の AsyncStorage 完了フラグ等は各 Step コンポーネント内で管理されており影響なし
   */
  const goNext = () => {
    if (stepIndex < STEPS.length - 1) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setCurrentStep(STEPS[stepIndex + 1]);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }
  };

  const handleComplete = async () => {
    await completeOnboarding();
    // navigation は hasCompletedOnboarding の変化で自動切替
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return <WelcomeStep onNext={goNext} />;
      case 'goal':
        return <GoalSetupStep onNext={goNext} />;
      case 'healthConnect':
        return <HealthConnectStep onNext={goNext} />;
      case 'notification':
        return <NotificationStep onNext={goNext} />;
      case 'trial':
        return <TrialStep onComplete={handleComplete} />;
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/images/bg_home.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      {/* 全体に薄いオーバーレイ：各ステップの文字・UIを読みやすく保つ */}
      <View style={styles.overlay} />
      <SafeAreaView style={styles.container}>
        {/* ステップインジケーター（ヘッダー固定 — フェードの対象外） */}
        <View style={styles.indicator}>
          {STEPS.map((step, i) => (
            <ProgressDot
              key={step}
              isActive={i === stepIndex}
              isDone={i < stepIndex}
            />
          ))}
        </View>

        {/* コンテンツエリアのみフェードトランジションを適用 */}
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {renderStep()}
        </Animated.View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 18, 40, 0.72)',
  },
  container: {
    flex: 1,
  },
  indicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#444',
  },
  dotActive: {
    backgroundColor: '#6B5CE7',
  },
  dotDone: {
    backgroundColor: '#4CAF50',
  },
  content: {
    flex: 1,
    padding: 24,
  },
});
