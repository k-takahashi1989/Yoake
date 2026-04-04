const authState = {
  currentUser: null,
  handler: null,
};

const signInAnonymously = jest.fn().mockImplementation(async () => {
  authState.currentUser = { uid: 'test-uid', isAnonymous: true };
  return { user: authState.currentUser };
});

const signInWithEmailAndPassword = jest.fn().mockImplementation(async email => {
  authState.currentUser = { uid: 'linked-uid', email, isAnonymous: false };
  return { user: authState.currentUser };
});

const signOut = jest.fn().mockImplementation(async () => {
  authState.currentUser = null;
});

const mockAuth = jest.fn(() => ({
  currentUser: authState.currentUser,
  onAuthStateChanged: jest.fn(cb => {
    authState.handler = cb;
    cb(authState.currentUser);
    return jest.fn();
  }),
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
}));

mockAuth.EmailAuthProvider = {
  credential: jest.fn((email, password) => ({ email, password })),
};

mockAuth.__setCurrentUser = user => {
  authState.currentUser = user;
};

mockAuth.__getCurrentUser = () => authState.currentUser;

mockAuth.__emitAuthState = user => {
  authState.currentUser = user;
  authState.handler?.(user);
};

mockAuth.__reset = () => {
  authState.currentUser = null;
  authState.handler = null;
  signInAnonymously.mockClear();
  signInWithEmailAndPassword.mockClear();
  signOut.mockClear();
  mockAuth.EmailAuthProvider.credential.mockClear();
};

module.exports = mockAuth;
module.exports.default = mockAuth;
