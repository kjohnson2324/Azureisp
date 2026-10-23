// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle map glyph PBFs as raw assets (svg, otf and ttf are already defaults).
config.resolver.assetExts.push('pbf');

module.exports = config;
