module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-community|@react-navigation|react-native-safe-area-context|react-native-screens|react-native-vector-icons|react-native-gifted-charts|gifted-charts-core|react-native-linear-gradient|react-native-svg|react-native-iap|@notifee|react-native-health-connect|react-native-device-info|react-native-nitro-modules|react-native-reanimated)/)',
  ],
  moduleNameMapper: {
    '@react-native-firebase/firestore': '<rootDir>/__mocks__/@react-native-firebase/firestore.js',
    '@react-native-firebase/auth': '<rootDir>/__mocks__/@react-native-firebase/auth.js',
    '@react-native-firebase/messaging': '<rootDir>/__mocks__/@react-native-firebase/messaging.js',
    '@react-native-firebase/crashlytics': '<rootDir>/__mocks__/@react-native-firebase/crashlytics.js',
    '@react-native-firebase/functions': '<rootDir>/__mocks__/@react-native-firebase/functions.js',
    'react-native-device-info': '<rootDir>/__mocks__/react-native-device-info.js',
    '@react-native-async-storage/async-storage': '<rootDir>/__mocks__/@react-native-async-storage/async-storage.js',
    '@notifee/react-native': '<rootDir>/__mocks__/@notifee/react-native.js',
    'react-native-iap': '<rootDir>/__mocks__/react-native-iap.js',
    'react-i18next': '<rootDir>/__mocks__/react-i18next.js',
    'react-native-reanimated': '<rootDir>/__mocks__/react-native-reanimated.js',
    'react-native-svg': '<rootDir>/__mocks__/react-native-svg.js',
  },
};
