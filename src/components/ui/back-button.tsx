import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { hitTarget } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';

interface BackButtonProps {
  icon?: Extract<IconName, 'back' | 'close'>;
  onPress?: () => void;
}

export function BackButton({ icon = 'back', onPress }: BackButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      accessibilityRole="button"
      accessibilityLabel={icon === 'close' ? 'Close' : 'Back'}
      hitSlop={8}
      style={styles.button}>
      <Icon name={icon} size={20} color={theme.text} weight="semibold" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: hitTarget, height: hitTarget, justifyContent: 'center', marginLeft: -10, paddingLeft: 10 },
});
