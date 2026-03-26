// react-native-svg の Jest モック
// SvgXml など SVG コンポーネントを View に置き換えてテストを通す
const React = require('react');
const { View } = require('react-native');

const mockComponent = (displayName) => {
  const Component = (props) => React.createElement(View, props);
  Component.displayName = displayName;
  return Component;
};

module.exports = {
  default: mockComponent('Svg'),
  Svg: mockComponent('Svg'),
  SvgXml: mockComponent('SvgXml'),
  Circle: mockComponent('Circle'),
  Path: mockComponent('Path'),
  G: mockComponent('G'),
  Rect: mockComponent('Rect'),
  Text: mockComponent('Text'),
  Line: mockComponent('Line'),
  Polyline: mockComponent('Polyline'),
  Polygon: mockComponent('Polygon'),
  Ellipse: mockComponent('Ellipse'),
  Defs: mockComponent('Defs'),
  ClipPath: mockComponent('ClipPath'),
  Use: mockComponent('Use'),
  Symbol: mockComponent('Symbol'),
  LinearGradient: mockComponent('LinearGradient'),
  RadialGradient: mockComponent('RadialGradient'),
  Stop: mockComponent('Stop'),
  Mask: mockComponent('Mask'),
};
