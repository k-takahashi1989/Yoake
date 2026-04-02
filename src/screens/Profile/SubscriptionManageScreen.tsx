import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
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
import { useAuthStore } from '../../stores/authStore';
import { SUBSCRIPTION } from '../../constants';
import { safeToDate } from '../../utils/dateUtils';
import { useTranslation } from '../../i18n';

const PRODUCT_IDS = [
  SUBSCRIPTION.PRODUCT_IDS.MONTHLY,
  SUBSCRIPTION.PRODUCT_IDS.YEARLY,
];

export default function SubscriptionManageScreen() {
  const { subscription, isPremium, refreshSubscription } = useAuthStore();
  const { t, i18n } = useTranslation();
  const isJa = i18n.language === 'ja';
  const isAndroid = Platform.OS === 'android';
  const isIos = Platform.OS === 'ios';

  const [isRestoring, setIsRestoring] = useState(false);
  const [isBillingAvailable, setIsBillingAvailable] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchasingProductId, setPurchasingProductId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  const status = subscription?.status ?? 'free';
  const isOnTrial = status === 'trial';
  const isActive = status === 'active';

  const formatPlanDate = (value: any) =>
    isJa
      ? format(safeToDate(value), 'M月d日 (E)', { locale: ja })
      : format(safeToDate(value), 'MMM d (EEE)');

  const trialEnd = subscription?.trialEndAt ? formatPlanDate(subscription.trialEndAt) : null;
  const periodEnd = subscription?.currentPeriodEndAt
    ? formatPlanDate(subscription.currentPeriodEndAt)
    : null;

  useEffect(() => {
    let purchaseUpdateSub: EventSubscription | null = null;
    let purchaseErrorSub: EventSubscription | null = null;

    const setup = async () => {
      if (!isAndroid) {
        setIsBillingAvailable(false);
        setIsLoadingProducts(false);
        return;
      }

      try {
        await initConnection();
        setIsBillingAvailable(true);

        purchaseUpdateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
          const token = (purchase as any).purchaseToken ?? (purchase as any).transactionId;
          if (!token) return;

          try {
            await finishTransaction({ purchase });
            const deviceId = await DeviceInfo.getUniqueId();
            const activateTrial = functions().httpsCallable('activateTrial');
            await activateTrial({
              purchaseToken: token,
              productId: purchase.productId,
              deviceId,
            });
            await refreshSubscription();

            setIsPurchasing(false);
            setPurchasingProductId(null);
            Alert.alert(
              isJa ? 'プレミアムを開始しました' : 'Premium Started',
              isJa
                ? 'プレミアム機能が使えるようになりました。'
                : 'Premium access has been activated.',
            );
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
        setIsLoadingProducts(false);
      }
    };

    setup();

    return () => {
      purchaseUpdateSub?.remove();
      purchaseErrorSub?.remove();
    };
  }, [isAndroid, isJa, refreshSubscription, t]);

  const copy = useMemo(
    () => ({
      heroEyebrow: 'PREMIUM',
      heroTitle: isJa ? '睡眠記録を、次の改善につなげるプレミアム' : 'Turn your logs into better sleep',
      heroBody: isJa
        ? '日々の記録を、週次レポートとAIアドバイスで次の行動につなげやすくします。'
        : 'Turn daily logs into clear next steps with weekly reports and AI guidance.',
      freeTitle: isJa ? '無料でできること' : 'Included for free',
      premiumTitle: isJa ? 'プレミアムでできること' : 'What Premium unlocks',
      currentPlanTitle: t('subscription.currentPlanTitle'),
      freePlanNote: isJa
        ? '無料プランでは、日々の睡眠記録と当日の状態確認まで使えます。'
        : 'The free plan covers daily logging and checking your current status.',
      trialText: isJa
        ? `${SUBSCRIPTION.TRIAL_DAYS}日間無料で、分析体験を試せます`
        : `Try the full analysis experience free for ${SUBSCRIPTION.TRIAL_DAYS} days`,
      upgradeBody: isJa
        ? 'まずは無料体験で、レポートとAIの改善提案をまとめて確認できます。'
        : 'Start with a 7-day free trial and try the full report plus AI experience.',
      legal: isIos
        ? isJa
          ? 'iOS版の課金導線は現在準備中です。プレミアム購入・管理は RevenueCat 対応後に有効化する予定です。'
          : 'The iOS billing flow is not enabled yet. Premium purchase and management will be enabled after the RevenueCat migration.'
        : isJa
          ? 'サブスクリプションは Google Play で管理されます。トライアル終了前にキャンセルしない場合は自動更新されます。'
          : 'Subscriptions are managed on Google Play. Cancel before the trial ends to avoid charges. Your sleep logs remain available after cancellation.',
      purchaseUnavailable: isIos
        ? isJa
          ? 'iOS課金はまだこのビルドで有効化していません。RevenueCat への移行後にプレミアム購入と管理へ対応予定です。'
          : 'iOS billing is not enabled in this build yet. Premium purchase and management will be available after the RevenueCat migration.'
        : isJa
          ? 'この環境では Google Play の課金を利用できません。Play ストア対応端末でお試しください。'
          : 'Google Play billing is not available in this environment. Please try on a Play Store-enabled device.',
      monthlyPlan: isJa ? '月額プラン' : 'Monthly plan',
      yearlyPlan: isJa ? '年額プラン' : 'Yearly plan',
      recommended: isJa ? 'おすすめ' : 'Recommended',
      startLabel: isJa ? '始める' : 'Start',
      yearlyEquivalent: isJa
        ? `月あたり 約${Math.round(SUBSCRIPTION.YEARLY_PRICE / 12).toLocaleString()}円`
        : `$${Math.round(SUBSCRIPTION.YEARLY_PRICE / 12).toLocaleString()}/mo equivalent`,
    }),
    [isIos, isJa, t],
  );

  const freeFeatures = useMemo(
    () =>
      isJa
        ? ['日々の睡眠記録', '今日のスコア確認', '記録の編集']
        : ['Daily sleep logging', "Today's score view", 'Record editing'],
    [isJa],
  );

  const premiumFeatures = useMemo(
    () =>
      isJa
        ? [
            { label: '週次レポートで睡眠の流れをまとめて確認' },
            { label: 'AIに相談して次の改善アクションを整理' },
            { label: '行動とスコアの関係を振り返りやすくする' },
            { label: '長めの履歴や過去レポートを見返せる' },
            { label: '自分の生活に合わせて記録項目を調整できる' },
          ]
        : [
            { label: 'Review your weekly trend at a glance' },
            { label: 'Ask AI what to improve next' },
            { label: 'Understand which actions affect your score' },
            { label: 'Review longer history and past reports' },
            { label: 'Customize tracking items for your routine' },
          ],
    [isJa],
  );

  const getProductId = (product: Product) => (product as any).productId ?? (product as any).id;
  const getDisplayPrice = (product: Product | undefined, fallback: number) =>
    product ? (product as any).displayPrice ?? `¥${fallback.toLocaleString()}` : `¥${fallback.toLocaleString()}`;

  const monthlyProduct = products.find(product => getProductId(product) === SUBSCRIPTION.PRODUCT_IDS.MONTHLY);
  const yearlyProduct = products.find(product => getProductId(product) === SUBSCRIPTION.PRODUCT_IDS.YEARLY);

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

  const handleStartPurchase = async (productId: string) => {
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
        Alert.alert(
          t('onboarding.trial.purchaseError'),
          message || t('onboarding.trial.errorMessage'),
        );
      }
    }
  };

  const openGooglePlaySubscriptions = () => {
    if (!isAndroid) return;

    Linking.openURL(
      `https://play.google.com/store/account/subscriptions?sku=${SUBSCRIPTION.PRODUCT_IDS.MONTHLY}&package=com.ktakahashi.yoake`,
    ).catch(() => Linking.openURL('https://play.google.com/store/account/subscriptions'));
  };

  const planBadgeText = isOnTrial
    ? t('subscription.trialBadge')
    : isActive
      ? t('subscription.premiumBadge')
      : t('subscription.freeBadge');

  const planDetailText = isOnTrial && trialEnd
    ? t('subscription.trialEnd', { date: trialEnd })
    : isActive && periodEnd
      ? t('subscription.nextBilling', { date: periodEnd })
      : copy.freePlanNote;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>{copy.heroEyebrow}</Text>
          <Text style={styles.heroTitle}>{copy.heroTitle}</Text>
          <Text style={styles.heroBody}>{copy.heroBody}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{copy.currentPlanTitle}</Text>
          <View style={styles.planBadgeRow}>
            <Text style={styles.planBadge}>{planBadgeText}</Text>
          </View>
          <Text style={styles.planNote}>{planDetailText}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{copy.freeTitle}</Text>
          {freeFeatures.map(item => (
            <View key={item} style={styles.featureRow}>
              <Text style={styles.featureBullet}>+</Text>
              <Text style={styles.featureLabel}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{copy.premiumTitle}</Text>
          {premiumFeatures.map(item => (
            <View key={item.label} style={styles.featureRow}>
              <Text style={styles.featureBullet}>+</Text>
              <Text style={styles.featureLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {!isPremium && (
          <>
            <View style={styles.upgradeCard}>
              <Text style={styles.upgradeTitle}>{copy.trialText}</Text>
              <Text style={styles.upgradeSubtitle}>{copy.upgradeBody}</Text>
            </View>

            {isLoadingProducts ? (
              <View style={styles.billingCard}>
                <ActivityIndicator color="#6B5CE7" />
              </View>
            ) : isBillingAvailable ? (
              <View style={styles.planGroup}>
                <TouchableOpacity
                  style={[styles.planCard, isPurchasing && styles.planCardDisabled]}
                  onPress={() => handleStartPurchase(SUBSCRIPTION.PRODUCT_IDS.MONTHLY)}
                  disabled={isPurchasing}
                  activeOpacity={0.85}
                >
                  <View style={styles.planTextBlock}>
                    <Text style={styles.planName}>{copy.monthlyPlan}</Text>
                    <Text style={styles.planPrice}>
                      {getDisplayPrice(monthlyProduct, SUBSCRIPTION.MONTHLY_PRICE)}
                    </Text>
                  </View>
                  {purchasingProductId === SUBSCRIPTION.PRODUCT_IDS.MONTHLY ? (
                    <ActivityIndicator size="small" color="#6B5CE7" />
                  ) : (
                    <Text style={styles.planAction}>{copy.startLabel}</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.planCard,
                    styles.planCardRecommended,
                    isPurchasing && styles.planCardDisabled,
                  ]}
                  onPress={() => handleStartPurchase(SUBSCRIPTION.PRODUCT_IDS.YEARLY)}
                  disabled={isPurchasing}
                  activeOpacity={0.85}
                >
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>{copy.recommended}</Text>
                  </View>
                  <View style={styles.planTextBlock}>
                    <Text style={styles.planName}>{copy.yearlyPlan}</Text>
                    <Text style={styles.planPrice}>
                      {getDisplayPrice(yearlyProduct, SUBSCRIPTION.YEARLY_PRICE)}
                    </Text>
                    <Text style={styles.planMonthly}>{copy.yearlyEquivalent}</Text>
                  </View>
                  {purchasingProductId === SUBSCRIPTION.PRODUCT_IDS.YEARLY ? (
                    <ActivityIndicator size="small" color="#6B5CE7" />
                  ) : (
                    <Text style={styles.planAction}>{copy.startLabel}</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.billingCard}>
                <Text style={styles.billingUnavailableText}>{copy.purchaseUnavailable}</Text>
              </View>
            )}
          </>
        )}

        {isPremium && isAndroid && (
          <TouchableOpacity style={styles.manageBtn} onPress={openGooglePlaySubscriptions}>
            <Text style={styles.manageBtnText}>{t('subscription.manageBtn')}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.restoreBtn, isRestoring && styles.restoreBtnDisabled]}
          onPress={handleRestore}
          disabled={isRestoring}
        >
          {isRestoring ? (
            <ActivityIndicator color="#9C8FFF" size="small" />
          ) : (
            <Text style={styles.restoreBtnText}>{t('subscription.restoreBtn')}</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.legalNote}>{copy.legal}</Text>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1A1A2E' },
  scroll: { flex: 1 },
  heroCard: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: 'rgba(107, 92, 231, 0.14)',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.28)',
  },
  heroEyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    color: '#B5AEFF',
    fontWeight: '700',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 22,
    color: '#D6D2F4',
  },
  card: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
  },
  cardTitle: {
    fontSize: 13,
    color: '#9A9AB8',
    fontWeight: '600',
    marginBottom: 12,
  },
  planBadgeRow: { marginBottom: 8 },
  planBadge: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  planNote: {
    fontSize: 13,
    color: '#9A9AB8',
    marginTop: 4,
    lineHeight: 18,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
    gap: 10,
  },
  featureBullet: {
    fontSize: 14,
    width: 16,
    color: '#A99FFF',
    fontWeight: '700',
  },
  featureLabel: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
  },
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
  upgradeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  upgradeSubtitle: {
    fontSize: 13,
    color: '#C8C8E0',
    textAlign: 'center',
    lineHeight: 20,
  },
  billingCard: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
  },
  billingUnavailableText: {
    fontSize: 13,
    color: '#B0B0C8',
    textAlign: 'center',
    lineHeight: 20,
  },
  planGroup: {
    gap: 12,
    margin: 16,
    marginTop: 12,
    marginBottom: 0,
  },
  planCard: {
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planCardRecommended: {
    borderColor: '#6B5CE7',
    backgroundColor: '#6B5CE720',
  },
  planCardDisabled: { opacity: 0.6 },
  planTextBlock: { flex: 1 },
  planName: {
    fontSize: 14,
    color: '#B0B0C8',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  planMonthly: {
    fontSize: 12,
    color: '#9A9AB8',
    marginTop: 4,
  },
  planAction: {
    color: '#D9D5FF',
    fontSize: 14,
    fontWeight: '700',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    right: 12,
    backgroundColor: '#6B5CE7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  recommendedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  manageBtn: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#2D2D44',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  manageBtnText: {
    color: '#9C8FFF',
    fontSize: 15,
    fontWeight: '600',
  },
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
  restoreBtnText: {
    color: '#9C8FFF',
    fontSize: 14,
  },
  legalNote: {
    marginHorizontal: 16,
    marginTop: 16,
    fontSize: 11,
    color: '#555',
    lineHeight: 17,
    textAlign: 'center',
  },
  bottomSpacer: { height: 32 },
});
