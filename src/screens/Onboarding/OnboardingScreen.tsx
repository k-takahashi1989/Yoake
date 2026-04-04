import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  ImageBackground,
  PanResponder,
  useWindowDimensions,
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
const EDGE_SWIPE_WIDTH = 32;
const SWIPE_BACK_THRESHOLD_RATIO = 0.22;
const STEP_TRANSITION_DURATION = 240;

function ProgressDot({ isActive, isDone }: { isActive: boolean; isDone: boolean }) {
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

export default function OnboardingScreen({ navigation: _navigation }: Props) {
  const { width } = useWindowDimensions();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const { completeOnboarding, ensureSignedIn } = useAuthStore();
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const isAnimatingRef = useRef(false);

  const currentStep = STEPS[currentStepIndex];
  const canGoBack = currentStepIndex > 0;
  const swipeBackThreshold = Math.min(120, width * SWIPE_BACK_THRESHOLD_RATIO);

  const animateStepEntrance = useCallback(
    (fromValue: number) => {
      translateX.setValue(fromValue);
      opacity.setValue(0.92);
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: STEP_TRANSITION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: STEP_TRANSITION_DURATION,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isAnimatingRef.current = false;
      });
    },
    [opacity, translateX],
  );

  const transitionToStep = useCallback(
    (nextIndex: number, direction: 'forward' | 'backward') => {
      if (nextIndex < 0 || nextIndex >= STEPS.length || nextIndex === currentStepIndex || isAnimatingRef.current) {
        return;
      }

      isAnimatingRef.current = true;
      const exitTo = direction === 'forward' ? -width : width;

      Animated.parallel([
        Animated.timing(translateX, {
          toValue: exitTo,
          duration: STEP_TRANSITION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.86,
          duration: STEP_TRANSITION_DURATION,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentStepIndex(nextIndex);
        animateStepEntrance(direction === 'forward' ? width : -width);
      });
    },
    [animateStepEntrance, currentStepIndex, opacity, translateX, width],
  );

  const goNext = useCallback(() => {
    transitionToStep(currentStepIndex + 1, 'forward');
  }, [currentStepIndex, transitionToStep]);

  const goBack = useCallback(() => {
    transitionToStep(currentStepIndex - 1, 'backward');
  }, [currentStepIndex, transitionToStep]);

  useEffect(() => {
    ensureSignedIn().catch(error => {
      console.warn('[OnboardingScreen] ensureSignedIn failed:', error);
    });
  }, [ensureSignedIn]);

  const handleComplete = async () => {
    await completeOnboarding();
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

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          if (!canGoBack || isAnimatingRef.current) {
            return false;
          }

          const isHorizontalSwipe =
            Math.abs(gestureState.dx) > 10 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.4;

          return evt.nativeEvent.pageX <= EDGE_SWIPE_WIDTH && gestureState.dx > 0 && isHorizontalSwipe;
        },
        onPanResponderMove: (_, gestureState) => {
          translateX.setValue(Math.max(0, gestureState.dx));
          const nextOpacity = 1 - Math.min(gestureState.dx / (width * 1.6), 0.12);
          opacity.setValue(nextOpacity);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx >= swipeBackThreshold || gestureState.vx >= 0.7) {
            goBack();
            return;
          }

          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 0,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: 160,
              useNativeDriver: true,
            }),
          ]).start();
        },
        onPanResponderTerminate: () => {
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 0,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: 160,
              useNativeDriver: true,
            }),
          ]).start();
        },
      }),
    [canGoBack, goBack, opacity, swipeBackThreshold, translateX, width],
  );

  return (
    <ImageBackground
      source={require('../../assets/images/bg_home.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <SafeAreaView style={styles.container}>
        <View style={styles.indicator}>
          {STEPS.map((step, i) => (
            <ProgressDot
              key={step}
              isActive={i === currentStepIndex}
              isDone={i < currentStepIndex}
            />
          ))}
        </View>

        <Animated.View
          style={[
            styles.content,
            {
              opacity,
              transform: [{ translateX }],
            },
          ]}
          {...panResponder.panHandlers}
        >
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
