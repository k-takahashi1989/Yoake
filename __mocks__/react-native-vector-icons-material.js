const React = require('react');
const { Text } = require('react-native');

function MaterialCommunityIcons({ name, size, color, style }) {
  return React.createElement(
    Text,
    {
      style,
      accessibilityRole: 'image',
    },
    `${name}:${size ?? ''}:${color ?? ''}`
  );
}

module.exports = MaterialCommunityIcons;
module.exports.default = MaterialCommunityIcons;
