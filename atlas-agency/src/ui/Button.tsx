import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { AppText } from './AppText';
import { useAppTheme } from '@/a11y/PreferencesContext';
import { layout } from '@/theme/tokens';

interface Props extends Omit<PressableProps, 'children'> {
  label: string;
  icon?: string;
  kind?: 'primary' | 'secondary';
  selected?: boolean;
}

/** 48pt minimum target, visible pressed state, and the label doubles as the accessible name. */
export function Button({ label, icon, kind = 'secondary', selected, style, ...rest }: Props) {
  const { colors, dark, font } = useAppTheme();
  // White on #0072B2 is 5.1:1 (light); dark mode's #56B4E9 needs dark text (7.9:1).
  const onAccent = dark ? '#11132A' : '#FFFFFF';
  const primary = kind === 'primary' || selected;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected, disabled: !!rest.disabled }}
      hitSlop={4}
      style={(state) => [
        styles.base,
        { borderColor: colors.text, backgroundColor: primary ? colors.accent : colors.surface, opacity: state.pressed ? 0.7 : 1 },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      <AppText variant="body" style={{ color: primary ? onAccent : colors.text, fontFamily: font.bold }}>
        {icon ? `${icon}  ${label}` : label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTouchTarget,
    minWidth: layout.minTouchTarget,
    paddingHorizontal: layout.space(4),
    borderRadius: layout.radius,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
