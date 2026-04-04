module.exports = {
  project: {
    android: {},
    ios: {},
  },
  assets: ['./android/app/src/main/assets/fonts/'],
  dependencies: {
    // EAS Build の設定にのみ使用するため、ネイティブモジュールのリンクは不要
    expo: {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};
