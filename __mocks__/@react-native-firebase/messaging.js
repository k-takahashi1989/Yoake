const mockMessaging = () => ({
  requestPermission: jest.fn().mockResolvedValue(1),
  getToken: jest.fn().mockResolvedValue('mock-token'),
  onMessage: jest.fn(() => jest.fn()),
});

module.exports = mockMessaging;
module.exports.default = mockMessaging;
