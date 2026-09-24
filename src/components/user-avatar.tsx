import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { fontFamily } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

import { Text } from './ui/text';

interface UserAvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number;
}

function initials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
}

export function UserAvatar({ uri, name, size = 40 }: UserAvatarProps) {
  const theme = useTheme();
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[shape, { backgroundColor: theme.skeleton }]}
        contentFit="cover"
        transition={150}
        recyclingKey={uri}
        accessibilityLabel={name ? `${name}'s profile photo` : 'Profile photo'}
      />
    );
  }

  return (
    <View
      style={[shape, styles.fallback, { backgroundColor: theme.accentSoft }]}
      accessibilityLabel={name ? `${name}'s profile photo` : 'Profile photo'}>
      <Text
        style={{ color: theme.accent, fontSize: size * 0.38, fontFamily: fontFamily.display }}
        allowFontScaling={false}>
        {initials(name).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
