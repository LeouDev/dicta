import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ProfileHeader } from '@/components/profile-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { hitTarget } from '@/constants/tokens';
import { useMyProfile } from '@/hooks/use-my-profile';
import { useTheme } from '@/hooks/use-theme';
import { signOut } from '@/services/auth';
import { friendlyError } from '@/services/errors';

export default function ProfileScreen() {
  const theme = useTheme();
  const { data: profile } = useMyProfile();

  const confirmSignOut = () =>
    Alert.alert('Sign out of Dicta?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => signOut().catch((e) => Alert.alert('Couldn’t sign out', friendlyError(e))),
      },
    ]);

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title=""
        right={
          <Pressable onPress={confirmSignOut} accessibilityRole="button" accessibilityLabel="Settings" style={styles.iconButton}>
            <Icon name="settings" size={22} color={theme.text} />
          </Pressable>
        }
      />
      {profile && <ProfileHeader profile={profile} />}
      <View style={styles.gallery}>
        <EmptyState
          title="Your gallery is empty"
          message="Every card you publish lands here."
          actionLabel="Create your first card"
          onAction={() => router.push('/create')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: hitTarget, height: hitTarget, alignItems: 'flex-end', justifyContent: 'center' },
  gallery: { flex: 1 },
});
