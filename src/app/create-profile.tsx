import { useMutation, useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Platform, StyleSheet, View, type TextInput } from 'react-native';

import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Icon } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { UserAvatar } from '@/components/user-avatar';
import { fontFamily, radius, shadows, spacing } from '@/constants/tokens';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTheme } from '@/hooks/use-theme';
import { queryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { signOut } from '@/services/auth';
import { friendlyError } from '@/services/errors';
import { createProfile, isUsernameAvailable } from '@/services/profiles';
import { useAuth } from '@/store/auth';
import {
  BIO_MAX,
  DISPLAY_NAME_MAX,
  normalizeUsername,
  suggestUsername,
  validateDisplayName,
  validateUsername,
} from '@/utils/validation';

// The preview mirrors the Editorial card, whose colors are part of the design, not the app theme.
const CARD = { paper: '#F4EEE3', ink: '#1A1714', muted: '#6B645C', accent: '#8E1B1B' };

export default function CreateProfileScreen() {
  const theme = useTheme();
  const user = useAuth((s) => s.session?.user);
  const metadataName = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(metadataName);
  const [username, setUsername] = useState(() => suggestUsername(metadataName || user?.email || ''));
  const [bio, setBio] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const usernameRef = useRef<TextInput>(null);
  const bioRef = useRef<TextInput>(null);

  const debouncedUsername = useDebouncedValue(username, 350);
  const formatError = username ? validateUsername(username) : 'Pick a username.';
  const availability = useQuery({
    queryKey: queryKeys.usernameAvailable(debouncedUsername),
    queryFn: () => isUsernameAvailable(debouncedUsername),
    enabled: validateUsername(debouncedUsername) === null,
    staleTime: 30_000,
  });
  const checking = !formatError && (username !== debouncedUsername || availability.isFetching);
  const taken = !formatError && !checking && availability.data === false;
  const available = !formatError && !checking && availability.data === true;

  let usernameError: string | null = null;
  let usernameHint: string | null = null;
  if (formatError) {
    if (username || submitted) usernameError = formatError;
  } else if (checking) usernameHint = 'Checking…';
  else if (taken) usernameError = 'That username is taken.';
  else if (availability.isError) usernameHint = 'Couldn’t check availability right now.';
  else if (available) usernameHint = 'Available';

  const create = useMutation({
    mutationFn: () =>
      createProfile({ userId: user!.id, username, displayName, bio, avatarLocalUri: avatarUri }),
    onSuccess: (profile) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // The root guard sees the profile and moves to the app.
      queryClient.setQueryData(queryKeys.profile(profile.id), profile);
    },
    onError: (e) => {
      if (typeof e === 'object' && e && 'code' in e && e.code === '23505') {
        queryClient.invalidateQueries({ queryKey: queryKeys.usernameAvailable(username) });
        setFormError('Someone just claimed that username. Try another.');
      } else {
        setFormError(friendlyError(e, 'We couldn’t create your profile. Please try again.'));
      }
    },
  });

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
  };

  const onAvatarPress = () => {
    if (!avatarUri || Platform.OS !== 'ios') return void pickPhoto();
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Choose a different photo', 'Remove photo', 'Cancel'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
      (index) => {
        if (index === 0) pickPhoto();
        if (index === 1) setAvatarUri(null);
      },
    );
  };

  const submit = () => {
    setSubmitted(true);
    setFormError(null);
    if (validateDisplayName(displayName) || formatError || taken || checking) return;
    create.mutate();
  };

  const previewName = displayName.trim() || 'Your name';
  const previewHandle = `@${username || 'username'}`;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="display" accessibilityRole="header">
          Make it yours
        </Text>
        <Text variant="callout" color="textSecondary">
          This is how you’ll appear on every card you share.
        </Text>
      </View>

      <View style={[styles.card, shadows.card, { backgroundColor: CARD.paper }]}>
        <View style={styles.cardHeader}>
          <PressableScale
            onPress={onAvatarPress}
            accessibilityLabel={avatarUri ? 'Change profile photo' : 'Add a profile photo'}
            style={styles.avatarButton}>
            {avatarUri ? (
              <UserAvatar uri={avatarUri} name={previewName} size={64} />
            ) : (
              <View style={[styles.avatarEmpty, { borderColor: CARD.muted }]}>
                <Icon name="camera" size={22} color={CARD.muted} />
              </View>
            )}
          </PressableScale>
          <View style={styles.cardIdentity}>
            <Text numberOfLines={1} style={[styles.cardName, { color: CARD.ink }]}>
              {previewName}
            </Text>
            <Text numberOfLines={1} style={[styles.cardHandle, { color: CARD.muted }]}>
              {previewHandle}
            </Text>
          </View>
        </View>
        <Text allowFontScaling={false} style={[styles.cardQuote, { color: CARD.accent }]}>
          {bio.trim() || 'Your words, beautifully yours.'}
        </Text>
      </View>
      {!avatarUri && (
        <Text variant="caption" color="textTertiary" align="center" style={styles.photoHint}>
          Tap the circle to add a photo
        </Text>
      )}

      <View style={styles.form}>
        <TextField
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="How your name appears"
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => usernameRef.current?.focus()}
          error={submitted ? validateDisplayName(displayName) : null}
        />
        <TextField
          ref={usernameRef}
          label="Username"
          prefix="@"
          value={username}
          onChangeText={(t) => setUsername(normalizeUsername(t))}
          placeholder="yourname"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => bioRef.current?.focus()}
          error={usernameError}
          hint={usernameHint}
          trailing={
            checking ? (
              <ActivityIndicator size="small" color={theme.textTertiary} />
            ) : available ? (
              <Icon name="check.circle" size={20} color={theme.success} />
            ) : null
          }
        />
        <TextField
          ref={bioRef}
          label="Bio (optional)"
          value={bio}
          onChangeText={setBio}
          placeholder="A line about you"
          maxLength={BIO_MAX}
          multiline
          hint={`${bio.length}/${BIO_MAX}`}
          style={styles.bio}
        />
        <FormError message={formError} />
        <Button label="Continue" onPress={submit} loading={create.isPending} />
        <Button label="Use a different account" variant="ghost" size="md" onPress={() => signOut().catch(() => {})} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.lg },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarButton: { borderRadius: radius.pill },
  avatarEmpty: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIdentity: { flex: 1, gap: 2 },
  cardName: { fontSize: 18, fontWeight: '700' },
  cardHandle: { fontSize: 15 },
  cardQuote: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 30, textAlign: 'center' },
  photoHint: { marginTop: spacing.sm },
  form: { gap: spacing.md, marginTop: spacing.xl, paddingBottom: spacing.lg },
  bio: { minHeight: 72, textAlignVertical: 'top' },
});
