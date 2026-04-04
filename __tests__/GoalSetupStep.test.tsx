import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert } from 'react-native';
import GoalSetupStep from '../src/screens/Onboarding/steps/GoalSetupStep';
import ScalePressable from '../src/components/common/ScalePressable';
import { saveGoal } from '../src/services/firebase';

const mockEnsureSignedIn = jest.fn().mockResolvedValue(undefined);

jest.mock('../src/services/firebase', () => ({
  saveGoal: jest.fn(),
}));

jest.mock('../src/stores/authStore', () => ({
  useAuthStore: jest.fn((selector: any) =>
    selector({
      ensureSignedIn: mockEnsureSignedIn,
    }),
  ),
}));

describe('GoalSetupStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureSignedIn.mockResolvedValue(undefined);
    (saveGoal as jest.Mock).mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ensures sign-in before saving the goal', async () => {
    const onNext = jest.fn();
    let tree: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<GoalSetupStep onNext={onNext} />);
    });

    const saveButton = tree!.root.findByType(ScalePressable);

    await ReactTestRenderer.act(async () => {
      await saveButton.props.onPress();
    });

    expect(mockEnsureSignedIn).toHaveBeenCalled();
    expect(saveGoal).toHaveBeenCalledWith(
      expect.objectContaining({
        targetHours: 7.5,
        targetScore: 80,
        bedTimeTarget: '23:00',
      }),
    );
    expect(onNext).toHaveBeenCalled();
  });

  it('shows an error alert when goal saving fails', async () => {
    const onNext = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (saveGoal as jest.Mock).mockRejectedValueOnce(new Error('Not authenticated'));

    let tree: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<GoalSetupStep onNext={onNext} />);
    });

    const saveButton = tree!.root.findByType(ScalePressable);

    await ReactTestRenderer.act(async () => {
      await saveButton.props.onPress();
    });

    expect(mockEnsureSignedIn).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('common.error', 'common.saveFailed');
    expect(onNext).not.toHaveBeenCalled();
  });
});
