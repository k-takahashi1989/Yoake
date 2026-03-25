module.exports = {
  getUniqueId: jest.fn().mockResolvedValue('mock-device-id'),
  getDeviceId: jest.fn().mockReturnValue('mock-device-id'),
};
