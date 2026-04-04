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

type Props = NativeStackScreenProps<ProfileStackParamList, 'LinkEmail'>;

function mapLinkError(code?: string, isJa?: boolean) {
  switch (code) {
    case 'auth/email-already-in-use':
      return isJa ? 'このメールアドレスはすでに使われています。ログインしてください。' : 'This email address is already in use. Please sign in instead.';
    case 'auth/invalid-email':
      return isJa ? 'メールアドレスの形式が正しくありません。' : 'Please enter a valid email address.';
    case 'auth/weak-password':
      return isJa ? 'パスワードは6文字以上にしてください。' : 'Password must be at least 6 characters.';
    case 'auth/requires-recent-login':
      return isJa ? '時間を置いたため認証が切れました。アプリを開き直して、もう一度お試しください。' : 'Authentication expired. Reopen the app and try again.';
    default:
      return isJa ? 'メール連携に失敗しました。時間を置いてもう一度お試しください。' : 'Failed to link your email. Please try again.';
  }
}

export default function LinkEmailScreen({ navigation }: Props) {
  const { linkEmail } = useAuthStore();
  const { i18n } = useTranslation();
  const isJa = i18n.language === 'ja';
  const copy = useMemo(() => ({
    title: isJa ? 'この端末だけのデータを、メールアドレスで保護します。' : 'Protect this device-only data with your email.',
    body: isJa
      ? '連携が終わると、機種変更や再インストール後も同じアカウントで復旧できます。'
      : 'After linking, you can restore your data on a new device or after reinstalling.',
    email: isJa ? 'メールアドレス' : 'Email address',
    password: isJa ? 'パスワード' : 'Password',
    passwordConfirm: isJa ? 'パスワード確認' : 'Confirm password',
    emailPlaceholder: isJa ? 'name@example.com' : 'name@example.com',
    passwordPlaceholder: isJa ? '6文字以上' : 'At least 6 characters',
    confirmPlaceholder: isJa ? 'もう一度入力' : 'Enter again',
    cta: isJa ? 'メールで保護する' : 'Protect with Email',
    saving: isJa ? '連携中...' : 'Linking...',
    validationTitle: isJa ? '入力を確認してください' : 'Check your input',
    validationBody: isJa ? 'メールアドレス、パスワード、確認用パスワードを入力してください。' : 'Enter your email, password, and confirmation.',
    mismatch: isJa ? '確認用パスワードが一致しません。' : 'Passwords do not match.',
    successTitle: isJa ? '保護できました' : 'Protected',
    successBody: isJa ? 'このアカウントはメールアドレスで復旧できるようになりました。' : 'This account can now be restored with your email.',
    failTitle: isJa ? '連携できませんでした' : 'Could not link',
  }), [isJa]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password || !passwordConfirm) {
      Alert.alert(copy.validationTitle, copy.validationBody);
      return;
    }
    if (password !== passwordConfirm) {
      Alert.alert(copy.validationTitle, copy.mismatch);
      return;
    }

    setIsSubmitting(true);
    try {
      await linkEmail(normalizedEmail, password);
      Alert.alert(copy.successTitle, copy.successBody, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert(copy.failTitle, mapLinkError(error?.code, isJa));
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

            <FieldLabel>{copy.email}</FieldLabel>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={copy.emailPlaceholder}
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
              placeholder={copy.passwordPlaceholder}
              placeholderTextColor="#66627E"
              secureTextEntry
              autoCapitalize="none"
            />

            <FieldLabel>{copy.passwordConfirm}</FieldLabel>
            <TextInput
              style={styles.input}
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              placeholder={copy.confirmPlaceholder}
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

          <Text style={styles.footnote}>{isJa ? 'メール連携後は、このメールアドレスとパスワードでログインできます。' : 'After linking, you can sign in with this email and password.'}</Text>
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
  body: { fontSize: 13, lineHeight: 20, color: '#C8C8E0', marginBottom: 6 },
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
  footnote: {
    marginHorizontal: 16,
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    color: '#9A9AB8', // WCAG AA対応: #8E8EAA → #9A9AB8
  },
});
