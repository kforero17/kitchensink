module.exports = {
  name: 'KitchenHelper',
  slug: 'kitchen-helper',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff'
  },
  assetBundlePatterns: [
    '**/*'
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.kitchenhelper.app'
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff'
    },
    package: 'com.kitchenhelper.app'
  },
  plugins: [
    'expo-dev-client'
  ],
  extra: {
    spoonacularApiKey: process.env.SPOONACULAR_API_KEY
  },
  newArchEnabled: false
}; 