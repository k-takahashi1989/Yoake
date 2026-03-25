import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../stores/authStore';
import { ProfileStackParamList } from '../../types';
import { SUBSCRIPTION, LINKS } from '../../constants';
import pkg from '../../../package.json';
import { generateSeedData } from '../../utils/seedData';

type ProfileNav = NativeStackNavigationProp<ProfileStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileNav>();
  const { profile, subscription, isPremium, signOut, _devSetPremium } = useAuthStore();
  const [isSeedLoading, setIsSeedLoading] = useState(false);

  const planText =
    subscription?.status === 'trial'
      ? '🎁 無料トライアル中'
      : isPremium
      ? '⭐ プレミアム'
      : '🆓 無料プラン';

  const handleSignOut = () => {
    Alert.alert('ログアウト', 'ログアウトしますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: 'ログアウト', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>マイページ</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ユーザー情報 */}
        <View style={styles.userCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {profile?.displayName ? profile.displayName[0].toUpperCase() : '?'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {profile?.displayName ?? 'ゲスト'}
            </Text>
            <Text style={[styles.planBadge, isPremium && styles.planBadgePremium]}>
              {planText}
            </Text>
          </View>
        </View>

        {/* ゲスト警告バナー */}
        {!profile?.displayName && (
          <View style={styles.guestWarning}>
            <Text style={styles.guestWarningText}>
              ⚠️ アカウント未設定のため、端末変更・再インストール時にデータが失われます。プロフィール編集からニックネームを設定しておきましょう。
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
              ✨ プレミアムにアップグレード
            </Text>
            <Text style={styles.upgradeCardSub}>
              月額¥{SUBSCRIPTION.MONTHLY_PRICE.toLocaleString()} · {SUBSCRIPTION.TRIAL_DAYS}日間無料
            </Text>
          </TouchableOpacity>
        )}

        {/* メニュー */}
        <View style={styles.menuSection}>
          <MenuRow
            emoji="👤"
            label="プロフィール編集"
            onPress={() => navigation.navigate('EditProfile')}
          />
          <MenuRow
            emoji="💳"
            label="サブスク管理"
            onPress={() => navigation.navigate('SubscriptionManage')}
          />
          <MenuRow
            emoji="❤️"
            label="Health Connect設定"
            onPress={() => navigation.navigate('HealthConnectSettings')}
          />
          <MenuRow
            emoji="🔔"
            label="通知設定"
            onPress={() => navigation.navigate('NotificationSettings')}
          />
          <MenuRow
            emoji="💾"
            label="データ管理"
            onPress={() => navigation.navigate('DataManagement')}
          />
          <MenuRow
            emoji="📄"
            label="プライバシーポリシー"
            onPress={() => Linking.openURL(LINKS.PRIVACY_POLICY)}
          />
          <MenuRow
            emoji="📋"
            label="利用規約"
            onPress={() => Linking.openURL(LINKS.TERMS)}
            last
          />
        </View>

        {/* ログアウト */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>ログアウト</Text>
        </TouchableOpacity>

        <Text style={styles.version}>YOAKE v{pkg.version}</Text>

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
    </SafeAreaView>
  );
}

function MenuRow({
  emoji,
  label,
  onPress,
  last = false,
}: {
  emoji: string;
  label: string;
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
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2D2D44',
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  scroll: { flex: 1 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#6B5CE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  userInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: '600', color: '#FFFFFF', marginBottom: 4 },
  planBadge: { fontSize: 13, color: '#888' },
  planBadgePremium: { color: '#FFD700' },
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
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#3D3D55',
    gap: 12,
  },
  menuRowLast: { borderBottomWidth: 0 },
  menuEmoji: { fontSize: 18, width: 28 },
  menuLabel: { flex: 1, fontSize: 15, color: '#FFFFFF' },
  menuArrow: { fontSize: 20, color: '#555' },
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
  version: { textAlign: 'center', color: '#444', fontSize: 12, marginBottom: 8 },
  devSection: {
    margin: 16,
    marginTop: 4,
    marginBottom: 24,
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6B5CE750',
    padding: 12,
  },
  devTitle: { fontSize: 10, color: '#6B5CE7', letterSpacing: 1, marginBottom: 8 },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  devLabel: { fontSize: 13, color: '#FFFFFF' },
  devToggle: {
    flexDirection: 'row',
    backgroundColor: '#2D2D44',
    borderRadius: 8,
    overflow: 'hidden',
  },
  devBtn: { paddingHorizontal: 14, paddingVertical: 6 },
  devBtnActive: { backgroundColor: '#555' },
  devBtnPremium: { backgroundColor: '#6B5CE7' },
  devBtnText: { fontSize: 12, color: '#888', fontWeight: '600' },
  devBtnTextActive: { color: '#FFFFFF' },
  devSeedBtn: {
    backgroundColor: '#2D2D44',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  devSeedBtnDisabled: { opacity: 0.5 },
  devSeedBtnText: { color: '#9C8FFF', fontSize: 13, fontWeight: '600' },
});
