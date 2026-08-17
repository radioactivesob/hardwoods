import React, { forwardRef } from 'react';
import {
  Text as RNText, TextInput as RNTextInput,
  TextProps, TextInputProps,
} from 'react-native';

// iOS Dynamic Type scales text up to ~3x at the largest accessibility
// sizes. This app is deliberately dense — scoreboards, stat grids, box
// score tables — and none of that survives 3x. Capping the multiplier
// keeps large-text users supported without shattering the layout.
//
// Screens that genuinely can't grow (big score numerals, tight table
// cells) pass a smaller cap or numberOfLines themselves.
export const MAX_FONT_SCALE = 1.3;

// Navigation chrome is fixed-height and packed — it scales less than
// content, the same tradeoff Apple's own nav bars make.
export const HEADER_FONT_SCALE = 1.1;

export const Text = forwardRef<RNText, TextProps>((props, ref) => (
  <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} ref={ref} />
));
Text.displayName = 'Text';

export const TextInput = forwardRef<RNTextInput, TextInputProps>((props, ref) => (
  <RNTextInput maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} ref={ref} />
));
TextInput.displayName = 'TextInput';
