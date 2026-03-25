const mockFunctions = () => ({
  httpsCallable: jest.fn(() => jest.fn().mockResolvedValue({ data: {} })),
});

module.exports = mockFunctions;
module.exports.default = mockFunctions;
