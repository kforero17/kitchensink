// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Ensure proper resolution of dependencies
config.resolver = {
  ...config.resolver,
  sourceExts: ['jsx', 'js', 'ts', 'tsx', 'json'],
  assetExts: [...config.resolver.assetExts, 'ttf', 'otf', 'png', 'jpg', 'jpeg', 'gif', 'wav', 'mp3']
};

// Make port configurable via environment variable
config.server = {
  port: process.env.METRO_PORT || 8081,
  host: '0.0.0.0'  // Allow external connections
};

// Enable network inspection for debugging
config.experimental = {
  ...config.experimental,
  networkInspector: true
};

// Only watch the app's own node_modules
config.watchFolders = [
  ...config.watchFolders || [],
  path.resolve(__dirname, 'node_modules')
];

module.exports = config; 