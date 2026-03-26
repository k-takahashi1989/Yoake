import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Linking,
  Modal, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../stores/authStore';
import { ProfileStackParamList, AiPersonality } from '../../types';
import { SUBSCRIPTION, LINKS, AI_PERSONALITIES } from '../../constants';
import pkg from '../../../package.json';
import { generateSeedData } from '../../utils/seedData';
import { useTranslation, changeLanguage } from '../../i18n';

type ProfileNav = NativeStackNavigationProp<ProfileStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileNav>();
  const { profile, subscription, isPremium, signOut, updateProfile, _devSetPremium } = useAuthStore();
  const [isSeedLoading, setIsSeedLoading] = useState(false);
  const [showPersonality, setShowPersonality] = useState(false);
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();

  const planText =
    subscription?.status === 'trial'
      ? t('profile.trial')
      : isPremium
      ? t('profile.premium')
      : t('profile.free');

  const handleSignOut = () => {
    Alert.alert(t('profile.signOutTitle'), t('profile.signOutMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.signOut'), style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <View style={styles.root}>
      {/* 鏡の位置に重なる右上フローティングユーザーカード */}
      <View style={[styles.mirrorCard, { top: insets.top + 8 }]}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {profile?.displayName ? profile.displayName[0].toUpperCase() : '?'}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {profile?.displayName ?? t('profile.guest')}
          </Text>
          <Text style={[styles.planBadge, isPremium && styles.planBadgePremium]}>
            {planText}
          </Text>
        </View>
      </View>

      {/* ボトムシート（メニュー一覧） */}
      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.handle} />
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* ゲスト警告バナー */}
          {!profile?.displayName && (
            <View style={styles.guestWarning}>
              <Text style={styles.guestWarningText}>
                {t('profile.guestWarning')}
              </Text>
            </View>
          )}

          {/* アップグレード（無料ユーザーのみ） */}
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

          {/* メニュー */}
          <View style={styles.menuSection}>
            <MenuRow
              emoji="👤"
              label={t('profile.menuEditProfile')}
              onPress={() => navigation.navigate('EditProfile')}
            />
            <MenuRow
              emoji="💳"
              label={t('profile.menuSubscription')}
              onPress={() => navigation.navigate('SubscriptionManage')}
            />
            <MenuRow
              emoji="❤️"
              label={t('profile.menuHealthConnect')}
              onPress={() => navigation.navigate('HealthConnectSettings')}
            />
            <MenuRow
              emoji="🔔"
              label={t('profile.menuNotification')}
              onPress={() => navigation.navigate('NotificationSettings')}
            />
            <MenuRow
              emoji="💾"
              label={t('profile.menuData')}
              onPress={() => navigation.navigate('DataManagement')}
            />
            <MenuRow
              emoji="🌐"
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
              emoji="🤖"
              label={t('profile.aiPersonality')}
              value={t(`personality.${profile?.aiPersonality ?? 'standard'}`)}
              onPress={() => setShowPersonality(true)}
            />
            <MenuRow
              emoji="📄"
              label={t('profile.menuPrivacy')}
              onPress={() => Linking.openURL(LINKS.PRIVACY_POLICY)}
            />
            <MenuRow
              emoji="📋"
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
              <Text style={styles.devTitle}>── DEV ──────────────────────</Text>
              <View style={styles.devRow}>
                <Text style={styles.devLabel}>プレミアム切替</Text>
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
                    <Text style={[styles.devBtnText, isPremium && styles.devBtnTextActive]}>⭐ PRO</Text>
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
                    Alert.alert('完了', '90日分のシードデータを生成しました');
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
                  <Text style={styles.devSeedBtnText}>90日分シードデータ生成</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.devTitle}>──────────────────────────────</Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* AI性格選択ボトムシート */}
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
  emoji,
  label,
  value,
  onPress,
  last = false,
}: {
  emoji: string;
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
      <Text style={styles.menuEmoji}>{emoji}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      {value != null && <Text style={styles.menuValue}>{value}</Text>}
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // 右上フローティングユーザーカード（鏡の位置に重ねる）
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
  // ボトムシート
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '62%',
    backgroundColor: 'rgba(13, 13, 30, 0.88)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.3)',
    paddingHorizontal: 16,
    paddingTop: 12,
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
  menuRowLast: { borderBottomWidth: 0 },
  menuEmoji: { fontSize: 18, width: 28 },
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
// AI性格選択ボトムシートコンポーネント
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

  // 各カードのアニメーション値（4枚分）
  const anims = useRef(
    AI_PERSONALITIES.map(() => ({
      translateY: new Animated.Value(30),
      opacity: new Animated.Value(0),
    }))
  ).current;

  // モーダルが開いたときにstaggerアニメーション実行
  useEffect(() => {
    if (visible) {
      // 選択状態を現在値にリセット
      setSelected(currentPersonality);
      // アニメーションをリセット
      anims.forEach(a => {
        a.translateY.setValue(30);
        a.opacity.setValue(0);
      });
      // staggerアニメーション開始
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
      {/* 背景タップで閉じる */}
      <TouchableOpacity
        style={personalityStyles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* シート本体（タップが背景に伝播しないよう stopPropagation） */}
        <TouchableOpacity
          style={personalityStyles.sheet}
          activeOpacity={1}
          onPress={() => {}}
        >
          <Text style={personalityStyles.sheetTitle}>{t('personality.sheetTitle')}</Text>
          <Text style={personalityStyles.sheetSub}>{t('personality.sheetSub')}</Text>

          {/* カードグリッド（2列） */}
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
                    {/* 選択中チェックマーク */}
                    {isSelected && (
                      <Text style={[personalityStyles.checkMark, { color: p.themeColor }]}>✓</Text>
                    )}
                    <Text style={personalityStyles.cardEmoji}>{p.emoji}</Text>
                    <Text style={personalityStyles.cardTitle}>{t(p.labelKey)}</Text>
                    <Text style={personalityStyles.cardSub}>{t(p.subKey)}</Text>
                    {/* 区切り線 */}
                    <View style={personalityStyles.divider} />
                    {/* プレビュー文 */}
                    <Text style={personalityStyles.cardPreview}>{t(p.previewKey)}</Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>

          {/* 決定ボタン */}
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
