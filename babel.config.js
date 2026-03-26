module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // react-native-reanimated のプラグインは必ず plugins の最後に記述する
    'react-native-reanimated/plugin',
  ],
};
