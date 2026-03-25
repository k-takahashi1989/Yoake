import React, { useState } from 'react';
import {
  View,
  StyleSheet,
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

export default function OnboardingScreen({ navigation }: Props) {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const { completeOnboarding } = useAuthStore();

  const stepIndex = STEPS.indexOf(currentStep);

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[stepIndex + 1]);
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
    <SafeAreaView style={styles.container}>
      {/* ステップインジケーター */}
      <View style={styles.indicator}>
        {STEPS.map((step, i) => (
          <View
            key={step}
            style={[
              styles.dot,
              i === stepIndex && styles.dotActive,
              i < stepIndex && styles.dotDone,
            ]}
          />
        ))}
      </View>

      <View style={styles.content}>{renderStep()}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  indicator: {
    flexDirection: 'row',
    justifyContent: 'center',
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
    width: 24,
  },
  dotDone: {
    backgroundColor: '#4CAF50',
  },
  content: {
    flex: 1,
    padding: 24,
  },
});
