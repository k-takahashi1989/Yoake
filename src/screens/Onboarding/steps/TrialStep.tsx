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

interface Props {
  onComplete: () => void;
}

const PRODUCT_IDS = [
  SUBSCRIPTION.PRODUCT_IDS.MONTHLY,
  SUBSCRIPTION.PRODUCT_IDS.YEARLY,
];

export default function TrialStep({ onComplete }: Props) {
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
                  'トライアル利用済み',
                  'このデバイスではすでに無料トライアルが使用されています。',
                );
              } else {
                Alert.alert('エラー', 'トライアルの開始に失敗しました。しばらく経ってから再試行してください。');
                console.error('activateTrial error:', err);
              }
            }
          }
        });

        purchaseErrorSub = purchaseErrorListener((error: PurchaseError) => {
          console.error('購入エラー:', error);
          setIsPurchasing(false);
          if (!error.message?.toLowerCase().includes('cancel')) {
            Alert.alert('購入エラー', error.message);
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
        Alert.alert('購入エラー', msg || '購入を開始できませんでした');
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

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⭐</Text>
      <Text style={styles.title}>7日間無料トライアル</Text>
      <Text style={styles.description}>
        すべての有料機能を{SUBSCRIPTION.TRIAL_DAYS}日間無料でお試しいただけます。
      </Text>

      <View style={styles.featureList}>
        {PREMIUM_FEATURES.map(f => (
          <View key={f} style={styles.featureRow}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      {!isBillingAvailable && !isLoading && (
        <View style={styles.billingUnavailable}>
          <Text style={styles.billingUnavailableText}>
            この環境ではGoogle Playが利用できません。{'\n'}
            無料プランで始めることができます。
          </Text>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator color="#6B5CE7" style={{ marginVertical: 16 }} />
      ) : isBillingAvailable ? (
        <View style={styles.planGroup}>
          {/* 月額プラン */}
          <TouchableOpacity
            style={[styles.planCard, isPurchasing && styles.planCardDisabled]}
            onPress={() => handleStartTrial(SUBSCRIPTION.PRODUCT_IDS.MONTHLY)}
            disabled={isPurchasing}
          >
            <View>
              <Text style={styles.planName}>月額プラン</Text>
              <Text style={styles.planPrice}>
                {(monthlyProduct as any)?.displayPrice ?? `¥${SUBSCRIPTION.MONTHLY_PRICE}`} / 月
              </Text>
            </View>
            {isPurchasing && <ActivityIndicator size="small" color="#6B5CE7" />}
          </TouchableOpacity>

          {/* 年額プラン（推奨） */}
          <TouchableOpacity
            style={[styles.planCard, styles.planCardRecommended, isPurchasing && styles.planCardDisabled]}
            onPress={() => handleStartTrial(SUBSCRIPTION.PRODUCT_IDS.YEARLY)}
            disabled={isPurchasing}
          >
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedText}>おすすめ 38%OFF</Text>
            </View>
            <View>
              <Text style={styles.planName}>年額プラン</Text>
              <Text style={styles.planPrice}>
                {(yearlyProduct as any)?.displayPrice ?? `¥${SUBSCRIPTION.YEARLY_PRICE}`} / 年
              </Text>
              <Text style={styles.planMonthly}>
                月換算 ¥{Math.round(SUBSCRIPTION.YEARLY_PRICE / 12)}
              </Text>
            </View>
            {isPurchasing && <ActivityIndicator size="small" color="#6B5CE7" />}
          </TouchableOpacity>
        </View>
      ) : null}

      <Text style={styles.legal}>
        トライアル終了後は自動更新されます。{'\n'}いつでもキャンセル可能です。
      </Text>

      <TouchableOpacity style={styles.skipButton} onPress={handleSkip} disabled={isPurchasing}>
        <Text style={styles.skipText}>無料プランで始める</Text>
      </TouchableOpacity>
    </View>
  );
}

const PREMIUM_FEATURES = [
  '週次AIレポート・AIチャット',
  'スマートアラーム（ウェアラブル連携）',
  '週次・月次グラフ / 習慣別相関グラフ',
  '習慣カスタマイズ（最大20項目）',
  'クラウドバックアップ・CSVエクスポート',
];

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
  skipButton: { paddingVertical: 10, alignItems: 'center' },
  skipText: { color: '#666', fontSize: 13, textDecorationLine: 'underline' },
});
