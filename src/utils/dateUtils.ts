/**
 * Safely converts a Firestore Timestamp (or related value) to a Date.
 * Handles: proper Timestamp, plain {seconds} object, regular Date, null/undefined.
 */
export function safeToDate(ts: any): Date {
  if (!ts) return new Date();
  if (ts instanceof Date) return isNaN(ts.getTime()) ? new Date() : ts;
  if (typeof ts.toDate === 'function') {
    const d = ts.toDate();
    return isNaN(d.getTime()) ? new Date() : d;
  }
  if (ts.seconds !== undefined) return new Date(ts.seconds * 1000);
  return new Date();
}
