import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Platform } from 'react-native';

/**
 * 現在のユーザーの FCM トークンを取得し Firestore に保存する。
 * 権限がない場合・未ログインの場合はサイレントに無視。
 */
export async function registerFcmToken(): Promise<void> {
  const user = auth().currentUser;
  if (!user) return;

  const authStatus = await messaging().hasPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  if (!enabled) return;

  const token = await messaging().getToken();
  if (!token) return;

  await saveFcmToken(user.uid, token);
}

/**
 * FCM トークンを Firestore の fcmTokens サブコレクションに保存する。
 * トークンをドキュメント ID として使い、upsert する。
 */
export async function saveFcmToken(uid: string, token: string): Promise<void> {
  await firestore()
    .collection('users').doc(uid)
    .collection('fcmTokens').doc(token)
    .set({
      token,
      platform: Platform.OS,
      updatedAt: firestore.FieldValue.serverTimestamp(),
      isValid: true,
    });
}

/**
 * サインアウト前に FCM トークンを無効化して削除する。
 * エラーはサイレントに無視。
 */
export async function deleteFcmToken(): Promise<void> {
  const user = auth().currentUser;
  if (!user) return;
  try {
    const token = await messaging().getToken();
    if (!token) return;
    await firestore()
      .collection('users').doc(user.uid)
      .collection('fcmTokens').doc(token)
      .update({ isValid: false });
    await messaging().deleteToken();
  } catch {
    // silent
  }
}
