/**
 * firebase.ts — Firestore CRUD 関数のユニットテスト
 * 各関数の正常系・分岐条件を検証する。
 */

// jest.mock は babel-jest によりファイル先頭にホイスティングされる
jest.mock('@react-native-firebase/firestore', () => {
  const mockGet = jest.fn().mockResolvedValue({ exists: () => false, data: () => null });
  const mockSet = jest.fn().mockResolvedValue(undefined);
  const mockUpdate = jest.fn().mockResolvedValue(undefined);
  const mockDelete = jest.fn().mockResolvedValue(undefined);

  const docRef = {
    get: mockGet,
    set: mockSet,
    update: mockUpdate,
    delete: mockDelete,
    onSnapshot: jest.fn(() => jest.fn()),
  };

  const subCol = {
    doc: jest.fn(() => docRef),
    get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  };

  const userDocRef = { collection: jest.fn(() => subCol) };

  const fn: any = jest.fn(() => ({
    collection: jest.fn(() => ({ doc: jest.fn(() => userDocRef) })),
    batch: jest.fn(() => ({
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    })),
  }));

  fn.Timestamp = {
    fromDate: (d: any) => ({ toDate: () => d, seconds: 0, nanoseconds: 0 }),
    now: () => ({ toDate: () => new Date(), seconds: 0, nanoseconds: 0 }),
  };
  fn.FieldValue = {
    serverTimestamp: () => ({ _serverTimestamp: true }),
    arrayUnion: (...i: any[]) => ({ _arrayUnion: i }),
    arrayRemove: (...i: any[]) => ({ _arrayRemove: i }),
    increment: (n: number) => ({ _increment: n }),
  };

  // テストから参照できるよう公開
  fn.__mockGet = mockGet;
  fn.__mockSet = mockSet;
  fn.__mockUpdate = mockUpdate;
  fn.__mockDelete = mockDelete;
  fn.__subCol = subCol;

  return fn;
});

jest.mock('@react-native-firebase/auth', () => {
  const fn = jest.fn(() => ({ currentUser: { uid: 'uid-test' } }));
  return fn;
});

import {
  getSleepLog,
  saveSleepLog,
  deleteSleepLog,
  getRecentSleepLogs,
  saveChatMessages,
  getChatMessages,
  getGoal,
  saveAiReport,
  getAiReport,
} from '../src/services/firebase';

const fsMock = jest.requireMock('@react-native-firebase/firestore') as any;
const mockGet: jest.Mock = fsMock.__mockGet;
const mockSet: jest.Mock = fsMock.__mockSet;
const mockUpdate: jest.Mock = fsMock.__mockUpdate;
const mockDelete: jest.Mock = fsMock.__mockDelete;
const subCol: any = fsMock.__subCol;

// ============================================================
// テストヘルパー
// ============================================================

function makeTimestamp(date: Date = new Date()) {
  return { toDate: () => date, seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 };
}

function makeSleepLogPartial(date = '2026-03-24'): any {
  return {
    date,
    bedTime: makeTimestamp(new Date('2026-03-24T00:00:00Z')),
    wakeTime: makeTimestamp(new Date('2026-03-24T07:00:00Z')),
    totalMinutes: 420,
    deepSleepMinutes: null,
    remMinutes: null,
    lightSleepMinutes: null,
    awakenings: null,
    heartRateAvg: null,
    sleepOnset: 'NORMAL' as const,
    wakeFeeling: 'NORMAL' as const,
    habits: [],
    memo: null,
    score: 75,
    sleepDebtMinutes: 0,
    source: 'MANUAL' as const,
    scoreVersion: 1,
  };
}

// ============================================================
// getSleepLog
// ============================================================

describe('getSleepLog', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ドキュメントが存在しない場合 null を返す', async () => {
    mockGet.mockResolvedValueOnce({ exists: () => false, data: () => null });
    const result = await getSleepLog('2026-03-24');
    expect(result).toBeNull();
  });

  it('ドキュメントが存在する場合データを返す', async () => {
    const log = makeSleepLogPartial();
    mockGet.mockResolvedValueOnce({ exists: () => true, data: () => log });
    const result = await getSleepLog('2026-03-24');
    expect(result).toEqual(log);
  });
});

// ============================================================
// saveSleepLog
// ============================================================

describe('saveSleepLog', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ドキュメントが存在しない場合 set を呼ぶ', async () => {
    mockGet.mockResolvedValueOnce({ exists: () => false });
    await saveSleepLog(makeSleepLogPartial());
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('ドキュメントが存在する場合 update を呼ぶ', async () => {
    mockGet.mockResolvedValueOnce({ exists: () => true });
    await saveSleepLog(makeSleepLogPartial());
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('新規保存時は createdAt と updatedAt が含まれる', async () => {
    mockGet.mockResolvedValueOnce({ exists: () => false });
    await saveSleepLog(makeSleepLogPartial());
    const arg = mockSet.mock.calls[0][0] as Record<string, unknown>;
    expect(arg).toHaveProperty('createdAt');
    expect(arg).toHaveProperty('updatedAt');
  });

  it('更新時は updatedAt が含まれる', async () => {
    mockGet.mockResolvedValueOnce({ exists: () => true });
    await saveSleepLog(makeSleepLogPartial());
    const arg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(arg).toHaveProperty('updatedAt');
  });
});

// ============================================================
// deleteSleepLog
// ============================================================

describe('deleteSleepLog', () => {
  beforeEach(() => jest.clearAllMocks());

  it('delete を1回呼ぶ', async () => {
    await deleteSleepLog('2026-03-24');
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// getRecentSleepLogs
// ============================================================

describe('getRecentSleepLogs', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ドキュメントが0件のとき空配列を返す', async () => {
    subCol.get.mockResolvedValueOnce({ docs: [], empty: true });
    const result = await getRecentSleepLogs(7);
    expect(result).toEqual([]);
  });

  it('ドキュメントがあるとき data() をマップして返す', async () => {
    const log = makeSleepLogPartial('2026-03-24');
    subCol.get.mockResolvedValueOnce({
      docs: [{ id: '2026-03-24', data: () => log }],
      empty: false,
    });
    const result = await getRecentSleepLogs(7);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-03-24');
  });
});

// ============================================================
// saveChatMessages / getChatMessages
// ============================================================

describe('saveChatMessages', () => {
  beforeEach(() => jest.clearAllMocks());

  it('50件を超えるメッセージは末尾50件に切り詰めて保存する', async () => {
    const messages = Array.from({ length: 55 }, (_, i) => ({
      role: 'user' as const,
      content: `msg${i}`,
      createdAt: makeTimestamp(),
    }));
    await saveChatMessages('chat-1', messages as any);
    const saved = mockSet.mock.calls[0][0] as { messages: any[] };
    expect(saved.messages).toHaveLength(50);
    // 末尾50件 = index 5〜54
    expect(saved.messages[0].content).toBe('msg5');
    expect(saved.messages[49].content).toBe('msg54');
  });

  it('50件以下のメッセージは全件保存する', async () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({
      role: 'assistant' as const,
      content: `msg${i}`,
      createdAt: makeTimestamp(),
    }));
    await saveChatMessages('chat-1', messages as any);
    const saved = mockSet.mock.calls[0][0] as { messages: any[] };
    expect(saved.messages).toHaveLength(10);
  });

  it('ちょうど50件は切り詰めなし', async () => {
    const messages = Array.from({ length: 50 }, (_, i) => ({
      role: 'user' as const,
      content: `msg${i}`,
      createdAt: makeTimestamp(),
    }));
    await saveChatMessages('chat-1', messages as any);
    const saved = mockSet.mock.calls[0][0] as { messages: any[] };
    expect(saved.messages).toHaveLength(50);
    expect(saved.messages[0].content).toBe('msg0');
  });
});

describe('getChatMessages', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ドキュメントが存在しない場合空配列を返す', async () => {
    mockGet.mockResolvedValueOnce({ exists: () => false, data: () => null });
    const result = await getChatMessages('chat-1');
    expect(result).toEqual([]);
  });

  it('ドキュメントが存在する場合メッセージ配列を返す', async () => {
    const msgs = [{ role: 'user', content: 'hello', createdAt: makeTimestamp() }];
    mockGet.mockResolvedValueOnce({ exists: () => true, data: () => ({ messages: msgs }) });
    const result = await getChatMessages('chat-1');
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('hello');
  });
});

// ============================================================
// getGoal
// ============================================================

describe('getGoal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ドキュメントが存在しない場合 null を返す', async () => {
    mockGet.mockResolvedValueOnce({ exists: () => false, data: () => null });
    const result = await getGoal();
    expect(result).toBeNull();
  });

  it('ドキュメントが存在する場合 UserGoal を返す', async () => {
    const goal = { targetHours: 7.5, targetScore: 80, bedTimeTarget: '23:00', updatedAt: null };
    mockGet.mockResolvedValueOnce({ exists: () => true, data: () => goal });
    const result = await getGoal();
    expect(result?.targetHours).toBe(7.5);
    expect(result?.bedTimeTarget).toBe('23:00');
  });
});

// ============================================================
// saveAiReport / getAiReport
// ============================================================

describe('saveAiReport / getAiReport', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saveAiReport は set を呼ぶ', async () => {
    const report = {
      type: 'weekly' as const,
      content: 'テストレポート内容',
      generatedAt: makeTimestamp(),
      inputSummary: '',
      modelUsed: 'claude-haiku-4-5',
      tokenCount: null,
    };
    await saveAiReport('2026-W12', report as any);
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet.mock.calls[0][0]).toMatchObject({ content: 'テストレポート内容' });
  });

  it('getAiReport はドキュメントが存在しない場合 null を返す', async () => {
    mockGet.mockResolvedValueOnce({ exists: () => false, data: () => null });
    const result = await getAiReport('2026-W12');
    expect(result).toBeNull();
  });

  it('getAiReport はドキュメントが存在する場合 AiReport を返す', async () => {
    const report = { type: 'weekly', content: 'report', generatedAt: makeTimestamp(), inputSummary: '', modelUsed: 'claude-haiku-4-5', tokenCount: 100 };
    mockGet.mockResolvedValueOnce({ exists: () => true, data: () => report });
    const result = await getAiReport('2026-W12');
    expect(result?.content).toBe('report');
  });
});
