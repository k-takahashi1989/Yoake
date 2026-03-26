import { ja, enUS } from 'date-fns/locale';
import { i18n } from '../i18n';

export function getDateFnsLocale() {
  return i18n.language === 'ja' ? ja : enUS;
}

/**
 * Safely converts a Firestore Timestamp (or related value) to a Date.
 * Handles: proper Timestamp, plain {seconds} object, regular Date, null/undefined.
 */
export function safeToDate(ts: any): Date {
  if (!ts) return new Date();
  if (ts instanceof Date) return isNaN(ts.getTime()) ? new Date() : ts;
  if (typeof ts === 'string') {
    // "yyyy-MM-dd" を手動パース（Hermes は new Date("2026/03/20") を Invalid Date として扱うため）
    const m = ts.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(ts);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  if (typeof ts.toDate === 'function') {
    const d = ts.toDate();
    return isNaN(d.getTime()) ? new Date() : d;
  }
  if (ts.seconds !== undefined) return new Date(ts.seconds * 1000);
  return new Date();
}
