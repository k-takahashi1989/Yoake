const Timestamp = {
  fromDate: (date) => ({
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  }),
  now: () => ({
    toDate: () => new Date(),
    seconds: Math.floor(Date.now() / 1000),
    nanoseconds: 0,
  }),
};

const FieldValue = {
  serverTimestamp: () => ({ _serverTimestamp: true }),
  arrayUnion: (...items) => ({ _arrayUnion: items }),
  arrayRemove: (...items) => ({ _arrayRemove: items }),
  increment: (n) => ({ _increment: n }),
};

const mockFirestore = () => ({
  collection: () => ({
    doc: () => ({
      get: jest.fn().mockResolvedValue({ exists: () => false, data: () => null }),
      set: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      onSnapshot: jest.fn(),
      collection: () => ({
        doc: jest.fn(),
        get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      }),
    }),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
  }),
  batch: () => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  }),
});

mockFirestore.Timestamp = Timestamp;
mockFirestore.FieldValue = FieldValue;

module.exports = mockFirestore;
module.exports.default = mockFirestore;
