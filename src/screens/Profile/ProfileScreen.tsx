import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Linking,
  ImageBackground,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../stores/authStore';
import { ProfileStackParamList } from '../../types';
import { SUBSCRIPTION, LINKS } from '../../constants';
import pkg from '../../../package.json';
import { generateSeedData } from '../../utils/seedData';
import { useSleepStore } from '../../stores/sleepStore';
import { SLEEP_LOG_FETCH_LIMIT } from '../../constants';
import { useTranslation, changeLanguage } from '../../i18n';
import Icon, { IconName } from '../../components/common/Icon';
import {
  markReviewFlowCompleted,
  openStoreReviewPage,
} from '../../services/reviewService';
import { MORNING_THEME } from '../../theme/morningTheme';

type ProfileNav = NativeStackNavigationProp<ProfileStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileNav>();
  const { user, profile, subscription, isPremium, signOut, _devSetPremium } = useAuthStore();
  const [isSeedLoading, setIsSeedLoading] = useState(false);
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isJa = i18n.language === 'ja';

  const planText =
    subscription?.status === 'trial'
      ? t('profile.trial')
      : isPremium
      ? t('profile.premium')
      : t('profile.free');
  const accountName = profile?.displayName?.trim() || (user?.email?.split('@')[0] ?? t('profile.guest'));
  const accountStatusText = user?.email ?? (isJa ? 'メール未登録' : 'Email not linked');
  const accountHintText = isJa ? 'プロフィール編集' : 'Edit profile';
  const guestWarningText = isJa
    ? 'このままだと再インストールや機種変更時にデータを復旧できません。メールアドレスを登録すると、同じアカウントで睡眠記録を引き継げます。'
    : 'Without email protection, you cannot restore your data after reinstalling or changing devices. Link an email to keep your sleep records.';
  const protectButtonText = isJa ? 'メールアドレス登録' : 'Add Email Address';
  const signOutMessage = user?.isAnonymous
    ? t('profile.signOutMessage')
    : isJa
    ? 'この端末からログアウトします。メールアドレスで再度ログインすれば、記録を引き継げます。'
    : 'You will be signed out on this device. Sign in again with your email to restore your data.';

  const handleSignOut = () => {
    Alert.alert(t('profile.signOutTitle'), signOutMessage, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.signOut'), style: 'destructive', onPress: signOut },
    ]);
  };

  const handleRateAppPress = () => {
    openStoreReviewPage()
      .then(async opened => {
        if (opened) {
          await markReviewFlowCompleted();
          return;
        }

        Alert.alert(
          isJa ? 'レビュー先が未設定です' : 'Review link is not ready',
          isJa
            ? 'iOS は App Store ID を設定してからレビュー導線を有効にしてください。'
            : 'Set the App Store ID before enabling the iOS review link.',
        );
      })
      .catch(() => {});
  };

  return (
    <View style={styles.root}>
      <ImageBackground
        source={require('../../assets/images/bg_home.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <View style={styles.bgOverlay} />

      <View
        style={[
          styles.bottomSheet,
          { paddingBottom: insets.bottom + 8, paddingTop: insets.top + 10 },
        ]}
      >
        <View style={styles.handle} />
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* ページタイトル */}
          <Text style={styles.pageTitle}>{t('profile.title')}</Text>

          {/* ゲスト警告バナー */}
          {user?.isAnonymous && (
            <View style={styles.guestWarning}>
              <Text style={styles.guestWarningText}>
                {guestWarningText}
              </Text>
            </View>
          )}

          {/* アップグレードカード（無料ユーザーのみ） */}
          {!isPremium && (
            <TouchableOpacity
              style={styles.upgradeCard}
              onPress={() => navigation.navigate('SubscriptionManage')}
            >
              <Text style={styles.upgradeCardText}>
                {t('profile.upgradeCard')}
              </Text>
              <Text style={styles.upgradeCardSub}>
                {t('profile.upgradeCardSub', {
                  price: SUBSCRIPTION.MONTHLY_PRICE.toLocaleString(),
                  days: SUBSCRIPTION.TRIAL_DAYS,
                })}
              </Text>
            </TouchableOpacity>
          )}

          {/* アカウントセクション */}
          <View style={styles.menuSection}>
            <AccountRow
              displayName={accountName}
              planText={planText}
              isPremium={isPremium}
              subtitle={accountStatusText}
              hint={accountHintText}
              onPress={() => navigation.navigate('EditProfile')}
            />
            {user?.isAnonymous && (
              <View style={styles.accountActions}>
                <TouchableOpacity
                  style={styles.accountPrimaryAction}
                  onPress={() => navigation.navigate('LinkEmail')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.accountPrimaryActionText}>{protectButtonText}</Text>
                </TouchableOpacity>
              </View>
            )}
            {isPremium && (
              <MenuRow
                iconName="crown"
                label={t('profile.menuSubscription')}
                onPress={() => navigation.navigate('SubscriptionManage')}
                last
              />
            )}
          </View>

          {/* 設定セクション */}
          <Text style={styles.sectionHeader}>{t('profile.sectionSettings')}</Text>
          <View style={styles.menuSection}>
            <MenuRow
              iconName="heart-beat"
              label={t('profile.menuHealthConnect')}
              onPress={() => navigation.navigate('HealthConnectSettings')}
            />
            <MenuRow
              iconName="bell"
              label={t('profile.menuNotification')}
              onPress={() => navigation.navigate('NotificationSettings')}
            />
            <MenuRow
              iconName="data-analytics"
              label={t('profile.menuData')}
              onPress={() => navigation.navigate('DataManagement')}
            />
            <MenuRow
              iconName="globe"
              label={t('profile.language')}
              value={i18n.language === 'ja' ? '日本語' : 'English'}
              onPress={() => {
                Alert.alert(t('profile.selectLanguage'), '', [
                  { text: '日本語', onPress: () => changeLanguage('ja') },
                  { text: 'English', onPress: () => changeLanguage('en') },
                  { text: t('common.cancel'), style: 'cancel' },
                ]);
              }}
              last
            />
          </View>

          {/* サポートセクション */}
          <Text style={styles.sectionHeader}>{t('profile.sectionSupport')}</Text>
          <View style={styles.menuSection}>
            <MenuRow
              iconName="note"
              label={t('profile.menuHowToUse')}
              onPress={() => Linking.openURL(LINKS.HOW_TO_USE)}
            />
            <MenuRow
              iconName="sparkling"
              label={t('profile.menuReview')}
              onPress={handleRateAppPress}
            />
            <MenuRow
              iconName="speech-bubble"
              label={t('profile.menuFeedback')}
              onPress={() => Linking.openURL(LINKS.FEEDBACK_FORM)}
            />
            <MenuRow
              iconName="padlock"
              label={t('profile.menuPrivacy')}
              onPress={() => Linking.openURL(LINKS.PRIVACY_POLICY)}
            />
            <MenuRow
              iconName="note"
              label={t('profile.menuTerms')}
              onPress={() => Linking.openURL(LINKS.TERMS)}
              last
            />
          </View>

          {/* ログアウト */}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Text style={styles.signOutText}>{t('profile.signOut')}</Text>
          </TouchableOpacity>

          <Text style={styles.version}>{t('profile.version', { version: pkg.version })}</Text>

          {/* DEV セクション */}
          {__DEV__ && (
            <View style={styles.devSection}>
              <Text style={styles.devTitle}>DEBUG MENU</Text>
              <View style={styles.devRow}>
                <Text style={styles.devLabel}>プレミアム状態</Text>
                <View style={styles.devToggle}>
                  <TouchableOpacity
                    style={[styles.devBtn, !isPremium && styles.devBtnActive]}
                    onPress={() => _devSetPremium(false)}
                  >
                    <Text style={[styles.devBtnText, !isPremium && styles.devBtnTextActive]}>FREE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.devBtn, isPremium && styles.devBtnPremium]}
                    onPress={() => _devSetPremium(true)}
                  >
                    <Text style={[styles.devBtnText, isPremium && styles.devBtnTextActive]}>PRO</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.devSeedBtn, isSeedLoading && styles.devSeedBtnDisabled]}
                disabled={isSeedLoading}
                onPress={async () => {
                  setIsSeedLoading(true);
                  try {
                    await generateSeedData(90);
                    await useSleepStore.getState().loadRecent(SLEEP_LOG_FETCH_LIMIT.HOME);
                    Alert.alert('成功', '90日分のシードデータを生成しました');
                  } catch (e: any) {
                    Alert.alert('エラー', e.message ?? '生成に失敗しました');
                  } finally {
                    setIsSeedLoading(false);
                  }
                }}
              >
                {isSeedLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.devSeedBtnText}>90日分のシードデータ生成</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.devTitle}>DEBUG MENU</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function MenuRow({
  iconName,
  iconColor,
  label,
  value,
  onPress,
  last = false,
}: {
  iconName: IconName;
  iconColor?: string;
  label: string;
  value?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, last && styles.menuRowLast]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuIconWrapper}>
        <Icon name={iconName} size={22} color={iconColor ?? '#9C8FFF'} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      {value != null && <Text style={styles.menuValue}>{value}</Text>}
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

function AccountRow({
  displayName,
  planText,
  isPremium,
  subtitle,
  hint,
  onPress,
}: {
  displayName: string;
  planText: string;
  isPremium: boolean;
  subtitle: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, styles.accountRow]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>
          {displayName ? displayName[0].toUpperCase() : '?'}
        </Text>
      </View>
      <View style={styles.accountTextBlock}>
        <View style={styles.accountTitleRow}>
          <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
          <Text style={[styles.planBadge, isPremium && styles.planBadgePremium]}>
            {planText}
          </Text>
        </View>
        <Text style={styles.accountSubtitle}>{subtitle}</Text>
        <Text style={styles.accountHint}>{hint}</Text>
      </View>
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MORNING_THEME.root },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: MORNING_THEME.overlay,
  },
  bottomSheet: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: MORNING_THEME.surfaceGlass,
    paddingHorizontal: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: MORNING_THEME.goldBorder,
    alignSelf: 'center',
    marginBottom: 12,
  },
  // ページタイトル
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: MORNING_THEME.textPrimary,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  // セクション見出し
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: MORNING_THEME.textMuted,
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  guestWarning: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: MORNING_THEME.goldSurface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: MORNING_THEME.goldBorder,
  },
  guestWarningText: {
    color: MORNING_THEME.goldStrong,
    fontSize: 13,
    lineHeight: 20,
  },
  upgradeCard: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: MORNING_THEME.gold,
    borderRadius: 16,
    padding: 16,
  },
  upgradeCardText: { fontSize: 16, fontWeight: 'bold', color: '#17263A', marginBottom: 4 },
  upgradeCardSub: { fontSize: 13, color: '#32445A' },
  menuSection: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: MORNING_THEME.surfacePrimary,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: MORNING_THEME.borderStrong,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: MORNING_THEME.borderSoft,
    gap: 14,
  },
  accountRow: {
    alignItems: 'flex-start',
    paddingVertical: 18,
  },
  accountTextBlock: {
    flex: 1,
    gap: 4,
    paddingTop: 1,
  },
  accountTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6B5CE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  userName: { fontSize: 16, fontWeight: '600', color: MORNING_THEME.textPrimary, marginBottom: 2 },
  planBadge: { fontSize: 12, color: '#C8C8E0' },
  planBadgePremium: { color: '#FFD700' },
  accountSubtitle: { fontSize: 13, color: MORNING_THEME.textMuted },
  accountHint: { fontSize: 13, color: MORNING_THEME.textMuted },
  accountActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: MORNING_THEME.borderSoft,
  },
  accountPrimaryAction: {
    flex: 1,
    backgroundColor: MORNING_THEME.gold,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  accountPrimaryActionText: {
    color: '#17263A',
    fontSize: 14,
    fontWeight: '700',
  },
  menuRowLast: { borderBottomWidth: 0 },
  menuIconWrapper: { width: 30, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 17, color: MORNING_THEME.textPrimary },
  menuValue: { fontSize: 14, color: MORNING_THEME.textSecondary, marginRight: 4 },
  menuArrow: { fontSize: 22, color: MORNING_THEME.textSecondary },
  signOutBtn: {
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: MORNING_THEME.dangerBorder,
    alignItems: 'center',
  },
  signOutText: { color: MORNING_THEME.danger, fontSize: 16, fontWeight: '600' },
  version: { textAlign: 'center', color: MORNING_THEME.textSecondary, fontSize: 13, marginBottom: 8, marginTop: 4 },
  devSection: {
    margin: 16,
    marginTop: 4,
    marginBottom: 24,
    backgroundColor: MORNING_THEME.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MORNING_THEME.borderStrong,
    padding: 12,
  },
  devTitle: { fontSize: 10, color: MORNING_THEME.goldStrong, letterSpacing: 1, marginBottom: 8 },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  devLabel: { fontSize: 13, color: MORNING_THEME.textPrimary },
  devToggle: {
    flexDirection: 'row',
    backgroundColor: MORNING_THEME.surfaceSoft,
    borderRadius: 8,
    overflow: 'hidden',
  },
  devBtn: { paddingHorizontal: 14, paddingVertical: 6 },
  devBtnActive: { backgroundColor: MORNING_THEME.blueSurface },
  devBtnPremium: { backgroundColor: MORNING_THEME.gold },
  devBtnText: { fontSize: 12, color: MORNING_THEME.textSecondary, fontWeight: '600' },
  devBtnTextActive: { color: '#17263A' },
  devSeedBtn: {
    backgroundColor: MORNING_THEME.surfaceSoft,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: MORNING_THEME.borderCool,
  },
  devSeedBtnDisabled: { opacity: 0.5 },
  devSeedBtnText: { color: MORNING_THEME.textSecondary, fontSize: 13, fontWeight: '600' },
});
