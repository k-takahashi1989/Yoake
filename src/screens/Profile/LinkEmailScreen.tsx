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
import { MORNING_THEME } from '../../theme/morningTheme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'LinkEmail'>;

function mapLinkError(code?: string, isJa?: boolean) {
  switch (code) {
    case 'auth/email-already-in-use':
      return isJa
        ? 'このメールアドレスはすでに使われています。ログインしてください。'
        : 'This email address is already in use. Please sign in instead.';
    case 'auth/invalid-email':
      return isJa ? '有効なメールアドレスを入力してください。' : 'Please enter a valid email address.';
    case 'auth/weak-password':
      return isJa ? 'パスワードは6文字以上にしてください。' : 'Password must be at least 6 characters.';
    case 'auth/requires-recent-login':
      return isJa
        ? '認証の有効期限が切れました。アプリを開き直して、もう一度お試しください。'
        : 'Authentication expired. Reopen the app and try again.';
    default:
      return isJa
        ? 'メールアドレス登録に失敗しました。時間をおいてもう一度お試しください。'
        : 'Failed to save your email address. Please try again.';
  }
}

export default function LinkEmailScreen({ navigation }: Props) {
  const { linkEmail } = useAuthStore();
  const { i18n } = useTranslation();
  const isJa = i18n.language === 'ja';

  const copy = useMemo(
    () => ({
      title: isJa ? 'メールアドレス登録' : 'Add Email Address',
      body: isJa
        ? 'メールアドレスを登録すると、再インストールや機種変更後でも同じアカウントで睡眠記録を引き継げます。'
        : 'Save your email address so you can restore your sleep records after reinstalling or switching devices.',
      email: isJa ? 'メールアドレス' : 'Email address',
      password: isJa ? 'パスワード' : 'Password',
      passwordConfirm: isJa ? 'パスワード確認' : 'Confirm password',
      emailPlaceholder: 'name@example.com',
      passwordPlaceholder: isJa ? '6文字以上' : 'At least 6 characters',
      confirmPlaceholder: isJa ? 'もう一度入力' : 'Enter again',
      cta: isJa ? '登録する' : 'Save Email Address',
      saving: isJa ? '登録中...' : 'Saving...',
      validationTitle: isJa ? '入力を確認してください' : 'Check your input',
      validationBody: isJa
        ? 'メールアドレス、パスワード、確認用パスワードを入力してください。'
        : 'Enter your email, password, and confirmation.',
      mismatch: isJa ? '確認用パスワードが一致しません。' : 'Passwords do not match.',
      successTitle: isJa ? '登録できました' : 'Saved',
      successBody: isJa
        ? 'このアカウントは、メールアドレスで復元できるようになりました。'
        : 'This account can now be restored with your email address.',
      failTitle: isJa ? '登録できませんでした' : 'Could not save',
      signInLead: isJa ? 'すでにアカウントをお持ちですか？' : 'Already have an account?',
      signInCta: isJa ? 'ログイン' : 'Sign In',
      footnote: isJa
        ? '登録後は、このメールアドレスとパスワードでログインできます。'
        : 'After saving, you can sign in with this email and password.',
    }),
    [isJa],
  );

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
              placeholderTextColor={MORNING_THEME.textMuted}
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
              placeholderTextColor={MORNING_THEME.textMuted}
              secureTextEntry
              autoCapitalize="none"
            />

            <FieldLabel>{copy.passwordConfirm}</FieldLabel>
            <TextInput
              style={styles.input}
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              placeholder={copy.confirmPlaceholder}
              placeholderTextColor={MORNING_THEME.textMuted}
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
              <ActivityIndicator color={MORNING_THEME.goldText} />
            ) : (
              <Text style={styles.primaryButtonText}>{copy.cta}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.signInCard}>
            <Text style={styles.signInLead}>{copy.signInLead}</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('SignIn')}>
              <Text style={styles.secondaryButtonText}>{copy.signInCta}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footnote}>{copy.footnote}</Text>
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
  safeArea: { flex: 1, backgroundColor: MORNING_THEME.root },
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  card: {
    margin: 16,
    backgroundColor: MORNING_THEME.surfacePrimary,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: MORNING_THEME.borderSoft,
  },
  title: { fontSize: 18, fontWeight: '700', color: MORNING_THEME.textPrimary, marginBottom: 8 },
  body: { fontSize: 13, lineHeight: 20, color: MORNING_THEME.textSecondary, marginBottom: 6 },
  label: { fontSize: 12, color: MORNING_THEME.textMuted, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: MORNING_THEME.surfaceSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 13,
    color: MORNING_THEME.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: MORNING_THEME.borderSoft,
  },
  primaryButton: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: MORNING_THEME.gold,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: MORNING_THEME.goldBorder,
  },
  primaryButtonText: {
    color: MORNING_THEME.goldText,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  disabled: { opacity: 0.6 },
  signInCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: MORNING_THEME.surfaceElevated,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: MORNING_THEME.borderCool,
    gap: 10,
  },
  signInLead: {
    fontSize: 13,
    lineHeight: 20,
    color: MORNING_THEME.textSecondary,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: MORNING_THEME.surfaceRaised,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: MORNING_THEME.borderSoft,
  },
  secondaryButtonText: {
    color: MORNING_THEME.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  footnote: {
    marginHorizontal: 16,
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    color: MORNING_THEME.textMuted,
  },
});
