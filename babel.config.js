module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      '@babel/plugin-transform-flow-strip-types',
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-transform-class-properties', { loose: true }],
      ['module:react-native-dotenv', { moduleName: '@env', path: '.env' }],
      'react-native-reanimated/plugin',
    ],
  };
}; 