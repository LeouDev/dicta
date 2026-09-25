import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type TextInput } from 'react-native';

import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Icon } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { UserAvatar } from '@/components/user-avatar';
import { fontFamily, radius, shadows, spacing } from '@/constants/tokens';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTheme } from '@/hooks/use-theme';
import { showActions } from '@/lib/action-sheet';
import { queryKeys } from '@/lib/query-keys';
import { isUsernameAvailable } from '@/services/profiles';
import { BIO_MAX, DISPLAY_NAME_MAX, normalizeUsername, validateDisplayName, validateUsername } from '@/utils/validation';

// The preview mirrors the Editorial card, whose colors are part of the design, not the app theme.
const CARD = { paper: '#F4EEE3', ink: '#1A1714', muted: '#6B645C', accent: '#8E1B1B' };

export interface ProfileFormValues {
  displayName: string;
  username: string;
  bio: string;
  /** New local photo, `null` to remove, undefined to keep the current one. */
  avatar: string | null | undefined;
}

interface ProfileFormProps {
  initial: { displayName: string; username: string; bio: string; avatarUrl: string | null };
  /** Editing: your current handle counts as available. */
  currentUsername?: string;
  submitLabel: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: ProfileFormValues) => void;
  footer?: ReactNode;
}

/** Profile photo, display name, unique username (checked live) and bio, with a card preview. */
export function ProfileForm({ initial, currentUsername, submitLabel, submitting, error, onSubmit, footer }: ProfileFormProps) {
  const theme = useTheme();
  const [avatar, setAvatar] = useState<string | null | undefined>(undefined);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [username, setUsername] = useState(initial.username);
  const [bio, setBio] = useState(initial.bio);
  const [submitted, setSubmitted] = useState(false);
  const usernameRef = useRef<TextInput>(null);
  const bioRef = useRef<TextInput>(null);

  const shownAvatar = avatar === undefined ? initial.avatarUrl : avatar;
  const unchangedHandle = currentUsername !== undefined && username === currentUsername;
  const debouncedUsername = useDebouncedValue(username, 350);
  const formatError = username ? validateUsername(username) : 'Pick a username.';
  const availability = useQuery({
    queryKey: queryKeys.usernameAvailable(debouncedUsername),
    queryFn: () => isUsernameAvailable(debouncedUsername),
    enabled: !unchangedHandle && validateUsername(debouncedUsername) === null,
    staleTime: 30_000,
  });
  const checking = !formatError && !unchangedHandle && (username !== debouncedUsername || availability.isFetching);
  const taken = !formatError && !unchangedHandle && !checking && availability.data === false;
  const available = !formatError && (unchangedHandle || (!checking && availability.data === true));

  let usernameError: string | null = null;
  let usernameHint: string | null = null;
  if (formatError) {
    if (username || submitted) usernameError = formatError;
  } else if (unchangedHandle) usernameHint = null;
  else if (checking) usernameHint = 'Checking…';
  else if (taken) usernameError = 'That username is taken.';
  else if (availability.isError) usernameHint = 'Couldn’t check availability right now.';
  else if (available) usernameHint = 'Available';

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (!result.canceled && result.assets[0]) setAvatar(result.assets[0].uri);
  };

  const onAvatarPress = () => {
    if (!shownAvatar) return void pickPhoto();
    showActions([
      { label: 'Choose a different photo', onPress: pickPhoto },
      { label: 'Remove photo', destructive: true, onPress: () => setAvatar(null) },
    ]);
  };

  const submit = () => {
    setSubmitted(true);
    if (validateDisplayName(displayName) || formatError || taken || checking) return;
    onSubmit({ displayName, username, bio, avatar });
  };

  const previewName = displayName.trim() || 'Your name';

  return (
    <>
      <View style={[styles.card, shadows.card, { backgroundColor: CARD.paper }]}>
        <View style={styles.cardHeader}>
          <PressableScale
            onPress={onAvatarPress}
            accessibilityLabel={shownAvatar ? 'Change profile photo' : 'Add a profile photo'}
            style={styles.avatarButton}>
            {shownAvatar ? (
              <UserAvatar uri={shownAvatar} name={previewName} size={64} />
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
              @{username || 'username'}
            </Text>
          </View>
        </View>
        <Text allowFontScaling={false} style={[styles.cardQuote, { color: CARD.accent }]}>
          {bio.trim() || 'Your words, beautifully yours.'}
        </Text>
      </View>
      {!shownAvatar && (
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
            ) : available && !unchangedHandle ? (
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
        <FormError message={error} />
        <Button label={submitLabel} onPress={submit} loading={submitting} />
        {footer}
      </View>
    </>
  );
}

/** Postgres unique violation on the username. */
export const isUsernameTaken = (e: unknown) => typeof e === 'object' && e !== null && 'code' in e && e.code === '23505';

const styles = StyleSheet.create({
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
