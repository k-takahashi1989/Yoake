import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useAuthStore } from '../../stores/authStore';
import { SUBSCRIPTION } from '../../constants';
import { safeToDate } from '../../utils/dateUtils';
import { useTranslation } from '../../i18n';

export default function SubscriptionManageScreen() {
  const { subscription, isPremium, refreshSubscription } = useAuthStore();
  const { t } = useTranslation();
  const [isRestoring, setIsRestoring] = useState(false);

  const status = subscription?.status ?? 'free';
  const isOnTrial = status === 'trial';
  const isActive = status === 'active';

  const trialEnd = subscription?.trialEndAt
    ? format(safeToDate(subscription.trialEndAt), 'M月d日（EEE）', { locale: ja })
    : null;
  const periodEnd = subscription?.currentPeriodEndAt
    ? format(safeToDate(subscription.currentPeriodEndAt), 'M月d日（EEE）', { locale: ja })
    : null;

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await refreshSubscription();
      Alert.alert(t('subscription.restoreSuccess'), t('subscription.restoreSuccessMessage'));
    } catch {
      Alert.alert(t('common.error'), t('subscription.restoreError'));
    } finally {
      setIsRestoring(false);
    }
  };

  const openGooglePlaySubscriptions = () => {
    Linking.openURL(
      'https://play.google.com/store/account/subscriptions?sku=' +
        SUBSCRIPTION.PRODUCT_IDS.MONTHLY +
        '&package=com.ktakahashi.yoake',
    ).catch(() =>
      Linking.openURL('https://play.google.com/store/account/subscriptions'),
    );
  };

  const features = [
    { emoji: '📊', labelKey: 'subscription.feature1' as const, premium: true },
    { emoji: '🤖', labelKey: 'subscription.feature2' as const, premium: true },
    { emoji: '💬', labelKey: 'subscription.feature3' as const, premium: true },
    { emoji: '🌊', labelKey: 'subscription.feature4' as const, premium: true },
    { emoji: '⚙️', labelKey: 'subscription.feature5' as const, premium: true },
    { emoji: '📔', labelKey: 'subscription.feature6' as const, premium: true },
    { emoji: '🌙', labelKey: 'subscription.feature7' as const, premium: false },
    { emoji: '⏰', labelKey: 'subscription.feature8' as const, premium: false },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 現在のプラン */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('subscription.currentPlanTitle')}</Text>

          <View style={styles.planBadgeRow}>
            <Text style={styles.planBadge}>
              {isOnTrial
                ? t('subscription.trialBadge')
                : isActive
                ? t('subscription.premiumBadge')
                : t('subscription.freeBadge')}
            </Text>
          </View>

          {isOnTrial && trialEnd && (
            <Text style={styles.planNote}>{t('subscription.trialEnd', { date: trialEnd })}</Text>
          )}
          {isActive && periodEnd && (
            <Text style={styles.planNote}>{t('subscription.nextBilling', { date: periodEnd })}</Text>
          )}
          {!isPremium && (
            <Text style={styles.planNote}>
              {t('subscription.freeNote')}
            </Text>
          )}
        </View>

        {/* プレミアム特典 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('subscription.featuresTitle')}</Text>
          {features.map(f => (
            <View key={f.labelKey} style={styles.featureRow}>
              <Text style={styles.featureEmoji}>{f.emoji}</Text>
              <Text style={styles.featureLabel}>{t(f.labelKey)}</Text>
              {f.premium && !isPremium && (
                <Text style={styles.featureLock}>🔒</Text>
              )}
            </View>
          ))}
        </View>

        {/* アクション */}
        {!isPremium && (
          <View style={styles.upgradeCard}>
            <Text style={styles.upgradeTitle}>
              {t('subscription.monthlyPrice', { price: SUBSCRIPTION.MONTHLY_PRICE.toLocaleString() })}
            </Text>
            <View style={styles.yearlyRow}>
              <Text style={styles.upgradeSubtitle}>
                {t('subscription.yearlyPrice', { price: SUBSCRIPTION.YEARLY_PRICE.toLocaleString() })}
              </Text>
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>40%OFF</Text>
              </View>
            </View>
            <Text style={styles.yearlyMonthly}>
              {t('subscription.yearlyMonthly', { price: Math.round(SUBSCRIPTION.YEARLY_PRICE / 12).toLocaleString() })}
            </Text>
            <Text style={styles.upgradeTrial}>
              {t('subscription.trialInfo', { days: SUBSCRIPTION.TRIAL_DAYS })}
            </Text>
          </View>
        )}

        {/* 管理ボタン */}
        {isPremium && (
          <TouchableOpacity style={styles.manageBtn} onPress={openGooglePlaySubscriptions}>
            <Text style={styles.manageBtnText}>{t('subscription.manageBtn')}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.restoreBtn, isRestoring && styles.restoreBtnDisabled]}
          onPress={handleRestore}
          disabled={isRestoring}
        >
          {isRestoring
            ? <ActivityIndicator color="#9C8FFF" size="small" />
            : <Text style={styles.restoreBtnText}>{t('subscription.restoreBtn')}</Text>
          }
        </TouchableOpacity>

        <Text style={styles.legalNote}>{t('subscription.legal')}</Text>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1A1A2E' },
  scroll: { flex: 1 },
  card: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
  },
  cardTitle: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 12 },
  planBadgeRow: { marginBottom: 8 },
  planBadge: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  planNote: { fontSize: 13, color: '#888', marginTop: 4, lineHeight: 18 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
    gap: 10,
  },
  featureEmoji: { fontSize: 16, width: 24 },
  featureLabel: { flex: 1, fontSize: 14, color: '#FFFFFF' },
  featureLock: { fontSize: 14 },
  upgradeCard: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#6B5CE720',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#6B5CE740',
    alignItems: 'center',
  },
  upgradeTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 4 },
  yearlyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  upgradeSubtitle: { fontSize: 13, color: '#888' },
  discountBadge: {
    backgroundColor: '#6B5CE7',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  discountText: { fontSize: 11, color: '#FFFFFF', fontWeight: '700' },
  yearlyMonthly: { fontSize: 12, color: '#888', marginBottom: 8 },
  upgradeTrial: { fontSize: 14, color: '#9C8FFF', fontWeight: '600' },
  manageBtn: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#2D2D44',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  manageBtnText: { color: '#9C8FFF', fontSize: 15, fontWeight: '600' },
  restoreBtn: {
    margin: 16,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: '#3D3D5E',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  restoreBtnDisabled: { opacity: 0.5 },
  restoreBtnText: { color: '#9C8FFF', fontSize: 14 },
  legalNote: {
    marginHorizontal: 16,
    marginTop: 16,
    fontSize: 11,
    color: '#555',
    lineHeight: 17,
    textAlign: 'center',
  },
});
