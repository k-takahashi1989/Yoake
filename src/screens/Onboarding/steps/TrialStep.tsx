import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import {
  initConnection,
  fetchProducts,
  purchaseUpdatedListener,
  purchaseErrorListener,
  Purchase,
  PurchaseError,
  Product,
  EventSubscription,
} from 'react-native-iap';
import { SUBSCRIPTION } from '../../../constants';
import { useTranslation } from '../../../i18n';
import ScalePressable from '../../../components/common/ScalePressable';
import { useAuthStore } from '../../../stores/authStore';
import {
  finishAndValidateSubscriptionPurchase,
  isNativeSubscriptionPurchaseSupported,
  startSubscriptionPurchase,
} from '../../../services/subscriptionService';

interface Props {
  onComplete: () => void;
}

const PRODUCT_IDS = [
  SUBSCRIPTION.PRODUCT_IDS.MONTHLY,
  SUBSCRIPTION.PRODUCT_IDS.YEARLY,
];

export default function TrialStep({ onComplete }: Props) {
  const { t, i18n } = useTranslation();
  const { refreshSubscription } = useAuthStore();
  const isJa = i18n.language === 'ja';
  const isIos = Platform.OS === 'ios';
  const purchaseSupported = isNativeSubscriptionPurchaseSupported();

  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isBillingAvailable, setIsBillingAvailable] = useState(true);
  const [purchasingProductId, setPurchasingProductId] = useState<string | null>(null);

  useEffect(() => {
    let purchaseUpdateSub: EventSubscription | null = null;
    let purchaseErrorSub: EventSubscription | null = null;

    const setup = async () => {
      if (!purchaseSupported) {
        setIsBillingAvailable(false);
        setIsLoading(false);
        return;
      }

      try {
        await initConnection();
        setIsBillingAvailable(true);

        purchaseUpdateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
          try {
            await finishAndValidateSubscriptionPurchase(purchase);
            await refreshSubscription();
            setIsPurchasing(false);
            setPurchasingProductId(null);
            onComplete();
          } catch (error: any) {
            setIsPurchasing(false);
            setPurchasingProductId(null);
            const code = error?.code ?? '';
            if (code === 'functions/failed-precondition') {
              Alert.alert(t('common.error'), t('subscription.restoreError'));
            } else {
              Alert.alert(t('common.error'), t('onboarding.trial.errorMessage'));
              console.error('validatePurchase error:', error);
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
  }, [onComplete, purchaseSupported, refreshSubscription, t]);

  const getProductId = (product: Product) => (product as any).productId ?? (product as any).id;
  const monthlyProduct = products.find(product => getProductId(product) === SUBSCRIPTION.PRODUCT_IDS.MONTHLY);
  const yearlyProduct = products.find(product => getProductId(product) === SUBSCRIPTION.PRODUCT_IDS.YEARLY);

  const copy = useMemo(
    () => ({
      icon: 'PRO',
      title: isJa ? '睡眠記録を、次の改善につなげる' : 'Turn your logs into better sleep',
      description: isJa
        ? `${SUBSCRIPTION.TRIAL_DAYS}日間で「どこを直せば眠りが良くなるか」まで見えるようにします。`
        : `Use the first ${SUBSCRIPTION.TRIAL_DAYS} days to learn what actually improves your sleep.`,
      billingUnavailable: !purchaseSupported
        ? isJa
          ? 'このビルドではApp Store課金をまだ有効化していません。いったん無料で始めて、iOS公開ビルドでプレミアム解放に進めます。'
          : 'App Store billing is not enabled in this build yet. You can start free now and unlock Premium in the iOS release build.'
        : isJa
          ? 'この環境では Google Play の課金を利用できません。Play ストア対応端末でお試しください。'
          : 'Google Play billing is not available in this environment. Please try on a Play Store-enabled device.',
      monthlyPlan: isJa ? '月額プラン' : 'Monthly plan',
      yearlyPlan: isJa ? '年額プラン' : 'Yearly plan',
      perMonth: isJa ? '/月' : '/month',
      perYear: isJa ? '/年' : '/year',
      recommended: isJa ? 'おすすめ' : 'Recommended',
      yearSavings: isJa ? '年額のほうがおトク' : 'Best value',
      legal: !purchaseSupported
        ? isJa
          ? 'プレミアム購入はストア公開ビルドで有効になります。無料で始めても、記録データはそのまま引き継げます。'
          : 'Premium purchase will be enabled in the store release build. You can start free and keep your log data.'
        : isJa
          ? '課金は Google Play で管理されます。無料体験終了前にキャンセルしない場合は自動更新されます。'
          : 'Managed on Google Play. Cancel before the trial ends to avoid charges.',
      skipLater: isJa ? 'まずは無料で続ける' : 'Keep going with free',
      startLabel: isJa ? '始める' : 'Start',
      yearlyEquivalent: isJa
        ? `月あたり 約${Math.round(SUBSCRIPTION.YEARLY_PRICE / 12).toLocaleString()}円`
        : `$${Math.round(SUBSCRIPTION.YEARLY_PRICE / 12).toLocaleString()}/mo equivalent`,
      featureList: isJa
        ? [
            '週次レポートで「今週の眠り方の癖」がひと目で分かる',
            'AIが次に直すべき行動を1つに絞って提案する',
            'スコアと習慣の関係を見て、効く行動だけ残せる',
            '過去レポートを見返して改善の積み上がりを追える',
            '自分の生活に合わせて記録項目を増やせる',
          ]
        : [
            'Spot your weekly sleep pattern at a glance',
            'Let AI narrow the next action to just one change',
            'See which habits actually move your score',
            'Review past reports and track progress over time',
            'Add custom tracking items for your routine',
          ],
    }),
    [isJa, purchaseSupported],
  );

  const previewRows = useMemo(
    () =>
      isJa
        ? [
            { label: '今週の平均', value: '78点', note: '先週より +6点' },
            { label: '見えてきた癖', value: '就寝が +48分遅れがち', note: '火・木で崩れやすい' },
            { label: '次の一手', value: '23:30までに布団へ', note: 'まず1つだけでOK' },
          ]
        : [
            { label: 'Weekly average', value: '78 pts', note: '+6 vs last week' },
            { label: 'Pattern found', value: 'Bedtime drifts by 48 min', note: 'Mostly Tue and Thu' },
            { label: 'Next move', value: 'Get in bed by 11:30 pm', note: 'One change is enough' },
          ],
    [isJa],
  );

  const billingUnavailableText = isIos
    ? isJa
      ? 'App Store の商品設定かサンドボックス接続がまだ整っていない可能性があります。StoreKit が使える実機で確認してください。'
      : 'App Store products are not available in this environment yet. Please try on a StoreKit-enabled device or TestFlight build.'
    : copy.billingUnavailable;

  const legalText = isIos
    ? isJa
      ? '購読は App Store で管理されます。トライアル終了前に解約すれば請求は発生しません。'
      : 'Subscriptions are managed on the App Store. Cancel before the trial ends to avoid charges.'
    : copy.legal;

  const handleStartTrial = async (productId: string) => {
    if (!purchaseSupported || !isBillingAvailable || isPurchasing) return;
    setIsPurchasing(true);
    setPurchasingProductId(productId);
    try {
      await startSubscriptionPurchase(productId);
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
    onComplete();
  };

  const getDisplayPrice = (product: Product | undefined, fallback: number) =>
    product ? (product as any).displayPrice ?? `¥${fallback.toLocaleString()}` : `¥${fallback.toLocaleString()}`;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.icon}>{copy.icon}</Text>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.description}>{copy.description}</Text>

      <View style={styles.previewCard}>
        <Text style={styles.previewEyebrow}>
          {isJa ? '7日で見えること' : 'What becomes visible in 7 days'}
        </Text>
        {previewRows.map(item => (
          <View key={item.label} style={styles.previewRow}>
            <View style={styles.previewLabelBlock}>
              <Text style={styles.previewLabel}>{item.label}</Text>
              <Text style={styles.previewNote}>{item.note}</Text>
            </View>
            <Text style={styles.previewValue}>{item.value}</Text>
          </View>
        ))}
      </View>

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
          <Text style={styles.billingUnavailableText}>{billingUnavailableText}</Text>
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

      <Text style={styles.legal}>{legalText}</Text>

      <ScalePressable style={styles.skipButton} onPress={handleSkip} disabled={isPurchasing}>
        <Text style={styles.skipText}>{copy.skipLater}</Text>
      </ScalePressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 24,
  },
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
  previewCard: {
    backgroundColor: 'rgba(107, 92, 231, 0.14)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.28)',
  },
  previewEyebrow: {
    fontSize: 11,
    color: '#CFC9FF',
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  previewLabelBlock: {
    flex: 1,
  },
  previewLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  previewNote: {
    color: '#AFA9D9',
    fontSize: 11,
    lineHeight: 16,
  },
  previewValue: {
    color: '#F7F3FF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    maxWidth: 128,
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
