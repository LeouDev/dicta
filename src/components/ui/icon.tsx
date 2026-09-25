import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';

/**
 * Semantic icon names → SF Symbols (iOS) and Material Symbols (Android/web),
 * so screens never hard-code platform icon names.
 */
const ICONS = {
  home: { ios: 'house', android: 'home' },
  'home.fill': { ios: 'house.fill', android: 'home' },
  discover: { ios: 'safari', android: 'explore' },
  'discover.fill': { ios: 'safari.fill', android: 'explore' },
  activity: { ios: 'heart', android: 'favorite' },
  'activity.fill': { ios: 'heart.fill', android: 'favorite' },
  profile: { ios: 'person.crop.circle', android: 'account_circle' },
  'profile.fill': { ios: 'person.crop.circle.fill', android: 'account_circle' },
  plus: { ios: 'plus', android: 'add' },
  close: { ios: 'xmark', android: 'close' },
  back: { ios: 'chevron.left', android: 'arrow_back' },
  camera: { ios: 'camera.fill', android: 'photo_camera' },
  check: { ios: 'checkmark', android: 'check' },
  'check.circle': { ios: 'checkmark.circle.fill', android: 'check_circle' },
  warning: { ios: 'exclamationmark.circle.fill', android: 'error' },
  mail: { ios: 'envelope', android: 'mail' },
  settings: { ios: 'gearshape', android: 'settings' },
  verified: { ios: 'checkmark.seal.fill', android: 'verified' },
  signout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout' },
  pencil: { ios: 'pencil.line', android: 'edit' },
  share: { ios: 'square.and.arrow.up', android: 'ios_share' },
  photo: { ios: 'photo', android: 'image' },
  eyedropper: { ios: 'eyedropper', android: 'colorize' },
  'chevron.down': { ios: 'chevron.down', android: 'expand_more' },
  'chevron.right': { ios: 'chevron.right', android: 'chevron_right' },
  'align.left': { ios: 'text.alignleft', android: 'format_align_left' },
  'align.center': { ios: 'text.aligncenter', android: 'format_align_center' },
  'align.right': { ios: 'text.alignright', android: 'format_align_right' },
  'position.top': { ios: 'align.vertical.top', android: 'vertical_align_top' },
  'position.center': { ios: 'align.vertical.center', android: 'vertical_align_center' },
  'position.bottom': { ios: 'align.vertical.bottom', android: 'vertical_align_bottom' },
} as const satisfies Record<string, { ios: string; android: string }>;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color: ColorValue;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
}

export function Icon({ name, size = 22, color, weight = 'regular' }: IconProps) {
  const { ios, android } = ICONS[name];
  return (
    <SymbolView
      name={{ ios, android, web: android } as SymbolViewProps['name']}
      size={size}
      tintColor={color}
      weight={weight}
      resizeMode="scaleAspectFit"
      style={{ width: size, height: size }}
    />
  );
}
