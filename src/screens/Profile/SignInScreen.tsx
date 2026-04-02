import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../i18n';

type Props = NativeStackScreenProps<ProfileStackParamList, 'SignIn'>;

function mapSignInError(code?: string, isJa?: boolean) {
  switch (code) {
    case 'auth/invalid-email':
      return isJa ? 'メールアドレスの形式が正しくありません。' : 'Please enter a valid email address.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return isJa ? 'メールアドレスまたはパスワードが違います。' : 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return isJa ? '試行回数が多すぎます。少し時間を置いてお試しください。' : 'Too many attempts. Please try again later.';
    default:
      return isJa ? 'ログインに失敗しました。時間を置いてもう一度お試しください。' : 'Failed to sign in. Please try again.';
  }
}

export default function SignInScreen({ navigation }: Props) {
  const { signInWithEmail, user } = useAuthStore();
  const { i18n } = useTranslation();
  const isJa = i18n.language === 'ja';
  const copy = useMemo(() => ({
    title: isJa ? '以前保護したアカウントでログインします。' : 'Sign in to a previously protected account.',
    body: isJa
      ? '機種変更後や再インストール後でも、メールアドレスで睡眠記録を復旧できます。'
      : 'Restore your sleep records with your email after changing devices or reinstalling.',
    warning: isJa
      ? 'この端末のゲストデータは、ログイン先のアカウントに自動で統合されません。保護したい場合は先に「メールで保護する」を使ってください。'
      : 'Guest data on this device will not merge automatically into the account you sign in to. Protect it with email first if needed.',
    email: isJa ? 'メールアドレス' : 'Email address',
    password: isJa ? 'パスワード' : 'Password',
    placeholderEmail: 'name@example.com',
    placeholderPassword: isJa ? 'パスワードを入力' : 'Enter password',
    cta: isJa ? 'ログインする' : 'Sign In',
    submitting: isJa ? 'ログイン中...' : 'Signing in...',
    validationTitle: isJa ? '入力を確認してください' : 'Check your input',
    validationBody: isJa ? 'メールアドレスとパスワードを入力してください。' : 'Enter your email address and password.',
    successTitle: isJa ? 'ログインしました' : 'Signed in',
    successBody: isJa ? 'アカウントを切り替えました。' : 'Your account has been switched.',
    failTitle: isJa ? 'ログインできませんでした' : 'Could not sign in',
  }), [isJa]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert(copy.validationTitle, copy.validationBody);
      return;
    }

    setIsSubmitting(true);
    try {
      await signInWithEmail(email.trim(), password);
      Alert.alert(copy.successTitle, copy.successBody, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert(copy.failTitle, mapSignInError(error?.code, isJa));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.body}>{copy.body}</Text>

            {user?.isAnonymous && (
              <View style={styles.warningCard}>
                <Text style={styles.warningText}>{copy.warning}</Text>
              </View>
            )}

            <FieldLabel>{copy.email}</FieldLabel>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={copy.placeholderEmail}
              placeholderTextColor="#66627E"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />

            <FieldLabel>{copy.password}</FieldLabel>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={copy.placeholderPassword}
              placeholderTextColor="#66627E"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, isSubmitting && styles.disabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>{copy.cta}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#1A1A2E' },
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  card: {
    margin: 16,
    backgroundColor: '#2D2D44',
    borderRadius: 18,
    padding: 16,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  body: { fontSize: 13, lineHeight: 20, color: '#C8C8E0', marginBottom: 8 },
  warningCard: {
    marginTop: 6,
    backgroundColor: 'rgba(255, 152, 0, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.2)',
    padding: 12,
  },
  warningText: { color: '#FFB74D', fontSize: 12, lineHeight: 18 },
  label: { fontSize: 12, color: '#9A9AB8', marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 13,
    color: '#FFFFFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#3D3D5E',
  },
  primaryButton: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: '#6B5CE7',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
