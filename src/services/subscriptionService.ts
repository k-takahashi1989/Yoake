import { Platform } from 'react-native';
import functions from '@react-native-firebase/functions';
import {
  finishTransaction,
  getAvailablePurchases,
  Purchase,
  requestPurchase,
} from 'react-native-iap';
import { SUBSCRIPTION } from '../constants';

export const SUBSCRIPTION_PRODUCT_IDS = [
  SUBSCRIPTION.PRODUCT_IDS.MONTHLY,
  SUBSCRIPTION.PRODUCT_IDS.YEARLY,
] as const;

export type SubscriptionPlatform = 'android' | 'ios';

export type ValidatedPurchaseResult = {
  success: boolean;
  status: 'trial' | 'active';
  expiryTime: string;
};

function getCurrentSubscriptionPlatform(): SubscriptionPlatform {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

export function isNativeSubscriptionPurchaseSupported(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

export function getPurchaseToken(purchase: Purchase): string | null {
  return purchase.purchaseToken ?? purchase.transactionId ?? null;
}

export async function startSubscriptionPurchase(productId: string): Promise<void> {
  const platform = getCurrentSubscriptionPlatform();

  await requestPurchase({
    request:
      platform === 'ios'
        ? {
            apple: { sku: productId },
          }
        : {
            google: { skus: [productId] },
          },
    type: 'subs',
  });
}

export async function finishAndValidateSubscriptionPurchase(
  purchase: Purchase,
): Promise<ValidatedPurchaseResult> {
  await finishTransaction({ purchase });
  return validateSubscriptionPurchase(purchase);
}

export async function validateSubscriptionPurchase(
  purchase: Purchase,
): Promise<ValidatedPurchaseResult> {
  const purchaseToken = getPurchaseToken(purchase);
  if (!purchaseToken) {
    throw new Error('Purchase token is missing');
  }

  const platform = getCurrentSubscriptionPlatform();
  const validatePurchase = functions().httpsCallable('validatePurchase');
  const result = await validatePurchase({
    platform,
    purchaseToken,
    productId: purchase.productId,
    transactionId: purchase.transactionId ?? null,
    appBundleIdIOS: 'appBundleIdIOS' in purchase ? purchase.appBundleIdIOS ?? null : null,
    environmentIOS: 'environmentIOS' in purchase ? purchase.environmentIOS ?? null : null,
  });

  return result.data as ValidatedPurchaseResult;
}

export async function restoreLatestSubscriptionPurchase(): Promise<Purchase> {
  const purchases = await getAvailablePurchases();
  const latestPurchase = purchases
    .filter(purchase => SUBSCRIPTION_PRODUCT_IDS.includes(purchase.productId as any))
    .sort((a, b) => b.transactionDate - a.transactionDate)[0];

  if (!latestPurchase) {
    throw new Error('No active subscription purchase found');
  }

  await validateSubscriptionPurchase(latestPurchase);
  return latestPurchase;
}
