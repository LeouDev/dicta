import { Switch as NativeSwitch, type SwitchProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * The app's switch: the accent track, centered in its row. React Native's iOS
 * Switch sets alignSelf: 'flex-start', which pins it to the top of a row that
 * centers its items.
 */
export function Switch({ style, ...props }: SwitchProps) {
  const theme = useTheme();
  return <NativeSwitch trackColor={{ true: theme.accent }} {...props} style={[styles.center, style]} />;
}

const styles = { center: { alignSelf: 'center' } } as const;
