import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Linking,
  Modal, Animated, ImageBackground,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../stores/authStore';
import { ProfileStackParamList, AiPersonality } from '../../types';
import { SUBSCRIPTION, LINKS, AI_PERSONALITIES } from '../../constants';
import pkg from '../../../package.json';
import { generateSeedData } from '../../utils/seedData';
import { useSleepStore } from '../../stores/sleepStore';
import { SLEEP_LOG_FETCH_LIMIT } from '../../constants';
import { useTranslation, changeLanguage } from '../../i18n';
import Icon, { IconName } from '../../components/common/Icon';

const DEBT_PERIOD_KEY = '@yoake:sleep_debt_period';

type ProfileNav = NativeStackNavigationProp<ProfileStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileNav>();
  const { user, profile, subscription, isPremium, signOut, updateProfile, _devSetPremium } = useAuthStore();
  const [isSeedLoading, setIsSeedLoading] = useState(false);
  const [showPersonality, setShowPersonality] = useState(false);
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [debtPeriod, setDebtPeriod] = useState<'14' | '30' | 'month'>('14');
  const isJa = i18n.language === 'ja';

  useEffect(() => {
    AsyncStorage.getItem(DEBT_PERIOD_KEY).then(stored => {
      if (stored === '14' || stored === '30' || stored === 'month') {
        setDebtPeriod(stored);
      }
    }).catch(() => {});
  }, []);

  const periodLabels: Record<'14' | '30' | 'month', string> = {
    '14': t('sleepDebt.period14'),
    '30': t('sleepDebt.period30'),
    'month': t('sleepDebt.periodMonth'),
  };

  const handleDebtPeriodChange = () => {
    Alert.alert(
      t('profile.debtPeriodTitle'),
      undefined,
      [
        { text: t('sleepDebt.period14'),    onPress: () => saveDebtPeriod('14') },
        { text: t('sleepDebt.period30'),    onPress: () => saveDebtPeriod('30') },
        { text: t('sleepDebt.periodMonth'), onPress: () => saveDebtPeriod('month') },
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  };

  const saveDebtPeriod = async (p: '14' | '30' | 'month') => {
    await AsyncStorage.setItem(DEBT_PERIOD_KEY, p);
    setDebtPeriod(p);
  };

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
    ? 'このままだと再インストールや機種変更時にデータを復旧できません。メールで保護すると、同じアカウントで睡眠記録を引き継げます。'
    : 'Without email protection, you cannot restore your data after reinstalling or changing devices. Link an email to keep your sleep records.';
  const protectButtonText = isJa ? 'メールで保護する' : 'Protect with Email';
  const signInButtonText = isJa ? 'ログイン' : 'Sign In';
  const signOutMessage = user?.isAnonymous
    ? t('profile.signOutMessage')
    : isJa
    ? 'この端末からログアウトします。メールアドレスで再度ログインすれば、データを復旧できます。'
    : 'You will be signed out on this device. You can restore your data by signing in again with your email.';

  const handleSignOut = () => {
    Alert.alert(t('profile.signOutTitle'), signOutMessage, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.signOut'), style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <View style={styles.root}>
      <ImageBackground
        source={require('../../assets/images/bg_home.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <View style={styles.bgOverlay} />
      {/* 髀｡縺ｮ菴咲ｽｮ縺ｫ驥阪↑繧句承荳翫ヵ繝ｭ繝ｼ繝・ぅ繝ｳ繧ｰ繝ｦ繝ｼ繧ｶ繝ｼ繧ｫ繝ｼ繝・*/}

      {/* 繝懊ヨ繝繧ｷ繝ｼ繝茨ｼ医Γ繝九Η繝ｼ荳隕ｧ・・*/}
      <View
        style={[
          styles.bottomSheet,
          { paddingBottom: insets.bottom + 8, paddingTop: insets.top + 10 },
        ]}
      >
        <View style={styles.handle} />
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* 繧ｲ繧ｹ繝郁ｭｦ蜻翫ヰ繝翫・ */}
          {user?.isAnonymous && (
            <View style={styles.guestWarning}>
              <Text style={styles.guestWarningText}>
                {guestWarningText}
              </Text>
            </View>
          )}

          {/* 繧｢繝・・繧ｰ繝ｬ繝ｼ繝会ｼ育┌譁吶Θ繝ｼ繧ｶ繝ｼ縺ｮ縺ｿ・・*/}
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

          {/* 繝｡繝九Η繝ｼ */}
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
                <TouchableOpacity
                  style={styles.accountSecondaryAction}
                  onPress={() => navigation.navigate('SignIn')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.accountSecondaryActionText}>{signInButtonText}</Text>
                </TouchableOpacity>
              </View>
            )}
            <MenuRow
              iconName="crown"
              label={t('profile.menuSubscription')}
              onPress={() => navigation.navigate('SubscriptionManage')}
            />
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
              iconName="clock"
              label={`${t('profile.debtPeriod')}: ${periodLabels[debtPeriod]}`}
              onPress={handleDebtPeriodChange}
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
            />
            <MenuRow
              iconName="sparkling"
              label={t('profile.aiPersonality')}
              value={t(`personality.${profile?.aiPersonality ?? 'standard'}`)}
              onPress={() => setShowPersonality(true)}
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

          {/* 繝ｭ繧ｰ繧｢繧ｦ繝・*/}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Text style={styles.signOutText}>{t('profile.signOut')}</Text>
          </TouchableOpacity>

          <Text style={styles.version}>{t('profile.version', { version: pkg.version })}</Text>

          {/* DEV 繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ */}
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
                    // 繧ｷ繝ｼ繝牙ｾ後↓store繧呈峩譁ｰ縺励※繝帙・繝逕ｻ髱｢縺ｫ蜊ｳ蜿肴丐
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

      {/* AI諤ｧ譬ｼ驕ｸ謚槭・繝医Β繧ｷ繝ｼ繝・*/}
      <PersonalityBottomSheet
        visible={showPersonality}
        currentPersonality={profile?.aiPersonality ?? 'standard'}
        onClose={() => setShowPersonality(false)}
        onConfirm={async (selected) => {
          await updateProfile({ aiPersonality: selected });
          setShowPersonality(false);
        }}
      />
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
        <Icon name={iconName} size={20} color={iconColor ?? '#9C8FFF'} />
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
  root: { flex: 1, backgroundColor: '#0D0D1A' },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 12, 24, 0.52)',
  },
  // 蜿ｳ荳翫ヵ繝ｭ繝ｼ繝・ぅ繝ｳ繧ｰ繝ｦ繝ｼ繧ｶ繝ｼ繧ｫ繝ｼ繝会ｼ磯升縺ｮ菴咲ｽｮ縺ｫ驥阪・繧具ｼ・
  mirrorCard: {
    position: 'absolute',
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 13, 30, 0.88)',
    borderRadius: 16,
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.35)',
    zIndex: 10,
    maxWidth: 180,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6B5CE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: 'bold', color: '#FFFFFF' },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginBottom: 2 },
  planBadge: { fontSize: 11, color: '#C8C8E0' },
  planBadgePremium: { color: '#FFD700' },
  // 繝懊ヨ繝繧ｷ繝ｼ繝・
  bottomSheet: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(13, 13, 30, 0.72)',
    paddingHorizontal: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(107, 92, 231, 0.4)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  guestWarning: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: '#FF980018',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FF980040',
  },
  guestWarningText: {
    color: '#FF9800',
    fontSize: 12,
    lineHeight: 18,
  },
  upgradeCard: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#6B5CE7',
    borderRadius: 16,
    padding: 16,
  },
  upgradeCardText: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 4 },
  upgradeCardSub: { fontSize: 13, color: '#D0C8FF' },
  menuSection: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: 'rgba(26, 26, 46, 0.75)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.25)',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(107, 92, 231, 0.25)',
    gap: 12,
  },
  accountRow: {
    alignItems: 'flex-start',
    paddingVertical: 16,
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
  accountSubtitle: { fontSize: 12, color: '#9A9AB8' },
  accountHint: { fontSize: 12, color: '#78789B' },
  accountActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(107, 92, 231, 0.25)',
  },
  accountPrimaryAction: {
    flex: 1,
    backgroundColor: '#6B5CE7',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  accountPrimaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  accountSecondaryAction: {
    minWidth: 88,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.45)',
    backgroundColor: 'rgba(107, 92, 231, 0.08)',
  },
  accountSecondaryActionText: {
    color: '#D9D5FF',
    fontSize: 14,
    fontWeight: '600',
  },
  menuRowLast: { borderBottomWidth: 0 },
  menuIconWrapper: { width: 28, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, color: '#FFFFFF' },
  menuValue: { fontSize: 13, color: '#C8C8E0', marginRight: 4 },
  menuArrow: { fontSize: 20, color: '#C8C8E0' },
  signOutBtn: {
    margin: 16,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F44336',
    alignItems: 'center',
  },
  signOutText: { color: '#F44336', fontSize: 15, fontWeight: '600' },
  version: { textAlign: 'center', color: '#C8C8E0', fontSize: 12, marginBottom: 8 },
  devSection: {
    margin: 16,
    marginTop: 4,
    marginBottom: 24,
    backgroundColor: 'rgba(26, 26, 46, 0.75)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.25)',
    padding: 12,
  },
  devTitle: { fontSize: 10, color: '#9C8FFF', letterSpacing: 1, marginBottom: 8 },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  devLabel: { fontSize: 13, color: '#FFFFFF' },
  devToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(26, 26, 46, 0.75)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  devBtn: { paddingHorizontal: 14, paddingVertical: 6 },
  devBtnActive: { backgroundColor: 'rgba(107, 92, 231, 0.35)' },
  devBtnPremium: { backgroundColor: '#6B5CE7' },
  devBtnText: { fontSize: 12, color: '#C8C8E0', fontWeight: '600' },
  devBtnTextActive: { color: '#FFFFFF' },
  devSeedBtn: {
    backgroundColor: 'rgba(26, 26, 46, 0.75)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.25)',
  },
  devSeedBtnDisabled: { opacity: 0.5 },
  devSeedBtnText: { color: '#9C8FFF', fontSize: 13, fontWeight: '600' },
});

// ============================================================
// AI諤ｧ譬ｼ驕ｸ謚槭・繝医Β繧ｷ繝ｼ繝医さ繝ｳ繝昴・繝阪Φ繝・
// ============================================================

function PersonalityBottomSheet({
  visible,
  currentPersonality,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  currentPersonality: AiPersonality;
  onClose: () => void;
  onConfirm: (selected: AiPersonality) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<AiPersonality>(currentPersonality);
  const [confirming, setConfirming] = useState(false);

  // 蜷・き繝ｼ繝峨・繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ蛟､・・譫壼・・・
  const anims = useRef(
    AI_PERSONALITIES.map(() => ({
      translateY: new Animated.Value(30),
      opacity: new Animated.Value(0),
    }))
  ).current;

  // 繝｢繝ｼ繝繝ｫ縺碁幕縺・◆縺ｨ縺阪↓stagger繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ螳溯｡・
  useEffect(() => {
    if (visible) {
      // 驕ｸ謚樒憾諷九ｒ迴ｾ蝨ｨ蛟､縺ｫ繝ｪ繧ｻ繝・ヨ
      setSelected(currentPersonality);
      // 繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ繧偵Μ繧ｻ繝・ヨ
      anims.forEach(a => {
        a.translateY.setValue(30);
        a.opacity.setValue(0);
      });
      // stagger繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ髢句ｧ・
      Animated.stagger(
        60,
        anims.map(a =>
          Animated.parallel([
            Animated.timing(a.translateY, {
              toValue: 0,
              duration: 280,
              useNativeDriver: true,
            }),
            Animated.timing(a.opacity, {
              toValue: 1,
              duration: 280,
              useNativeDriver: true,
            }),
          ])
        )
      ).start();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm(selected);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      {/* 閭梧勹繧ｿ繝・・縺ｧ髢峨§繧・*/}
      <TouchableOpacity
        style={personalityStyles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* 繧ｷ繝ｼ繝域悽菴難ｼ医ち繝・・縺瑚レ譎ｯ縺ｫ莨晄眺縺励↑縺・ｈ縺・stopPropagation・・*/}
        <TouchableOpacity
          style={personalityStyles.sheet}
          activeOpacity={1}
          onPress={() => {}}
        >
          <Text style={personalityStyles.sheetTitle}>{t('personality.sheetTitle')}</Text>
          <Text style={personalityStyles.sheetSub}>{t('personality.sheetSub')}</Text>

          {/* 繧ｫ繝ｼ繝峨げ繝ｪ繝・ラ・・蛻暦ｼ・*/}
          <View style={personalityStyles.grid}>
            {AI_PERSONALITIES.map((p, i) => {
              const isSelected = selected === p.id;
              return (
                <Animated.View
                  key={p.id}
                  style={[
                    personalityStyles.cardWrapper,
                    {
                      opacity: anims[i].opacity,
                      transform: [{ translateY: anims[i].translateY }],
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      personalityStyles.card,
                      isSelected
                        ? { borderColor: p.themeColor, backgroundColor: p.themeColor + '18' }
                        : { borderColor: 'rgba(107, 92, 231, 0.25)', backgroundColor: 'rgba(26, 26, 46, 0.75)' },
                    ]}
                    onPress={() => setSelected(p.id)}
                    activeOpacity={0.8}
                  >
                    {/* 驕ｸ謚樔ｸｭ繝√ぉ繝・け繝槭・繧ｯ */}
                    {isSelected && (
                      <Text style={[personalityStyles.checkMark, { color: p.themeColor }]}>✓</Text>
                    )}
                    <Text style={personalityStyles.cardEmoji}>{p.emoji}</Text>
                    <Text style={personalityStyles.cardTitle}>{t(p.labelKey)}</Text>
                    <Text style={personalityStyles.cardSub}>{t(p.subKey)}</Text>
                    {/* 蛹ｺ蛻・ｊ邱・*/}
                    <View style={personalityStyles.divider} />
                    {/* 繝励Ξ繝薙Η繝ｼ譁・*/}
                    <Text style={personalityStyles.cardPreview}>{t(p.previewKey)}</Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>

          {/* 豎ｺ螳壹・繧ｿ繝ｳ */}
          <TouchableOpacity
            style={[personalityStyles.confirmBtn, confirming && { opacity: 0.6 }]}
            onPress={handleConfirm}
            disabled={confirming}
            activeOpacity={0.8}
          >
            {confirming ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={personalityStyles.confirmBtnText}>{t('personality.confirm')}</Text>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const personalityStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.25)',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  sheetSub: {
    fontSize: 13,
    color: '#C8C8E0',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cardWrapper: {
    width: '47%',
    margin: '1.5%',
  },
  card: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    position: 'relative',
  },
  checkMark: {
    position: 'absolute',
    top: 8,
    right: 10,
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 11,
    color: '#C8C8E0',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(107, 92, 231, 0.25)',
    marginVertical: 8,
  },
  cardPreview: {
    fontSize: 12,
    color: '#C8C8E0',
    fontStyle: 'italic',
    lineHeight: 17,
  },
  confirmBtn: {
    backgroundColor: '#6B5CE7',
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});



