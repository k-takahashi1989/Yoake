import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {
  UserProfile,
  Subscription,
  UserGoal,
  SleepLog,
  AiReport,
  HabitTemplate,
  BodyLog,
  ChatMessage,
} from '../types';

// ============================================================
// ユーティリティ
// ============================================================

function uid(): string {
  const user = auth().currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

function userDoc() {
  return firestore().collection('users').doc(uid());
}

// ============================================================
// UserProfile
// ============================================================

export async function getProfile(): Promise<UserProfile | null> {
  const snap = await userDoc().collection('profile').doc('main').get();
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function saveProfile(data: Partial<UserProfile>): Promise<void> {
  await userDoc()
    .collection('profile')
    .doc('main')
    .set({ ...data, lastActiveAt: firestore.FieldValue.serverTimestamp() }, { merge: true });
}

// ============================================================
// Subscription
// ============================================================

export async function getSubscription(): Promise<Subscription | null> {
  const snap = await userDoc().collection('subscription').doc('main').get();
  return snap.exists() ? (snap.data() as Subscription) : null;
}

export async function saveSubscription(data: Partial<Subscription>): Promise<void> {
  await userDoc().collection('subscription').doc('main').set(data, { merge: true });
}

// ============================================================
// UserGoal
// ============================================================

export async function getGoal(): Promise<UserGoal | null> {
  const snap = await userDoc().collection('goal').doc('main').get();
  return snap.exists() ? (snap.data() as UserGoal) : null;
}

export async function saveGoal(data: Partial<UserGoal>): Promise<void> {
  await userDoc()
    .collection('goal')
    .doc('main')
    .set({ ...data, updatedAt: firestore.FieldValue.serverTimestamp() }, { merge: true });
}

// ============================================================
// SleepLog
// ============================================================

export async function saveSleepLog(log: Omit<SleepLog, 'createdAt' | 'updatedAt'>): Promise<void> {
  const docRef = userDoc().collection('sleepLogs').doc(log.date);
  const existing = await docRef.get();
  if (existing.exists()) {
    await docRef.update({
      ...log,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  } else {
    await docRef.set({
      ...log,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  }
}

export async function getSleepLog(date: string): Promise<SleepLog | null> {
  const snap = await userDoc().collection('sleepLogs').doc(date).get();
  return snap.exists() ? (snap.data() as SleepLog) : null;
}

export async function getRecentSleepLogs(days: number): Promise<SleepLog[]> {
  const snap = await userDoc()
    .collection('sleepLogs')
    .orderBy('date', 'desc')
    .limit(days)
    .get();
  return snap.docs.map(d => d.data() as SleepLog);
}

export async function deleteSleepLog(date: string): Promise<void> {
  await userDoc().collection('sleepLogs').doc(date).delete();
}

export async function getSleepLogsInRange(
  startDate: string,
  endDate: string,
): Promise<SleepLog[]> {
  const snap = await userDoc()
    .collection('sleepLogs')
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .orderBy('date', 'desc')
    .get();
  return snap.docs.map(d => d.data() as SleepLog);
}

// ============================================================
// AiReport
// ============================================================

export async function getAiReport(key: string): Promise<AiReport | null> {
  const snap = await userDoc().collection('aiReports').doc(key).get();
  return snap.exists() ? (snap.data() as AiReport) : null;
}

export async function saveAiReport(key: string, report: AiReport): Promise<void> {
  await userDoc().collection('aiReports').doc(key).set(report);
}

export async function getPastWeeklyReports(n: number): Promise<Array<{ key: string } & AiReport>> {
  const snap = await userDoc()
    .collection('aiReports')
    .where('type', '==', 'weekly')
    .orderBy('generatedAt', 'desc')
    .limit(n)
    .get();
  return snap.docs.map(d => ({ key: d.id, ...(d.data() as AiReport) }));
}

// ============================================================
// HabitTemplate
// ============================================================

export async function getHabitTemplates(): Promise<HabitTemplate[]> {
  const snap = await userDoc()
    .collection('habitTemplates')
    .orderBy('order', 'asc')
    .get();
  return snap.docs.map(d => d.data() as HabitTemplate);
}

export async function saveHabitTemplate(template: HabitTemplate): Promise<void> {
  await userDoc().collection('habitTemplates').doc(template.id).set(template);
}

export async function deleteHabitTemplate(habitId: string): Promise<void> {
  await userDoc().collection('habitTemplates').doc(habitId).delete();
}

// ============================================================
// BodyLog（有料）
// ============================================================

export async function saveBodyLog(log: Omit<BodyLog, 'createdAt'>): Promise<void> {
  await userDoc()
    .collection('bodyLogs')
    .doc(log.date)
    .set({ ...log, createdAt: firestore.FieldValue.serverTimestamp() });
}

export async function getBodyLog(date: string): Promise<BodyLog | null> {
  const snap = await userDoc().collection('bodyLogs').doc(date).get();
  return snap.exists() ? (snap.data() as BodyLog) : null;
}

// ============================================================
// ChatHistory
// ============================================================

const CHAT_HISTORY_MAX = 50;

export async function saveChatMessages(
  chatId: string,
  messages: ChatMessage[],
): Promise<void> {
  const trimmed = messages.slice(-CHAT_HISTORY_MAX);
  await userDoc().collection('chatHistory').doc(chatId).set({ messages: trimmed });
}

export async function getChatMessages(chatId: string): Promise<ChatMessage[]> {
  const snap = await userDoc().collection('chatHistory').doc(chatId).get();
  if (!snap.exists()) return [];
  return (snap.data() as { messages: ChatMessage[] }).messages ?? [];
}

// ============================================================
// appData / defaultHabits
// ============================================================

export async function getDefaultHabits() {
  const snap = await firestore()
    .collection('appData')
    .doc('defaultHabits')
    .get();
  return snap.exists() ? ((snap.data() as any).habits ?? []) : [];
}

// ============================================================
// 全ユーザーデータ削除
// ============================================================

export async function deleteAllUserData(): Promise<void> {
  const userRef = userDoc();
  const collections = ['sleepLogs', 'aiReports', 'habitTemplates', 'chatHistory', 'bodyLogs'];

  for (const col of collections) {
    const snap = await userRef.collection(col).limit(500).get();
    if (snap.empty) continue;
    const batch = firestore().batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  const batch2 = firestore().batch();
  batch2.delete(userRef.collection('profile').doc('main'));
  batch2.delete(userRef.collection('subscription').doc('main'));
  batch2.delete(userRef.collection('goal').doc('main'));
  await batch2.commit();
}

// ============================================================
// リアルタイム購読
// ============================================================

export function subscribeToSleepLog(
  date: string,
  onChange: (log: SleepLog | null) => void,
): () => void {
  return userDoc()
    .collection('sleepLogs')
    .doc(date)
    .onSnapshot(snap => {
      onChange(snap.exists() ? (snap.data() as SleepLog) : null);
    });
}
