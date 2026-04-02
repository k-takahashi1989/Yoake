import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
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
import ScalePressable from '../../../components/common/ScalePressable';

interface Props {
  onComplete: () => void;
}

const PRODUCT_IDS = [
  SUBSCRIPTION.PRODUCT_IDS.MONTHLY,
  SUBSCRIPTION.PRODUCT_IDS.YEARLY,
];

export default function TrialStep({ onComplete }: Props) {
  const { t, i18n } = useTranslation();
  const isJa = i18n.language === 'ja';
  const isAndroid = Platform.OS === 'android';

  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isBillingAvailable, setIsBillingAvailable] = useState(true);
  const [purchasingProductId, setPurchasingProductId] = useState<string | null>(null);

  useEffect(() => {
    let purchaseUpdateSub: EventSubscription | null = null;
    let purchaseErrorSub: EventSubscription | null = null;

    const setup = async () => {
      if (!isAndroid) {
        setIsBillingAvailable(false);
        setIsLoading(false);
        return;
      }

      try {
        await initConnection();
        setIsBillingAvailable(true);

        purchaseUpdateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
          const token = (purchase as any).purchaseToken ?? (purchase as any).transactionId;
          if (!token) return;

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
            setPurchasingProductId(null);
            onComplete();
          } catch (error: any) {
            setIsPurchasing(false);
            setPurchasingProductId(null);
            const code = error?.code ?? '';
            if (code === 'functions/already-exists') {
              Alert.alert(
                t('onboarding.trial.alreadyUsedTitle'),
                t('onboarding.trial.alreadyUsedMessage'),
              );
            } else {
              Alert.alert(t('common.error'), t('onboarding.trial.errorMessage'));
              console.error('activateTrial error:', error);
            }
          }
        });

        purchaseErrorSub = purchaseErrorListener((error: PurchaseError) => {
          console.error('purchaseErrorListener:', error);
          setIsPurchasing(false);
          setPurchasingProductId(null);
          if (!error.message?.toLowerCase().includes('cancel')) {
            Alert.alert(t('onboarding.trial.purchaseError'), error.message);
          }
        });

        const fetched = await fetchProducts({ skus: PRODUCT_IDS, type: 'subs' });
        setProducts(fetched as Product[]);
      } catch (error) {
        console.error('IAP setup failed:', error);
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
  }, [isAndroid, onComplete, t]);

  const getProductId = (product: Product) => (product as any).productId ?? (product as any).id;
  const monthlyProduct = products.find(product => getProductId(product) === SUBSCRIPTION.PRODUCT_IDS.MONTHLY);
  const yearlyProduct = products.find(product => getProductId(product) === SUBSCRIPTION.PRODUCT_IDS.YEARLY);

  const copy = useMemo(
    () => ({
      icon: 'PRO',
      title: isJa ? '睡眠記録を、次の改善につなげる' : 'Turn your logs into better sleep',
      description: isJa
        ? `${SUBSCRIPTION.TRIAL_DAYS}日間の無料体験で、週次レポートとAIアドバイスをまとめて試せます。`
        : `Start with a ${SUBSCRIPTION.TRIAL_DAYS}-day free trial and try weekly reports plus AI guidance.`,
      billingUnavailable: !isAndroid
        ? isJa
          ? 'iOS課金はまだこのビルドで有効化していません。RevenueCat への移行後にプレミアム購入へ対応予定です。'
          : 'iOS billing is not enabled in this build yet. Premium purchase will be available after the RevenueCat migration.'
        : isJa
          ? 'この環境では Google Play の課金を利用できません。Play ストア対応端末でお試しください。'
          : 'Google Play billing is not available in this environment. Please try on a Play Store-enabled device.',
      monthlyPlan: isJa ? '月額プラン' : 'Monthly plan',
      yearlyPlan: isJa ? '年額プラン' : 'Yearly plan',
      perMonth: isJa ? '/月' : '/month',
      perYear: isJa ? '/年' : '/year',
      recommended: isJa ? 'おすすめ' : 'Recommended',
      yearSavings: isJa ? '年額のほうがおトク' : 'Best value',
      legal: !isAndroid
        ? isJa
          ? 'iOS版の課金導線は現在準備中です。プレミアム購入・管理は RevenueCat 対応後に有効化する予定です。'
          : 'The iOS billing flow is not enabled yet. Premium purchase and management will be enabled after the RevenueCat migration.'
        : isJa
          ? '課金は Google Play で管理されます。無料体験終了前にキャンセルしない場合は自動更新されます。'
          : 'Managed on Google Play. Cancel before the trial ends to avoid charges.',
      skipLater: isJa ? 'まずは無料プランで使ってみる' : 'Keep using the free plan',
      startLabel: isJa ? '始める' : 'Start',
      yearlyEquivalent: isJa
        ? `月あたり 約${Math.round(SUBSCRIPTION.YEARLY_PRICE / 12).toLocaleString()}円`
        : `$${Math.round(SUBSCRIPTION.YEARLY_PRICE / 12).toLocaleString()}/mo equivalent`,
      featureList: isJa
        ? [
            '週次レポートで睡眠の流れをまとめて確認',
            'AIに相談して次の改善アクションを整理',
            '行動とスコアの関係を振り返りやすくする',
            '長めの履歴や過去レポートを見返せる',
            '自分の生活に合わせて記録項目を調整できる',
          ]
        : [
            'See your weekly trend at a glance',
            'Ask AI what to improve next',
            'Understand which actions affect your score',
            'Review longer history and past reports',
            'Customize tracking items for your routine',
          ],
    }),
    [isAndroid, isJa],
  );

  const handleStartTrial = async (productId: string) => {
    if (!isAndroid || !isBillingAvailable || isPurchasing) return;
    setIsPurchasing(true);
    setPurchasingProductId(productId);
    try {
      await requestPurchase({
        request: { google: { skus: [productId] } },
        type: 'subs',
      });
    } catch (error: any) {
      setIsPurchasing(false);
      setPurchasingProductId(null);
      const message = error?.message ?? '';
      if (!message.toLowerCase().includes('cancel') && !message.toLowerCase().includes('user')) {
        Alert.alert(t('onboarding.trial.purchaseError'), message || t('onboarding.trial.errorMessage'));
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

  const getDisplayPrice = (product: Product | undefined, fallback: number) =>
    product ? (product as any).displayPrice ?? `¥${fallback.toLocaleString()}` : `¥${fallback.toLocaleString()}`;

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{copy.icon}</Text>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.description}>{copy.description}</Text>

      <View style={styles.featureList}>
        {copy.featureList.map(feature => (
          <View key={feature} style={styles.featureRow}>
            <Text style={styles.checkIcon}>+</Text>
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {!isBillingAvailable && !isLoading && (
        <View style={styles.billingUnavailable}>
          <Text style={styles.billingUnavailableText}>{copy.billingUnavailable}</Text>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator color="#6B5CE7" style={styles.loader} />
      ) : isBillingAvailable ? (
        <View style={styles.planGroup}>
          <ScalePressable
            style={[styles.planCard, isPurchasing && styles.planCardDisabled]}
            onPress={() => handleStartTrial(SUBSCRIPTION.PRODUCT_IDS.MONTHLY)}
            disabled={isPurchasing}
          >
            <View>
              <Text style={styles.planName}>{copy.monthlyPlan}</Text>
              <Text style={styles.planPrice}>
                {getDisplayPrice(monthlyProduct, SUBSCRIPTION.MONTHLY_PRICE)} {copy.perMonth}
              </Text>
            </View>
            {purchasingProductId === SUBSCRIPTION.PRODUCT_IDS.MONTHLY ? (
              <ActivityIndicator size="small" color="#6B5CE7" />
            ) : (
              <Text style={styles.planAction}>{copy.startLabel}</Text>
            )}
          </ScalePressable>

          <ScalePressable
            style={[styles.planCard, styles.planCardRecommended, isPurchasing && styles.planCardDisabled]}
            onPress={() => handleStartTrial(SUBSCRIPTION.PRODUCT_IDS.YEARLY)}
            disabled={isPurchasing}
          >
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedText}>{copy.recommended}</Text>
            </View>
            <View>
              <Text style={styles.planName}>{copy.yearlyPlan}</Text>
              <Text style={styles.planPrice}>
                {getDisplayPrice(yearlyProduct, SUBSCRIPTION.YEARLY_PRICE)} {copy.perYear}
              </Text>
              <Text style={styles.planMonthly}>{copy.yearlyEquivalent}</Text>
              <Text style={styles.savingsBadge}>{copy.yearSavings}</Text>
            </View>
            {purchasingProductId === SUBSCRIPTION.PRODUCT_IDS.YEARLY ? (
              <ActivityIndicator size="small" color="#6B5CE7" />
            ) : (
              <Text style={styles.planAction}>{copy.startLabel}</Text>
            )}
          </ScalePressable>
        </View>
      ) : null}

      <Text style={styles.legal}>{copy.legal}</Text>

      <ScalePressable style={styles.skipButton} onPress={handleSkip} disabled={isPurchasing}>
        <Text style={styles.skipText}>{copy.skipLater}</Text>
      </ScalePressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  icon: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
    color: '#CFCBFF',
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#B0B0C8',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  featureList: {
    backgroundColor: '#2D2D44',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 6,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center' },
  checkIcon: {
    color: '#6B5CE7',
    fontSize: 13,
    fontWeight: 'bold',
    marginRight: 8,
    width: 16,
  },
  featureText: { fontSize: 13, color: '#D0D0E8' },
  loader: { marginVertical: 16 },
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
  planMonthly: { fontSize: 11, color: '#9A9AB8', marginTop: 2 },
  planAction: { color: '#D9D5FF', fontSize: 14, fontWeight: '700' },
  billingUnavailable: {
    backgroundColor: '#2D2D44',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  billingUnavailableText: {
    fontSize: 13,
    color: '#B0B0C8',
    textAlign: 'center',
    lineHeight: 20,
  },
  legal: {
    fontSize: 10,
    color: '#555',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 12,
  },
  skipButton: { paddingVertical: 10, marginTop: 16, alignItems: 'center' },
  skipText: { color: '#9A9AB8', fontSize: 13, textDecorationLine: 'underline' },
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
