import { format, subDays } from 'date-fns';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { calculateScore } from './scoreCalculator';
import { DEFAULT_HABITS } from '../constants';
import { SleepOnset, WakeFeeling } from '../types';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const ONSETS: SleepOnset[] = ['FAST', 'NORMAL', 'SLOW'];
const FEELINGS: WakeFeeling[] = ['GOOD', 'NORMAL', 'BAD'];

export async function generateSeedData(days = 90): Promise<void> {
  const user = auth().currentUser;
  if (!user) throw new Error('Not authenticated');

  const userRef = firestore().collection('users').doc(user.uid);
  const today = new Date();

  const BATCH_SIZE = 100;
  let batch = firestore().batch();
  let batchCount = 0;

  for (let i = 1; i <= days; i++) {
    const date = subDays(today, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    // 就寝時刻: 平日22〜24時, 週末23〜25時
    const bedHourRaw = isWeekend ? randInt(23, 25) : randInt(22, 24);
    const bedMinute = randInt(0, 59);
    const bedDate = new Date(date);
    bedDate.setHours(bedHourRaw % 24, bedMinute, 0, 0);
    if (bedHourRaw >= 24) bedDate.setDate(bedDate.getDate() + 1);

    // 睡眠時間: 平日6〜8h, 週末7〜9h
    const sleepMinutes = isWeekend ? randInt(420, 540) : randInt(360, 480);
    const wakeDate = new Date(bedDate.getTime() + sleepMinutes * 60 * 1000);

    // 習慣: 各習慣50%でON
    const habits = DEFAULT_HABITS.map(h => ({
      id: h.id,
      label: h.label,
      emoji: h.emoji,
      checked: Math.random() < 0.5,
    }));

    const sleepOnset: SleepOnset = randChoice(ONSETS);
    const wakeFeeling: WakeFeeling = randChoice(FEELINGS);

    const bedTimestamp = firestore.Timestamp.fromDate(bedDate);
    const wakeTimestamp = firestore.Timestamp.fromDate(wakeDate);

    const { score } = calculateScore(
      {
        date: dateStr,
        bedTime: bedTimestamp,
        wakeTime: wakeTimestamp,
        totalMinutes: sleepMinutes,
        deepSleepMinutes: null,
        remMinutes: null,
        lightSleepMinutes: null,
        awakenings: null,
        heartRateAvg: null,
        sleepOnset,
        wakeFeeling,
        habits,
        memo: null,
        source: 'MANUAL',
      },
      [],
    );

    const docRef = userRef.collection('sleepLogs').doc(dateStr);
    batch.set(docRef, {
      date: dateStr,
      bedTime: bedTimestamp,
      wakeTime: wakeTimestamp,
      totalMinutes: sleepMinutes,
      deepSleepMinutes: null,
      remMinutes: null,
      lightSleepMinutes: null,
      awakenings: null,
      heartRateAvg: null,
      sleepOnset,
      wakeFeeling,
      habits,
      memo: null,
      score,
      sleepDebtMinutes: 0,
      source: 'MANUAL',
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
    batchCount++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = firestore().batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }
}
