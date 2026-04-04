import { SleepOnset, WakeFeeling } from '../types';

type TranslateFn = (key: string) => string;

const SLEEP_ONSET_LABEL_KEYS: Record<SleepOnset, string> = {
  FAST: 'common.sleepOnset.fast',
  SLIGHTLY_FAST: 'common.sleepOnset.slightlyFast',
  NORMAL: 'common.sleepOnset.normal',
  SLIGHTLY_SLOW: 'common.sleepOnset.slightlySlow',
  SLOW: 'common.sleepOnset.slow',
};

const WAKE_FEELING_LABEL_KEYS: Record<WakeFeeling, string> = {
  GOOD: 'common.wakeFeeling.good',
  SLIGHTLY_GOOD: 'common.wakeFeeling.slightlyGood',
  NORMAL: 'common.wakeFeeling.normal',
  SLIGHTLY_BAD: 'common.wakeFeeling.slightlyBad',
  BAD: 'common.wakeFeeling.bad',
};

export function getSleepOnsetOptions(t: TranslateFn): Array<{ value: SleepOnset; label: string }> {
  return [
    { value: 'FAST', label: t('sleepInput.onsetFast') },
    { value: 'SLIGHTLY_FAST', label: t('sleepInput.onsetSlightlyFast') },
    { value: 'NORMAL', label: t('sleepInput.onsetNormal') },
    { value: 'SLIGHTLY_SLOW', label: t('sleepInput.onsetSlightlySlow') },
    { value: 'SLOW', label: t('sleepInput.onsetSlow') },
  ];
}

export function getWakeFeelingOptions(t: TranslateFn): Array<{ value: WakeFeeling; label: string }> {
  return [
    { value: 'GOOD', label: t('sleepInput.wakeFeelingGood') },
    { value: 'SLIGHTLY_GOOD', label: t('sleepInput.wakeFeelingSlightlyGood') },
    { value: 'NORMAL', label: t('sleepInput.wakeFeelingNormal') },
    { value: 'SLIGHTLY_BAD', label: t('sleepInput.wakeFeelingSlightlyBad') },
    { value: 'BAD', label: t('sleepInput.wakeFeelingBad') },
  ];
}

export function getSleepOnsetLabel(value: SleepOnset, t: TranslateFn): string {
  return t(SLEEP_ONSET_LABEL_KEYS[value]);
}

export function getWakeFeelingLabel(value: WakeFeeling, t: TranslateFn): string {
  return t(WAKE_FEELING_LABEL_KEYS[value]);
}
