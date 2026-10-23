import { Text, type TextProps } from 'react-native';

import { useAppTheme } from '@/a11y/PreferencesContext';

type Variant = 'title' | 'heading' | 'body' | 'caption';

const SIZE: Record<Variant, number> = { title: 26, heading: 18, body: 16, caption: 14 };

/** Text that follows the student's font (dyslexia option) and text-size preferences. */
export function AppText({ variant = 'body', muted, style, ...rest }: TextProps & { variant?: Variant; muted?: boolean }) {
  const { colors, font, scale } = useAppTheme();
  const bold = variant === 'title' || variant === 'heading';
  const size = SIZE[variant] * scale;
  return (
    <Text
      maxFontSizeMultiplier={2}
      style={[{ fontFamily: bold ? font.bold : font.regular, fontSize: size, lineHeight: size * 1.4, color: muted ? colors.textMuted : colors.text }, style]}
      {...rest}
    />
  );
}
