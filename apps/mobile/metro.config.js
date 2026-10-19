// Expo's default Metro config understands pnpm workspaces (SDK 52+).
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
