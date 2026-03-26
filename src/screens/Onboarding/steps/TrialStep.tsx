import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  initConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  Purchase,
  PurchaseError,
  Product,
  EventSubscription,
} from 'react-native-iap';
import functions from '@react-native-firebase/functions';
import DeviceInfo from 'react-native-device-info';
import { saveSubscription } from '../../../services/firebase';
import { SUBSCRIPTION } from '../../../constants';
import { useTranslation } from '../../../i18n';

interface Props {
  onComplete: () => void;
}

const PRODUCT_IDS = [
  SUBSCRIPTION.PRODUCT_IDS.MONTHLY,
  SUBSCRIPTION.PRODUCT_IDS.YEARLY,
];

export default function TrialStep({ onComplete }: Props) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isBillingAvailable, setIsBillingAvailable] = useState(true);

  useEffect(() => {
    let purchaseUpdateSub: EventSubscription | null = null;
    let purchaseErrorSub: EventSubscription | null = null;

    const setup = async () => {
      try {
        await initConnection();
        setIsBillingAvailable(true);

        purchaseUpdateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
          const token = (purchase as any).purchaseToken ?? (purchase as any).transactionId;
          if (token) {
            await finishTransaction({ purchase });
            try {
              const deviceId = await DeviceInfo.getUniqueId();
              const activateTrial = functions().httpsCallable('activateTrial');
              await activateTrial({
                purchaseToken: token,
                productId: purchase.productId,
                deviceId,
              });
              setIsPurchasing(false);
              onComplete();
            } catch (err: any) {
              setIsPurchasing(false);
              const code = err?.code ?? '';
              if (code === 'functions/already-exists') {
                Alert.alert(
                  t('onboarding.trial.alreadyUsedTitle'),
                  t('onboarding.trial.alreadyUsedMessage'),
                );
              } else {
                Alert.alert(t('common.error'), t('onboarding.trial.errorMessage'));
                console.error('activateTrial error:', err);
              }
            }
          }
        });

        purchaseErrorSub = purchaseErrorListener((error: PurchaseError) => {
          console.error('購入エラー:', error);
          setIsPurchasing(false);
          if (!error.message?.toLowerCase().includes('cancel')) {
            Alert.alert(t('onboarding.trial.purchaseError'), error.message);
          }
        });

        const subs = await fetchProducts({ skus: PRODUCT_IDS, type: 'subs' });
        setProducts(subs as Product[]);
      } catch (e) {
        console.error('IAP初期化エラー:', e);
        setIsBillingAvailable(false);
      } finally {
        setIsLoading(false);
      }
    };

    setup();

    return () => {
      purchaseUpdateSub?.remove();
      purchaseErrorSub?.remove();
    };
  }, []);

  const handleStartTrial = async (productId: string) => {
    if (!isBillingAvailable) return;
    setIsPurchasing(true);
    try {
      await requestPurchase({
        request: { google: { skus: [productId] } },
        type: 'subs',
      });
    } catch (e: any) {
      setIsPurchasing(false);
      console.error('購入リクエストエラー:', e);
      const msg: string = e?.message ?? '';
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('user')) {
        Alert.alert(t('onboarding.trial.purchaseError'), msg || t('onboarding.trial.errorMessage'));
      }
    }
  };

  const handleSkip = async () => {
    await saveSubscription({
      plan: 'free',
      status: 'expired',
      trialStartAt: null,
      trialEndAt: null,
      currentPeriodEndAt: null,
      trialUsed: false,
    });
    onComplete();
  };

  const monthlyProduct = products.find(p => (p as any).id === SUBSCRIPTION.PRODUCT_IDS.MONTHLY);
  const yearlyProduct = products.find(p => (p as any).id === SUBSCRIPTION.PRODUCT_IDS.YEARLY);

  const premiumFeatures = [
    t('onboarding.trial.feature1'),
    t('onboarding.trial.feature2'),
    t('onboarding.trial.feature3'),
    t('onboarding.trial.feature4'),
    t('onboarding.trial.feature5'),
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⭐</Text>
      <Text style={styles.title}>{t('onboarding.trial.title')}</Text>
      <Text style={styles.description}>
        {t('onboarding.trial.desc', { days: SUBSCRIPTION.TRIAL_DAYS })}
      </Text>

      <View style={styles.featureList}>
        {premiumFeatures.map(f => (
          <View key={f} style={styles.featureRow}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      {!isBillingAvailable && !isLoading && (
        <View style={styles.billingUnavailable}>
          <Text style={styles.billingUnavailableText}>
            {t('onboarding.trial.billingUnavailable')}
          </Text>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator color="#6B5CE7" style={{ marginVertical: 16 }} />
      ) : isBillingAvailable ? (
        <View style={styles.planGroup}>
          {/* Monthly plan */}
          <TouchableOpacity
            style={[styles.planCard, isPurchasing && styles.planCardDisabled]}
            onPress={() => handleStartTrial(SUBSCRIPTION.PRODUCT_IDS.MONTHLY)}
            disabled={isPurchasing}
          >
            <View>
              <Text style={styles.planName}>{t('onboarding.trial.monthlyPlan')}</Text>
              <Text style={styles.planPrice}>
                {(monthlyProduct as any)?.displayPrice ?? `¥${SUBSCRIPTION.MONTHLY_PRICE}`} {t('onboarding.trial.perMonth')}
              </Text>
            </View>
            {isPurchasing && <ActivityIndicator size="small" color="#6B5CE7" />}
          </TouchableOpacity>

          {/* Yearly plan (recommended) */}
          <TouchableOpacity
            style={[styles.planCard, styles.planCardRecommended, isPurchasing && styles.planCardDisabled]}
            onPress={() => handleStartTrial(SUBSCRIPTION.PRODUCT_IDS.YEARLY)}
            disabled={isPurchasing}
          >
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedText}>{t('onboarding.trial.recommended')}</Text>
            </View>
            <View>
              <Text style={styles.planName}>{t('onboarding.trial.yearlyPlan')}</Text>
              <Text style={styles.planPrice}>
                {(yearlyProduct as any)?.displayPrice ?? `¥${SUBSCRIPTION.YEARLY_PRICE}`} {t('onboarding.trial.perYear')}
              </Text>
              <Text style={styles.planMonthly}>
                {t('onboarding.trial.monthlyEquivalent', { price: Math.round(SUBSCRIPTION.YEARLY_PRICE / 12) })}
              </Text>
              {/* 年額節約額バッジ: 月額との差額を緑バッジで訴求 */}
              <Text style={styles.savingsBadge}>{t('onboarding.trial.yearSavings')}</Text>
            </View>
            {isPurchasing && <ActivityIndicator size="small" color="#6B5CE7" />}
          </TouchableOpacity>
        </View>
      ) : null}

      <Text style={styles.legal}>
        {t('onboarding.trial.legal')}
      </Text>

      {/* スキップボタン: marginTopを大きくして誤タップを防止 */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip} disabled={isPurchasing}>
        <Text style={styles.skipText}>{t('onboarding.trial.skipLater')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  icon: { fontSize: 56, textAlign: 'center', marginBottom: 12 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center', marginBottom: 8 },
  description: { fontSize: 14, color: '#B0B0C8', textAlign: 'center', marginBottom: 16, lineHeight: 22 },
  featureList: {
    backgroundColor: '#2D2D44',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 6,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center' },
  checkIcon: { color: '#6B5CE7', fontSize: 13, fontWeight: 'bold', marginRight: 8, width: 16 },
  featureText: { fontSize: 13, color: '#D0D0E8' },
  planGroup: { gap: 10, marginBottom: 12 },
  planCard: {
    backgroundColor: '#2D2D44',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#444',
  },
  planCardRecommended: {
    borderColor: '#6B5CE7',
    backgroundColor: '#6B5CE720',
  },
  planCardDisabled: { opacity: 0.6 },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    right: 12,
    backgroundColor: '#6B5CE7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  recommendedText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  planName: { fontSize: 14, color: '#B0B0C8', marginBottom: 2 },
  planPrice: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  planMonthly: { fontSize: 11, color: '#888', marginTop: 2 },
  billingUnavailable: {
    backgroundColor: '#2D2D44',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  billingUnavailableText: { fontSize: 13, color: '#B0B0C8', textAlign: 'center', lineHeight: 20 },
  legal: { fontSize: 10, color: '#555', textAlign: 'center', lineHeight: 16, marginBottom: 12 },
  // スキップボタン: marginTopを増やしCTAとの距離を広げて誤タップを防止、色もWCAG AA準拠の#888以上に
  skipButton: { paddingVertical: 10, marginTop: 16, alignItems: 'center' },
  skipText: { color: '#888', fontSize: 13, textDecorationLine: 'underline' },
  // 年額節約額バッジ: 緑背景で月額より安い訴求を強調
  savingsBadge: {
    backgroundColor: '#4CAF50',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
});
