const mockAuth = () => ({
  currentUser: null,
  onAuthStateChanged: jest.fn((cb) => { cb(null); return jest.fn(); }),
  signInAnonymously: jest.fn().mockResolvedValue({ user: { uid: 'test-uid' } }),
  signOut: jest.fn().mockResolvedValue(undefined),
});

module.exports = mockAuth;
module.exports.default = mockAuth;
