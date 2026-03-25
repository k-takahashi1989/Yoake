const mockCrashlytics = () => ({
  recordError: jest.fn(),
  log: jest.fn(),
  setUserId: jest.fn(),
});

module.exports = mockCrashlytics;
module.exports.default = mockCrashlytics;
